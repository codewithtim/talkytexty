# Text to Code - Project Research Report

## Executive Summary

Text to Code is a cross-platform desktop application that captures speech via a global hotkey, transcribes it locally using on-device AI models, and injects the resulting text into any target application. It runs entirely offline — no API keys, no cloud, no data leaves the machine. Built with Tauri v2 (Rust backend + React/TypeScript frontend), it operates as a system tray background process with a floating recording overlay and a settings UI.

The project is in active development on the `001-voice-input` feature branch. All planned implementation tasks from the original specification are marked complete. The codebase is well-structured, thoroughly documented, and follows a formal development constitution. Several TODO items remain for polish, additional features, and distribution.

---

## Architecture

### High-Level Design

The app is a **Tauri v2 desktop application** with two distinct execution layers:

1. **Rust backend** (`src-tauri/src/`): Handles audio capture, transcription, text injection, preferences persistence, hotkey routing, system tray, and window management.
2. **React frontend** (`src/`): Provides the settings UI, model management, hotkey configuration, recording overlay, and window picker.

Communication between layers uses **Tauri commands** (`invoke()`) for request/response and **Tauri Channels** for streaming data (amplitude updates during recording).

### Window Architecture

Three Tauri webview windows are defined in `tauri.conf.json`:

| Window | Size | Purpose | Behavior |
|--------|------|---------|----------|
| `main` (settings) | 800x600 | Model management, hotkey config, preferences | Hidden by default, opened from system tray. Close hides rather than quits. |
| `recording-overlay` | 300x80 | Floating pill showing recording status + soundwave | Transparent, always-on-top, click-through (`set_ignore_cursor_events`), non-focusable. Shown during recording, hidden on completion. |
| `window-picker` | 640x140 | macOS Cmd+Tab-style app selector for text injection target | Transparent, always-on-top, focusable (for keyboard navigation), centered on screen. |

### Backend Module Organization (Domain-Driven Design)

The Rust backend is organized by **bounded context**, not technical layer:

```
src-tauri/src/
  lib.rs              — App entry point: tray setup, hotkey registration, overlay positioning, window lifecycle
  main.rs             — Thin binary entry point, calls lib::run()
  hotkeys.rs          — Pure function hotkey event routing (HotkeyEvent → HotkeyResponse)
  audio/
    mod.rs            — Domain types: RecordingSession, RecordingStatus, AudioEvent, TranscriptionResult
    capture.rs        — Microphone capture via cpal, stereo→mono conversion, amplitude calculation
    resample.rs       — Sample rate conversion (device native → 16kHz) via rubato FFT resampler
  transcription/
    mod.rs            — Domain types: TranscriptionModel, ModelVariant, Quantization, DownloadStatus
    engine.rs         — TranscriptionEngine trait + WhisperEngine and ParakeetEngine implementations
    models.rs         — Builtin model registry (7 models), JSON persistence, HuggingFace download paths
  injection/
    mod.rs            — Domain type: TargetWindow
    keyboard.rs       — Text injection via enigo simulated keystrokes
    clipboard.rs      — Text injection via clipboard paste (arboard + Cmd/Ctrl+V), restores previous clipboard
    windows.rs        — Window enumeration via x-win, deduplication by app name, platform-specific activation
  preferences/
    mod.rs            — Domain types: UserPreferences, HotkeyBinding, HotkeyAction, RecordingMode, etc.
    storage.rs        — JSON file persistence for preferences
  commands/
    mod.rs            — CommandError type (code + message)
    audio_commands.rs — start_recording, stop_recording Tauri commands
    model_commands.rs — list_models, set_active_model, download_model, delete_model
    injection_commands.rs — inject_text, list_windows, copy_to_clipboard
    preferences_commands.rs — get_preferences, update_preferences (with hotkey re-registration)
    system_commands.rs — check_permissions, request_permission (macOS Accessibility + Microphone)
```

