# TalkyTexty - Project Research Report

## Executive Summary

TalkyTexty is a cross-platform desktop application that captures speech via a global hotkey, transcribes it locally using on-device AI models, and injects the resulting text into any target application. It runs entirely offline — no API keys, no cloud, no data leaves the machine. Built with Tauri v2 (Rust backend + React/TypeScript frontend), it operates as a system tray background process with a floating recording overlay and a settings UI.

The project is in active development on the `main` branch (v0.2.1). The core voice input feature is complete and functional. The codebase has since been extended with a Superwhisper-inspired UI redesign, multiple visualization styles, processing animations, transcription history with audio playback, audio device selection, overlay modes, tray icon recording indicators, macOS permission handling (microphone + accessibility), a stats dashboard, and a changelog panel. Several TODO items remain for polish and distribution.

---

## Architecture

### High-Level Design

The app is a **Tauri v2 desktop application** with two distinct execution layers:

1. **Rust backend** (`src-tauri/src/`): Handles audio capture, transcription, text injection, preferences persistence, hotkey routing, system tray, window management, and transcription history.
2. **React frontend** (`src/`): Provides the settings UI with sidebar navigation, model management, hotkey configuration, recording overlay with selectable visualizations, transcription history with waveform playback, and window picker.

Communication between layers uses **Tauri commands** (`invoke()`) for request/response and **Tauri Channels** for streaming data (amplitude updates during recording).

### Window Architecture

Three Tauri webview windows are defined in `tauri.conf.json`:

| Window | Size | Purpose | Behavior |
|--------|------|---------|----------|
| `main` (settings) | 800x600 | Sidebar-based settings UI with panels for general, history, models, changelog, about | Visible on startup, overlay title bar with macOS traffic light positioning. Close hides rather than quits. Permission banner shown when mic/accessibility not granted. |
| `recording-overlay` | 480x120 | Floating pill showing recording status + soundwave visualization | Transparent, always-on-top, non-focusable, skip taskbar, non-resizable. Shown during recording, hidden on completion. Supports Full/Mini/None modes. |
| `window-picker` | 640x140 | macOS Cmd+Tab-style app selector for text injection target | Transparent, always-on-top, focusable (for keyboard navigation), centered on screen, skip taskbar. |

### Backend Module Organization (Domain-Driven Design)

The Rust backend is organized by **bounded context**, not technical layer:

```
src-tauri/src/
  lib.rs              — App entry point: AppState, tray setup, hotkey registration, overlay positioning, window lifecycle, recording icon
  main.rs             — Thin binary entry point, calls lib::run()
  hotkeys.rs          — Pure function hotkey event routing (HotkeyEvent → HotkeyResponse)
  audio/
    mod.rs            — Domain types: RecordingSession, RecordingStatus, AudioEvent, TranscriptionResult
    capture.rs        — Microphone capture via cpal, stereo→mono conversion, amplitude calculation, device enumeration
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
  history/
    mod.rs            — HistoryEntry struct, JSON persistence, WAV audio file storage, max 5000 entries
  preferences/
    mod.rs            — Domain types: UserPreferences, HotkeyBinding, HotkeyAction, RecordingMode, TargetMode, TextInjectionMethod, OverlayPosition, OverlayMode, VisualizationStyle, ProcessingAnimation, OverlayCustomPosition, validation & conflict detection
    storage.rs        — JSON file persistence for preferences
  commands/
    mod.rs            — CommandError type (code + message)
    audio_commands.rs — start_recording, stop_recording, cancel_recording, list_audio_devices
    model_commands.rs — list_models, set_active_model, download_model, delete_model
    injection_commands.rs — inject_text, list_windows, copy_to_clipboard
    preferences_commands.rs — get_preferences, update_preferences (with hotkey re-registration)
    system_commands.rs — check_permissions (AXIsProcessTrusted + cpal), request_permission (AXIsProcessTrustedWithOptions prompt + System Settings, cpal device enumeration for mic dialog)
    window_commands.rs — set_traffic_lights_visible (macOS-specific)
    history_commands.rs — list_history, delete_history_entry, clear_history, get_history_audio
```

### Frontend Organization

