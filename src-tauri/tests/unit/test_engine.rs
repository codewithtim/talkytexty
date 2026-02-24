// T029: Unit tests for whisper-rs engine wrapper
//
// WhisperEngine::load requires an actual GGML model file on disk.
// Tests that need a model are marked #[ignore].
// Error handling and edge cases are tested without a model.

use std::path::PathBuf;
use text_to_code_lib::transcription::engine::{ParakeetEngine, WhisperEngine};

#[test]
fn test_engine_load_invalid_path_returns_error() {
    let result = WhisperEngine::load(&PathBuf::from("/nonexistent/model.bin"));
    assert!(result.is_err());
    let err = result.err().expect("Expected an error");
    assert!(
        err.contains("Failed to load whisper model"),
        "Expected model load error, got: {}",
        err
    );
}

#[test]
fn test_engine_load_empty_file_returns_error() {
    let temp_dir = tempfile::tempdir().unwrap();
    let model_path = temp_dir.path().join("empty.bin");
    std::fs::write(&model_path, b"").unwrap();

    let result = WhisperEngine::load(&model_path);
    assert!(result.is_err(), "Expected error loading empty file");
}

#[test]
fn test_engine_load_invalid_file_returns_error() {
    let temp_dir = tempfile::tempdir().unwrap();
    let model_path = temp_dir.path().join("invalid.bin");
    std::fs::write(&model_path, b"this is not a valid GGML model file").unwrap();

    let result = WhisperEngine::load(&model_path);
    assert!(result.is_err(), "Expected error loading invalid file");
}

#[test]
#[ignore] // Requires a downloaded whisper model
fn test_engine_transcribe_silence_returns_empty_or_minimal() {
    // This test requires a model at a known path.
    // Set TTC_MODEL_PATH env var or use the default app data location.
    let model_path = std::env::var("TTC_MODEL_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").expect("HOME not set");
            PathBuf::from(home)
                .join("Library/Application Support/com.text-to-code.app/models/ggml-base.en-q5_1.bin")
        });

    if !model_path.exists() {
        panic!("Model not found at {:?}. Download it first.", model_path);
    }

    let engine = WhisperEngine::load(&model_path).unwrap();

    // 1 second of silence at 16kHz
    let silence = vec![0.0f32; 16000];
    let result = engine.transcribe_audio(&silence).unwrap();

    // Silence should produce empty or very short transcription
    assert!(
        result.len() < 50,
        "Expected minimal text for silence, got: '{}'",
        result
    );
}

#[test]
#[ignore] // Requires a downloaded whisper model
fn test_engine_transcribe_empty_audio_returns_empty() {
    let model_path = std::env::var("TTC_MODEL_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").expect("HOME not set");
            PathBuf::from(home)
                .join("Library/Application Support/com.text-to-code.app/models/ggml-base.en-q5_1.bin")
        });

    if !model_path.exists() {
        panic!("Model not found at {:?}.", model_path);
    }

    let engine = WhisperEngine::load(&model_path).unwrap();
    let result = engine.transcribe_audio(&[]).unwrap();
    assert!(result.is_empty(), "Expected empty result for empty audio");
}

// --- ParakeetEngine error tests ---

#[test]
fn test_parakeet_load_invalid_path_returns_error() {
    let result = ParakeetEngine::load(&PathBuf::from("/nonexistent/model_dir"), "ParakeetCTC");
    assert!(result.is_err());
    let err = result.err().expect("Expected an error");
    assert!(
        err.contains("Failed to load Parakeet CTC model"),
        "Expected Parakeet CTC load error, got: {}",
        err
    );
}

#[test]
fn test_parakeet_tdt_load_invalid_path_returns_error() {
    let result = ParakeetEngine::load(&PathBuf::from("/nonexistent/model_dir"), "ParakeetTDT");
    assert!(result.is_err());
    let err = result.err().expect("Expected an error");
    assert!(
        err.contains("Failed to load Parakeet TDT model"),
        "Expected Parakeet TDT load error, got: {}",
        err
    );
}

#[test]
fn test_parakeet_load_unknown_variant_returns_error() {
    let result = ParakeetEngine::load(&PathBuf::from("/some/path"), "UnknownVariant");
    assert!(result.is_err());
    let err = result.err().expect("Expected an error");
    assert!(
        err.contains("Unknown Parakeet variant"),
        "Expected unknown variant error, got: {}",
        err
    );
}
