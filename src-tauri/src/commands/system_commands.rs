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
            // Trigger the system permission dialog (macOS) and return the result.
            Ok(request_microphone_permission())
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
    // Attempt to list input devices — if cpal can see them, permission is granted.
    // On macOS, this returns false when the user has denied or not yet granted access.
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    let device = match host.default_input_device() {
        Some(d) => d,
        None => return false,
    };
    // Getting the default config will fail if microphone access is denied
    device.default_input_config().is_ok()
}

#[cfg(target_os = "macos")]
fn request_microphone_permission() -> bool {
    // Attempt to access the default input device and query its config.
    // On macOS, this triggers the system permission dialog if
    // NSMicrophoneUsageDescription is in Info.plist and the user
    // hasn't responded yet. We run this in a blocking manner so
    // the frontend can poll the result afterward.
    use cpal::traits::HostTrait;
    let host = cpal::default_host();

    // Try to enumerate input devices — this alone can trigger the dialog on macOS
    if let Ok(mut devices) = host.input_devices() {
        // Iterating triggers the permission prompt
        let _ = devices.next();
    }

    // Check if permission is now granted
    check_microphone_permission()
}

#[cfg(not(target_os = "macos"))]
fn request_microphone_permission() -> bool {
    check_microphone_permission()
}
