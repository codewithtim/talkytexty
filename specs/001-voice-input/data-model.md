# Data Model: Voice Input

**Branch**: `001-voice-input` | **Date**: 2026-02-18

## Entity Overview

```
UserPreferences (1) ──── (1) ActiveModel ──── (*) TranscriptionModel
       │
       ├── (*) HotkeyBinding
       │
       └── (0..1) TargetWindow

RecordingSession ──── (1) TranscriptionModel
```

## Entities

### TranscriptionModel

Represents a speech-to-text model available for local inference.

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionModel {
    pub id: String,
    pub name: String,
    pub variant: ModelVariant,
    pub size_bytes: u64,
    pub languages: Vec<String>,
    pub quantization: Option<Quantization>,
    pub download_status: DownloadStatus,
    pub huggingface_repo: String,
    pub huggingface_filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelVariant {
    Tiny,
    Base,
    Small,
    Medium,
    LargeV2,
    LargeV3,
    LargeV3Turbo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Quantization {
    Q4_0,
    Q4_1,
    Q5_0,
    Q5_1,
    Q8_0,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadStatus {
    NotDownloaded,
    Downloading { progress_percent: f32 },
    Downloaded { local_path: String },
    Error { message: String },
}
```

**TypeScript**:
```typescript
interface TranscriptionModel {
  id: string;
  name: string;
  variant: ModelVariant;
  sizeBytes: number;
  languages: string[];
  quantization: Quantization | null;
  downloadStatus: DownloadStatus;
  huggingfaceRepo: string;
  huggingfaceFilename: string;
}

type ModelVariant =
  | "Tiny" | "Base" | "Small" | "Medium"
  | "LargeV2" | "LargeV3" | "LargeV3Turbo";

type Quantization = "Q4_0" | "Q4_1" | "Q5_0" | "Q5_1" | "Q8_0" | "None";

type DownloadStatus =
  | { status: "NotDownloaded" }
  | { status: "Downloading"; progressPercent: number }
  | { status: "Downloaded"; localPath: string }
  | { status: "Error"; message: string };
```

**Validation rules**:
- `id` MUST be unique across all models
- `size_bytes` MUST be > 0
- `languages` MUST contain at least one entry
- `local_path` (when Downloaded) MUST point to an existing file

**State transitions**:
```
NotDownloaded → Downloading → Downloaded
                    ↓
                  Error → NotDownloaded (retry)
Downloaded → NotDownloaded (user deletes model)
```

---

### RecordingSession

Represents a single voice capture instance from start to stop.

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSession {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub status: RecordingStatus,
    pub model_id: String,
    pub transcription: Option<String>,
    pub target_window: TargetWindowRef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingStatus {
    Recording,
    Transcribing,
    Completed,
    Failed { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TargetWindowRef {
    ActiveWindow,
    Pinned { window_id: String },
}
```

**TypeScript**:
```typescript
interface RecordingSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: RecordingStatus;
  modelId: string;
  transcription: string | null;
  targetWindow: TargetWindowRef;
}

type RecordingStatus =
  | { status: "Recording" }
  | { status: "Transcribing" }
  | { status: "Completed" }
  | { status: "Failed"; message: string };

type TargetWindowRef =
  | { type: "ActiveWindow" }
  | { type: "Pinned"; windowId: string };
```

**Validation rules**:
- `started_at` MUST be ISO 8601 format
- `ended_at` MUST be after `started_at` when present
- `model_id` MUST reference an existing TranscriptionModel with
  DownloadStatus::Downloaded
- `transcription` is only present when status is Completed

**State transitions**:
```
Recording → Transcribing → Completed
               ↓
             Failed
Recording → Failed (microphone error, system sleep)
```

---

### HotkeyBinding

Represents a user-configured keyboard shortcut mapped to an action.

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyBinding {
    pub action: HotkeyAction,
    pub key_combination: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum HotkeyAction {
    ToggleRecording,
    PushToTalk,
    OpenTargetSelector,
    OpenSettings,
}
```

**TypeScript**:
```typescript
interface HotkeyBinding {
  action: HotkeyAction;
  keyCombination: string;
  enabled: boolean;
}

type HotkeyAction =
  | "ToggleRecording"
  | "PushToTalk"
  | "OpenTargetSelector"
  | "OpenSettings";
```

**Validation rules**:
- `action` MUST be unique — only one binding per action
- `key_combination` MUST follow Tauri shortcut format
  (e.g., `"CommandOrControl+Shift+Space"`)
- `key_combination` MUST NOT be empty when `enabled` is true

**Defaults**:

| Action | Default Key Combination |
|--------|------------------------|
| ToggleRecording | `CommandOrControl+Shift+Space` |
| PushToTalk | (disabled by default) |
| OpenTargetSelector | `CommandOrControl+Shift+T` |
| OpenSettings | `CommandOrControl+Shift+,` |

---

### TargetWindow

Represents an application window designated to receive transcribed text.

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetWindow {
    pub window_id: String,
    pub title: String,
    pub app_name: String,
    pub process_id: u32,
}
```

**TypeScript**:
```typescript
interface TargetWindow {
  windowId: string;
  title: string;
  appName: string;
  processId: number;
}
```

**Validation rules**:
- `window_id` is platform-specific (HWND on Windows, CGWindowID on
  macOS, X11 window ID on Linux)
- `process_id` MUST reference a running process
- `title` may change if the window updates its title bar

---

### UserPreferences

Represents all persisted user configuration.

**Rust**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub active_model_id: Option<String>,
    pub recording_mode: RecordingMode,
    pub hotkeys: Vec<HotkeyBinding>,
    pub target_mode: TargetMode,
    pub text_injection_method: TextInjectionMethod,
    pub overlay_position: OverlayPosition,
    pub overlay_opacity: f32,
    pub launch_at_login: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingMode {
    PushToTalk,
    Toggle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TargetMode {
    ActiveWindow,
    Pinned { window_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TextInjectionMethod {
    SimulatedKeystrokes,
    ClipboardPaste,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverlayPosition {
    TopCenter,
    TopRight,
    BottomCenter,
    BottomRight,
}
```

**TypeScript**:
```typescript
interface UserPreferences {
  activeModelId: string | null;
  recordingMode: RecordingMode;
  hotkeys: HotkeyBinding[];
  targetMode: TargetMode;
  textInjectionMethod: TextInjectionMethod;
  overlayPosition: OverlayPosition;
  overlayOpacity: number;
  launchAtLogin: boolean;
}

type RecordingMode = "PushToTalk" | "Toggle";

type TargetMode =
  | { type: "ActiveWindow" }
  | { type: "Pinned"; windowId: string };

type TextInjectionMethod = "SimulatedKeystrokes" | "ClipboardPaste";

type OverlayPosition =
  | "TopCenter" | "TopRight" | "BottomCenter" | "BottomRight";
```

**Validation rules**:
- `active_model_id` MUST reference a downloaded model when present
- `overlay_opacity` MUST be between 0.0 and 1.0
- `hotkeys` MUST contain exactly one binding per HotkeyAction
- When `target_mode` is Pinned, `window_id` MUST reference a running
  window (revert to ActiveWindow if window closes)

**Persistence**: Serialized as JSON to Tauri's app data directory
(`app.path().app_data_dir()` / `preferences.json`).

## Storage Strategy

All persistent data is stored as JSON files in the Tauri app data
directory. No database is required.

```
{app_data_dir}/
├── preferences.json     # UserPreferences
└── models/              # Downloaded model files
    ├── registry.json    # Vec<TranscriptionModel> metadata
    ├── ggml-base.en-q5_1.bin
    ├── ggml-small.en.bin
    └── ...
```

RecordingSession is ephemeral (in-memory only) — it is not persisted
across app restarts.
