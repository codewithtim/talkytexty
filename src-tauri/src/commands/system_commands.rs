use serde::Serialize;

use super::CommandError;

#[derive(Debug, Serialize)]
pub struct PermissionStatus {
    pub microphone: bool,
    pub accessibility: bool,
}

#[tauri::command]
pub async fn check_permissions() -> Result<PermissionStatus, CommandError> {
    let microphone = check_microphone_permission();
    let accessibility = check_accessibility_permission();

    Ok(PermissionStatus {
        microphone,
        accessibility,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn request_permission(
    permission_type: String,
) -> Result<bool, CommandError> {
    match permission_type.as_str() {
        "microphone" => {
            // On macOS, cpal will trigger the system permission dialog on first use.
            // We return the current status after the prompt.
            Ok(check_microphone_permission())
        }
        "accessibility" => {
            request_accessibility_permission();
            Ok(check_accessibility_permission())
        }
        other => Err(CommandError::new(
            "InvalidPermissionType",
            format!("Unknown permission type: {}", other),
        )),
    }
}

#[cfg(target_os = "macos")]
fn check_accessibility_permission() -> bool {
    // On macOS, check if Accessibility permission is granted
    // This uses the ApplicationServices framework
    use std::process::Command;
    let output = Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to return true")
        .output();
    matches!(output, Ok(o) if o.status.success())
}

#[cfg(not(target_os = "macos"))]
fn check_accessibility_permission() -> bool {
    // On Windows/Linux, no special accessibility permission needed
    true
}

#[cfg(target_os = "macos")]
fn request_accessibility_permission() {
    // Open System Preferences to Accessibility pane
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}

#[cfg(not(target_os = "macos"))]
fn request_accessibility_permission() {
    // No-op on non-macOS platforms
}

fn check_microphone_permission() -> bool {
    // Microphone permission is checked at audio capture time.
    // For pre-check, we attempt to list input devices.
    // If cpal can see devices, permission is likely granted.
    use cpal::traits::HostTrait;
    let host = cpal::default_host();
    host.default_input_device().is_some()
}