```
src/
  main.tsx            — React app entry point
  App.tsx             — BrowserRouter with route-based window switching (overlay, picker, main), sidebar navigation, hotkey listener, PreferencesProvider context
  index.css           — Tailwind CSS v4 import + global styles (.kbd badges, scrollbar, selection colors)
  types/index.ts      — TypeScript interfaces matching all Rust domain types
  utils/
    format-hotkey.ts  — Platform-specific hotkey formatting (macOS ⌘⇧ symbols vs Windows Ctrl+Shift labels)
  pages/
    overlay.tsx       — Transparent recording overlay with visualization, processing animation, metadata display
    picker.tsx        — Window picker (Cmd+Tab style) for target window selection
  components/
    sidebar.tsx       — Collapsible navigation sidebar with colored icon backgrounds (5 sections: General, History, Models, What's New, About) + branding footer
    status-bar.tsx    — Top bar with sidebar toggle and audio device selector dropdown
    permission-banner.tsx — Non-dismissible permission status banner with grant buttons and polling (usePermissions hook)
    settings-group.tsx — Reusable card containers (SettingsGroup + SettingsRow) for settings panels
    toggle-switch.tsx — Styled toggle switch input component
    company-badge.tsx — OpenAI/NVIDIA company badges with SVG icons for model cards
    recording-pill.tsx — Pill-shaped recording indicator with visualization, status, hotkey display, mic name (Full/Mini modes)
    model-card.tsx    — Individual model display with download/activate/delete states + company badge
    hotkey-recorder.tsx — Interactive hotkey capture component (records key combinations)
    visualizations/
      index.ts        — Visualization registry and VisualizationProps interface
      bars.tsx        — Classic bar visualization with amplitude smoothing
      sine.tsx        — Layered sine waves with color gradients (blue, purple, pink, amber)
      rainbow.tsx     — Rainbow-colored bars with gradient spectrum interpolation
    processing-animations/
      index.ts        — Animation registry and interfaces
      pulse.tsx       — CSS pulsing glow effect during processing
      frozen-frame.tsx — Frozen last visualization frame at reduced opacity
      typing-parrot.tsx — 8-bit pixel art parrot typing on keyboard animation
    panels/
      general-panel.tsx — Stats widget, model selector, recording mode/hotkey, settings hotkey, target mode, visualization picker, animation picker, overlay mode
      models-panel.tsx — Model list with download/activate/delete actions
      history-panel.tsx — Transcription history with waveform playback, peak extraction, audio decoding
      hotkeys-panel.tsx — Hotkey bindings with toggle enable/disable and key recorder (no longer in sidebar, settings hotkey moved to General)
      changelog-panel.tsx — Versioned changelog display with color-coded Added/Fixed/Changed/Removed sections
      about-panel.tsx — App info, version display, launch-at-login toggle
  hooks/
    use-recording.ts  — Core recording state machine (idle→recording→transcribing→injecting→idle) with cancel support
    use-models.ts     — Model CRUD operations via Tauri commands
    use-preferences.tsx — Preferences read/update via React Context (PreferencesProvider wraps MainWindow, shared state across all consumers)
    use-audio-stream.ts — Listens for amplitude-update events for overlay visualization
    use-history.ts    — History entries load, delete, clear via Tauri commands
```

---

## Core Data Flow

### Recording → Transcription → Injection Pipeline

1. **Hotkey press** → Rust global shortcut handler fires → `resolve_hotkey_event()` determines action → emits `hotkey-start-recording` event
2. **Frontend** `useRecording` hook listens → calls `invoke("start_recording")` with a Channel and optional device name
3. **Backend** `start_recording` command → validates (model loaded, not already recording) → starts `AudioCapture` via cpal (optionally targeting a specific audio device) → streams `AmplitudeUpdate` events → shows overlay window → updates tray icon with red recording dot → returns session ID
4. **During recording** → amplitude data flows: cpal callback → amplitude buffer → downsample to 32 bins → Channel → frontend → Canvas visualization (Bars, Sine, or Rainbow style)
5. **Hotkey press again** → emits `hotkey-stop-recording` → frontend calls `invoke("stop_recording")`
6. **Backend** `stop_recording` → stops capture → saves WAV audio file → resamples audio to 16kHz via rubato → runs transcription engine → creates history entry → returns `TranscriptionResult` → hides overlay → restores normal tray icon
7. **Frontend** receives text → checks target mode:
   - **ActiveWindow mode**: calls `invoke("inject_text")` directly
   - **WindowPicker mode**: emits `show-picker` event → picker window appears → user selects target → calls `inject_text` with target process ID
