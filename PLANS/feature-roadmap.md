# TalkyTexty Feature Roadmap

## Critical Performance Fixes (Phase 1) - HIGH PRIORITY

### 1.1 GPU Acceleration
**Current Issue**: `whisper-rs = "0.15"` has no GPU features enabled - running pure CPU.

**Solution**: Update `Cargo.toml` with platform-specific features:
```toml
[target.'cfg(target_os = "macos")'.dependencies]
whisper-rs = { version = "0.15", features = ["metal", "coreml"] }

[target.'cfg(target_os = "linux")'.dependencies]
whisper-rs = { version = "0.15", features = ["cuda"] }

[target.'cfg(target_os = "windows")'.dependencies]
whisper-rs = { version = "0.15", features = ["cuda"] }
```

**Expected Speedup**:
- CPU: ~3-5s for 10s audio
- CUDA/Metal: ~0.3-0.5s
- CUDA FP16: ~0.15-0.2s

### 1.2 Persistent WhisperState Cache
**Current Issue**: Every transcription creates a new state via `ctx.create_state()` - memory allocation overhead.

**Location**: `@/home/kai/talkytexty/src-tauri/src/transcription/engine.rs:53-56`

**Solution**: Cache and reuse `WhisperState`:
```rust
pub struct WhisperEngine {
    ctx: Arc<WhisperContext>,
    state: Mutex<Option<WhisperState>>,  // Cache state
}
```

### 1.3 Fix Spaced-Letter Output Bug
**Issue**: Certain models/quantizations emit character-level tokens ("t h i s" instead of "this").

**Solution**: Add token repetition penalties:
```rust
params.set_repetition_penalty(1.1);  // Prevents token repetition
params.set_temperature(0.0);         // Greedy decoding
params.set_entropy_thold(2.4);       // Skip low-confidence repetition
```

### 1.4 Flash Attention
Enable `flash_attn` for 2-3x speedup on modern GPUs.

### 1.5 GPU Layer Offloading
For NVIDIA GPUs:
```rust
params.set_gpu_layers(32);  // Offload all layers to GPU
```

---

## Audio Input Features (Phase 2) - HIGH PRIORITY

### 2.1 Input Gain Control
- Slider in settings to adjust microphone sensitivity
- Currently only warns on low audio
- Store gain setting in `UserPreferences`

### 2.2 Noise Suppression Toggle
- Enable/disable basic noise filtering
- Use RNNoise or similar lightweight noise reduction
- Beneficial for noisy environments

### 2.3 Quick Audio Test
- "Test mic" button in settings
- Records 5-second sample and plays back
- Helps users verify setup before first use

### 2.4 Real-time Streaming Transcription
- Show partial results while recording
- Whisper supports this via chunk processing
- ParakeetEOU already supports streaming (chunks of 2560 samples = 160ms at 16kHz)
- Process audio in chunks during recording, not after

**Implementation**:
- Use `whisper_full_parallel()` or chunk processing
- Start partial transcription after 500ms of audio
- First word appears in <500ms instead of waiting for recording to end

---

## History Management (Phase 3) - MEDIUM PRIORITY

### 3.1 Search & Filter
- Search transcriptions by content
- Filter by date range
- Filter by application (if tracked)

### 3.2 Export Options
- Export as TXT (plain text)
- Export as JSON (full metadata)
- Export as SRT (subtitles with timestamps)

### 3.3 Favorites/Pinning
- Star important transcriptions
- Keep starred items at top
- Quick access to frequently used phrases

### 3.4 Bulk Operations
- Multi-select entries
- Bulk delete
- Bulk export

### 3.5 Audio Playback
- Play back original audio from history entry
- Audio data already stored in `recordings/` directory
- Add playback controls in history panel

### 3.6 Edit History
- Modify transcription text after the fact
- Store edit timestamp
- Useful for corrections

### 3.7 Copy Without Switching
- Copy any history item to clipboard
- Stay in current app
- Quick access via keyboard shortcut

---

## UI Enhancements (Phase 4) - MEDIUM PRIORITY

### 4.1 Mini Mode Enhancements
- Even smaller "dot" mode showing just recording status
- Minimal screen real estate usage

### 4.2 Always-on-Top Toggle
- Keep overlay visible when clicking elsewhere
- Useful for reference while typing

### 4.3 Theme Customization
- Manual dark/light mode override
- Currently follows system theme

### 4.4 Opacity Presets
- Quick opacity buttons: 25%, 50%, 75%, 100%
- Currently single opacity slider

### 4.5 Position Snap-to-Edge
- Magnetic edge snapping when dragging overlay
- Prevents overlay from going off-screen

### 4.6 Multi-Monitor Support
- Option to show overlay on specific monitor
- Remember position per monitor

### 4.7 Screen Reader Mode
- Audio announcements instead of visual overlay
- Accessibility improvement

---

## Model Management (Phase 5) - MEDIUM PRIORITY

### 5.1 Auto-Model Selection
- Suggest best model based on available RAM/CPU
- System requirements detection
- Smart defaults for new users

### 5.2 Model Caching Info
- Show memory usage per loaded model
- Help users understand resource impact

### 5.3 Background Preloading
- Preload model on app start if `active_model_id` is set
- Instant first recording

### 5.4 Model Auto-Cleanup
- Settings exist for auto-cleanup
- Add "Cleanup Now" button for manual trigger
- Clear unused models

