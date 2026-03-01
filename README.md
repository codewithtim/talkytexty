<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="TalkyTexty icon" />
</p>

<h1 align="center">TalkyTexty</h1>

<p align="center">
  Voice to text, anywhere on your desktop. Speak and your words appear wherever your cursor is.
</p>

<p align="center">
  Runs entirely offline using local Whisper models — no API keys, no cloud, no data leaves your machine.
</p>

---

## How it works

1. Press a global hotkey from any application
2. Speak into your microphone
3. Press the hotkey again (or release it in push-to-talk mode)
4. Your transcribed text is typed into the active window

TalkyTexty runs in your system tray and works with any application — text editors, browsers, chat apps, terminals, IDEs.

## Features

- **Global hotkeys** — start/stop recording from any application
- **Toggle or push-to-talk** — hold to record or press to toggle
- **Local transcription** — whisper.cpp models run entirely on-device
- **Text injection** — transcribed text is typed into the active window automatically
- **Model management** — download and switch between Whisper models of different sizes
- **Visual feedback** — floating overlay shows recording status with animated soundwave
- **System tray** — runs in the background, accessible from the menu bar
- **Customizable** — hotkeys, overlay style, recording mode, and more

## Install

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Rust | 1.80+ | `rustup update stable` |
| Node.js | 20+ | |
| pnpm | 9+ | `npm install -g pnpm` |
| cmake | any | Required for whisper.cpp compilation |

**macOS:** `xcode-select --install && brew install cmake`

**Windows:** Visual Studio Build Tools with C++ workload (cmake included)

**Linux:** `sudo apt install libasound2-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev cmake`

### Build from source

```bash
git clone https://github.com/codewithtim/talkytexty.git
cd talkytexty
pnpm install
pnpm tauri build
```

The first build takes several minutes (compiles whisper.cpp and all Rust dependencies).

The built app is in `src-tauri/target/release/bundle/`:
- **macOS**: `macos/TalkyTexty.app` — drag to your Applications folder
- **Windows**: `nsis/TalkyTexty_x.x.x_x64-setup.exe` — run the installer
- **Linux**: `appimage/TalkyTexty_x.x.x_amd64.AppImage` or `deb/` — install as usual

### First launch

1. Open TalkyTexty — it starts in the **system tray** (menu bar on macOS)
2. Click the tray icon and select **Show Settings**
3. **Grant permissions** when prompted:
   - **macOS**: Microphone access and Accessibility (System Settings > Privacy & Security)
   - **Windows**: No special permissions needed
   - **Linux**: Ensure ALSA is working (`arecord -l` lists devices)
4. Navigate to **Models** and download a model (Small English Q5 recommended)
5. Open any text editor, press `Cmd+Shift+Space` (macOS) or `Ctrl+Shift+Space`, and speak
6. Press the hotkey again to stop — your text appears in the editor

### Choosing a model

| Model | Size | Speed | Accuracy | Best for |
|-------|------|-------|----------|----------|
| Base English (Q5) | ~60 MB | Fastest | Good | Quick testing |
| Small English (Q5) | ~190 MB | Fast | Better | **Daily use (recommended)** |
| Small English | ~466 MB | Moderate | Better | Best quality for size |
| Large V3 Turbo (Q5) | ~547 MB | Slower | Best | Maximum accuracy, multilingual |

## Default hotkeys

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Toggle recording | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| Push-to-talk | `Cmd+Shift+V` | `Ctrl+Shift+V` |
| Open target selector | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| Open settings | `Cmd+Shift+,` | `Ctrl+Shift+,` |

All hotkeys are customizable in Settings. Push-to-talk is disabled by default.

## Recording modes

**Toggle** (default): Press the hotkey to start recording. Press again to stop and transcribe.

**Push-to-talk**: Hold the hotkey to record. Release to stop and transcribe. Enable in Settings > Recording.

## Text injection

Two methods for inserting text (configurable in Settings):

- **Simulated Keystrokes** (default) — types text character by character. Works in most applications.
- **Clipboard Paste** — pastes via `Cmd+V` / `Ctrl+V`. Faster for long text. Restores your previous clipboard content.

---

## Development

Built with [Tauri v2](https://v2.tauri.app/) (Rust backend + React frontend).

### Running in dev mode

```bash
pnpm tauri dev
```

Starts the Vite dev server and launches the app with hot reload. Subsequent builds are incremental and fast.

### Testing

```bash
# Rust tests
cd src-tauri && cargo test

# Frontend tests
pnpm test

# All quality gates
cd src-tauri && cargo test && cargo clippy -- -D warnings && cd .. && \
  npx tsc --noEmit && pnpm lint && pnpm format:check
```

### Project structure

```
src/                           # React frontend (TypeScript)
  pages/                       #   Route pages (settings, overlay, picker)
  components/                  #   UI components (soundwave, hotkey recorder, etc.)
  hooks/                       #   React hooks (recording, models, preferences)
  types/                       #   Shared TypeScript interfaces
src-tauri/                     # Rust backend
  src/
    lib.rs                     #   App entry, tray, hotkey handler
    audio/                     #   Audio capture (cpal) and resampling (rubato)
    transcription/             #   Whisper engine and model registry
    injection/                 #   Text injection (keyboard, clipboard)
    preferences/               #   User preferences persistence
    commands/                  #   Tauri IPC command handlers
  tests/                       #   Rust test suites
```

## Troubleshooting

**"No input device available"** — Check microphone permissions. macOS: System Settings > Privacy & Security > Microphone.

**"Failed to load whisper model"** — Delete the model in Settings > Models and re-download.

**Hotkeys not working** — macOS requires Accessibility permission. System Settings > Privacy & Security > Accessibility > add TalkyTexty.

**Text not appearing** — Some apps block simulated keystrokes. Try Clipboard Paste mode in Settings.

## Disclaimer

This project is entirely vibe-coded using [Claude](https://claude.ai) and is not a representation of my coding abilities.

## License

MIT — see [LICENSE](LICENSE) for details.
