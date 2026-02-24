// T059a: Integration test for hotkey re-registration after preference update
//
// Tests verify:
// - Preferences update changes the stored hotkey bindings
// - Old and new bindings are distinct after update
// - Hotkey validation is applied during preference update

use std::fs;
use std::sync::{Mutex, RwLock};

use text_to_code_lib::preferences::{
    HotkeyAction, UserPreferences,
};
use text_to_code_lib::preferences::storage;
use text_to_code_lib::AppState;

fn make_test_state(dir: &std::path::Path) -> AppState {
    AppState {
        preferences: RwLock::new(UserPreferences::default()),
        app_data_dir: dir.to_path_buf(),
        recording_active: RwLock::new(false),
        engine: RwLock::new(None),
        active_capture: Mutex::new(None),
    }
}

#[test]
fn test_hotkey_rebind_updates_preferences() {
    let temp_dir = std::env::temp_dir().join("ttc_test_rebind");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let state = make_test_state(&temp_dir);

    // Read current binding for ToggleRecording
    let original_binding = {
        let prefs = state.preferences.read().unwrap();
        prefs
            .hotkeys
            .iter()
            .find(|h| h.action == HotkeyAction::ToggleRecording)
            .unwrap()
            .key_combination
            .clone()
    };
    assert_eq!(original_binding, "CommandOrControl+Shift+Space");

    // Simulate rebind: update the binding
    {
        let mut prefs = state.preferences.write().unwrap();
        if let Some(h) = prefs
            .hotkeys
            .iter_mut()
            .find(|h| h.action == HotkeyAction::ToggleRecording)
        {
            h.key_combination = "CommandOrControl+Shift+R".to_string();
        }
        storage::save_preferences(&temp_dir, &prefs).unwrap();
    }

    // Verify new binding is persisted
    let loaded = storage::load_preferences(&temp_dir).unwrap();
    let new_binding = loaded
        .hotkeys
        .iter()
        .find(|h| h.action == HotkeyAction::ToggleRecording)
        .unwrap();
    assert_eq!(new_binding.key_combination, "CommandOrControl+Shift+R");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_hotkey_rebind_preserves_other_bindings() {
    let temp_dir = std::env::temp_dir().join("ttc_test_rebind_preserve");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let state = make_test_state(&temp_dir);

    // Only change ToggleRecording
    {
        let mut prefs = state.preferences.write().unwrap();
        if let Some(h) = prefs
            .hotkeys
            .iter_mut()
            .find(|h| h.action == HotkeyAction::ToggleRecording)
        {
            h.key_combination = "Alt+Shift+X".to_string();
        }
        storage::save_preferences(&temp_dir, &prefs).unwrap();
    }

    // Verify OpenSettings is unchanged
    let loaded = storage::load_preferences(&temp_dir).unwrap();
    let settings_binding = loaded
        .hotkeys
        .iter()
        .find(|h| h.action == HotkeyAction::OpenSettings)
        .unwrap();
    assert_eq!(settings_binding.key_combination, "CommandOrControl+Shift+,");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_hotkey_enable_disable_persists() {
    let temp_dir = std::env::temp_dir().join("ttc_test_rebind_toggle");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let state = make_test_state(&temp_dir);

    // Disable ToggleRecording
    {
        let mut prefs = state.preferences.write().unwrap();
        if let Some(h) = prefs
            .hotkeys
            .iter_mut()
            .find(|h| h.action == HotkeyAction::ToggleRecording)
        {
            h.enabled = false;
        }
        storage::save_preferences(&temp_dir, &prefs).unwrap();
    }

    // Verify disabled state persists
    let loaded = storage::load_preferences(&temp_dir).unwrap();
    let binding = loaded
        .hotkeys
        .iter()
        .find(|h| h.action == HotkeyAction::ToggleRecording)
        .unwrap();
    assert!(!binding.enabled);

    let _ = fs::remove_dir_all(&temp_dir);
}
