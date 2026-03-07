use tauri::{Emitter, State};

use tokio_util::sync::CancellationToken;

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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<TranscriptionModel, CommandError> {
    use futures_util::StreamExt;
    use crate::transcription::DownloadProgress;

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

    // Persist downloading status BEFORE starting
    models::update_model_status(
        &state.app_data_dir,
        &model_id,
        DownloadStatus::Downloading { progress_percent: 0.0 },
    )
    .map_err(|e| CommandError::new("DownloadFailed", e))?;

    let hf_repo = model.huggingface_repo.clone();
    let filenames = model.huggingface_filenames.clone();
    let app_data_dir = state.app_data_dir.clone();
    let total_size = model.size_bytes;
    let mut bytes_downloaded = 0;

    let client = reqwest::Client::new();

    let cancel_token = CancellationToken::new();
    {
        let mut tokens = state
            .download_cancel_tokens
            .lock()
            .map_err(|e| CommandError::new("LockError", e.to_string()))?;
        tokens.insert(model_id.clone(), cancel_token.clone());
    }

    let start_instant = std::time::Instant::now();
    let mut last_emit = start_instant;
    let mut last_bytes = 0_u64;
    let dest_str = if filenames.len() == 1 {
        // Single file (Whisper)
        let filename = &filenames[0];
        let url = format!("https://huggingface.co/{}/resolve/main/{}", hf_repo, filename);
        let dest = models::model_file_path(&app_data_dir, filename);

        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create directory: {}", e)))?;
        }

        let res = client.get(&url).send().await
            .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to connect: {}", e)))?;

        if !res.status().is_success() {
            return Err(CommandError::new("DownloadFailed", format!("Server returned status: {}", res.status())));
        }

        let mut file = tokio::fs::File::create(&dest).await
            .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create file: {}", e)))?;

        let mut stream = res.bytes_stream();
        while let Some(item) = stream.next().await {
            if cancel_token.is_cancelled() {
                models::update_model_status(
                    &state.app_data_dir,
                    &model_id,
                    DownloadStatus::NotDownloaded,
                )
                .ok();
                return Err(CommandError::new("DownloadCancelled", "Download cancelled."));
            }
            let chunk = item.map_err(|e| CommandError::new("DownloadFailed", format!("Download error: {}", e)))?;
            tokio::io::copy(&mut &chunk[..], &mut file).await
                .map_err(|e| CommandError::new("DownloadFailed", format!("Write error: {}", e)))?;

            bytes_downloaded += chunk.len() as u64;
            let percent = (bytes_downloaded as f32 / total_size as f32) * 100.0;

            let now = std::time::Instant::now();
            if now.duration_since(last_emit).as_millis() > 250 {
                let dt = now.duration_since(last_emit).as_secs_f64().max(0.001);
                let dbytes = bytes_downloaded.saturating_sub(last_bytes);
                let bps = (dbytes as f64 / dt) as u64;
                let remaining = total_size.saturating_sub(bytes_downloaded);
                let eta = if bps > 0 { Some((remaining / bps) as u64) } else { None };

                let _ = app.emit(
                    "download-progress",
                    DownloadProgress {
                        model_id: model_id.clone(),
                        percent,
                        bytes_downloaded,
                        bytes_total: total_size,
                        bytes_per_second: bps,
                        eta_seconds: eta,
                    },
                );
                last_emit = now;
                last_bytes = bytes_downloaded;
            }
        }

        dest.to_string_lossy().to_string()
    } else {
        // Multi-file (Parakeet)
        let dest_dir = models::model_dir_path(&app_data_dir, &model_id);
        tokio::fs::create_dir_all(&dest_dir).await
            .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create model directory: {}", e)))?;

        for filename in &filenames {
            let url = format!("https://huggingface.co/{}/resolve/main/{}", hf_repo, filename);

            // Strip any subdirectory prefix for local storage
            let local_name = std::path::Path::new(filename)
                .file_name()
                .unwrap_or_else(|| std::ffi::OsStr::new(filename));
            let dest_file = dest_dir.join(local_name);

            let res = client.get(&url).send().await
                .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to connect: {}", e)))?;

            if !res.status().is_success() {
                return Err(CommandError::new("DownloadFailed", format!("Server returned status: {}", res.status())));
            }

            let mut file = tokio::fs::File::create(&dest_file).await
                .map_err(|e| CommandError::new("DownloadFailed", format!("Failed to create file: {}", e)))?;

            let mut stream = res.bytes_stream();
            while let Some(item) = stream.next().await {
                if cancel_token.is_cancelled() {
                    models::update_model_status(
                        &state.app_data_dir,
                        &model_id,
                        DownloadStatus::NotDownloaded,
                    )
                    .ok();
                    return Err(CommandError::new("DownloadCancelled", "Download cancelled."));
                }
                let chunk = item.map_err(|e| CommandError::new("DownloadFailed", format!("Download error: {}", e)))?;
                tokio::io::copy(&mut &chunk[..], &mut file).await
                    .map_err(|e| CommandError::new("DownloadFailed", format!("Write error: {}", e)))?;

                bytes_downloaded += chunk.len() as u64;
                let percent = (bytes_downloaded as f32 / total_size as f32) * 100.0;

                let now = std::time::Instant::now();
                if now.duration_since(last_emit).as_millis() > 250 {
                    let dt = now.duration_since(last_emit).as_secs_f64().max(0.001);
                    let dbytes = bytes_downloaded.saturating_sub(last_bytes);
                    let bps = (dbytes as f64 / dt) as u64;
                    let remaining = total_size.saturating_sub(bytes_downloaded);
                    let eta = if bps > 0 { Some((remaining / bps) as u64) } else { None };

                    let _ = app.emit(
                        "download-progress",
                        DownloadProgress {
                            model_id: model_id.clone(),
                            percent,
                            bytes_downloaded,
                            bytes_total: total_size,
                            bytes_per_second: bps,
                            eta_seconds: eta,
                        },
                    );
                    last_emit = now;
                    last_bytes = bytes_downloaded;
                }
            }
        }

        dest_dir.to_string_lossy().to_string()
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
pub async fn cancel_model_download(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), CommandError> {
    let tokens = state
        .download_cancel_tokens
        .lock()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if let Some(token) = tokens.get(&model_id) {
        token.cancel();
    }
    Ok(())
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
