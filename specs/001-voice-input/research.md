# Research: Voice Input

**Branch**: `001-voice-input` | **Date**: 2026-02-18
**Input**: Technical Context unknowns from plan template

## R1: Local Speech-to-Text Engine

**Decision**: Use `whisper-rs` v0.15 (Rust FFI bindings to whisper.cpp)

**Rationale**:
- Most battle-tested Whisper integration in the Rust ecosystem
- Broadest hardware acceleration: Metal (macOS), CUDA (Windows/Linux),
  Vulkan (cross-platform), CoreML (macOS)
- Supports quantized models (Q4, Q5, Q8) for reduced memory usage
- `WhisperContext` is `Send + Sync`, integrates cleanly with Tauri's
  async command system
- Proven in existing Tauri apps (Handy, Pothook)
- Active maintenance tracking upstream whisper.cpp

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| `candle` (Hugging Face pure-Rust) | Slightly lower performance than whisper.cpp with hardware acceleration; larger dependency tree |
| `rwhisper` (Kalosm wrapper) | Low adoption (~482 downloads/month); pulls in full Candle dependency tree |
| `faster-whisper-rs` | Requires Python runtime — unacceptable for a desktop app |

## R2: Audio Capture

**Decision**: Use `cpal` v0.17 (Cross-Platform Audio Library) with
`rubato` for sample rate conversion

**Rationale**:
- De facto standard for cross-platform audio in Rust (8.7M+ downloads)
- Native backends: CoreAudio (macOS), WASAPI (Windows), ALSA (Linux)
- Whisper requires 16kHz mono f32; `rubato` provides high-quality
  resampling from device native rates (44.1kHz/48kHz)

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| `rodio` | Built on cpal; adds playback features we don't need; still requires cpal for input capture |
| `dasp` (for resampling) | Simpler but lower quality resampling than rubato |

## R3: Model Management and Downloading

**Decision**: Use `hf-hub` v0.3 for downloading GGML models from
Hugging Face with app-local caching

**Rationale**:
- `whisper-rs` does not handle model downloading — it loads from file paths
- `hf-hub` provides programmatic access to Hugging Face model repos
- Supports download progress callbacks for UI indication
- Caches downloads locally; subsequent loads skip the network
- Models stored in Tauri's app data directory

**Model lineup**:

| Model | Disk Size | RAM Usage | Use Case |
|-------|-----------|-----------|----------|
| `base.en-q5_1` | 60 MiB | ~150 MB | Low-resource fallback |
| `small.en` | 466 MiB | ~1-1.5 GB | Default — good accuracy, reasonable RAM |
| `small.en-q5_1` | 190 MiB | ~400 MB | Default alternative for constrained hardware |
| `large-v3-turbo-q5_0` | 547 MiB | ~1.5-2 GB | High-quality option — near SOTA accuracy, 6x faster than large-v3 |

## R4: Text Injection into Target Applications

**Decision**: Use `enigo` v1.85 as primary with `arboard` clipboard
paste as fallback

**Rationale**:
- `enigo` is the most maintained keyboard simulation crate (~35k
  downloads/month)
- `enigo.text()` uses platform-native fast paths (CGEvents on macOS,
  SendInput on Windows, XTest on X11) with full Unicode support
- Some apps (Electron, games) may not respond to simulated keystrokes;
  clipboard paste (Cmd/Ctrl+V via `arboard`) provides a reliable fallback
- Dual-strategy covers virtually all target applications

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| `rdev` / `rdevin` | Fragmented fork history; no `text()` fast path; designed for listening, not simulation |
| `autopilot-rs` | Overkill (full GUI automation); low recent activity |
| `InputBot` | No macOS support |

## R5: Window Enumeration and Activation

**Decision**: Use `x-win` for window enumeration, platform-specific
code for window activation

**Rationale**:
- `x-win` provides `get_open_windows()` returning title, PID, app name,
  position — exactly what the target selector UI needs
- Window activation has no good cross-platform crate; requires:
  - macOS: `NSRunningApplication.activateWithOptions` via `objc2`
  - Windows: `SetForegroundWindow` via `windows` crate
  - Linux: `xdotool` for X11

**Alternatives considered**:

| Option | Rejected Because |
|--------|-----------------|
| `active-win-pos-rs` | Only gets the active window; no enumeration of all windows |
| `xcap` | Heavier (includes screenshot capability); window enumeration is not its primary focus |

## R6: Global Hotkeys

**Decision**: Use `tauri-plugin-global-shortcut` (official Tauri v2
plugin)

**Rationale**:
- Official Tauri plugin maintained by the Tauri team
- Supports registration from both Rust and JavaScript
- Built on the `global-hotkey` crate (also by Tauri team)
- Handles platform differences transparently
- Supports dynamic registration/unregistration for user customization

## R7: Overlay Window (Recording Indicator)

**Decision**: Tauri v2 transparent, always-on-top, non-focusable window
with Canvas API soundwave visualization

**Rationale**:
- Tauri v2 supports all required window properties: `transparent`,
  `decorations: false`, `alwaysOnTop`, `focusable: false`,
  `skipTaskbar`, `visibleOnAllWorkspaces`
- `set_ignore_cursor_events(true)` makes the overlay click-through
- Canvas API is the best choice for 60fps soundwave animation (single
  DOM element, no per-bar DOM nodes like SVG)
- Audio amplitude streamed from Rust via Tauri Channels (not Events —
  Channels are designed for high-throughput ordered data)
- `macOSPrivateApi: true` required for transparent windows on macOS
  (disqualifies Mac App Store distribution)

## R8: System Tray / Background Process

**Decision**: Tauri v2 `tray-icon` feature with `LSUIElement` on macOS

**Rationale**:
- `tray-icon` Cargo feature enables system tray support
- `LSUIElement: true` in Info.plist makes the app a macOS agent
  application (no Dock icon)
- Window close intercepted to hide instead of quit
- `RunEvent::ExitRequested` handler prevents exit when all windows are
  hidden

## R9: OS Permissions

**Decision**: Check and prompt for permissions at first launch

**Permissions required**:

| Platform | Permission | Required For |
|----------|-----------|-------------|
| macOS | Accessibility | `enigo` keyboard simulation (CGEvents) |
| macOS | Microphone | `cpal` audio capture |
| macOS | Input Monitoring | Global hotkey listening (Big Sur+) |
| Windows | None (standard) | Basic operation at same integrity level |
| Windows | UAC elevation | Injecting into elevated (admin) windows |
| Linux (X11) | None | XTest and ALSA available by default |
| Linux (GNOME) | Shell extension | `x-win` window enumeration on GNOME >= 41 |

## Dependency Summary

```toml
[dependencies]
# Tauri framework
tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-shell = "2"

# Speech-to-text
whisper-rs = { version = "0.15", features = ["metal"] }

# Audio capture and processing
cpal = "0.17"
rubato = "0.15"

# Model downloading
hf-hub = "0.3"

# Text injection
enigo = "1.85"
arboard = "3"

# Window management
x-win = "0.4"

# Platform helpers
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

```json
// Frontend (package.json)
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-global-shortcut": "^2",
    "react": "^19",
    "react-dom": "^19",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^6",
    "@vitejs/plugin-react": "^4",
    "vitest": "^3",
    "@testing-library/react": "^16",
    "eslint": "^9",
    "prettier": "^3"
  }
}
```
