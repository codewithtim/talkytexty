// T058: Unit test for hotkey validation
//
// Tests verify:
// - Valid Tauri shortcut formats are accepted
// - Invalid formats are rejected
// - Duplicate key combinations across actions are detected as conflicts

use text_to_code_lib::preferences::{HotkeyAction, HotkeyBinding};

// Import the validation function (to be created in T060)
use text_to_code_lib::preferences::validate_hotkey_format;
use text_to_code_lib::preferences::detect_hotkey_conflicts;

#[test]
fn test_valid_hotkey_format_accepted() {
    assert!(validate_hotkey_format("CommandOrControl+Shift+Space").is_ok());
    assert!(validate_hotkey_format("CommandOrControl+Shift+V").is_ok());
    assert!(validate_hotkey_format("Alt+Shift+R").is_ok());
    assert!(validate_hotkey_format("CommandOrControl+K").is_ok());
}

#[test]
fn test_empty_hotkey_rejected() {
    assert!(validate_hotkey_format("").is_err());
}

#[test]
fn test_no_modifier_rejected() {
    // Bare key without modifier should be rejected (too easy to trigger accidentally)
    assert!(validate_hotkey_format("Space").is_err());
    assert!(validate_hotkey_format("A").is_err());
}

#[test]
fn test_modifier_only_rejected() {
    // Modifier without a key should be rejected
    assert!(validate_hotkey_format("CommandOrControl").is_err());
    assert!(validate_hotkey_format("Shift").is_err());
    assert!(validate_hotkey_format("Alt").is_err());
}

#[test]
fn test_conflict_detected_for_duplicate_combinations() {
    let bindings = vec![
        HotkeyBinding {
            action: HotkeyAction::ToggleRecording,
            key_combination: "CommandOrControl+Shift+Space".to_string(),
            enabled: true,
        },
        HotkeyBinding {
            action: HotkeyAction::OpenSettings,
            key_combination: "CommandOrControl+Shift+Space".to_string(),
            enabled: true,
        },
    ];

    let conflicts = detect_hotkey_conflicts(&bindings);
    assert!(
        !conflicts.is_empty(),
        "Should detect conflict when two actions share the same key combination"
    );
}

#[test]
fn test_no_conflict_for_unique_combinations() {
    let bindings = vec![
        HotkeyBinding {
            action: HotkeyAction::ToggleRecording,
            key_combination: "CommandOrControl+Shift+Space".to_string(),
            enabled: true,
        },
        HotkeyBinding {
            action: HotkeyAction::OpenSettings,
            key_combination: "CommandOrControl+Shift+,".to_string(),
            enabled: true,
        },
    ];

    let conflicts = detect_hotkey_conflicts(&bindings);
    assert!(
        conflicts.is_empty(),
        "Should not detect conflicts when all combinations are unique"
    );
}

#[test]
fn test_disabled_hotkeys_do_not_conflict() {
    let bindings = vec![
        HotkeyBinding {
            action: HotkeyAction::ToggleRecording,
            key_combination: "CommandOrControl+Shift+Space".to_string(),
            enabled: true,
        },
        HotkeyBinding {
            action: HotkeyAction::PushToTalk,
            key_combination: "CommandOrControl+Shift+Space".to_string(),
            enabled: false, // disabled — should not conflict
        },
    ];

    let conflicts = detect_hotkey_conflicts(&bindings);
    assert!(
        conflicts.is_empty(),
        "Disabled hotkeys should not produce conflicts"
    );
}
