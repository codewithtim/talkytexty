use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::Stream;
use serde::Serialize;

/// Information about an available audio input device.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

/// List available audio input devices.
#[allow(deprecated)] // cpal::DeviceTrait::name() — stable replacement not yet widely adopted
pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {}", e))?;

    let mut result = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            let is_default = default_name.as_deref() == Some(&name);
            result.push(AudioDeviceInfo { name, is_default });
        }
    }
    Ok(result)
}

/// Handle to an active audio capture stream.
pub struct AudioCapture {
    stream: Stream,
    buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
}

/// Callback type for amplitude updates during capture.
pub type AmplitudeCallback = Box<dyn Fn(Vec<f32>, f32) + Send + 'static>;

impl AudioCapture {
    /// Start capturing audio from the specified or default input device.
    /// Returns the capture handle and the device's native sample rate.
    #[allow(deprecated)] // cpal::DeviceTrait::name()
    pub fn start(amplitude_callback: AmplitudeCallback, device_name: Option<&str>) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = if let Some(name) = device_name {
            host.input_devices()
                .map_err(|e| format!("Failed to enumerate devices: {}", e))?
                .find(|d| d.name().ok().as_deref() == Some(name))
                .unwrap_or_else(|| {
                    log::warn!("Device '{}' not found, falling back to default", name);
                    host.default_input_device().expect("No default input device")
                })
        } else {
            host.default_input_device()
                .ok_or_else(|| "No input device available. Check microphone permissions.".to_string())?
        };

        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get input config: {}", e))?;

        let sample_rate = config.sample_rate();
        let channels = config.channels() as usize;

        // Pre-allocate for up to 10 minutes of recording to avoid reallocations
        let capacity = estimate_buffer_capacity(sample_rate, 600);
        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(capacity)));
        let buffer_clone = Arc::clone(&buffer);

        // Amplitude calculation window (every ~50ms of audio)
        let amplitude_window_size = (sample_rate as usize / 20) * channels;
        let amplitude_buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(amplitude_window_size)));
        let amplitude_buffer_clone = Arc::clone(&amplitude_buffer);

        let stream = device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Convert stereo to mono if needed, store raw samples
                    let mono_samples: Vec<f32> = if channels > 1 {
                        data.chunks(channels)
                            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
                            .collect()
                    } else {
                        data.to_vec()
                    };

                    // Append to main buffer
                    if let Ok(mut buf) = buffer_clone.lock() {
                        buf.extend_from_slice(&mono_samples);
                    }

                    // Collect amplitude samples for visualization
                    if let Ok(mut amp_buf) = amplitude_buffer_clone.lock() {
                        amp_buf.extend_from_slice(&mono_samples);
                        let window = amplitude_window_size / channels.max(1);
                        if amp_buf.len() >= window {
                            let samples: Vec<f32> = amp_buf.drain(..window).collect();
                            let rms = calculate_rms(&samples);
                            let amplitudes = downsample_for_visualization(&samples, 48);
                            amplitude_callback(amplitudes, rms);
                        }
                    }
                },
                |err| {
                    log::error!("Audio capture error: {}", err);
                },
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start audio stream: {}", e))?;

        Ok(Self {
            stream,
            buffer,
            sample_rate,
        })
    }

    /// Stop capturing and return the collected audio buffer and sample rate.
    pub fn stop(self) -> (Vec<f32>, u32) {
        drop(self.stream);
        let buffer = match Arc::try_unwrap(self.buffer) {
            Ok(mutex) => mutex.into_inner().unwrap_or_default(),
            Err(arc) => arc.lock().map(|b| b.clone()).unwrap_or_default(),
        };
        (buffer, self.sample_rate)
    }
}

/// Estimate buffer capacity for a given sample rate and max duration in seconds.
/// Pre-allocating avoids repeated reallocations during long recording sessions.
fn estimate_buffer_capacity(sample_rate: u32, max_duration_secs: u32) -> usize {
    sample_rate as usize * max_duration_secs as usize
}

/// Calculate root mean square of audio samples.
fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

/// Downsample audio to a fixed number of bins for visualization.
fn downsample_for_visualization(samples: &[f32], num_bins: usize) -> Vec<f32> {
    if samples.is_empty() || num_bins == 0 {
        return vec![0.0; num_bins];
    }
    let bin_size = samples.len() / num_bins;
    if bin_size == 0 {
        return samples.iter().copied().chain(std::iter::repeat(0.0)).take(num_bins).collect();
    }
    samples
        .chunks(bin_size)
        .take(num_bins)
        .map(|chunk| {
            chunk.iter().map(|s| s.abs()).sum::<f32>() / chunk.len() as f32
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_rms_silence() {
        assert_eq!(calculate_rms(&[0.0, 0.0, 0.0]), 0.0);
    }

    #[test]
    fn test_calculate_rms_signal() {
        let rms = calculate_rms(&[1.0, -1.0, 1.0, -1.0]);
        assert!((rms - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_downsample_basic() {
        let samples: Vec<f32> = (0..64).map(|i| i as f32 / 64.0).collect();
        let bins = downsample_for_visualization(&samples, 8);
        assert_eq!(bins.len(), 8);
    }

    #[test]
    fn test_downsample_empty() {
        let bins = downsample_for_visualization(&[], 8);
        assert_eq!(bins.len(), 8);
        assert!(bins.iter().all(|&b| b == 0.0));
    }

    #[test]
    fn test_downsample_48_bins() {
        let samples: Vec<f32> = (0..960).map(|i| (i as f32 / 960.0).sin()).collect();
        let bins = downsample_for_visualization(&samples, 48);
        assert_eq!(bins.len(), 48);
        assert!(bins.iter().all(|&b| b >= 0.0));
    }

    #[test]
    fn test_preallocate_capacity_for_long_recording() {
        // 10 minutes at 48kHz mono = 28_800_000 samples
        let capacity = estimate_buffer_capacity(48000, 600);
        assert!(capacity >= 28_800_000);
    }

    #[test]
    fn test_preallocate_capacity_scales_with_duration() {
        let short = estimate_buffer_capacity(48000, 60);
        let long = estimate_buffer_capacity(48000, 600);
        assert!(long > short);
    }
}
