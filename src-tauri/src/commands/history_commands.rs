use tauri::State;

use crate::history::HistoryEntry;
use crate::AppState;

use super::CommandError;

#[tauri::command(rename_all = "camelCase")]
pub fn list_history(state: State<'_, AppState>) -> Result<Vec<HistoryEntry>, CommandError> {
    crate::history::load_history(&state.app_data_dir)
        .map_err(|e| CommandError::new("HistoryLoadError", e))
}

#[tauri::command(rename_all = "camelCase")]
pub fn delete_history_entry(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), CommandError> {
    crate::history::delete_entry(&state.app_data_dir, &id)
        .map_err(|e| CommandError::new("HistoryDeleteError", e))
}

#[tauri::command(rename_all = "camelCase")]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), CommandError> {
    crate::history::clear_history(&state.app_data_dir)
        .map_err(|e| CommandError::new("HistoryClearError", e))
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_history_audio(
    state: State<'_, AppState>,
    file_name: String,
) -> Result<Vec<u8>, CommandError> {
    crate::history::load_audio_bytes(&state.app_data_dir, &file_name)
        .map_err(|e| CommandError::new("AudioLoadError", e))
}
