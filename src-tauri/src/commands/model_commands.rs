use tauri::State;

use crate::transcription::engine::{ParakeetEngine, TranscriptionEngine, WhisperEngine};
use crate::transcription::models;
use crate::transcription::{DownloadStatus, ModelVariant, TranscriptionModel};
use crate::AppState;

use super::CommandError;

/// Validate that the active model can be switched (not recording).
pub fn validate_can_set_active_model(state: &AppState) -> Result<(), CommandError> {
    let recording = state
        .recording_active
        .read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if *recording {
        return Err(CommandError::new(
            "RecordingInProgress",
            "Cannot switch models while recording is in progress. Stop recording first.",
        ));
    }
    Ok(())
}

/// Load the appropriate transcription engine for a model.
pub fn load_engine_for_model(
    model: &TranscriptionModel,
    local_path: &str,
) -> Result<Box<dyn TranscriptionEngine>, String> {
    match model.model_family.as_str() {
        "Whisper" => {
            let engine = WhisperEngine::load(std::path::Path::new(local_path))?;
            Ok(Box::new(engine))
        }
        "Parakeet" => {
            let variant = match model.variant {
                ModelVariant::ParakeetCTC => "ParakeetCTC",
                ModelVariant::ParakeetTDT => "ParakeetTDT",
                ModelVariant::ParakeetEOU => "ParakeetEOU",
                _ => return Err(format!("Unexpected variant for Parakeet family: {:?}", model.variant)),
            };
            let engine = ParakeetEngine::load(std::path::Path::new(local_path), variant)?;
            Ok(Box::new(engine))
        }
        other => Err(format!("Unknown model family: {}", other)),
    }
}