8. **Backend** `inject_text` → optionally activates target window → injects text via keyboard simulation (enigo) or clipboard paste (arboard)

### Cancel Flow

- **Escape key** during recording → emits `hotkey-cancel-recording` → frontend calls `invoke("cancel_recording")` → backend stops capture, discards audio, hides overlay, restores tray icon → no transcription or injection occurs

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
| `tauri` | 2 | Desktop app framework (tray, windows, IPC); features: tray-icon, macos-private-api, image-png |
| `tauri-plugin-global-shortcut` | 2 | System-wide hotkey registration |
| `tauri-plugin-single-instance` | 2.4 | Prevents multiple app instances |
| `tauri-plugin-shell` | 2 | Shell access for system commands |
| `whisper-rs` | 0.15 | Whisper.cpp FFI bindings for speech-to-text |
| `parakeet-rs` | 0.3 | NVIDIA Parakeet ONNX models (CTC, TDT, EOU variants); features: cpu |
| `cpal` | 0.17 | Cross-platform audio capture (CoreAudio/WASAPI/ALSA) |
| `rubato` | 0.15 | FFT-based audio resampling (device rate → 16kHz) |
| `hound` | 3 | WAV file encoding/decoding for history audio storage |
| `hf-hub` | 0.4 | HuggingFace model downloading |
| `enigo` | 0.6 | Keyboard simulation for text injection; features: serde |
| `arboard` | 3 | Clipboard access for paste-based injection |
| `x-win` | 5 | Window enumeration across platforms |
| `objc2` | 0.6 | macOS Objective-C runtime bindings |
| `objc2-app-kit` | 0.3 | macOS AppKit APIs (NSButton, NSControl, NSWindow, NSResponder, NSView) |
| `serde` / `serde_json` | 1 | Serialization for preferences, model registry, and history |
| `tokio` | 1 | Async runtime (full features) |
| `reqwest` | 0.12 | HTTP client (streaming downloads) |
| `uuid` | 1 | UUID v4 generation for history entries and sessions |
| `chrono` | 0.4 | Date/time handling with serde support |
| `log` / `env_logger` | 0.4 / 0.11 | Logging infrastructure |
| `futures-util` | 0.3 | Async stream utilities |

