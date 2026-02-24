#[cfg(target_os = "macos")]
#[tauri::command]
pub fn set_traffic_lights_visible(app: tauri::AppHandle, visible: bool) {
    use tauri::Manager;

    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let ns_window = window.ns_window();
    if ns_window.is_err() {
        return;
    }
    let ns_window_ptr = ns_window.unwrap();

    // SAFETY: Tauri gives us a valid NSWindow pointer and we only call
    // standard NSWindow button accessors on the main thread (which Tauri
    // commands are dispatched on).
    unsafe {
        use objc2_app_kit::{NSWindow, NSWindowButton};

        let ns_win: &NSWindow = &*(ns_window_ptr as *const NSWindow);

        // Zoom (green) button is always hidden — the app has no full-screen mode
        if let Some(btn) = ns_win.standardWindowButton(NSWindowButton::ZoomButton) {
            btn.setHidden(true);
        }

        // Minimize (yellow) button toggles with sidebar state
        if let Some(btn) = ns_win.standardWindowButton(NSWindowButton::MiniaturizeButton) {
            btn.setHidden(!visible);
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn set_traffic_lights_visible(_app: tauri::AppHandle, _visible: bool) {
    // No-op on non-macOS platforms
}
