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
    // Use the native AXIsProcessTrusted API from ApplicationServices
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
    }
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
fn check_accessibility_permission() -> bool {
    true
}

#[cfg(target_os = "macos")]
fn request_accessibility_permission() {
    // Use AXIsProcessTrustedWithOptions with the prompt option to show
    // the system dialog, then also open System Settings as a fallback
    // since the prompt only appears once.
    extern "C" {
        fn CFStringCreateWithCString(
            alloc: *const std::ffi::c_void,
            c_str: *const std::ffi::c_char,
            encoding: u32,
        ) -> *const std::ffi::c_void;
        fn CFDictionaryCreate(
            allocator: *const std::ffi::c_void,
            keys: *const *const std::ffi::c_void,
            values: *const *const std::ffi::c_void,
            num_values: isize,
            key_callbacks: *const std::ffi::c_void,
            value_callbacks: *const std::ffi::c_void,
            ) -> *const std::ffi::c_void;
        fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
        static kCFBooleanTrue: *const std::ffi::c_void;
        static kCFTypeDictionaryKeyCallBacks: std::ffi::c_void;
        static kCFTypeDictionaryValueCallBacks: std::ffi::c_void;
    }

    unsafe {
        // kAXTrustedCheckOptionPrompt = "AXTrustedCheckOptionPrompt"
        let key = CFStringCreateWithCString(
            std::ptr::null(),
            b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const _,
            0x08000100, // kCFStringEncodingUTF8
        );
        let keys = [key];
        let values = [kCFBooleanTrue];
        let options = CFDictionaryCreate(
            std::ptr::null(),
            keys.as_ptr(),
            values.as_ptr(),
            1,
            &kCFTypeDictionaryKeyCallBacks as *const _,
            &kCFTypeDictionaryValueCallBacks as *const _,
        );
        AXIsProcessTrustedWithOptions(options);
    }

    // Also open System Settings as a convenience — the prompt dialog
    // only appears the very first time, after that users need to toggle
    // the switch manually in System Settings.
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
    // On Linux/Windows, cpal doesn't have a built-in permission prompt.
    // We just check if it can access devices. If not, it's likely
    // a driver or system configuration issue (ALSA/Pipewire/Pulse on Linux).
    check_microphone_permission()
}
