use tauri::{ipc::Channel, Emitter, Manager, State};

use std::fs;
use std::path::PathBuf;

use crate::audio::capture::{AudioCapture, AudioDeviceInfo};
use crate::audio::resample::resample_to_16khz;
use crate::audio::{AudioEvent, TranscriptionResult};
use crate::TranscriptionEngine;
use crate::AppState;

use super::CommandError;

/// Validate that recording can be started (model loaded, not already recording).
pub fn validate_can_start_recording(state: &AppState) -> Result<(), CommandError> {
    let engine = state
        .engine
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if engine.is_none() {
        return Err(CommandError::new(
            "NoModelSelected",
            "No active transcription model loaded. Please select and download a model first.",
        ));
    }
    drop(engine);

    let recording = state
        .recording_active
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if *recording {
        return Err(CommandError::new(
            "AlreadyRecording",
            "A recording session is already active.",
        ));
    }

    Ok(())
}

/// Validate that recording can be stopped (currently recording).
pub fn validate_can_stop_recording(state: &AppState) -> Result<(), CommandError> {
    let recording = state
        .recording_active
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if !*recording {
        return Err(CommandError::new(
            "NotRecording",
            "No active recording session.",
        ));
    }
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn start_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    on_event: Channel<AudioEvent>,
) -> Result<String, CommandError> {
    eprintln!("[start_recording] Command invoked");
    if let Err(e) = validate_can_start_recording(&state) {
        eprintln!("[start_recording] Validation failed: {} - {}", e.code, e.message);
        return Err(e);
    }
    eprintln!("[start_recording] Validation passed");

    let session_id = uuid::Uuid::new_v4().to_string();

    // Create amplitude callback that sends events to the frontend
    let event_channel = on_event.clone();
    let app_clone = app.clone();
    let amplitude_callback = Box::new(move |amplitudes: Vec<f32>, rms: f32| {
        let _ = event_channel.send(AudioEvent::AmplitudeUpdate {
            amplitudes: amplitudes.clone(),
            rms,
        });
        // Also emit to all windows so the overlay can show amplitude visualization
        let _ = app_clone.emit(
            "amplitude-update",
            AudioEvent::AmplitudeUpdate { amplitudes, rms },
        );
    });

    // Read selected device from preferences
    let device_name = {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.selected_audio_device.clone()
    };

    // Start audio capture
    eprintln!("[start_recording] Starting audio capture...");
    let capture = AudioCapture::start(amplitude_callback, device_name.as_deref())
        .map_err(|e| {
            eprintln!("[start_recording] Audio capture failed: {}", e);
            CommandError::new("MicrophoneUnavailable", e)
        })?;
    eprintln!("[start_recording] Audio capture started");

    // Store capture handle in state
    {
        let mut active = state
            .active_capture
            .lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *active = Some(capture);
    }

    // Mark recording as active
    {
        let mut recording = state
            .recording_active
            .write()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *recording = true;
    }

    // Check if streaming transcription is enabled
    let enable_streaming = {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.enable_streaming_transcription
    };

    // Spawn streaming transcription task if enabled
    if enable_streaming {
        let app_for_streaming = app.clone();
        
        tauri::async_runtime::spawn(async move {
            // Minimum audio for transcription: ~1.5 seconds at 16kHz = 24000 samples
            const MIN_SAMPLES_16KHZ: usize = 24000;
            
            loop {
                // Wait 1.5 seconds between streaming transcriptions
                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                
                // Get state from app handle
                let state = app_for_streaming.state::<AppState>();
                
                // Check if still recording
                let recording_guard = match state.recording_active.read() {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                let still_recording = *recording_guard;
                drop(recording_guard);
                if !still_recording {
                    break;
                }
                
                // Get audio snapshot and sample rate
                let capture_guard = match state.active_capture.lock() {
                    Ok(guard) => guard,
                    Err(_) => continue,
                };
                
                let capture_ref: &Option<AudioCapture> = &*capture_guard;
                let capture = match capture_ref {
                    Some(c) => c,
                    None => continue,
                };
                
                let audio_chunk: Vec<f32> = capture.get_buffer_snapshot();
                let sample_rate = capture.sample_rate();
                drop(capture_guard);
                
                // Need enough audio (at least 1.5 seconds)
                let min_samples = (sample_rate as f32 * 1.5) as usize;
                if audio_chunk.len() < min_samples {
                    continue;
                }
                
                // Apply gain
                let input_gain = state.preferences.read()
                    .map(|p| p.input_gain.clamp(0.1, 4.0))
                    .unwrap_or(1.0);
                let audio_with_gain: Vec<f32> = audio_chunk
                    .iter()
                    .map(|&s| (s * input_gain).clamp(-1.0, 1.0))
                    .collect();
                
                // Resample to 16kHz
                let audio_16khz = match resample_to_16khz(&audio_with_gain, sample_rate) {
                    Ok(a) => a,
                    Err(_) => continue,
                };
                
                if audio_16khz.len() < MIN_SAMPLES_16KHZ {
                    continue;
                }
                
                // Transcribe
                let engine_guard = match state.engine.read() {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                
                let engine_opt: &Option<Box<dyn TranscriptionEngine>> = &*engine_guard;
                let text = match engine_opt {
                    Some(engine) => engine.transcribe(&audio_16khz).ok(),
                    None => None,
                };
                drop(engine_guard);
                
                // Emit streaming result
                if let Some(text) = text {
                    if !text.trim().is_empty() {
                        let _ = app_for_streaming.emit(
                            "streaming-transcription",
                            AudioEvent::StreamingTranscription {
                                text: text.clone(),
                                is_final: false,
                            },
                        );
                        eprintln!("[streaming] Partial: {}", text);
                    }
                }
            }
        });
    }

    // Write crash-recovery marker
    let _ = write_recording_marker(&state.app_data_dir);

    // Record the start time for duration tracking
    {
        let mut started_at = state.recording_started_at.lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *started_at = Some(std::time::Instant::now());
    }

    eprintln!("[start_recording] Recording active, session: {}", session_id);

    let _ = on_event.send(AudioEvent::RecordingStarted);
    // Emit to all windows so the overlay can show the recording indicator
    let _ = app.emit("recording-started", ());
    let _ = app.emit("overlay-state", OverlayStatePayload { state: "recording".to_string(), message: None });
    crate::update_tray_recording_state(&app, true);

    // Show the overlay window (unless mode is None)
    {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        let show_overlay = !matches!(prefs.overlay_mode, crate::preferences::OverlayMode::None);
        drop(prefs);
        if show_overlay {
            if let Some(overlay) = app.get_webview_window("recording-overlay") {
                let _ = overlay.show();
                eprintln!("[start_recording] Overlay window shown");
            }
        }
    }

    // Register Escape shortcut for cancel
    {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let _ = app.global_shortcut().register("Escape");
    }

    Ok(session_id)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn stop_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    on_event: Channel<AudioEvent>,
) -> Result<TranscriptionResult, CommandError> {
    validate_can_stop_recording(&state)?;

    let _ = app.emit("overlay-state", OverlayStatePayload { state: "transcribing".to_string(), message: None });

    // Stop capture and get audio buffer
    let (audio_buffer, sample_rate) = {
        let mut active = state
            .active_capture
            .lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        let capture = active
            .take()
            .ok_or_else(|| CommandError::new("NotRecording", "No active capture found."))?;
        capture.stop()
    };

    // Mark recording as stopped and capture duration
    let recording_duration_ms = {
        let mut started_at = state.recording_started_at.lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        started_at.take().map(|t| t.elapsed().as_millis() as u64).unwrap_or(0)
    };

    {
        let mut recording = state
            .recording_active
            .write()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *recording = false;
    }

    // Remove crash-recovery marker now that capture is stopped
    let _ = remove_recording_marker(&state.app_data_dir);

    let _ = on_event.send(AudioEvent::RecordingStopped);
    let _ = app.emit("recording-stopped", ());
    crate::update_tray_recording_state(&app, false);

    // Unregister Escape shortcut
    {
        use tauri_plugin_global_shortcut::GlobalShortcutExt;
        let _ = app.global_shortcut().unregister("Escape");
    }

    let _ = on_event.send(AudioEvent::TranscriptionStarted);

    let start_time = std::time::Instant::now();

    // Get input gain from preferences and apply to audio buffer
    let input_gain = {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.input_gain.clamp(0.1, 4.0)  // Allow 10% to 400% gain
    };
    
    // Apply gain to audio buffer
    let audio_buffer: Vec<f32> = audio_buffer
        .iter()
        .map(|&sample| (sample * input_gain).clamp(-1.0, 1.0))
        .collect();

    // Resample to 16kHz for transcription engine
    let audio_16khz = resample_to_16khz(&audio_buffer, sample_rate)
        .map_err(|e| CommandError::new("TranscriptionFailed", format!("Resampling failed: {}", e)))?;

    // Generate session ID before saving audio so we can use it as filename
    let session_id = uuid::Uuid::new_v4().to_string();

    // Save audio as WAV for history playback
    let audio_file_name = crate::history::save_audio_wav(
        &state.app_data_dir, &session_id, &audio_16khz, 16000,
    ).ok();

    // Transcribe
    let text = {
        let engine = state
            .engine
            .read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        let engine = engine
            .as_ref()
            .ok_or_else(|| CommandError::new("NoModelSelected", "No model loaded."))?;
        engine
            .transcribe(&audio_16khz)
            .map_err(|e| CommandError::new("TranscriptionFailed", e))?
    };

    let duration_ms = start_time.elapsed().as_millis() as u64;

    let _ = on_event.send(AudioEvent::TranscriptionCompleted {
        text: text.clone(),
    });
    let _ = app.emit("transcription-completed", ());

    // Save to history
    {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        let entry = crate::history::HistoryEntry {
            id: session_id.clone(),
            created_at: chrono::Utc::now().to_rfc3339(),
            text: text.clone(),
            model_id: prefs.active_model_id.clone().unwrap_or_default(),
            recording_duration_ms,
            transcription_duration_ms: duration_ms,
            audio_device: prefs.selected_audio_device.clone(),
            audio_file_name: audio_file_name.clone(),
        };
        drop(prefs);
        let _ = crate::history::add_entry(&state.app_data_dir, &entry);
    }

    // Hide the overlay window
    if let Some(overlay) = app.get_webview_window("recording-overlay") {
        let _ = overlay.hide();
        eprintln!("[stop_recording] Overlay window hidden");
    }

    let prefs = state
        .preferences
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;

    // Apply formatting options
    let mut final_text = apply_formatting(&text, &prefs.formatting_options);
    
    // Sort macros by length of trigger descending to match longest first
    let mut active_macros = prefs.voice_macros.iter()
        .filter(|m| m.enabled)
        .collect::<Vec<_>>();
    active_macros.sort_by(|a, b| b.trigger.len().cmp(&a.trigger.len()));

    let trimmed_text = final_text.trim().to_lowercase();
    
    for m in active_macros {
        let trigger = m.trigger.trim().to_lowercase();
        // Check if the text exactly matches or ends with the trigger
        if trimmed_text == trigger || trimmed_text.ends_with(&format!(" {}", trigger)) {
            eprintln!("[stop_recording] Macro trigger matched: {}", m.trigger);
            
            // Execute macro action
            use crate::preferences::MacroAction;
            match &m.action {
                MacroAction::TypeText(val) => {
                    // Replace trigger with replacement text
                    if trimmed_text == trigger {
                        final_text = val.clone();
                    } else {
                        // Replace last occurrence of trigger
                        let last_space = final_text.trim_end().rfind(' ').unwrap_or(0);
                        final_text = format!("{}{}", &final_text[..last_space + 1], val);
                    }
                }
                MacroAction::PressKey(key) => {
                    // Remove trigger from text and press the key instead
                    if trimmed_text == trigger {
                        final_text = "".to_string();
                    } else {
                        let last_space = final_text.trim_end().rfind(' ').unwrap_or(0);
                        final_text = final_text[..last_space].to_string();
                    }
                    let _ = crate::injection::keyboard::press_key_via_keyboard(key.as_str());
                }
                MacroAction::DeleteBack => {
                    if trimmed_text == trigger {
                        final_text = "".to_string();
                    } else {
                        let last_space = final_text.trim_end().rfind(' ').unwrap_or(0);
                        final_text = final_text[..last_space].to_string();
                    }
                    let _ = crate::injection::keyboard::delete_previous_word_via_keyboard();
                }
                MacroAction::InsertTemplate { template, .. } => {
                    // Replace trigger with template
                    if trimmed_text == trigger {
                        final_text = template.clone();
                    } else {
                        let last_space = final_text.trim_end().rfind(' ').unwrap_or(0);
                        final_text = format!("{}{}", &final_text[..last_space + 1], template);
                    }
                }
                MacroAction::RunSequence(steps) => {
                    // Remove trigger and execute sequence
                    if trimmed_text == trigger {
                        final_text = "".to_string();
                    } else {
                        let last_space = final_text.trim_end().rfind(' ').unwrap_or(0);
                        final_text = final_text[..last_space].to_string();
                    }
                    // Execute steps
                    for step in steps {
                        match step {
                            crate::preferences::MacroSequenceStep::TypeText(step_text) => {
                                let _ = crate::injection::keyboard::inject_text_via_keyboard(step_text.as_str());
                            }
                            crate::preferences::MacroSequenceStep::PressKey(step_key) => {
                                let _ = crate::injection::keyboard::press_key_via_keyboard(step_key.as_str());
                            }
                            crate::preferences::MacroSequenceStep::WaitMs(ms) => {
                                std::thread::sleep(std::time::Duration::from_millis(*ms));
                            }
                        }
                    }
                }
            }
            break; // Only one macro per utterance for now
        }
    }
    
    // Check if review step is enabled
    let enable_review = prefs.enable_review_step;
    let target_mode = prefs.target_mode.clone();
    drop(prefs);
    
    // Show review window if enabled, otherwise inject directly
    if enable_review {
        let _ = app.emit("overlay-state", OverlayStatePayload { state: "injecting".to_string(), message: None });
        // Show the review window
        if let Some(review_window) = app.get_webview_window("review-window") {
            let _ = app.emit("show-review", final_text.clone());
            let _ = review_window.show();
            let _ = review_window.set_focus();
        }
    } else if matches!(target_mode, crate::preferences::TargetMode::WindowPicker) {
        let _ = app.emit("overlay-state", OverlayStatePayload { state: "injecting".to_string(), message: None });
        let _ = app.emit("show-picker", final_text.clone());
    } else {
        let _ = app.emit("overlay-state", OverlayStatePayload { state: "injecting".to_string(), message: None });
        let _ = crate::injection::keyboard::inject_text_via_keyboard(&final_text);
    }

    let _ = app.emit("overlay-state", OverlayStatePayload { state: "idle".to_string(), message: None });

    Ok(TranscriptionResult {
        session_id,
        text: final_text,
        duration_ms,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn cancel_recording(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    validate_can_stop_recording(&state)?;

    // Take and drop the capture (discards audio — no transcription)
    {
        let mut active = state
            .active_capture
            .lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        let capture = active.take();
        drop(capture);
    }

    // Mark recording as stopped
    {
        let mut recording = state
            .recording_active
            .write()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *recording = false;
    }

    let _ = app.emit("recording-cancelled", ());
    let _ = app.emit("overlay-state", OverlayStatePayload { state: "idle".to_string(), message: None });
    crate::update_tray_recording_state(&app, false);

    // Unregister Escape shortcut
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    let _ = app.global_shortcut().unregister("Escape");

    // Hide the overlay window
    if let Some(overlay) = app.get_webview_window("recording-overlay") {
        let _ = overlay.hide();
    }

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>, CommandError> {
    crate::audio::capture::list_input_devices()
        .map_err(|e| CommandError::new("DeviceEnumeration", e))
}

/// Test microphone by recording a 5-second sample and saving it for playback.
/// Returns the path to the saved audio file.
#[tauri::command(rename_all = "camelCase")]
pub async fn test_microphone(
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    eprintln!("[test_microphone] Starting mic test...");
    
    // Check if already recording
    let recording = state.recording_active.read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if *recording {
        return Err(CommandError::new("AlreadyRecording", "Cannot test mic while recording"));
    }
    drop(recording);
    
    // Get selected device
    let device_name = {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.selected_audio_device.clone()
    };
    
    // Create amplitude callback for visualization
    let amplitude_callback = Box::new(move |_amplitudes: Vec<f32>, _rms: f32| {
        // Silently capture - we just want the audio
    });
    
    // Start capture
    let capture = AudioCapture::start(amplitude_callback, device_name.as_deref())
        .map_err(|e| CommandError::new("MicrophoneUnavailable", e))?;
    
    eprintln!("[test_microphone] Recording 5-second test sample...");
    
    // Record for 5 seconds
    std::thread::sleep(std::time::Duration::from_secs(5));
    
    // Stop capture and get audio
    let (audio_buffer, sample_rate) = capture.stop();
    
    eprintln!("[test_microphone] Test sample captured, saving...");
    
    // Apply input gain
    let input_gain = {
        let prefs = state.preferences.read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.input_gain.clamp(0.1, 4.0)
    };
    
    let audio_buffer: Vec<f32> = audio_buffer
        .iter()
        .map(|&sample| (sample * input_gain).clamp(-1.0, 1.0))
        .collect();
    
    // Resample to 16kHz for consistent playback
    let audio_16khz = resample_to_16khz(&audio_buffer, sample_rate)
        .map_err(|e| CommandError::new("ProcessingFailed", format!("Resampling failed: {}", e)))?;
    
    // Save to test file
    let test_id = uuid::Uuid::new_v4().to_string();
    let test_dir = state.app_data_dir.join("mic_tests");
    std::fs::create_dir_all(&test_dir)
        .map_err(|e| CommandError::new("FileSystem", format!("Failed to create test directory: {}", e)))?;
    
    let test_path = test_dir.join(format!("test_{}.wav", test_id));
    let test_path_str = test_path.to_string_lossy().to_string();
    
    // Save as WAV
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    
    let mut writer = hound::WavWriter::create(&test_path, spec)
        .map_err(|e| CommandError::new("FileSystem", format!("Failed to create WAV: {}", e)))?;
    
    for &sample in &audio_16khz {
        let clamped = sample.clamp(-1.0, 1.0);
        let int_sample = (clamped * i16::MAX as f32) as i16;
        writer.write_sample(int_sample)
            .map_err(|e| CommandError::new("FileSystem", format!("Failed to write sample: {}", e)))?;
    }
    
    writer.finalize()
        .map_err(|e| CommandError::new("FileSystem", format!("Failed to finalize WAV: {}", e)))?;
    
    eprintln!("[test_microphone] Test saved to: {}", test_path_str);
    
    Ok(test_path_str)
}

/// Apply formatting options to transcribed text.
fn apply_formatting(text: &str, opts: &crate::preferences::FormattingOptions) -> String {
    let mut result = text.to_string();
    
    // Capitalize first letter if enabled
    if opts.capitalize_first_letter {
        if let Some(first_char) = result.chars().next() {
            let capitalized = first_char.to_uppercase().collect::<String>();
            result = capitalized + &result[first_char.len_utf8()..];
        }
    }
    
    result
}

#[derive(Clone, serde::Serialize)]
struct OverlayStatePayload {
    state: String,
    message: Option<String>,
}

fn recording_marker_path(app_data_dir: &std::path::Path) -> PathBuf {
    app_data_dir.join("recording.lock")
}

fn write_recording_marker(app_data_dir: &std::path::Path) -> Result<(), String> {
    let path = recording_marker_path(app_data_dir);
    fs::write(&path, b"recording")
        .map_err(|e| format!("Failed to write recording marker: {}", e))
}

fn remove_recording_marker(app_data_dir: &std::path::Path) -> Result<(), String> {
    let path = recording_marker_path(app_data_dir);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove recording marker: {}", e))?;
    }
    Ok(())
}