#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
) -> Result<Vec<TranscriptionModel>, CommandError> {
    Ok(models::get_builtin_models(&state.app_data_dir))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn set_active_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), CommandError> {
    eprintln!("[set_active_model] Activating model: {}", model_id);

    // Guard against model switch during recording
    validate_can_set_active_model(&state)?;

    // Validate model exists and is downloaded
    let all_models = models::get_builtin_models(&state.app_data_dir);
    let model = all_models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| CommandError::new("ModelNotFound", format!("No model with id: {}", model_id)))?;

    let local_path = match &model.download_status {
        DownloadStatus::Downloaded { local_path } => {
            eprintln!("[set_active_model] Model path: {}", local_path);
            local_path.clone()
        }
        other => {
            eprintln!("[set_active_model] Model not downloaded, status: {:?}", other);
            return Err(CommandError::new(
                "NotDownloaded",
                "Model must be downloaded before activating.",
            ))
        }
    };

    // Load engine based on model family
    eprintln!("[set_active_model] Loading {} engine...", model.model_family);
    let engine = load_engine_for_model(model, &local_path)
        .map_err(|e| {
            eprintln!("[set_active_model] Load failed: {}", e);
            CommandError::new("LoadFailed", e)
        })?;
    eprintln!("[set_active_model] Engine loaded successfully");

    // Update engine in state
    {
        let mut engine_lock = state
            .engine
            .write()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        *engine_lock = Some(engine);
    }

    // Update preferences and save to disk
    {
        let mut prefs = state
            .preferences
            .write()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        prefs.active_model_id = Some(model_id);
        crate::preferences::storage::save_preferences(&state.app_data_dir, &prefs)
            .map_err(|e| CommandError::new("SaveFailed", e))?;
    }
    eprintln!("[set_active_model] Model activated and preferences saved");

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn download_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<TranscriptionModel, CommandError> {
    let all_models = models::get_builtin_models(&state.app_data_dir);
    let model = all_models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| CommandError::new("ModelNotFound", format!("No model with id: {}", model_id)))?;

    if matches!(&model.download_status, DownloadStatus::Downloaded { .. }) {
        return Err(CommandError::new(
            "AlreadyDownloaded",
            "Model is already downloaded.",
        ));
    }

    if matches!(&model.download_status, DownloadStatus::Downloading { .. }) {
        return Err(CommandError::new(
            "AlreadyDownloading",
            "Model is already being downloaded.",
        ));
    }

    // Persist downloading status BEFORE starting so it survives navigation
    models::update_model_status(
        &state.app_data_dir,
        &model_id,
        DownloadStatus::Downloading { progress_percent: 0.0 },
    )
    .map_err(|e| CommandError::new("DownloadFailed", e))?;

    // Extract values needed for the blocking download task
    let hf_repo = model.huggingface_repo.clone();
    let filenames = model.huggingface_filenames.clone();
    let app_data_dir = state.app_data_dir.clone();
    let dl_model_id = model.id.clone();

    // Run blocking hf-hub download on a dedicated thread to avoid blocking
    // the Tokio async runtime (critical for Parakeet's multi-GB downloads)
    let error_reset_dir = state.app_data_dir.clone();
    let error_reset_id = model_id.clone();

    let dest_str = match tokio::task::spawn_blocking(move || -> Result<String, CommandError> {
        let api = hf_hub::api::sync::Api::new()
            .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to initialize HF API: {}", e)))?;
        let repo = api.model(hf_repo);

        if filenames.len() == 1 {
            // Single file (Whisper)
            eprintln!("[download_model] Downloading single file: {}", filenames[0]);
            let path = repo
                .get(&filenames[0])
                .map_err(|e| CommandError::new("DownloadFailed", format!("Download failed: {}", e)))?;

            let dest = models::model_file_path(&app_data_dir, &filenames[0]);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create directory: {}", e)))?;
            }
            std::fs::copy(&path, &dest)
                .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to copy model: {}", e)))?;

            Ok(dest.to_string_lossy().to_string())
        } else {
            // Multi-file (Parakeet): create directory and download each file
            let dest_dir = models::model_dir_path(&app_data_dir, &dl_model_id);
            std::fs::create_dir_all(&dest_dir)
                .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create model directory: {}", e)))?;

            for (i, filename) in filenames.iter().enumerate() {
                eprintln!("[download_model] Downloading file {}/{}: {}", i + 1, filenames.len(), filename);
                let path = repo
                    .get(filename)
                    .map_err(|e| CommandError::new("DownloadFailed", format!("Download of {} failed: {}", filename, e)))?;

                // Flatten: strip any subdirectory prefix (e.g. "onnx/model.onnx" → "model.onnx")
                // so all files land directly in the model directory for parakeet-rs
                let local_name = std::path::Path::new(filename)
                    .file_name()
                    .unwrap_or_else(|| std::ffi::OsStr::new(filename));
                let dest_file = dest_dir.join(local_name);
                std::fs::copy(&path, &dest_file)
                    .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to copy {}: {}", filename, e)))?;
                eprintln!("[download_model] Completed file: {}", filename);
            }

            Ok(dest_dir.to_string_lossy().to_string())
        }
    })
    .await
    .map_err(|e| CommandError::new("DownloadFailed", format!("Download task failed: {}", e)))? {
        Ok(path) => path,
        Err(e) => {
            // Reset status so the user can retry
            let _ = models::update_model_status(
                &error_reset_dir,
                &error_reset_id,
                DownloadStatus::NotDownloaded,
            );
            return Err(e);
        }
    };

    // Update registry
    models::update_model_status(
        &state.app_data_dir,
        &model_id,
        DownloadStatus::Downloaded { local_path: dest_str },
    )
    .map_err(|e| CommandError::new("DownloadFailed", e))?;

    // Return updated model
    let updated = models::get_builtin_models(&state.app_data_dir);
    updated
        .into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| CommandError::new("ModelNotFound", "Model disappeared after download"))
}

#[tauri::command(rename_all = "camelCase")]
pub async fn delete_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), CommandError> {
    // Check if model is active
    {
        let prefs = state
            .preferences
            .read()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        if prefs.active_model_id.as_deref() == Some(&model_id) {
            return Err(CommandError::new(
                "ModelInUse",
                "Cannot delete the active model. Switch to another model first.",
            ));
        }
    }

    let all_models = models::get_builtin_models(&state.app_data_dir);
    let model = all_models
        .iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| CommandError::new("ModelNotFound", format!("No model with id: {}", model_id)))?;

    if let DownloadStatus::Downloaded { local_path } = &model.download_status {
        let path = std::path::Path::new(local_path);
        if path.is_dir() {
            let _ = std::fs::remove_dir_all(path);
        } else {
            let _ = std::fs::remove_file(path);
        }
    } else {
        return Err(CommandError::new("NotDownloaded", "Model is not downloaded."));
    }

    models::update_model_status(&state.app_data_dir, &model_id, DownloadStatus::NotDownloaded)
        .map_err(|e| CommandError::new("DeleteFailed", e))?;

    Ok(())
}