### 5.5 Partial Model Download Resume
- Resume interrupted downloads
- Don't restart from beginning
- Checksum-verified resume

---

## Text Injection Improvements (Phase 6) - MEDIUM PRIORITY

### 6.1 Undo Support
- Cmd/Ctrl+Z after injection to remove last transcription
- Track last injected text
- Cross-application undo

### 6.2 Cursor Memory
- Return cursor to original position after injection
- Useful for partial text replacement
- Store cursor position before injection

### 6.3 Typing Speed Control
- Adjust keystroke delay
- Some apps struggle with fast input
- Configurable in settings

### 6.4 Async Keystroke Queue
- Don't block on each keystroke
- Batch and type in background
- Smoother injection experience

### 6.5 Smart Pacing
- Type faster in empty fields
- Slower in rich text editors
- Auto-detect target app type

---

## Advanced Features (Phase 7) - LOW PRIORITY

### 7.1 Custom Vocabulary
- Personal dictionary for names, technical terms, acronyms
- Whisper often misses these
- Prompt engineering or post-processing

### 7.2 Smart Punctuation
- Auto-detect questions, exclamations based on intonation/tone
- Improve readability without manual editing

### 7.3 Multiple Alternative Results
- Show top-N transcriptions when confidence is low
- GUI to select which one
- Improves accuracy for ambiguous speech

---

## Performance Optimizations (Ongoing)

### Startup & Model Loading
- [ ] Lazy Model Loading — Don't load until first recording
- [ ] Model Pre-warming — Optional startup load for instant recording
- [ ] Parallel Model Download — Concurrent chunk downloads
- [ ] Delta Model Updates — Only download changed weights
- [ ] Compressed Model Cache — Memory-mapped or compressed until needed

### Recording Pipeline
- [ ] Zero-Copy Audio Buffers — Ring buffers, avoid Vec allocations
- [ ] Lock-Free Audio Queue — crossbeam channels instead of Mutex
- [ ] GPU Resampling — Move 48kHz→16kHz to CUDA/Metal
- [ ] VAD on GPU — Silero VAD for <1ms latency
- [ ] Circular Recording Buffer — Pre-allocate max duration buffer
- [ ] Immediate Transcription Start — Begin after 500ms (streaming)

### Transcription Engine
- [ ] Persistent KV Cache — Keep attention key-values between segments (50%+ speedup)
- [ ] Batch Processing — Parallel segment processing
- [ ] Speculative Decoding — Draft model + main model verification (2x speedup)
- [ ] Flash Attention 2 — Memory-efficient attention
- [ ] INT8/INT4 Quantization — Smaller models with minimal quality loss
- [ ] Model Compilation — ONNX Runtime graph optimization for Parakeet
- [ ] TensorRT for NVIDIA — 3-5x speedup
- [ ] CoreML ANE for Apple — Apple Neural Engine efficiency

### Memory Management
- [ ] Memory-Mapped Models — Load weights on-demand (10x less RAM)
- [ ] Automatic Memory Pressure Handling — Unload when system memory < 10%
- [ ] Streaming Audio Without Buffering — Stream to disk if needed
- [ ] Generational GC — jemallocator or mimalloc for better heap performance

### UI & Responsiveness
- [ ] Skeletal Loading States — Placeholder UI immediately
- [ ] Virtualized History List — Virtual scroll for 1000+ entries
- [ ] Debounced Settings Saves — Batch writes every 5s
- [ ] Off-Main-Thread Audio Viz — Worker thread for soundwave
- [ ] Reduced Motion Mode — Disable animations for low-end systems
- [ ] Frame Pacing — 30fps when idle, 60fps when interacting

### Power Efficiency
- [ ] Adaptive Quality — Lower precision on battery
- [ ] Recording Timeout — Auto-stop after X seconds of silence
- [ ] Background App Detection — Reduce CPU priority for fullscreen games
- [ ] Sleep/Wake Handling — Proper pause/resume without leaks

### Network & I/O
- [ ] Zero-Copy Downloads — Stream directly to disk
- [ ] Checksum-Verified Resume — Verify partial downloads
- [ ] Parallel Chunk Hashing — Compute SHA during download
- [ ] Async FS Operations — tokio::fs instead of std::fs

### Monitoring & Optimization
- [ ] Performance HUD — Debug mode showing latency, GPU, memory
- [ ] Automatic Profiling — Log slow operations (>100ms)
- [ ] Adaptive Settings — Auto-suggest faster model if consistently slow
- [ ] Cold Start Diagnostics — Show startup time breakdown

---

## Implementation Priority

### Immediate (Next Sprint)
1. GPU acceleration (Metal/CUDA)
2. Persistent state caching
3. Spaced-letter bug fix
4. Real-time streaming transcription

### Short-term (1-2 Sprints)
1. Input gain control
2. Noise suppression toggle
3. Audio playback from history
4. Search & filter history

### Medium-term (3-4 Sprints)
1. Export options
2. Mini mode enhancements
3. Model auto-selection
4. Undo support

### Long-term (Future)
1. Custom vocabulary
2. Smart punctuation
3. Multiple alternatives
4. Performance HUD

---

## Technical Debt

1. **State Recreation** — Every transcription creates new WhisperState
2. **CPU-only inference** — No GPU acceleration enabled
3. **Blocking audio processing** — No streaming during recording
4. **Mutex-based audio queue** — Could use lock-free channels
5. **No memory pressure handling** — Could OOM on low-RAM systems