### Frontend (TypeScript/React)

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.1.0 | UI framework |
| React Router DOM | 7 | Client-side routing between pages |
| Tailwind CSS | 4 | Utility-first CSS (via @tailwindcss/vite plugin) |
| @tauri-apps/api | 2 | Tauri IPC (invoke, listen, Channel) |
| @tauri-apps/plugin-global-shortcut | 2 | Global hotkey binding from frontend |
| Vite | 7.0.4 | Build tool and dev server |
| Vitest | 3 | Test runner |
| @testing-library/react | 16 | Component testing utilities |
| @testing-library/jest-dom | 6 | DOM assertion matchers |
| TypeScript | 5.8.3 | Type safety |
| ESLint | 9 | Linting (with react-hooks and typescript-eslint plugins) |
| Prettier | 3 | Code formatting |
| jsdom | 26 | DOM implementation for testing |

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
    pub app_data_dir: PathBuf,                   // Data directory for models + prefs + history
    pub recording_active: RwLock<bool>,           // Recording state flag
    pub engine: RwLock<Option<Box<dyn TranscriptionEngine>>>,  // Loaded engine
    pub active_capture: Mutex<Option<AudioCapture>>,           // Active audio stream
    pub recording_started_at: Mutex<Option<std::time::Instant>>,  // Recording start time for duration tracking
}
```

Key design decisions:
- `RwLock` for preferences and engine (multiple readers, exclusive writer)
- `Mutex` for active capture and recording timestamp (only one recording at a time)
- Engine is dynamically dispatched (`Box<dyn TranscriptionEngine>`) to support both Whisper and Parakeet
- `recording_started_at` tracks elapsed time for history entry duration

### Frontend State

The main settings window uses a **sidebar + panel** architecture wrapped in a `PreferencesProvider` React Context so all panels share a single preferences state. Each panel manages its own domain state via custom hooks:
- `useRecording`: State machine (`idle` → `recording` → `transcribing` → `injecting` → `idle`) with Tauri event listeners for hotkey-driven flow, plus cancel support; checks permissions before starting
- `useModels`: Model list, download/activate/delete operations with loading states
- `usePreferences`: React Context-based preferences shared across all consumers (PreferencesProvider wraps MainWindow)
- `usePermissions`: Permission polling hook (mic + accessibility) with 2s interval for accessibility changes
- `useAudioStream`: Amplitude data from `amplitude-update` events
- `useHistory`: History entry list, delete, clear operations

### Persistence

- **Preferences**: `{app_data_dir}/preferences.json` — full `UserPreferences` struct
- **Model registry**: `{app_data_dir}/models/registry.json` — `Vec<TranscriptionModel>` metadata
- **Model files**: `{app_data_dir}/models/` — GGML binaries (Whisper) or directories (Parakeet)
- **History**: `{app_data_dir}/history.json` — `Vec<HistoryEntry>` metadata (max 5000 entries)
- **Audio recordings**: `{app_data_dir}/recordings/{uuid}.wav` — 16kHz mono WAV files
- **No database** — all persistence is flat JSON files + WAV audio files

---

## Audio Pipeline Details

### Capture (`capture.rs`)

- Uses cpal's default input device or a user-selected device
- `list_input_devices()` enumerates available audio input devices with default detection
- Stereo → mono conversion (average channels)
- Pre-allocates buffer for up to 10 minutes of recording (avoids reallocations)
- Amplitude callback fires every ~50ms with 32-bin downsampled visualization data
- RMS calculation for overall volume level

### Resampling (`resample.rs`)

- Uses rubato's `FftFixedInOut` resampler (FFT-based, high quality)
- Converts from device native rate (typically 44.1kHz or 48kHz) to 16kHz mono for Whisper/Parakeet
- Processes in 1024-sample chunks with zero-padding for the final partial chunk
- Passthrough optimization when source is already 16kHz

### Audio Storage (`history/mod.rs`)

- After recording stops, raw audio is saved as a WAV file via the `hound` crate
- 16kHz mono, 32-bit float samples
- Files stored in `{app_data_dir}/recordings/` with UUID filenames
- Audio bytes retrievable via `get_history_audio` command for frontend playback

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

Global hotkeys registered via `tauri-plugin-global-shortcut` during app setup. Re-registered on preferences update (unregister old → register new). Escape key dynamically registered/unregistered during recording for cancel support.

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

### Settings Window (Main)

The main window uses a **Superwhisper-inspired** sidebar + panel layout:

- **Sidebar**: Collapsible navigation with 5 sections (General, History, Models, What's New, About), colored icon backgrounds, branding footer with version
- **StatusBar**: Top bar with sidebar toggle button and audio device selector dropdown
- **SettingsGroup/SettingsRow**: Reusable card containers for grouped settings with label-right layout

### Settings Panels

- **GeneralPanel**: Stats widget (avg WPM, words this week, transcriptions, time saved), model selector with company badges, recording mode (toggle/push-to-talk) with hotkey, settings hotkey with toggle, target mode (active window/picker), visualization style picker with preview cards, processing animation picker, overlay mode selector (Full/Mini/None)
- **ModelsPanel**: Model list with ModelCard components showing download progress, activate/delete actions
- **HistoryPanel**: Transcription history entries with waveform playback visualization, peak extraction, audio decoding, search, delete, clear all
- **ChangelogPanel**: Versioned release history with color-coded sections (Added, Fixed, Changed, Removed)
- **AboutPanel**: App info card with parrot icon, version, launch-at-login toggle

### Recording Overlay

- **RecordingPill**: Rounded pill with visualization area + status row. Supports Full mode (larger with metadata) and Mini mode (compact). Shows hotkey badge, microphone name, and recording/processing status.
- **Visualizations** (3 selectable styles via registry pattern):
  - **Bars**: Classic amplitude bars with smooth interpolation
  - **Sine**: Layered sine waves with blue/purple/pink/amber color gradients
  - **Rainbow**: Spectrum gradient bars (blue → purple → pink → orange)
- **Processing Animations** (3 selectable styles):
  - **Pulse**: CSS pulsing glow effect
  - **FrozenFrame**: Freezes last visualization at reduced opacity
  - **TypingParrot**: 8-bit pixel art parrot typing on keyboard (canvas-based, wing flapping + key flash)
- All visualizations use `requestAnimationFrame` for 60fps animation and are DPR-aware
- **OverlayMode**: Full (large pill with metadata), Mini (compact), None (hidden)

### Window Picker

- Horizontal strip of app icons with names
- Keyboard navigation (Arrow keys, Tab, Enter to select, Escape to dismiss)
- Auto-resizes window to fit content
- On dismiss without selection, copies text to clipboard as fallback

### Model Card

- Displays model name, family (Whisper/Parakeet), size, quantization, languages
- Company badge (OpenAI for Whisper, NVIDIA for Parakeet) with SVG icons
- State-aware buttons: Download (not downloaded), Activate/Delete (downloaded), Active badge (active)
- Loading spinners for download and activation operations

### Utility Components

- **CompanyBadge**: OpenAI/NVIDIA badges with SVG logos for model provenance
- **ToggleSwitch**: Styled checkbox toggle component
- **FormatHotkey** (`utils/format-hotkey.ts`): Platform-aware hotkey formatting — macOS uses symbols (⌘⇧⌥), Windows/Linux uses text labels (Ctrl+Shift+Alt)

---

## Transcription History

### Data Model

```typescript
interface HistoryEntry {
  id: string;           // UUID v4
  createdAt: string;    // ISO 8601 timestamp
  text: string;         // Transcribed text
  modelId: string;      // Model used for transcription
  recordingDurationMs: number;
  transcriptionDurationMs: number;
  audioDevice: string | null;
  audioFileName: string | null;  // WAV file in recordings/
}
```

### Storage

- **Metadata**: `{app_data_dir}/history.json` — JSON array of `HistoryEntry` objects
- **Audio**: `{app_data_dir}/recordings/{uuid}.wav` — 16kHz mono WAV files
- **Limit**: Auto-prunes to 5,000 entries maximum

### Frontend

- **HistoryPanel**: Scrollable list of transcription entries with timestamps, model info, durations
- **WaveformPlayer**: Canvas-based waveform visualization extracted from WAV audio data, with playback controls
- Operations: copy text, delete individual entries, clear all history

---

## Testing Strategy

### Rust Tests (3 tiers)

Located in `src-tauri/tests/`:

1. **Unit tests** (`tests/unit/`): 8 test files, 859 lines — Audio capture helpers, resampling, engine error handling, push-to-talk logic, keyboard injection, hotkey validation, window filtering, model download
2. **Contract tests** (`tests/contract/`): 5 test files, 542 lines — Tauri command validation — error codes, state transitions, input validation for audio, model, injection, and window commands
3. **Integration tests** (`tests/integration/`): 4 test files, 357 lines — Cross-module recording flow, hotkey rebinding, model lifecycle

Also inline unit tests in `capture.rs`, `resample.rs`, `models.rs`, `storage.rs`, and `preferences/mod.rs`.

### Frontend Tests (Vitest + Testing Library)

5 test files, 689 lines:
- `components/soundwave.test.tsx`: Canvas rendering, animation lifecycle, custom props
- `components/recording-pill.test.tsx`: Recording vs processing states, Full/Mini/None modes, visualization changes, indicator colors
- `components/model-card.test.tsx`: All download status states, button visibility, callbacks
- `components/hotkey-recorder.test.tsx`: Recording mode, key capture, modifier filtering, cancel behavior
- `utils/format-hotkey.test.ts`: macOS symbol formatting (⌘⇧Space), Windows label formatting (Ctrl+Shift+Space), cross-platform Alt/Option

### Test Infrastructure

- Vitest with jsdom environment
- Canvas mocking for visualization tests (getContext, requestAnimationFrame)
- `@testing-library/jest-dom` matchers
- Some Rust tests marked `#[ignore]` for hardware-dependent scenarios

