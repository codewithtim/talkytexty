use std::fs;
use std::path::{Path, PathBuf};

use crate::preferences::UserPreferences;

pub fn get_preferences_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("preferences.json")
}

pub fn load_preferences(app_data_dir: &Path) -> Result<UserPreferences, String> {
    let path = get_preferences_path(app_data_dir);

    if !path.exists() {
        let defaults = UserPreferences::default();
        save_preferences(app_data_dir, &defaults)?;
        return Ok(defaults);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read preferences file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse preferences: {}", e))
}

pub fn save_preferences(
    app_data_dir: &Path,
    preferences: &UserPreferences,
) -> Result<(), String> {
    let path = get_preferences_path(app_data_dir);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create preferences directory: {}", e))?;
    }

    let contents = serde_json::to_string_pretty(preferences)
        .map_err(|e| format!("Failed to serialize preferences: {}", e))?;

    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write preferences file: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_load_creates_default_when_missing() {
        let temp_dir = std::env::temp_dir().join("ttc_test_prefs_default");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let prefs = load_preferences(&temp_dir).unwrap();
        assert!(prefs.active_model_id.is_none());
        assert_eq!(prefs.hotkeys.len(), 4);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let temp_dir = std::env::temp_dir().join("ttc_test_prefs_roundtrip");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let mut prefs = UserPreferences::default();
        prefs.active_model_id = Some("small-en".to_string());
        prefs.overlay_opacity = 0.75;

        save_preferences(&temp_dir, &prefs).unwrap();
        let loaded = load_preferences(&temp_dir).unwrap();

        assert_eq!(loaded.active_model_id, Some("small-en".to_string()));
        assert!((loaded.overlay_opacity - 0.75).abs() < f32::EPSILON);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
