pub mod audio;
pub mod commands;
pub mod history;
pub mod hotkeys;
pub mod injection;
pub mod preferences;
pub mod transcription;

use std::path::PathBuf;
use std::sync::{Mutex, RwLock};

use audio::capture::AudioCapture;
use hotkeys::{resolve_hotkey_event, HotkeyEvent, HotkeyResponse};
use preferences::storage;
use preferences::UserPreferences;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use transcription::engine::TranscriptionEngine;

pub struct AppState {
    pub preferences: RwLock<UserPreferences>,
    pub app_data_dir: PathBuf,
    pub recording_active: RwLock<bool>,
    pub engine: RwLock<Option<Box<dyn TranscriptionEngine>>>,
    pub active_capture: Mutex<Option<AudioCapture>>,
    pub recording_started_at: Mutex<Option<std::time::Instant>>,
}

fn build_tray_menu(
    app: &tauri::AppHandle,
    is_recording: bool,
) -> tauri::Result<tauri::menu::Menu<Wry>> {
    let status_text = if is_recording {
        "Recording..."
    } else {
        "Recording: Idle"
    };
    let toggle_text = if is_recording {
        "Stop Recording"
    } else {
        "Start Recording"
    };

    let status = MenuItemBuilder::new(status_text)
        .id("status")
        .enabled(false)
        .build(app)?;
    let toggle = MenuItemBuilder::new(toggle_text)
        .id("toggle_recording")
        .build(app)?;
    let show_settings = MenuItemBuilder::new("Show Settings")
        .id("show_settings")
        .build(app)?;
    let models = MenuItemBuilder::new("Models")
        .id("show_models")
        .build(app)?;
    let quit = MenuItemBuilder::new("Quit").id("quit").build(app)?;

    MenuBuilder::new(app)
        .item(&status)
        .separator()
        .item(&toggle)
        .separator()
        .item(&show_settings)
        .item(&models)
        .separator()
        .item(&quit)
        .build()
}

pub fn update_tray_recording_state(app: &tauri::AppHandle, is_recording: bool) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        if let Ok(menu) = build_tray_menu(app, is_recording) {
            let _ = tray.set_menu(Some(menu));
        }

        // Swap icon: normal icon or icon with red recording dot
        let icon = if is_recording {
            recording_icon()
        } else {
            Image::from_bytes(include_bytes!("../icons/32x32.png")).ok()
        };
        if let Some(icon) = icon {
            let _ = tray.set_icon(Some(icon));
        }
    }
}

