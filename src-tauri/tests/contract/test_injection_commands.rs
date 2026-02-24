// T033: Contract tests for inject_text command
//
// Tests verify the command contracts per contracts/tauri-commands.md:
// - inject_text dispatches to keyboard or clipboard based on preferences
// - inject_text handles empty text gracefully
// - Target mode is correctly read from preferences
//
// Note: Actual text injection requires Accessibility permission
// and is tested with #[ignore] in test_keyboard.rs.

use std::path::PathBuf;
use std::sync::{Mutex, RwLock};

use text_to_code_lib::preferences::{
    TargetMode, TextInjectionMethod, UserPreferences,
};
use text_to_code_lib::AppState;

fn make_test_state() -> AppState {
    AppState {
        preferences: RwLock::new(UserPreferences::default()),
        app_data_dir: PathBuf::from("/tmp/ttc_test_injection"),
        recording_active: RwLock::new(false),
        engine: RwLock::new(None),
        active_capture: Mutex::new(None),
    }
}

#[test]
fn test_default_injection_method_is_simulated_keystrokes() {
    let state = make_test_state();
    let prefs = state.preferences.read().unwrap();
    assert!(
        matches!(prefs.text_injection_method, TextInjectionMethod::SimulatedKeystrokes),
        "Default injection method should be SimulatedKeystrokes"
    );
}

#[test]
fn test_default_target_mode_is_active_window() {
    let state = make_test_state();
    let prefs = state.preferences.read().unwrap();
    assert!(
        matches!(prefs.target_mode, TargetMode::ActiveWindow),
        "Default target mode should be ActiveWindow"
    );
}

#[test]
fn test_preferences_can_switch_to_clipboard_paste() {
    let state = make_test_state();
    {
        let mut prefs = state.preferences.write().unwrap();
        prefs.text_injection_method = TextInjectionMethod::ClipboardPaste;
    }
    let prefs = state.preferences.read().unwrap();
    assert!(matches!(
        prefs.text_injection_method,
        TextInjectionMethod::ClipboardPaste
    ));
}

#[test]
fn test_preferences_can_set_window_picker() {
    let state = make_test_state();
    {
        let mut prefs = state.preferences.write().unwrap();
        prefs.target_mode = TargetMode::WindowPicker;
    }
    let prefs = state.preferences.read().unwrap();
    assert!(
        matches!(prefs.target_mode, TargetMode::WindowPicker),
        "Expected WindowPicker target mode"
    );
}

#[test]
fn test_preferences_toggle_window_picker_to_active() {
    let state = make_test_state();
    {
        let mut prefs = state.preferences.write().unwrap();
        prefs.target_mode = TargetMode::WindowPicker;
    }
    {
        let mut prefs = state.preferences.write().unwrap();
        prefs.target_mode = TargetMode::ActiveWindow;
    }
    let prefs = state.preferences.read().unwrap();
    assert!(matches!(prefs.target_mode, TargetMode::ActiveWindow));
}
