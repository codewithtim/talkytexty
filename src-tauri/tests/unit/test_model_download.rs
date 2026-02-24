// T047: Unit test for model downloading via hf-hub
//
// Tests verify:
// - Model file is written to the correct app data directory
// - Registry is updated after download
// - Download status transitions correctly

use std::fs;

use text_to_code_lib::transcription::models;
use text_to_code_lib::transcription::DownloadStatus;

#[test]
fn test_model_file_path_points_to_models_dir() {
    let app_data_dir = std::path::Path::new("/tmp/ttc_test_download");
    let path = models::model_file_path(app_data_dir, "ggml-base.en-q5_1.bin");
    assert_eq!(
        path,
        app_data_dir.join("models").join("ggml-base.en-q5_1.bin")
    );
}

#[test]
fn test_registry_update_sets_downloaded_status() {
    let temp_dir = std::env::temp_dir().join("ttc_test_download_registry");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(temp_dir.join("models")).unwrap();

    // First get models (all NotDownloaded)
    let models = models::get_builtin_models(&temp_dir);
    let model_id = &models[0].id;
    assert!(matches!(
        models[0].download_status,
        DownloadStatus::NotDownloaded
    ));

    // Simulate download by updating status
    let fake_path = temp_dir
        .join("models")
        .join(&models[0].huggingface_filenames[0]);
    fs::write(&fake_path, b"fake model data").unwrap();

    models::update_model_status(
        &temp_dir,
        model_id,
        DownloadStatus::Downloaded {
            local_path: fake_path.to_string_lossy().to_string(),
        },
    )
    .unwrap();

    // Verify status updated in registry
    let updated = models::get_builtin_models(&temp_dir);
    let model = updated.iter().find(|m| m.id == *model_id).unwrap();
    assert!(
        matches!(&model.download_status, DownloadStatus::Downloaded { local_path } if !local_path.is_empty()),
        "Model should be Downloaded with a path"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_registry_preserves_status_across_reloads() {
    let temp_dir = std::env::temp_dir().join("ttc_test_download_persist");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(temp_dir.join("models")).unwrap();

    let models = models::get_builtin_models(&temp_dir);
    let model_id = models[0].id.clone();

    // Set as downloaded
    models::update_model_status(
        &temp_dir,
        &model_id,
        DownloadStatus::Downloaded {
            local_path: "/fake/path.bin".to_string(),
        },
    )
    .unwrap();

    // Reload and verify persistence
    let reloaded = models::get_builtin_models(&temp_dir);
    let model = reloaded.iter().find(|m| m.id == model_id).unwrap();
    assert!(matches!(
        &model.download_status,
        DownloadStatus::Downloaded { .. }
    ));

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_update_model_status_for_unknown_model_does_not_error() {
    let temp_dir = std::env::temp_dir().join("ttc_test_download_unknown");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(temp_dir.join("models")).unwrap();

    // Updating a non-existent model ID should still succeed (no-op for the status)
    let result = models::update_model_status(
        &temp_dir,
        "nonexistent-model-id",
        DownloadStatus::Downloaded {
            local_path: "/fake.bin".to_string(),
        },
    );
    assert!(result.is_ok());

    // Verify no model has the fake status
    let models = models::get_builtin_models(&temp_dir);
    for model in &models {
        if model.id == "nonexistent-model-id" {
            panic!("Unknown model should not appear in registry");
        }
    }

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_update_status_back_to_not_downloaded() {
    let temp_dir = std::env::temp_dir().join("ttc_test_download_revert");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(temp_dir.join("models")).unwrap();

    let models = models::get_builtin_models(&temp_dir);
    let model_id = models[0].id.clone();

    // Set as downloaded then revert
    models::update_model_status(
        &temp_dir,
        &model_id,
        DownloadStatus::Downloaded {
            local_path: "/fake.bin".to_string(),
        },
    )
    .unwrap();

    models::update_model_status(&temp_dir, &model_id, DownloadStatus::NotDownloaded).unwrap();

    let reloaded = models::get_builtin_models(&temp_dir);
    let model = reloaded.iter().find(|m| m.id == model_id).unwrap();
    assert!(matches!(
        model.download_status,
        DownloadStatus::NotDownloaded
    ));

    let _ = fs::remove_dir_all(&temp_dir);
}
