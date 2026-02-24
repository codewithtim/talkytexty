use std::fs;
use std::path::{Path, PathBuf};

use super::{DownloadStatus, ModelVariant, Quantization, TranscriptionModel};

/// Returns the built-in model registry with download status from disk.
pub fn get_builtin_models(app_data_dir: &Path) -> Vec<TranscriptionModel> {
    let models_dir = app_data_dir.join("models");
    let registry = load_registry(&models_dir);

    builtin_model_definitions()
        .into_iter()
        .map(|mut model| {
            // Check if model is downloaded on disk
            if let Some(saved) = registry.iter().find(|m| m.id == model.id) {
                model.download_status = saved.download_status.clone();
            }
            model
        })
        .collect()
}

/// Returns the local path for a single model file (Whisper).
pub fn model_file_path(app_data_dir: &Path, filename: &str) -> PathBuf {
    app_data_dir.join("models").join(filename)
}

/// Returns the local directory path for a multi-file model (Parakeet).
pub fn model_dir_path(app_data_dir: &Path, model_id: &str) -> PathBuf {
    app_data_dir.join("models").join(model_id)
}

/// Returns the registry JSON path.
fn registry_path(models_dir: &Path) -> PathBuf {
    models_dir.join("registry.json")
}

/// Load saved model metadata from registry.json.
fn load_registry(models_dir: &Path) -> Vec<TranscriptionModel> {
    let path = registry_path(models_dir);
    if !path.exists() {
        return Vec::new();
    }
    let contents = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

/// Save model metadata to registry.json.
pub fn save_registry(
    app_data_dir: &Path,
    models: &[TranscriptionModel],
) -> Result<(), String> {
    let models_dir = app_data_dir.join("models");
    fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let path = registry_path(&models_dir);
    let contents = serde_json::to_string_pretty(models)
        .map_err(|e| format!("Failed to serialize registry: {}", e))?;
    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write registry: {}", e))
}

/// Update a single model's status in the registry.
pub fn update_model_status(
    app_data_dir: &Path,
    model_id: &str,
    status: DownloadStatus,
) -> Result<(), String> {
    let mut models = get_builtin_models(app_data_dir);
    if let Some(model) = models.iter_mut().find(|m| m.id == model_id) {
        model.download_status = status;
    }
    save_registry(app_data_dir, &models)
}

fn builtin_model_definitions() -> Vec<TranscriptionModel> {
    vec![
        TranscriptionModel {
            id: "base-en-q5_1".to_string(),
            name: "Base English (Quantized)".to_string(),
            model_family: "Whisper".to_string(),
            variant: ModelVariant::Base,
            size_bytes: 60 * 1024 * 1024, // ~60 MiB
            languages: vec!["en".to_string()],
            quantization: Some(Quantization::Q5_1),
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "ggerganov/whisper.cpp".to_string(),
            huggingface_filenames: vec!["ggml-base.en-q5_1.bin".to_string()],
        },
        TranscriptionModel {
            id: "small-en".to_string(),
            name: "Small English".to_string(),
            model_family: "Whisper".to_string(),
            variant: ModelVariant::Small,
            size_bytes: 466 * 1024 * 1024, // ~466 MiB
            languages: vec!["en".to_string()],
            quantization: None,
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "ggerganov/whisper.cpp".to_string(),
            huggingface_filenames: vec!["ggml-small.en.bin".to_string()],
        },
        TranscriptionModel {
            id: "small-en-q5_1".to_string(),
            name: "Small English (Quantized)".to_string(),
            model_family: "Whisper".to_string(),
            variant: ModelVariant::Small,
            size_bytes: 190 * 1024 * 1024, // ~190 MiB
            languages: vec!["en".to_string()],
            quantization: Some(Quantization::Q5_1),
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "ggerganov/whisper.cpp".to_string(),
            huggingface_filenames: vec!["ggml-small.en-q5_1.bin".to_string()],
        },
        TranscriptionModel {
            id: "large-v3-turbo-q5_0".to_string(),
            name: "Large V3 Turbo (Quantized)".to_string(),
            model_family: "Whisper".to_string(),
            variant: ModelVariant::LargeV3Turbo,
            size_bytes: 547 * 1024 * 1024, // ~547 MiB
            languages: vec![
                "en".to_string(), "zh".to_string(), "de".to_string(),
                "es".to_string(), "fr".to_string(), "it".to_string(),
                "ja".to_string(), "ko".to_string(), "pt".to_string(),
                "ru".to_string(),
            ],
            quantization: Some(Quantization::Q5_0),
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "ggerganov/whisper.cpp".to_string(),
            huggingface_filenames: vec!["ggml-large-v3-turbo-q5_0.bin".to_string()],
        },
        TranscriptionModel {
            id: "parakeet-ctc-0.6b".to_string(),
            name: "Parakeet CTC 0.6B".to_string(),
            model_family: "Parakeet".to_string(),
            variant: ModelVariant::ParakeetCTC,
            size_bytes: 2_516_582_400, // ~2.4 GB
            languages: vec!["en".to_string()],
            quantization: None,
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "onnx-community/parakeet-ctc-0.6b-ONNX".to_string(),
            huggingface_filenames: vec![
                "onnx/model.onnx".to_string(),
                "onnx/model.onnx_data".to_string(),
                "config.json".to_string(),
                "preprocessor_config.json".to_string(),
                "tokenizer.json".to_string(),
                "tokenizer_config.json".to_string(),
            ],
        },
        TranscriptionModel {
            id: "parakeet-tdt-0.6b-v3".to_string(),
            name: "Parakeet TDT 0.6B v3".to_string(),
            model_family: "Parakeet".to_string(),
            variant: ModelVariant::ParakeetTDT,
            size_bytes: 3_435_973_837, // ~3.2 GB
            languages: vec![
                "en".to_string(), "zh".to_string(), "de".to_string(),
                "es".to_string(), "fr".to_string(), "it".to_string(),
                "ja".to_string(), "ko".to_string(), "pt".to_string(),
                "ru".to_string(), "nl".to_string(), "pl".to_string(),
                "uk".to_string(), "hi".to_string(), "ar".to_string(),
                "sv".to_string(), "fi".to_string(), "no".to_string(),
                "da".to_string(), "tr".to_string(), "he".to_string(),
                "hu".to_string(), "cs".to_string(), "el".to_string(),
                "ca".to_string(),
            ],
            quantization: None,
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "istupakov/parakeet-tdt-0.6b-v3-onnx".to_string(),
            huggingface_filenames: vec![
                "encoder-model.onnx".to_string(),
                "encoder-model.onnx.data".to_string(),
                "decoder_joint-model.onnx".to_string(),
                "vocab.txt".to_string(),
            ],
        },
        TranscriptionModel {
            id: "parakeet-eou-120m".to_string(),
            name: "Parakeet Realtime EOU 120M".to_string(),
            model_family: "Parakeet".to_string(),
            variant: ModelVariant::ParakeetEOU,
            size_bytes: 481_000_000, // ~481 MB
            languages: vec!["en".to_string()],
            quantization: None,
            download_status: DownloadStatus::NotDownloaded,
            huggingface_repo: "altunenes/parakeet-rs".to_string(),
            huggingface_filenames: vec![
                "realtime_eou_120m-v1-onnx/encoder.onnx".to_string(),
                "realtime_eou_120m-v1-onnx/decoder_joint.onnx".to_string(),
                "realtime_eou_120m-v1-onnx/tokenizer.json".to_string(),
            ],
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_models_returns_six_models() {
        let models = builtin_model_definitions();
        assert_eq!(models.len(), 7);
    }

    #[test]
    fn test_builtin_models_all_not_downloaded() {
        let models = builtin_model_definitions();
        for model in &models {
            assert!(matches!(model.download_status, DownloadStatus::NotDownloaded));
        }
    }

    #[test]
    fn test_model_ids_are_unique() {
        let models = builtin_model_definitions();
        let mut ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), models.len());
    }

    #[test]
    fn test_save_and_load_registry() {
        let temp_dir = std::env::temp_dir().join("ttc_test_registry");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let models = builtin_model_definitions();
        save_registry(&temp_dir, &models).unwrap();

        let loaded = get_builtin_models(&temp_dir);
        assert_eq!(loaded.len(), 7);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
