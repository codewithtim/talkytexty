# Text to Code

A desktop application that transcribes speech into text and injects it into any application. Press a hotkey, speak, and your words appear wherever your cursor is.

Runs entirely offline using local Whisper models -- no API keys, no cloud, no data leaves your machine.

Built with Tauri v2 (Rust backend + React frontend).

## Features

- **Global hotkeys** -- start/stop recording from any application
- **Toggle or push-to-talk** -- hold to record or press to toggle
- **Local transcription** -- whisper.cpp models run on-device
- **Text injection** -- transcribed text is typed into the active window
- **Model management** -- download and switch between Whisper models
- **Visual feedback** -- floating overlay shows recording status with soundwave
- **System tray** -- runs in the background, accessible from the menu bar

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Rust | 1.80+ | `rustup update stable` |
| Node.js | 20+ | |
| pnpm | 9+ | `npm install -g pnpm` |
| cmake | any | Required for whisper.cpp compilation |
| Microphone | -- | Built-in or external |

### Platform-specific

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- cmake: `brew install cmake`

**Windows:**
- Visual Studio Build Tools with C++ workload
- cmake (included with VS Build Tools, or install separately)

**Linux:**
```bash
sudo apt install libasound2-dev libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev cmake
```

## Setup

```bash
git clone <repo-url>
cd text-to-code
pnpm install
```

Verify Rust is ready:

```bash
rustup update stable
cargo --version   # 1.80+
rustc --version   # 1.80+
cmake --version   # any
```

## Running locally

```bash
pnpm tauri dev
```

This starts the Vite dev server on `http://localhost:1420` and launches the Tauri application. The first build takes several minutes as it compiles whisper.cpp and all Rust dependencies.

### First launch

1. The app starts minimized to the **system tray** (menu bar on macOS)
2. Click the tray icon and select **Show Settings**
3. **Grant permissions** when prompted:
   - **macOS**: Microphone access and Accessibility (System Settings > Privacy & Security)
   - **Windows**: No special permissions needed
   - **Linux**: Ensure ALSA is working (`arecord -l` lists devices)
4. Navigate to **Models** and download a model (see below)
5. Open a text editor, press `Cmd+Shift+Space` (macOS) or `Ctrl+Shift+Space`, and speak
6. Press the hotkey again to stop -- your text appears in the editor

### Choosing a model

Navigate to Settings > Models. Available models:

| Model | Size | Speed | Accuracy | Recommendation |
|-------|------|-------|----------|----------------|
| Base English (Q5) | ~60 MB | Fastest | Good | Quick testing |
| Small English (Q5) | ~190 MB | Fast | Better | Daily use |
| Small English | ~466 MB | Moderate | Better | Best quality for size |
| Large V3 Turbo (Q5) | ~547 MB | Slower | Best | Maximum accuracy, multilingual |

For most users, **Small English (Q5)** is the best balance of speed and accuracy.

## Default hotkeys

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Toggle recording | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| Push-to-talk | `Cmd+Shift+V` | `Ctrl+Shift+V` |
| Open target selector | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| Open settings | `Cmd+Shift+,` | `Ctrl+Shift+,` |

Push-to-talk is disabled by default. Enable it in Settings > Hotkeys.

All hotkeys can be customized in Settings > Hotkeys.

## Recording modes

**Toggle mode** (default): Press the hotkey to start recording. Press again to stop. The app transcribes and injects the text.

**Push-to-talk mode**: Hold the hotkey to record. Release to stop and transcribe. Enable this in Settings > Hotkeys by toggling the Push to Talk binding.

## Text injection methods

The app supports two methods for inserting text (configurable in Settings):

- **Simulated Keystrokes** (default) -- types text character by character via the OS keyboard API. Works in most applications.
- **Clipboard Paste** -- copies text to clipboard and simulates `Cmd+V` / `Ctrl+V`. Faster for long text. Restores your previous clipboard content after pasting.

## Testing

### Rust tests

```bash
cd src-tauri
cargo test
```

This runs all test suites:
- **Unit tests** -- audio capture helpers, resampling, engine error handling, push-to-talk logic
- **Contract tests** -- Tauri command validation (error codes, state transitions)
- **Integration tests** -- cross-module recording flow

Some tests require hardware (microphone, downloaded model, accessibility permission) and are marked `#[ignore]`. Run them with:

```bash
cargo test -- --ignored
```

### Frontend tests

```bash
pnpm test
```

### Linting and formatting

```bash
# Rust
cd src-tauri
cargo clippy -- -D warnings
cargo fmt --check

# TypeScript
pnpm lint
pnpm format:check
```

### All quality gates at once

```bash
cd src-tauri && cargo test && cargo clippy -- -D warnings && cd .. && \
  npx tsc --noEmit && pnpm lint && pnpm format:check
```

## Building for production

```bash
pnpm tauri build
```

The built application is placed in `src-tauri/target/release/bundle/`.

## Project structure

```
text-to-code/
  src/                           # React frontend
    pages/                       #   Route pages (settings, models, hotkeys, overlay)
    components/                  #   UI components (soundwave, model-card, etc.)
    hooks/                       #   React hooks (recording, models, preferences)
    types/                       #   Shared TypeScript interfaces
  src-tauri/                     # Rust backend
    src/
      lib.rs                     #   App entry, tray, hotkey handler
      hotkeys.rs                 #   Hotkey event routing logic
      audio/                     #   Audio capture (cpal) and resampling (rubato)
      transcription/             #   Whisper engine and model registry
      injection/                 #   Text injection (keyboard, clipboard)
      preferences/               #   User preferences persistence
      commands/                  #   Tauri IPC command handlers
    tests/                       #   Rust test suites (unit, contract, integration)
  specs/                         # Feature specifications and design docs
```

## Architecture

The app runs as a Tauri v2 desktop application with two windows:

- **Settings window** (800x600) -- model management, hotkey configuration, preferences. Hidden by default, opened from the system tray.
- **Recording overlay** (300x80) -- transparent, always-on-top pill showing recording status and soundwave. Appears during recording.

The backend is organized into domain modules following Domain-Driven Design:

- **Audio** -- microphone capture via cpal, sample rate conversion via rubato
- **Transcription** -- whisper-rs inference, model registry with HuggingFace downloads
- **Injection** -- text input via enigo (keystrokes) or arboard (clipboard)
- **Preferences** -- JSON persistence, hotkey bindings, recording mode

Communication between frontend and backend uses Tauri commands (invoke) and Channels (streaming events like amplitude data).

## Troubleshooting

**"No input device available"** -- Check that your microphone is connected and permissions are granted. On macOS, go to System Settings > Privacy & Security > Microphone.

**"Failed to load whisper model"** -- The model file may be corrupted. Delete it in Settings > Models and re-download.

**Hotkeys not working** -- On macOS, the app needs Accessibility permission. Go to System Settings > Privacy & Security > Accessibility and add Text to Code.

**Text not appearing in target app** -- Some applications block simulated keystrokes. Try switching to Clipboard Paste mode in Settings.

**First build is slow** -- The initial `cargo build` compiles whisper.cpp from source, which takes several minutes. Subsequent builds are incremental and fast.

## License

Private -- all rights reserved.