### Frontend Organization

```
src/
  main.tsx            — React app entry point
  App.tsx             — BrowserRouter with route-based window switching (overlay, picker, main)
  index.css           — Tailwind CSS v4 import
  types/index.ts      — TypeScript interfaces matching all Rust domain types
  pages/
    settings.tsx      — Main settings page with nav to models/hotkeys, target mode toggle
    models.tsx        — Model list with download/activate/delete actions
    hotkeys.tsx       — Hotkey bindings with toggle enable/disable and key recorder
    overlay.tsx       — Transparent recording overlay with soundwave visualization
    picker.tsx        — Window picker (Cmd+Tab style) for target window selection
  components/
    recording-pill.tsx — Pill-shaped recording indicator with status dot + soundwave
    soundwave.tsx     — Canvas-based 32-bar amplitude visualization with smooth interpolation
    model-card.tsx    — Individual model display with download/activate/delete states
    hotkey-recorder.tsx — Interactive hotkey capture component (records key combinations)
  hooks/
    use-recording.ts  — Core recording state machine (idle→recording→transcribing→injecting→idle)
    use-models.ts     — Model CRUD operations via Tauri commands
    use-preferences.ts — Preferences read/update via Tauri commands
    use-audio-stream.ts — Listens for amplitude-update events for overlay visualization
```

---

## Core Data Flow

### Recording → Transcription → Injection Pipeline

1. **Hotkey press** → Rust global shortcut handler fires → `resolve_hotkey_event()` determines action → emits `hotkey-start-recording` event
2. **Frontend** `useRecording` hook listens → calls `invoke("start_recording")` with a Channel
3. **Backend** `start_recording` command → validates (model loaded, not already recording) → starts `AudioCapture` via cpal → streams `AmplitudeUpdate` events → shows overlay window → returns session ID
4. **During recording** → amplitude data flows: cpal callback → amplitude buffer → downsample to 32 bins → Channel → frontend → Canvas soundwave visualization
5. **Hotkey press again** → emits `hotkey-stop-recording` → frontend calls `invoke("stop_recording")`
6. **Backend** `stop_recording` → stops capture → resamples audio to 16kHz via rubato → runs transcription engine → returns `TranscriptionResult` → hides overlay
7. **Frontend** receives text → checks target mode:
   - **ActiveWindow mode**: calls `invoke("inject_text")` directly
   - **WindowPicker mode**: emits `show-picker` event → picker window appears → user selects target → calls `inject_text` with target process ID
8. **Backend** `inject_text` → optionally activates target window → injects text via keyboard simulation (enigo) or clipboard paste (arboard)

### Hotkey Event Routing

The hotkey system uses a **pure function** pattern (`hotkeys.rs`) for testability:

```
HotkeyEvent (Pressed/Released + Action) × RecordingMode × is_recording → HotkeyResponse
```

Supports two recording modes:
- **Toggle**: Press to start, press again to stop
- **Push-to-talk**: Hold to record, release to stop (requires key press AND release events)

### Model Management

Models are defined in a hardcoded registry (`models.rs:builtin_model_definitions()`) with 7 models across two engine families. Download status is persisted in `registry.json`. Models are downloaded from HuggingFace via the `hf-hub` crate on a dedicated `spawn_blocking` thread to avoid blocking the async runtime.

---

## Technology Stack