/// Create a copy of the tray icon with a red recording dot in the bottom-right corner.
fn recording_icon() -> Option<Image<'static>> {
    let base = Image::from_bytes(include_bytes!("../icons/32x32.png")).ok()?;
    let width = base.width();
    let height = base.height();
    let mut rgba = base.rgba().to_vec();

    // Red dot parameters — bottom-right badge
    let dot_radius = 5.0_f64;
    let cx = width as f64 - dot_radius - 1.0;
    let cy = height as f64 - dot_radius - 1.0;

    for y in 0..height {
        for x in 0..width {
            let dx = x as f64 - cx;
            let dy = y as f64 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist <= dot_radius {
                let idx = ((y * width + x) * 4) as usize;
                // Apple system red #FF3B30
                rgba[idx] = 0xFF;
                rgba[idx + 1] = 0x3B;
                rgba[idx + 2] = 0x30;
                rgba[idx + 3] = 0xFF;
            }
        }
    }

    Some(Image::new_owned(rgba, width, height))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    // Handle Escape for cancel recording (dynamically registered)
                    if matches!(event.state(), ShortcutState::Pressed)
                        && "Escape"
                            .parse::<Shortcut>()
                            .map(|s| s == *shortcut)
                            .unwrap_or(false)
                    {
                        let state = app.state::<AppState>();
                        let is_recording = state
                            .recording_active
                            .read()
                            .map(|r| *r)
                            .unwrap_or(false);
                        if is_recording {
                            let _ = app.emit("hotkey-cancel-recording", ());
                            return;
                        }
                    }

                    let state = app.state::<AppState>();
                    let prefs = match state.preferences.read() {
                        Ok(p) => p,
                        Err(_) => return,
                    };

                    // Find which action this shortcut maps to.
                    // Compare parsed Shortcut objects, not strings, because
                    // shortcut.to_string() normalizes to a platform-specific format
                    // (e.g. "shift+super+space") that differs from the stored format
                    // (e.g. "CommandOrControl+Shift+Space").
                    let action = prefs
                        .hotkeys
                        .iter()
                        .find(|h| {
                            h.enabled
                                && h.key_combination
                                    .parse::<Shortcut>()
                                    .map(|parsed| parsed == *shortcut)
                                    .unwrap_or(false)
                        })
                        .map(|h| h.action.clone());

                    let recording_mode = prefs.recording_mode.clone();
                    drop(prefs);

                    let Some(action) = action else {
                        eprintln!("[hotkey] No matching action for shortcut: {}", shortcut);
                        return;
                    };
                    eprintln!("[hotkey] Matched action: {:?}", action);

                    let is_recording = state
                        .recording_active
                        .read()
                        .map(|r| *r)
                        .unwrap_or(false);

                    let hotkey_event = match event.state() {
                        ShortcutState::Pressed => HotkeyEvent::Pressed(action),
                        ShortcutState::Released => HotkeyEvent::Released(action),
                    };

                    let response =
                        resolve_hotkey_event(hotkey_event, &recording_mode, is_recording);
                    eprintln!("[hotkey] Response: {:?}, is_recording: {}", response, is_recording);

                    match response {
                        HotkeyResponse::StartRecording => {
                            eprintln!("[hotkey] Emitting hotkey-start-recording to all windows");
                            let _ = app.emit("hotkey-start-recording", ());
                        }
                        HotkeyResponse::StopRecordingAndTranscribe => {
                            let _ = app.emit("hotkey-stop-recording", ());
                        }
                        HotkeyResponse::ShowSettings => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        HotkeyResponse::ShowTargetSelector => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("hotkey-open-target-selector", ());
                            }
                        }
                        HotkeyResponse::CancelRecording => {
                            // Handled by Escape shortcut handler above
                            let _ = app.emit("hotkey-cancel-recording", ());
                        }
                        HotkeyResponse::NoOp => {}
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing instance when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            let prefs = storage::load_preferences(&app_data_dir)
                .unwrap_or_default();

            // Register enabled hotkeys
            let global_shortcut = app.global_shortcut();
            for hotkey in &prefs.hotkeys {
                if hotkey.enabled {
                    if let Err(e) = global_shortcut.register(hotkey.key_combination.as_str()) {
                        log::warn!(
                            "Failed to register hotkey '{}' for {:?}: {}",
                            hotkey.key_combination,
                            hotkey.action,
                            e
                        );
                    }
                }
            }

            // Auto-load transcription engine if an active model is set
            let initial_engine: Option<Box<dyn TranscriptionEngine>> = if let Some(ref model_id) = prefs.active_model_id {
                let all_models = transcription::models::get_builtin_models(&app_data_dir);
                all_models
                    .iter()
                    .find(|m| m.id == *model_id)
                    .and_then(|model| {
                        if let transcription::DownloadStatus::Downloaded { ref local_path } =
                            model.download_status
                        {
                            eprintln!("[setup] Auto-loading model: {} from {}", model_id, local_path);
                            match commands::model_commands::load_engine_for_model(model, local_path) {
                                Ok(engine) => {
                                    eprintln!("[setup] Model loaded successfully");
                                    Some(engine)
                                }
                                Err(e) => {
                                    eprintln!("[setup] Failed to load model: {}", e);
                                    None
                                }
                            }
                        } else {
                            eprintln!("[setup] Active model '{}' is not downloaded", model_id);
                            None
                        }
                    })
            } else {
                eprintln!("[setup] No active model configured");
                None
            };

            let overlay_position = prefs.overlay_position.clone();
            let overlay_custom_position = prefs.overlay_custom_position.clone();

            app.manage(AppState {
                preferences: RwLock::new(prefs),
                app_data_dir,
                recording_active: RwLock::new(false),
                engine: RwLock::new(initial_engine),
                active_capture: Mutex::new(None),
                recording_started_at: Mutex::new(None),
            });

            // Always hide the zoom (green) traffic-light button on the main window
            #[cfg(target_os = "macos")]
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(ns_window_ptr) = main_win.ns_window() {
                    unsafe {
                        use objc2_app_kit::{NSWindow, NSWindowButton};
                        let ns_win: &NSWindow = &*(ns_window_ptr as *const NSWindow);
                        if let Some(btn) = ns_win.standardWindowButton(NSWindowButton::ZoomButton) {
                            btn.setHidden(true);
                        }
                    }
                }
            }

            // Configure overlay window runtime properties
            if let Some(overlay) = app.get_webview_window("recording-overlay") {
                // Position overlay: use saved custom position if available, else preset
                if let Some(custom_pos) = overlay_custom_position {
                    let _ = overlay.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(custom_pos.x as i32, custom_pos.y as i32),
                    ));
                } else if let Ok(Some(monitor)) = overlay.current_monitor() {
                    let monitor_size = monitor.size();
                    let monitor_pos = monitor.position();
                    let overlay_width = 340.0;
                    let overlay_height = 180.0;
                    let margin = 20.0;

                    let (x, y) = match overlay_position {
                        preferences::OverlayPosition::TopCenter => (
                            monitor_pos.x as f64
                                + (monitor_size.width as f64 - overlay_width) / 2.0,
                            monitor_pos.y as f64 + margin,
                        ),
                        preferences::OverlayPosition::TopRight => (
                            monitor_pos.x as f64 + monitor_size.width as f64
                                - overlay_width
                                - margin,
                            monitor_pos.y as f64 + margin,
                        ),
                        preferences::OverlayPosition::BottomCenter => (
                            monitor_pos.x as f64
                                + (monitor_size.width as f64 - overlay_width) / 2.0,
                            monitor_pos.y as f64 + monitor_size.height as f64
                                - overlay_height
                                - margin,
                        ),
                        preferences::OverlayPosition::BottomRight => (
                            monitor_pos.x as f64 + monitor_size.width as f64
                                - overlay_width
                                - margin,
                            monitor_pos.y as f64 + monitor_size.height as f64
                                - overlay_height
                                - margin,
                        ),
                    };

                    let _ = overlay.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x as i32, y as i32),
                    ));
                }
            }

            // System tray
            let menu = build_tray_menu(app.handle(), false)?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(Image::from_bytes(include_bytes!("../icons/32x32.png"))?)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("TalkyTexty")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "toggle_recording" => {
                            let state = app.state::<AppState>();
                            let is_recording = state
                                .recording_active
                                .read()
                                .map(|r| *r)
                                .unwrap_or(false);
                            if is_recording {
                                let _ = app.emit("hotkey-stop-recording", ());
                            } else {
                                let _ = app.emit("hotkey-start-recording", ());
                            }
                        }
                        "show_settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "show_models" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = app.emit("navigate", "/models");
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::system_commands::check_permissions,
            commands::system_commands::request_permission,
            commands::preferences_commands::get_preferences,
            commands::preferences_commands::update_preferences,
            commands::model_commands::list_models,
            commands::model_commands::set_active_model,
            commands::model_commands::download_model,
            commands::model_commands::delete_model,
            commands::audio_commands::start_recording,
            commands::audio_commands::stop_recording,
            commands::audio_commands::cancel_recording,
            commands::audio_commands::list_audio_devices,
            commands::injection_commands::inject_text,
            commands::injection_commands::list_windows,
            commands::injection_commands::copy_to_clipboard,
            commands::window_commands::set_traffic_lights_visible,
            commands::history_commands::list_history,
            commands::history_commands::delete_history_entry,
            commands::history_commands::clear_history,
            commands::history_commands::get_history_audio,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { api, .. } = &event {
                // Prevent exit when all windows are closed
                let has_visible_window = app
                    .webview_windows()
                    .values()
                    .any(|w| w.is_visible().unwrap_or(false));
                if !has_visible_window {
                    api.prevent_exit();
                }
            }
        });
}