---

## Platform Support

### macOS
- `macOSPrivateApi: true` for transparent overlay window (disqualifies Mac App Store)
- Accessibility permission required for keyboard simulation — checked via native `AXIsProcessTrusted()` API, requested via `AXIsProcessTrustedWithOptions` with prompt flag + opens System Settings
- Microphone permission prompted on first use via `NSMicrophoneUsageDescription` in `src-tauri/Info.plist` (Tauri merges into built app); cpal device enumeration triggers the system dialog
- Permission banner shown at top of settings when either permission is missing; polls every 2s for accessibility changes; recording is blocked until both are granted
- Window activation via AppleScript (`osascript` → System Events)
- Traffic light positioning via `objc2-app-kit` (NSWindow/NSButton APIs)
- Hotkey display uses macOS symbols (⌘⇧⌥)

### Windows
- WASAPI for audio capture
- No special permissions needed at same integrity level
- Window activation: **not yet implemented** (stubbed as error)
- Hotkey display uses text labels (Ctrl+Shift+Alt)

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

### Completed
- Core voice input pipeline (record → transcribe → inject)
- Model management (download, activate, delete from HuggingFace)
- Push-to-talk and toggle recording modes
- Target window selection (active window + window picker)
- Transcription performance fixes
- System tray with recording state indicator (red dot on icon)
- Superwhisper-inspired UI redesign with collapsible sidebar
- Multiple visualization styles (Bars, Sine, Rainbow)
- Processing animations (Pulse, FrozenFrame, TypingParrot)
- Transcription history with waveform playback
- Audio device selection
- Overlay mode selector (Full/Mini/None)
- Company badges (OpenAI/NVIDIA) on model cards
- Platform-aware hotkey display formatting
- Escape-to-cancel recording
- App branding: TalkyTexty name + custom parrot pixel art icon
- macOS permission handling (microphone + accessibility) with permission banner
- Stats dashboard (avg WPM, words this week, transcriptions, time saved)
- Changelog panel (What's New) in sidebar
- Preferences synced across all UI consumers via React Context
- CONTRIBUTING.md and CHANGELOG.md

### Open TODO Items
- Replace download spinner with progress bar for model downloads
- Options to add custom/new models
- Product website
- Test distribution releases

### Technical Observations

1. **Parakeet support was added post-spec**: The original spec only mentioned Whisper. The Parakeet engine family (CTC, TDT, EOU) was added later. The TypeScript `ModelVariant` type includes `ParakeetCTC` and `ParakeetTDT` but is missing `ParakeetEOU`.

2. **Window activation on Windows is unimplemented**: `injection/windows.rs` has a stub that returns an error for Windows platform.

3. **Download progress is not streamed**: The `download_model` contract specifies a `Channel<DownloadProgress>` for streaming progress, but the implementation uses `spawn_blocking` with `hf-hub`'s synchronous API, which doesn't report intermediate progress. The frontend `ModelCard` shows a generic spinner rather than a progress bar.

4. **Single-instance enforcement**: The app uses `tauri-plugin-single-instance` to prevent multiple instances — launching a second instance focuses the first.

5. **Recording state is frontend-driven**: While the backend tracks `recording_active`, the actual recording lifecycle is orchestrated from the frontend `useRecording` hook — hotkey events are emitted to the frontend, which then invokes the backend commands.

6. **Model auto-loading on startup**: If an `active_model_id` is set in preferences and the model is downloaded, the engine is automatically loaded during app setup — no manual activation needed on restart.

7. **macOS-specific features**: The overlay requires `macOSPrivateApi: true` for transparency, which prevents Mac App Store distribution. Window activation uses AppleScript. Traffic light button visibility is controlled via `objc2-app-kit` native APIs.

8. **Audio buffer pre-allocation**: The capture module pre-allocates for 10 minutes of recording at native sample rate to avoid reallocations during recording.

9. **History audio persistence**: Each transcription saves the raw audio as a WAV file, enabling future playback in the history panel. Files are stored alongside the JSON metadata.

---

## File Inventory

### Backend (Rust) — 24 source files, ~3,001 lines
| File | Lines | Purpose |
|------|-------|---------|
| `lib.rs` | 470 | App entry: AppState, tray (with recording icon), hotkeys, overlay positioning, window lifecycle |
| `main.rs` | 6 | Binary entry point |
| `hotkeys.rs` | 59 | Pure hotkey event routing |
| `audio/mod.rs` | 51 | Audio domain types |
| `audio/capture.rs` | 225 | Microphone capture, device enumeration, amplitude calculation |
| `audio/resample.rs` | 123 | FFT resampling to 16kHz |
| `transcription/mod.rs` | 79 | Transcription domain types (with backward-compatible DownloadStatus deserializer) |
| `transcription/engine.rs` | 169 | Whisper + Parakeet engine implementations |
| `transcription/models.rs` | 241 | Model registry + persistence |
| `injection/mod.rs` | 15 | Injection domain types |
| `injection/keyboard.rs` | 13 | Keystroke injection |
| `injection/clipboard.rs` | 50 | Clipboard paste injection |
| `injection/windows.rs` | 114 | Window enumeration + activation |
| `history/mod.rs` | 139 | History entry storage, WAV file management |
| `preferences/mod.rs` | 217 | Preferences types, enums (OverlayMode, VisualizationStyle, ProcessingAnimation, etc.), validation |
| `preferences/storage.rs` | 80 | JSON persistence |
| `commands/mod.rs` | 32 | CommandError type |
| `commands/audio_commands.rs` | 312 | Recording start/stop/cancel, device listing |
| `commands/model_commands.rs` | 281 | Model CRUD commands |
| `commands/injection_commands.rs` | 70 | Text injection commands |
| `commands/preferences_commands.rs` | 87 | Preferences commands |
| `commands/system_commands.rs` | 151 | Permission commands (AXIsProcessTrusted, AXIsProcessTrustedWithOptions, cpal mic check) |
| `commands/window_commands.rs` | 40 | macOS traffic light visibility |
| `commands/history_commands.rs` | 36 | History CRUD + audio retrieval |

### Frontend (TypeScript/React) — 34 source files, ~4,000 lines
| File | Lines | Purpose |
|------|-------|---------|
| `main.tsx` | 10 | App mount |
| `App.tsx` | 115 | Router, sidebar layout, hotkey listener, PreferencesProvider, PermissionBanner |
| `types/index.ts` | 163 | All TypeScript interfaces (HistoryEntry, UserPreferences, AudioEvent, PermissionStatus, etc.) |
| `utils/format-hotkey.ts` | 36 | Platform-aware hotkey formatting (⌘⇧ vs Ctrl+Shift) |
| `pages/overlay.tsx` | 135 | Recording overlay with visualization, processing animation, metadata |
| `pages/picker.tsx` | 181 | Window picker |
| `components/sidebar.tsx` | 128 | Collapsible nav sidebar with colored icons (5 sections) + branding |
| `components/status-bar.tsx` | 128 | Top bar with audio device selector |
| `components/permission-banner.tsx` | 128 | Permission status banner with grant buttons + usePermissions hook |
| `components/settings-group.tsx` | 42 | SettingsGroup + SettingsRow card containers |
| `components/toggle-switch.tsx` | 20 | Styled toggle switch |
| `components/company-badge.tsx` | 67 | OpenAI/NVIDIA badges with SVG icons |
| `components/recording-pill.tsx` | 131 | Recording indicator with Full/Mini modes, visualization, status |
| `components/model-card.tsx` | 158 | Model list item with company badge |
| `components/hotkey-recorder.tsx` | 129 | Hotkey capture UI |
| `components/visualizations/index.ts` | 24 | Visualization registry |
| `components/visualizations/bars.tsx` | 106 | Bar visualization |
| `components/visualizations/sine.tsx` | 103 | Sine wave visualization |
| `components/visualizations/rainbow.tsx` | 121 | Rainbow gradient visualization |
| `components/processing-animations/index.ts` | 25 | Animation registry |
| `components/processing-animations/pulse.tsx` | 13 | Pulse glow animation |
| `components/processing-animations/frozen-frame.tsx` | 28 | Frozen frame animation |
| `components/processing-animations/typing-parrot.tsx` | 172 | Pixel art parrot animation |
| `components/panels/general-panel.tsx` | 775 | Stats widget, model selector, recording/settings hotkeys, input, visualization, overlay mode |
| `components/panels/models-panel.tsx` | 60 | Model management panel |
| `components/panels/history-panel.tsx` | 472 | Transcription history with waveform playback |
| `components/panels/hotkeys-panel.tsx` | 97 | Hotkey configuration (no longer in sidebar) |
| `components/panels/changelog-panel.tsx` | 100 | Versioned changelog with color-coded sections |
| `components/panels/about-panel.tsx` | 45 | About info with parrot icon + launch-at-login |
| `hooks/use-recording.ts` | 148 | Recording state machine with cancel |
| `hooks/use-models.ts` | 97 | Model operations |
| `hooks/use-preferences.tsx` | 70 | React Context-based preferences (PreferencesProvider + usePreferences) |
| `hooks/use-audio-stream.ts` | 29 | Amplitude event listener |
| `hooks/use-history.ts` | 66 | History operations |

### Tests — 23 test files, ~2,452 lines
- **Rust**: 18 test files in `src-tauri/tests/` (1,763 lines) — unit (8), contract (5), integration (4), + harness files (3)
- **Frontend**: 5 test files (689 lines) — soundwave, recording-pill, model-card, hotkey-recorder, format-hotkey
- Inline unit tests in Rust modules: `capture.rs`, `resample.rs`, `models.rs`, `storage.rs`, `preferences/mod.rs`