### Backend (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2 | Desktop app framework (tray, windows, IPC) |
| `tauri-plugin-global-shortcut` | 2 | System-wide hotkey registration |
| `tauri-plugin-single-instance` | 2.4 | Prevents multiple app instances |
| `tauri-plugin-shell` | 2 | Shell access for system commands |
| `whisper-rs` | 0.15 | Whisper.cpp FFI bindings for speech-to-text |
| `parakeet-rs` | 0.3 | NVIDIA Parakeet ONNX models (CTC, TDT, EOU variants) |
| `cpal` | 0.17 | Cross-platform audio capture (CoreAudio/WASAPI/ALSA) |
| `rubato` | 0.15 | FFT-based audio resampling (device rate → 16kHz) |
| `hf-hub` | 0.4 | HuggingFace model downloading |
| `enigo` | 0.6 | Keyboard simulation for text injection |
| `arboard` | 3 | Clipboard access for paste-based injection |
| `x-win` | 5 | Window enumeration across platforms |
| `serde` / `serde_json` | 1 | Serialization for preferences and model registry |
| `tokio` | 1 | Async runtime |
| `reqwest` | 0.12 | HTTP client (streaming downloads) |

### Frontend (TypeScript/React)

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| React Router DOM | 7 | Client-side routing between pages |
| Tailwind CSS | 4 | Utility-first CSS |
| @tauri-apps/api | 2 | Tauri IPC (invoke, listen, Channel) |
| Vite | 7 | Build tool and dev server |
| Vitest | 3 | Test runner |
| @testing-library/react | 16 | Component testing utilities |
| TypeScript | 5.8 | Type safety |

---

## Transcription Engine Details

The app supports **two transcription engine families** behind a common `TranscriptionEngine` trait:

### Whisper (via whisper-rs → whisper.cpp)

- 4 Whisper model variants available (base.en-q5_1, small.en, small.en-q5_1, large-v3-turbo-q5_0)
- Single GGML binary file per model (60MB to 547MB)
- Greedy sampling strategy, English language, no timestamps
- Each model loaded as a `WhisperContext` → creates per-transcription `WhisperState`

### Parakeet (via parakeet-rs → ONNX Runtime)

- 3 Parakeet model variants: CTC (0.6B), TDT (0.6B v3), EOU (120M)
- Multi-file models requiring directory-based storage (ONNX model + config + tokenizer)
- Parakeet EOU is a **streaming model** that processes audio in 160ms chunks (2560 samples at 16kHz)
- EOU output requires post-processing: SentencePiece `▁` replacement and `<EOU>` token stripping

### Model Registry

Models are hardcoded in `builtin_model_definitions()` with HuggingFace repo + filenames. Download status is tracked in `registry.json` with state transitions:

```
NotDownloaded → Downloading → Downloaded
                    ↓
                  Error → NotDownloaded (retry via status reset)
Downloaded → NotDownloaded (user deletes model)
```

---

## State Management

### Backend State (`AppState`)

```rust
pub struct AppState {
    pub preferences: RwLock<UserPreferences>,    // Thread-safe preferences
    pub app_data_dir: PathBuf,                   // Data directory for models + prefs
    pub recording_active: RwLock<bool>,           // Recording state flag
    pub engine: RwLock<Option<Box<dyn TranscriptionEngine>>>,  // Loaded engine
    pub active_capture: Mutex<Option<AudioCapture>>,           // Active audio stream
}
```

Key design decisions:
- `RwLock` for preferences and engine (multiple readers, exclusive writer)
- `Mutex` for active capture (only one recording at a time)
- Engine is dynamically dispatched (`Box<dyn TranscriptionEngine>`) to support both Whisper and Parakeet
- Recording state is a simple boolean flag (not the full `RecordingSession`)

### Frontend State

Each page manages its own state via custom hooks:
- `useRecording`: State machine (`idle` → `recording` → `transcribing` → `injecting` → `idle`) with Tauri event listeners for hotkey-driven flow
- `useModels`: Model list, download/activate/delete operations with loading states
- `usePreferences`: Preferences CRUD with optimistic updates
- `useAudioStream`: Amplitude data from `amplitude-update` events

### Persistence

- **Preferences**: `{app_data_dir}/preferences.json` — full `UserPreferences` struct
- **Model registry**: `{app_data_dir}/models/registry.json` — `Vec<TranscriptionModel>` metadata
- **Model files**: `{app_data_dir}/models/` — GGML binaries (Whisper) or directories (Parakeet)
- **No database** — all persistence is flat JSON files

