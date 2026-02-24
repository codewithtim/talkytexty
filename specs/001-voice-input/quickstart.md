# Quickstart: Voice Input

**Branch**: `001-voice-input` | **Date**: 2026-02-18

## Prerequisites

- Rust 1.80+ (for cpal CoreAudio support on macOS)
- Node.js 20+
- A working microphone
- macOS: Xcode Command Line Tools
- Windows: Visual Studio Build Tools (C++ workload)
- Linux: `libasound2-dev` (ALSA headers), `libgtk-3-dev`,
  `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`

## Setup

1. Clone and install dependencies:

```bash
git clone <repo-url>
cd text-to-code
npm install
```

2. Verify Rust toolchain:

```bash
rustup update stable
cargo --version  # should be 1.80+
```

3. Run in development mode:

```bash
npm run tauri dev
```

This starts the Vite dev server and launches the Tauri app window.

## First Run

1. The app starts minimized to the system tray
2. Click the tray icon to open the settings window
3. **Grant permissions** when prompted:
   - macOS: Microphone access and Accessibility (System Settings >
     Privacy & Security)
   - Windows: No special permissions needed
   - Linux: Ensure ALSA is working (`arecord -l` lists devices)
4. **Download a model**: Go to Settings > Models, select "small.en"
   (recommended default), and click Download
5. **Test recording**: Press `Cmd+Shift+Space` (macOS) or
   `Ctrl+Shift+Space` (Windows/Linux) to start recording
6. Speak a sentence and press the hotkey again to stop
7. The transcribed text appears in the active window

## Project Structure

```
text-to-code/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entry point, tray setup
│   │   ├── audio/
│   │   │   ├── mod.rs            # Audio domain module
│   │   │   ├── capture.rs        # cpal microphone capture
│   │   │   └── resample.rs       # 16kHz conversion via rubato
│   │   ├── transcription/
│   │   │   ├── mod.rs            # Transcription domain module
│   │   │   ├── engine.rs         # whisper-rs inference wrapper
│   │   │   └── models.rs         # Model registry and downloading
│   │   ├── injection/
│   │   │   ├── mod.rs            # Text injection domain module
│   │   │   ├── keyboard.rs       # enigo text injection
│   │   │   ├── clipboard.rs      # arboard clipboard fallback
│   │   │   └── windows.rs        # x-win window enumeration
│   │   ├── preferences/
│   │   │   ├── mod.rs            # Preferences domain module
│   │   │   └── storage.rs        # JSON file persistence
│   │   └── commands/
│   │       ├── mod.rs            # Tauri command registration
│   │       ├── audio_commands.rs
│   │       ├── model_commands.rs
│   │       ├── injection_commands.rs
│   │       ├── preferences_commands.rs
│   │       └── system_commands.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
├── src/
│   ├── App.tsx                   # React root with router
│   ├── main.tsx                  # Entry point
│   ├── pages/
│   │   ├── settings.tsx          # Main settings page
│   │   ├── models.tsx            # Model management page
│   │   ├── hotkeys.tsx           # Hotkey configuration page
│   │   └── overlay.tsx           # Recording overlay (separate window)
│   ├── components/
│   │   ├── soundwave.tsx         # Canvas soundwave visualization
│   │   ├── recording-pill.tsx    # Pill-shaped overlay container
│   │   ├── model-card.tsx        # Model list item with download
│   │   ├── hotkey-recorder.tsx   # Hotkey capture input
│   │   └── window-selector.tsx   # Target window picker
│   ├── hooks/
│   │   ├── use-audio-stream.ts   # Tauri Channel audio events
│   │   ├── use-recording.ts      # Recording state management
│   │   ├── use-models.ts         # Model CRUD operations
│   │   └── use-preferences.ts    # Preferences read/write
│   └── types/
│       └── index.ts              # Shared TypeScript interfaces
├── tests/
│   ├── contract/                 # Tauri command contract tests
│   ├── integration/              # Cross-domain integration tests
│   └── unit/                     # Pure function unit tests
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── specs/
    └── 001-voice-input/          # This feature's design docs
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start development mode |
| `npm run tauri build` | Build production binary |
| `cargo test` | Run Rust tests |
| `npm test` | Run frontend tests (vitest) |
| `cargo clippy -- -D warnings` | Lint Rust code |
| `npm run lint` | Lint TypeScript code |
| `cargo fmt --check` | Check Rust formatting |
| `npm run format:check` | Check TypeScript formatting |

## Validation Checklist

After setup, verify the following work:

- [ ] `npm run tauri dev` launches the app
- [ ] System tray icon appears
- [ ] Settings window opens from tray
- [ ] Microphone permission prompt appears (macOS)
- [ ] Model download completes with progress bar
- [ ] Hotkey triggers recording (overlay appears)
- [ ] Speech is transcribed and injected into a text editor
