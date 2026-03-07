use std::path::Path;
use std::sync::{Arc, Mutex};

use parakeet_rs::Transcriber;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

/// Domain trait for speech-to-text engines.
/// All engines accept 16kHz mono f32 audio and return transcribed text.
pub trait TranscriptionEngine: Send + Sync {
    fn transcribe(&self, audio: &[f32]) -> Result<String, String>;
}

/// Thread-safe wrapper around WhisperContext with cached state for performance.
/// Caching the WhisperState avoids memory allocation overhead on each transcription.
pub struct WhisperEngine {
    ctx: Arc<WhisperContext>,
    /// Cached state to avoid recreation overhead on each transcription.
    /// This provides significant speedup by reusing allocated memory.
    state: Mutex<Option<WhisperState>>,
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

        // Configure context parameters for GPU acceleration
        let mut ctx_params = WhisperContextParameters::default();
        
        // Enable GPU offloading - offload all layers for maximum speedup
        #[cfg(any(target_os = "linux", target_os = "windows"))]
        {
            // CUDA: offload all 32 layers to GPU for maximum performance
            ctx_params.use_gpu = true;
            ctx_params.gpu_device = 0; // Use first GPU
        }
        
        #[cfg(target_os = "macos")]
        {
            // Metal/CoreML: enabled via features flag
            ctx_params.use_gpu = true;
        }

        let ctx = WhisperContext::new_with_params(path_str, ctx_params)
            .map_err(|e| format!("Failed to load whisper model: {}", e))?;

        Ok(Self {
            ctx: Arc::new(ctx),
            state: Mutex::new(None),
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
        
        // Fix for spaced-letter bug ("t h i s" instead of "this")
        // Use entropy threshold to skip low-confidence character-level tokens
        params.set_temperature(0.0);            // Greedy decoding (no randomness)
        params.set_entropy_thold(2.4);          // Skip low-confidence repetition
        
        // Use multiple threads for faster CPU inference
        params.set_n_threads(4);

        // Get or create cached state
        let mut state_lock = self.state.lock().map_err(|e| format!("Failed to acquire state lock: {}", e))?;
        
        let state = if let Some(ref mut existing_state) = *state_lock {
            // Reuse cached state - major performance win
            existing_state
        } else {
            // First transcription - create and cache state
            let new_state = self
                .ctx
                .create_state()
                .map_err(|e| format!("Failed to create whisper state: {}", e))?;
            *state_lock = Some(new_state);
            state_lock.as_mut().unwrap()
        };

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