---

## Audio Pipeline Details

### Capture (`capture.rs`)

- Uses cpal's default input device with native configuration
- Stereo → mono conversion (average channels)
- Pre-allocates buffer for up to 10 minutes of recording (avoids reallocations)
- Amplitude callback fires every ~50ms with 32-bin downsampled visualization data
- RMS calculation for overall volume level

### Resampling (`resample.rs`)

- Uses rubato's `FftFixedInOut` resampler (FFT-based, high quality)
- Converts from device native rate (typically 44.1kHz or 48kHz) to 16kHz mono for Whisper/Parakeet
- Processes in 1024-sample chunks with zero-padding for the final partial chunk
- Passthrough optimization when source is already 16kHz

---

## Text Injection Subsystem

### Two Methods

1. **Simulated Keystrokes** (default): `enigo.text()` — types character by character via OS keyboard API (CGEvents on macOS, SendInput on Windows, XTest on Linux)
2. **Clipboard Paste**: `arboard` sets clipboard → `enigo` simulates Cmd/Ctrl+V → restores previous clipboard content after 100ms delay

### Window Targeting

- **ActiveWindow mode** (default): Injects into whatever window is currently focused
- **WindowPicker mode**: After transcription, shows Cmd+Tab-style picker with app icons → user selects target → app activates target window (via AppleScript/xdotool) → injects text
- Window enumeration via x-win, deduplicated by app name (one entry per app), with Base64 app icons
- Window activation: macOS uses `osascript` (AppleScript via System Events), Linux uses `xdotool`, Windows is stubbed

---

## Hotkey System

### Registration

Global hotkeys registered via `tauri-plugin-global-shortcut` during app setup. Re-registered on preferences update (unregister old → register new).

### Default Bindings

| Action | Default Key | Mode |
|--------|-------------|------|
| ToggleRecording | `Cmd/Ctrl+Shift+Space` | Enabled |
| PushToTalk | `Cmd/Ctrl+Shift+V` | Disabled by default |
| OpenTargetSelector | `Cmd/Ctrl+Shift+T` | Enabled |
| OpenSettings | `Cmd/Ctrl+Shift+,` | Enabled |

### Validation

- Format validation: requires at least one modifier + one non-modifier key
- Conflict detection: flags duplicate key combinations across enabled bindings
- Frontend `HotkeyRecorder` component captures combinations via keydown/keyup events, maps to Tauri shortcut format

### Mode Switching

When enabling a recording action (Toggle or PushToTalk), the system automatically:
1. Disables the other recording action
2. Syncs `recordingMode` in preferences to match

---

## UI Components

### Recording Overlay

- **RecordingPill**: Rounded pill with status dot (red pulsing = recording, yellow = processing) + soundwave + text label
- **Soundwave**: Canvas-based visualization rendering 32 bars with smooth amplitude interpolation (lerp factor 0.15 per frame). Uses `requestAnimationFrame` for 60fps animation. DPR-aware rendering.

### Window Picker

- Horizontal strip of app icons with names
- Keyboard navigation (Arrow keys, Tab, Enter to select, Escape to dismiss)
- Auto-resizes window to fit content
- On dismiss without selection, copies text to clipboard as fallback

### Model Card

- Displays model name, family (Whisper/Parakeet), size, quantization, languages
- State-aware buttons: Download (not downloaded), Activate/Delete (downloaded), Active badge (active)
- Loading spinners for download and activation operations

---

## Testing Strategy

### Rust Tests (3 tiers)

Located in `src-tauri/tests/`:

1. **Unit tests** (`tests/unit/`): Audio capture helpers, resampling, engine error handling, push-to-talk logic, keyboard injection, hotkey validation, window filtering
2. **Contract tests** (`tests/contract/`): Tauri command validation — error codes, state transitions, input validation for audio, model, and injection commands
3. **Integration tests** (`tests/integration/`): Cross-module recording flow, hotkey rebinding, model lifecycle

