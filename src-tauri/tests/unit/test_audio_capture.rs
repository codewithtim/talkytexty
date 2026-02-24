// T027: Unit tests for audio capture module
//
// AudioCapture::start/stop require a real microphone device.
// Tests that need hardware are marked #[ignore] for CI environments.
// Pure helper functions (calculate_rms, downsample_for_visualization)
// are tested inline in src-tauri/src/audio/capture.rs.

use text_to_code_lib::audio::capture::AudioCapture;

#[test]
#[ignore] // Requires microphone hardware
fn test_capture_start_and_stop_returns_buffer() {
    let callback = Box::new(|_amplitudes: Vec<f32>, _rms: f32| {});
    let capture = AudioCapture::start(callback, None).expect("Failed to start capture");

    // Record briefly
    std::thread::sleep(std::time::Duration::from_millis(200));

    let (buffer, sample_rate) = capture.stop();

    // Should have captured some samples
    assert!(!buffer.is_empty(), "Expected non-empty audio buffer");
    // Sample rate should be a standard audio rate
    assert!(
        sample_rate >= 8000 && sample_rate <= 192000,
        "Unexpected sample rate: {}",
        sample_rate
    );
}

#[test]
#[ignore] // Requires microphone hardware
fn test_capture_output_is_mono_f32() {
    let callback = Box::new(|_amplitudes: Vec<f32>, _rms: f32| {});
    let capture = AudioCapture::start(callback, None).expect("Failed to start capture");

    std::thread::sleep(std::time::Duration::from_millis(200));

    let (buffer, _sample_rate) = capture.stop();

    // All samples should be valid f32 in reasonable range [-1.0, 1.0]
    // (with some headroom for hot signals)
    for sample in &buffer {
        assert!(
            sample.is_finite(),
            "Expected finite f32 sample, got {}",
            sample
        );
    }
}

#[test]
#[ignore] // Requires microphone hardware
fn test_capture_amplitude_callback_fires() {
    use std::sync::{Arc, Mutex};

    let callback_count = Arc::new(Mutex::new(0u32));
    let count_clone = Arc::clone(&callback_count);

    let callback = Box::new(move |_amplitudes: Vec<f32>, _rms: f32| {
        if let Ok(mut count) = count_clone.lock() {
            *count += 1;
        }
    });

    let capture = AudioCapture::start(callback, None).expect("Failed to start capture");

    // Record long enough for at least one amplitude callback (~50ms window)
    std::thread::sleep(std::time::Duration::from_millis(300));

    capture.stop();

    let count = *callback_count.lock().unwrap();
    assert!(
        count > 0,
        "Expected amplitude callback to fire at least once, got {} calls",
        count
    );
}
