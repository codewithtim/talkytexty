// Window enumeration and activation (T075-T076)

use std::collections::HashSet;

use super::TargetWindow;

/// Create a TargetWindow struct from individual fields.
pub fn map_to_target_window(
    window_id: &str,
    title: &str,
    app_name: &str,
    process_id: u32,
) -> TargetWindow {
    TargetWindow {
        window_id: window_id.to_string(),
        title: title.to_string(),
        app_name: app_name.to_string(),
        process_id,
        icon: None,
    }
}

/// Filter out windows belonging to our own process.
pub fn filter_own_windows(windows: Vec<TargetWindow>, own_pid: u32) -> Vec<TargetWindow> {
    windows
        .into_iter()
        .filter(|w| w.process_id != own_pid)
        .collect()
}

/// Enumerate all open windows using x-win, filtered to exclude our own app.
/// Returns one entry per application (deduplicated by app name), with app icons.
pub fn get_open_windows() -> Result<Vec<TargetWindow>, String> {
    let raw_windows = x_win::get_open_windows()
        .map_err(|e| format!("Failed to enumerate windows: {}", e))?;

    let own_pid = std::process::id();

    // Deduplicate by app name — keep the first window per app (Cmd+Tab style)
    let mut seen_apps = HashSet::new();
    let mut windows = Vec::new();

    for w in &raw_windows {
        if w.info.process_id == own_pid {
            continue;
        }
        if !seen_apps.insert(w.info.name.clone()) {
            continue;
        }

        let icon = x_win::get_window_icon(w)
            .ok()
            .and_then(|info| {
                if info.data.is_empty() {
                    None
                } else {
                    Some(info.data)
                }
            });

        windows.push(TargetWindow {
            window_id: w.id.to_string(),
            title: w.title.clone(),
            app_name: w.info.name.clone(),
            process_id: w.info.process_id,
            icon,
        });
    }

    Ok(windows)
}

/// Activate a specific window by process ID (platform-specific).
#[cfg(target_os = "macos")]
pub fn activate_window(process_id: u32) -> Result<(), String> {
    use std::process::Command;

    let script = format!(
        "tell application \"System Events\" to set frontmost of (first process whose unix id is {}) to true",
        process_id
    );

    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("Failed to activate window: {}", e))?;

    // Brief delay to allow window activation to settle
    std::thread::sleep(std::time::Duration::from_millis(100));

    Ok(())
}

#[cfg(target_os = "windows")]
pub fn activate_window(_process_id: u32) -> Result<(), String> {
    Err("Windows activation not yet implemented".to_string())
}

#[cfg(target_os = "linux")]
pub fn activate_window(process_id: u32) -> Result<(), String> {
    use std::process::Command;

    // Try xdotool first
    let xdotool_result = Command::new("xdotool")
        .arg("search")
        .arg("--pid")
        .arg(process_id.to_string())
        .arg("windowactivate")
        .output();

    match xdotool_result {
        Ok(output) if output.status.success() => {
            std::thread::sleep(std::time::Duration::from_millis(100));
            return Ok(());
        }
        _ => {
            // Fallback to wmctrl
            let wmctrl_result = Command::new("wmctrl")
                .arg("-I") // search by process name/id is tricky with wmctrl, but we can try -lp
                .arg("-a")
                .arg(process_id.to_string())
                .output();

            if let Ok(output) = wmctrl_result {
                if output.status.success() {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    return Ok(());
                }
            }
        }
    }

    Err("Failed to activate window. Ensure 'xdotool' or 'wmctrl' is installed and you are using an X11-based desktop.".to_string())
}
