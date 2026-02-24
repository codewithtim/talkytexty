// T028: Unit tests for audio resampling module
//
// Tests verify that rubato correctly converts 44.1kHz/48kHz to 16kHz mono.
// Additional edge case tests complement the inline tests in resample.rs.

use text_to_code_lib::audio::resample::resample_to_16khz;

#[test]
fn test_resample_16khz_passthrough() {
    let audio: Vec<f32> = (0..1600)
        .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 16000.0).sin())
        .collect();

    let result = resample_to_16khz(&audio, 16000).unwrap();
    assert_eq!(result.len(), audio.len());
    assert_eq!(result, audio);
}

#[test]
fn test_resample_empty_input() {
    let result = resample_to_16khz(&[], 44100).unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_resample_44100_produces_correct_length() {
    let source_rate = 44100u32;
    let duration_secs = 2.0f32;
    let num_samples = (source_rate as f32 * duration_secs) as usize;
    let audio: Vec<f32> = (0..num_samples)
        .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / source_rate as f32).sin())
        .collect();

    let result = resample_to_16khz(&audio, source_rate).unwrap();

    let expected = (16000.0 * duration_secs) as usize;
    let tolerance = 400; // Allow for chunk boundary effects
    assert!(
        (result.len() as i64 - expected as i64).unsigned_abs() < tolerance,
        "Expected ~{} samples for {}s at 16kHz, got {}",
        expected,
        duration_secs,
        result.len()
    );
}

#[test]
fn test_resample_48000_produces_correct_length() {
    let source_rate = 48000u32;
    let num_samples = source_rate as usize;
    let audio: Vec<f32> = (0..num_samples)
        .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / source_rate as f32).sin())
        .collect();

    let result = resample_to_16khz(&audio, source_rate).unwrap();

    let expected = 16000usize;
    let tolerance = 200;
    assert!(
        (result.len() as i64 - expected as i64).unsigned_abs() < tolerance,
        "Expected ~{} samples, got {}",
        expected,
        result.len()
    );
}

#[test]
fn test_resample_output_is_finite() {
    let source_rate = 44100u32;
    let audio: Vec<f32> = (0..44100)
        .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / source_rate as f32).sin())
        .collect();

    let result = resample_to_16khz(&audio, source_rate).unwrap();

    for (i, sample) in result.iter().enumerate() {
        assert!(
            sample.is_finite(),
            "Sample {} is not finite: {}",
            i,
            sample
        );
    }
}

#[test]
fn test_resample_preserves_silence() {
    let audio = vec![0.0f32; 44100]; // 1 second of silence at 44.1kHz
    let result = resample_to_16khz(&audio, 44100).unwrap();

    // All output samples should be zero (or near-zero due to floating point)
    for sample in &result {
        assert!(
            sample.abs() < 1e-6,
            "Expected silence, got amplitude {}",
            sample
        );
    }
}
