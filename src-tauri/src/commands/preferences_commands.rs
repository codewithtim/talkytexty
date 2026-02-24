use tauri::State;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::preferences::storage;
use crate::preferences::UserPreferences;
use crate::AppState;

use super::CommandError;

#[tauri::command]
pub async fn get_preferences(
    state: State<'_, AppState>,
) -> Result<UserPreferences, CommandError> {
    let prefs = state
        .preferences
        .read()
        .map_err(|e| CommandError::new("LockError", format!("Failed to read preferences: {}", e)))?;
    Ok(prefs.clone())
}

#[tauri::command]
pub async fn update_preferences(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    preferences: UserPreferences,
) -> Result<(), CommandError> {
    // Validate hotkey formats
    for hotkey in &preferences.hotkeys {
        if hotkey.enabled {
            crate::preferences::validate_hotkey_format(&hotkey.key_combination)
                .map_err(|e| CommandError::new("InvalidHotkey", e))?;
        }
    }

    // Check for conflicts
    let conflicts = crate::preferences::detect_hotkey_conflicts(&preferences.hotkeys);
    if !conflicts.is_empty() {
        return Err(CommandError::new(
            "InvalidHotkey",
            format!("Conflicting hotkey bindings: {}", conflicts.join(", ")),
        ));
    }

    // Read old hotkeys to diff
    let old_hotkeys = {
        let prefs = state
            .preferences
            .read()
            .map_err(|e| CommandError::new("LockError", format!("Failed to read preferences: {}", e)))?;
        prefs.hotkeys.clone()
    };

    // Persist to disk
    storage::save_preferences(&state.app_data_dir, &preferences)
        .map_err(|e| CommandError::new("PersistFailed", e))?;

    // Re-register hotkeys if they changed
    let global_shortcut = app.global_shortcut();

    // Unregister old enabled hotkeys
    for hotkey in &old_hotkeys {
        if hotkey.enabled {
            let _ = global_shortcut.unregister(hotkey.key_combination.as_str());
        }
    }

    // Register new enabled hotkeys
    for hotkey in &preferences.hotkeys {
        if hotkey.enabled {
            if let Err(e) = global_shortcut.register(hotkey.key_combination.as_str()) {
                eprintln!(
                    "[update_preferences] Failed to register hotkey '{}': {}",
                    hotkey.key_combination, e
                );
            }
        }
    }

    // Update in-memory state
    let mut prefs = state
        .preferences
        .write()
        .map_err(|e| CommandError::new("LockError", format!("Failed to write preferences: {}", e)))?;
    *prefs = preferences;

    Ok(())
}
