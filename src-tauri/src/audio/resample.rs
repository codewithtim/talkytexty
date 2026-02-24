use rubato::{FftFixedInOut, Resampler};

const WHISPER_SAMPLE_RATE: u32 = 16000;

/// Resample audio from the source sample rate to 16kHz mono f32 for Whisper.
/// If the source is already 16kHz, returns the input unchanged.
pub fn resample_to_16khz(audio: &[f32], source_rate: u32) -> Result<Vec<f32>, String> {
    if source_rate == WHISPER_SAMPLE_RATE {
        return Ok(audio.to_vec());
    }

    if audio.is_empty() {
        return Ok(Vec::new());
    }

    let chunk_size = 1024;
    let mut resampler = FftFixedInOut::<f32>::new(
        source_rate as usize,
        WHISPER_SAMPLE_RATE as usize,
        chunk_size,
        1, // mono
    )
    .map_err(|e| format!("Failed to create resampler: {}", e))?;

    let mut output = Vec::new();
    let frames_needed = resampler.input_frames_next();

    // Process in chunks
    let mut offset = 0;
    while offset + frames_needed <= audio.len() {
        let chunk = &audio[offset..offset + frames_needed];
        let input = vec![chunk.to_vec()];
        let result = resampler
            .process(&input, None)
            .map_err(|e| format!("Resampling failed: {}", e))?;
        if let Some(channel) = result.first() {
            output.extend_from_slice(channel);
        }
        offset += frames_needed;
    }

    // Handle remaining samples by zero-padding
    if offset < audio.len() {
        let remaining = &audio[offset..];
        let mut padded = remaining.to_vec();
        padded.resize(frames_needed, 0.0);
        let input = vec![padded];
        let result = resampler
            .process(&input, None)
            .map_err(|e| format!("Resampling failed on final chunk: {}", e))?;
        if let Some(channel) = result.first() {
            // Only take proportional output for the actual remaining samples
            let expected_output = (remaining.len() as f64
                * WHISPER_SAMPLE_RATE as f64
                / source_rate as f64) as usize;
            let take = expected_output.min(channel.len());
            output.extend_from_slice(&channel[..take]);
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_passthrough_16khz() {
        let audio: Vec<f32> = vec![0.1, 0.2, 0.3];
        let result = resample_to_16khz(&audio, 16000).unwrap();
        assert_eq!(result, audio);
    }

    #[test]
    fn test_resample_empty() {
        let result = resample_to_16khz(&[], 44100).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_resample_44100_to_16000() {
        // Generate 1 second of 44.1kHz sine wave
        let source_rate = 44100;
        let duration_secs = 1.0;
        let num_samples = (source_rate as f32 * duration_secs) as usize;
        let audio: Vec<f32> = (0..num_samples)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / source_rate as f32).sin())
            .collect();

        let result = resample_to_16khz(&audio, source_rate).unwrap();

        // Output should be approximately 16000 samples for 1 second
        let expected_len = 16000;
        let tolerance = 200; // Allow some tolerance for chunk boundary effects
        assert!(
            (result.len() as i64 - expected_len as i64).unsigned_abs() < tolerance,
            "Expected ~{} samples, got {}",
            expected_len,
            result.len()
        );
    }

    #[test]
    fn test_resample_48000_to_16000() {
        let source_rate = 48000;
        let num_samples = source_rate; // 1 second
        let audio: Vec<f32> = (0..num_samples)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / source_rate as f32).sin())
            .collect();

        let result = resample_to_16khz(&audio, source_rate).unwrap();

        let expected_len = 16000;
        let tolerance = 200;
        assert!(
            (result.len() as i64 - expected_len as i64).unsigned_abs() < tolerance,
            "Expected ~{} samples, got {}",
            expected_len,
            result.len()
        );
    }
}
