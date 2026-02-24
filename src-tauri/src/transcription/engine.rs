use std::path::Path;
use std::sync::{Arc, Mutex};

use parakeet_rs::Transcriber;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Domain trait for speech-to-text engines.
/// All engines accept 16kHz mono f32 audio and return transcribed text.
pub trait TranscriptionEngine: Send + Sync {
    fn transcribe(&self, audio: &[f32]) -> Result<String, String>;
}

/// Thread-safe wrapper around WhisperContext.
pub struct WhisperEngine {
    ctx: Arc<WhisperContext>,
}

// WhisperContext is Send+Sync, but we wrap for convenience
unsafe impl Send for WhisperEngine {}
unsafe impl Sync for WhisperEngine {}

impl WhisperEngine {
    /// Load a GGML model file into a WhisperContext.
    pub fn load(model_path: &Path) -> Result<Self, String> {
        let path_str = model_path
            .to_str()
            .ok_or_else(|| "Invalid model path encoding".to_string())?;

        let ctx = WhisperContext::new_with_params(path_str, WhisperContextParameters::default())
            .map_err(|e| format!("Failed to load whisper model: {}", e))?;

        Ok(Self {
            ctx: Arc::new(ctx),
        })
    }

    /// Transcribe 16kHz mono f32 audio samples to text.
    pub fn transcribe_audio(&self, audio: &[f32]) -> Result<String, String> {
        if audio.is_empty() {
            return Ok(String::new());
        }

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_single_segment(false);
        params.set_no_context(true);

        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| format!("Failed to create whisper state: {}", e))?;

        state
            .full(params, audio)
            .map_err(|e| format!("Transcription failed: {}", e))?;

        let num_segments = state.full_n_segments();

        let mut text = String::new();
        for i in 0..num_segments {
            if let Some(segment) = state.get_segment(i) {
                let segment_text = segment
                    .to_str_lossy()
                    .map_err(|e| format!("Failed to get segment {} text: {}", i, e))?;
                text.push_str(&segment_text);
            }
        }

        Ok(text.trim().to_string())
    }
}

impl TranscriptionEngine for WhisperEngine {
    fn transcribe(&self, audio: &[f32]) -> Result<String, String> {
        self.transcribe_audio(audio)
    }
}

/// Parakeet speech-to-text engine wrapping ONNX Runtime models.
/// Supports CTC (English-only) and TDT (multilingual) variants.
pub struct ParakeetEngine {
    inner: Mutex<ParakeetInner>,
}

enum ParakeetInner {
    Ctc(Box<parakeet_rs::Parakeet>),
    Tdt(Box<parakeet_rs::ParakeetTDT>),
    Eou(Box<parakeet_rs::ParakeetEOU>),
}

// parakeet_rs types are Send; we use Mutex for Sync
unsafe impl Send for ParakeetInner {}

impl ParakeetEngine {
    /// Load a Parakeet model from a directory.
    /// `variant` should be "ParakeetCTC", "ParakeetTDT", or "ParakeetEOU".
    pub fn load(model_dir: &Path, variant: &str) -> Result<Self, String> {
        let inner = match variant {
            "ParakeetCTC" => {
                let model = parakeet_rs::Parakeet::from_pretrained(model_dir, None)
                    .map_err(|e| format!("Failed to load Parakeet CTC model: {}", e))?;
                ParakeetInner::Ctc(Box::new(model))
            }
            "ParakeetTDT" => {
                let model = parakeet_rs::ParakeetTDT::from_pretrained(model_dir, None)
                    .map_err(|e| format!("Failed to load Parakeet TDT model: {}", e))?;
                ParakeetInner::Tdt(Box::new(model))
            }
            "ParakeetEOU" => {
                let model = parakeet_rs::ParakeetEOU::from_pretrained(model_dir, None)
                    .map_err(|e| format!("Failed to load Parakeet EOU model: {}", e))?;
                ParakeetInner::Eou(Box::new(model))
            }
            _ => return Err(format!("Unknown Parakeet variant: {}", variant)),
        };

        Ok(Self {
            inner: Mutex::new(inner),
        })
    }
}

impl TranscriptionEngine for ParakeetEngine {
    fn transcribe(&self, audio: &[f32]) -> Result<String, String> {
        if audio.is_empty() {
            return Ok(String::new());
        }

        let mut inner = self
            .inner
            .lock()
            .map_err(|e| format!("Failed to acquire engine lock: {}", e))?;

        let result = match &mut *inner {
            ParakeetInner::Ctc(model) => model
                .transcribe_samples(audio.to_vec(), 16000, 1, None)
                .map_err(|e| format!("Parakeet CTC transcription failed: {}", e))?,
            ParakeetInner::Tdt(model) => model
                .transcribe_samples(audio.to_vec(), 16000, 1, None)
                .map_err(|e| format!("Parakeet TDT transcription failed: {}", e))?,
            ParakeetInner::Eou(model) => {
                // ParakeetEOU is a streaming model — feed audio in 160ms chunks
                const CHUNK_SIZE: usize = 2560; // 160ms at 16kHz
                let mut full_text = String::new();
                let chunks: Vec<&[f32]> = audio.chunks(CHUNK_SIZE).collect();
                let last_idx = chunks.len().saturating_sub(1);
                for (i, chunk) in chunks.iter().enumerate() {
                    let is_last = i == last_idx;
                    let text = model
                        .transcribe(chunk, is_last)
                        .map_err(|e| format!("Parakeet EOU transcription failed: {}", e))?;
                    full_text.push_str(&text);
                }
                // Clean up raw token output:
                // - Replace SentencePiece word boundary marker (▁ U+2581) with spaces
                // - Strip <EOU> tokens emitted at utterance boundaries
                let cleaned = full_text.replace('▁', " ").replace("<EOU>", "");
                return Ok(cleaned.trim().to_string());
            }
        };

        Ok(result.text.trim().to_string())
    }
}
