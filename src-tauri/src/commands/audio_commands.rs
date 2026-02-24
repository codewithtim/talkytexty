use tauri::{ipc::Channel, Emitter, Manager, State};

use crate::audio::capture::{AudioCapture, AudioDeviceInfo};
use crate::audio::resample::resample_to_16khz;
use crate::audio::{AudioEvent, TranscriptionResult};
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
    crate::update_tray_recording_state(&app, true);

    // Show the overlay window
    if let Some(overlay) = app.get_webview_window("recording-overlay") {
        let _ = overlay.show();
        eprintln!("[start_recording] Overlay window shown");
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

    Ok(TranscriptionResult {
        session_id,
        text,
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