Also inline unit tests in `capture.rs`, `resample.rs`, `models.rs`, `storage.rs`, and `preferences/mod.rs`.

### Frontend Tests (Vitest + Testing Library)

Located in `src/components/*.test.tsx`:
- `soundwave.test.tsx`: Canvas rendering, animation lifecycle, custom props
- `recording-pill.test.tsx`: Recording vs processing states, indicator colors
- `model-card.test.tsx`: All download status states, button visibility, callbacks
- `hotkey-recorder.test.tsx`: Recording mode, key capture, modifier filtering, cancel behavior

### Test Infrastructure

- Vitest with jsdom environment
- Canvas mocking for soundwave tests (getContext, requestAnimationFrame)
- `@testing-library/jest-dom` matchers
- Some Rust tests marked `#[ignore]` for hardware-dependent scenarios

---

## Platform Support

### macOS
- `macOSPrivateApi: true` for transparent overlay window (disqualifies Mac App Store)
- Accessibility permission required for keyboard simulation (enigo/CGEvents)
- Microphone permission prompted on first use
- Window activation via AppleScript (`osascript` → System Events)

### Windows
- WASAPI for audio capture
- No special permissions needed at same integrity level
- Window activation: **not yet implemented** (stubbed as error)

### Linux
- ALSA for audio capture
- X11 required for text injection (XTest)
- Window activation via `xdotool`
- GNOME >= 41 may need shell extension for x-win window enumeration

---

## Project Governance

### Constitution (v1.0.0)

The project follows a formal constitution (`.specify/memory/constitution.md`) with 5 core principles:

1. **Test-First (TDD)**: Red-Green-Refactor cycle enforced
2. **Simplicity / YAGNI**: Simplest viable implementation, no speculative abstractions
3. **Type Safety**: Strict typing in both Rust and TypeScript, no `unwrap()` in production, no `any`
4. **Convention over Configuration**: Consistent naming, established patterns
5. **Domain-Driven Design**: Organization by business domain, ubiquitous language

### Quality Gates

All code must pass: automated tests, type checking (`cargo check` + `tsc --noEmit`), linting (`clippy` + ESLint), formatting (`cargo fmt` + Prettier), and clean builds.

### Specification Process

The project uses a structured "Speckit" workflow:
- Feature specs (`specs/001-voice-input/spec.md`) with user stories, acceptance criteria, functional requirements
- Implementation plans with constitution checks and complexity tracking
- Data model definitions with matching Rust/TypeScript types
- Tauri command contracts with error types and FR mappings
- Task breakdowns organized by user story with TDD enforcement

---

## Current Status and Known Issues

### Completed (checked off in TODO.md)
- Model selection visibility and naming
- Download feedback (prevents button spam)
- Push-to-talk functionality
- Target window selection improvements
- Transcription performance fixes

### Open TODO Items
- Add menu icon for recording state
- UI polish needed (general)
- Replace download spinner with progress bar
- Add ability to add custom/new models
- Come up with product name and logo
- Product website
- Test distribution releases
- Allow different hotkeys for window selection

### Technical Observations

1. **Parakeet support was added post-spec**: The original spec and research only mentioned Whisper. The Parakeet engine family (CTC, TDT, EOU) was added later, including the `parakeet-rs` dependency and `ParakeetEngine` implementation. The TypeScript types haven't been fully updated (e.g., `ModelVariant` type is missing `ParakeetEOU`).

2. **Window activation on Windows is unimplemented**: `injection/windows.rs` has a stub that returns an error for Windows platform.

3. **Download progress is not streamed**: The `download_model` contract specifies a `Channel<DownloadProgress>` for streaming progress, but the implementation uses `spawn_blocking` with `hf-hub`'s synchronous API, which doesn't report intermediate progress. The frontend `ModelCard` shows a generic spinner rather than a progress bar.

