// T030: Unit tests for keyboard injection and clipboard fallback
//
// enigo requires Accessibility permission on macOS.
// arboard requires a display server.
// Tests that need these are marked #[ignore].

use text_to_code_lib::injection::keyboard::inject_text_via_keyboard;
use text_to_code_lib::injection::clipboard::inject_text_via_clipboard;

#[test]
#[ignore] // Requires Accessibility permission
fn test_keyboard_injection_succeeds() {
    // This test will actually type text into the focused window.
    // Only run manually in a controlled environment.
    let result = inject_text_via_keyboard("test");
    assert!(
        result.is_ok(),
        "Keyboard injection failed: {:?}",
        result.err()
    );
}

#[test]
#[ignore] // Requires Accessibility permission and display server
fn test_clipboard_injection_succeeds() {
    let result = inject_text_via_clipboard("test clipboard");
    assert!(
        result.is_ok(),
        "Clipboard injection failed: {:?}",
        result.err()
    );
}

#[test]
#[ignore] // Requires Accessibility permission
fn test_keyboard_injection_empty_string() {
    let result = inject_text_via_keyboard("");
    assert!(
        result.is_ok(),
        "Empty string injection should succeed: {:?}",
        result.err()
    );
}

#[test]
#[ignore] // Requires Accessibility permission
fn test_keyboard_injection_special_characters() {
    let result = inject_text_via_keyboard("Hello, world! @#$%");
    assert!(
        result.is_ok(),
        "Special character injection failed: {:?}",
        result.err()
    );
}