4. **Single-instance enforcement**: The app uses `tauri-plugin-single-instance` to prevent multiple instances — launching a second instance focuses the first.

5. **Recording state is frontend-driven**: While the backend tracks `recording_active`, the actual recording lifecycle is orchestrated from the frontend `useRecording` hook — hotkey events are emitted to the frontend, which then invokes the backend commands.

6. **Model auto-loading on startup**: If an `active_model_id` is set in preferences and the model is downloaded, the engine is automatically loaded during app setup — no manual activation needed on restart.

7. **macOS-specific**: The overlay requires `macOSPrivateApi: true` for transparency, which prevents Mac App Store distribution. Window activation uses AppleScript.

8. **Audio buffer pre-allocation**: The capture module pre-allocates for 10 minutes of recording at native sample rate to avoid reallocations during recording.

---

## File Inventory

### Backend (Rust) — 14 source files
| File | Lines | Purpose |
|------|-------|---------|
| `lib.rs` | 390 | App entry: tray, hotkeys, overlay, window lifecycle |
| `main.rs` | 6 | Binary entry point |
| `hotkeys.rs` | 58 | Pure hotkey event routing |
| `audio/mod.rs` | 51 | Audio domain types |
| `audio/capture.rs` | 176 | Microphone capture + amplitude |
| `audio/resample.rs` | 123 | FFT resampling to 16kHz |
| `transcription/mod.rs` | 80 | Transcription domain types |
| `transcription/engine.rs` | 169 | Whisper + Parakeet engine implementations |
| `transcription/models.rs` | 241 | Model registry + persistence |
| `injection/mod.rs` | 15 | Injection domain types |
| `injection/keyboard.rs` | 13 | Keystroke injection |
| `injection/clipboard.rs` | 50 | Clipboard paste injection |
| `injection/windows.rs` | 114 | Window enumeration + activation |
| `preferences/mod.rs` | 163 | Preferences types + validation |
| `preferences/storage.rs` | 80 | JSON persistence |
| `commands/mod.rs` | 30 | CommandError type |
| `commands/audio_commands.rs` | 198 | Recording start/stop commands |
| `commands/model_commands.rs` | 281 | Model CRUD commands |
| `commands/injection_commands.rs` | 70 | Text injection commands |
| `commands/preferences_commands.rs` | 87 | Preferences commands |
| `commands/system_commands.rs` | 81 | Permission commands |

### Frontend (TypeScript/React) — 14 source files
| File | Lines | Purpose |
|------|-------|---------|
| `main.tsx` | 10 | App mount |
| `App.tsx` | 57 | Router + window routing |
| `types/index.ts` | 130 | All TypeScript interfaces |
| `pages/settings.tsx` | 104 | Main settings page |
| `pages/models.tsx` | 72 | Model management page |
| `pages/hotkeys.tsx` | 133 | Hotkey configuration page |
| `pages/overlay.tsx` | 45 | Recording overlay |
| `pages/picker.tsx` | 181 | Window picker |
| `components/recording-pill.tsx` | 31 | Recording indicator |
| `components/soundwave.tsx` | 84 | Canvas amplitude viz |
| `components/model-card.tsx` | 150 | Model list item |
| `components/hotkey-recorder.tsx` | 129 | Hotkey capture UI |
| `hooks/use-recording.ts` | 128 |  Recording state machine |
| `hooks/use-models.ts` | 97 | Model operations |
| `hooks/use-preferences.ts` | 53 | Preferences operations |
| `hooks/use-audio-stream.ts` | 29 | Amplitude event listener |

### Tests — 16 test files
- 9 Rust test files (`src-tauri/tests/`)
- 4 React component test files (`src/components/*.test.tsx`)
- Inline unit tests in 4 Rust modules
