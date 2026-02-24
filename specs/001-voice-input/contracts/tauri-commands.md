# Tauri Command Contracts: Voice Input

**Branch**: `001-voice-input` | **Date**: 2026-02-18

Commands are organized by bounded context (domain module). Each command
maps to a domain operation per Constitution Principle V.

## Audio Domain

### `start_recording`

Begins audio capture from the default input device and streams
amplitude data to the frontend for visualization.

```rust
#[tauri::command]
async fn start_recording(
    state: State<'_, AppState>,
    on_event: Channel<AudioEvent>,
) -> Result<String, CommandError>
```

**Input**: `on_event` — Tauri Channel for streaming audio events
**Output**: `String` — recording session ID
**Events emitted**:
- `AudioEvent::RecordingStarted`
- `AudioEvent::AmplitudeUpdate { amplitudes: Vec<f32>, rms: f32 }`

**Errors**:
- `NoModelSelected` — no active transcription model configured
- `MicrophoneUnavailable` — default input device not accessible
- `AlreadyRecording` — a recording session is already active

**Maps to**: FR-001, FR-015

---

### `stop_recording`

Stops audio capture and triggers transcription of the captured audio.

```rust
#[tauri::command]
async fn stop_recording(
    state: State<'_, AppState>,
    on_event: Channel<AudioEvent>,
) -> Result<TranscriptionResult, CommandError>
```

**Input**: `on_event` — Channel for transcription progress events
**Output**: `TranscriptionResult { session_id, text, duration_ms }`
**Events emitted**:
- `AudioEvent::RecordingStopped`
- `AudioEvent::TranscriptionStarted`
- `AudioEvent::TranscriptionCompleted { text: String }`

**Errors**:
- `NotRecording` — no active recording session
- `TranscriptionFailed { message }` — model inference error

**Maps to**: FR-001, FR-002

---

## Transcription Domain

### `list_models`

Returns all known transcription models with their download status.

```rust
#[tauri::command]
async fn list_models(
    state: State<'_, AppState>,
) -> Result<Vec<TranscriptionModel>, CommandError>
```

**Input**: None
**Output**: `Vec<TranscriptionModel>` — all models from the registry

**Maps to**: FR-004

---

### `download_model`

Downloads a model from Hugging Face and stores it in the app data
directory.

```rust
#[tauri::command]
async fn download_model(
    state: State<'_, AppState>,
    model_id: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<TranscriptionModel, CommandError>
```

**Input**:
- `model_id` — ID of the model to download
- `on_progress` — Channel for download progress events

**Output**: Updated `TranscriptionModel` with `Downloaded` status
**Events emitted**:
- `DownloadProgress { model_id, percent: f32, bytes_downloaded, bytes_total }`

**Errors**:
- `ModelNotFound` — unknown model ID
- `AlreadyDownloaded` — model is already downloaded
- `DownloadFailed { message }` — network or disk error
- `InsufficientDiskSpace` — not enough space for the model

**Maps to**: FR-004

---

### `delete_model`

Removes a downloaded model from disk.

```rust
#[tauri::command]
async fn delete_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), CommandError>
```

**Input**: `model_id`
**Output**: None

**Errors**:
- `ModelNotFound` — unknown model ID
- `ModelInUse` — model is the active model (must switch first)
- `NotDownloaded` — model is not downloaded

**Maps to**: FR-004

---

### `set_active_model`

Sets the active transcription model. Loads it into memory for
immediate use.

```rust
#[tauri::command]
async fn set_active_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), CommandError>
```

**Input**: `model_id`
**Output**: None

**Errors**:
- `ModelNotFound` — unknown model ID
- `NotDownloaded` — model must be downloaded before activating
- `LoadFailed { message }` — failed to load model into memory

**Maps to**: FR-004

---

## Text Injection Domain

### `inject_text`

Injects transcribed text into the target window using simulated
keystrokes or clipboard paste.

```rust
#[tauri::command]
async fn inject_text(
    state: State<'_, AppState>,
    text: String,
) -> Result<(), CommandError>
```

**Input**: `text` — transcribed text to inject
**Output**: None

**Behavior**:
1. If target mode is Pinned, activate the pinned window first
2. Attempt simulated keystrokes via `enigo.text()`
3. If injection method is ClipboardPaste, use clipboard + Cmd/Ctrl+V

**Errors**:
- `TargetWindowNotFound` — pinned window no longer exists
- `InjectionFailed { message }` — keyboard simulation failed
- `AccessibilityPermissionDenied` — macOS Accessibility not granted

**Maps to**: FR-003, FR-008

---

### `list_windows`

Returns all open windows for the target window selector UI.

```rust
#[tauri::command]
async fn list_windows() -> Result<Vec<TargetWindow>, CommandError>
```

**Input**: None
**Output**: `Vec<TargetWindow>` — open windows with title, app name,
process ID

**Maps to**: FR-008

---

### `set_target_window`

Pins a specific window as the text injection target.

```rust
#[tauri::command]
async fn set_target_window(
    state: State<'_, AppState>,
    window_id: Option<String>,
) -> Result<(), CommandError>
```

**Input**: `window_id` — window to pin, or `None` to revert to active
window mode
**Output**: None

**Errors**:
- `WindowNotFound` — specified window does not exist

**Maps to**: FR-008

---

## Preferences Domain

### `get_preferences`

Returns the current user preferences.

```rust
#[tauri::command]
async fn get_preferences(
    state: State<'_, AppState>,
) -> Result<UserPreferences, CommandError>
```

**Input**: None
**Output**: `UserPreferences`

**Maps to**: FR-009, FR-013

---

### `update_preferences`

Updates user preferences and persists them to disk.

```rust
#[tauri::command]
async fn update_preferences(
    state: State<'_, AppState>,
    preferences: UserPreferences,
) -> Result<(), CommandError>
```

**Input**: `preferences` — complete updated preferences
**Output**: None

**Side effects**:
- Re-registers global hotkeys if hotkey bindings changed
- Updates overlay position/opacity if changed
- Persists to `preferences.json`

**Errors**:
- `InvalidHotkey { message }` — hotkey combination is malformed
- `PersistFailed { message }` — failed to write preferences file

**Maps to**: FR-006, FR-009, FR-013

---

## System Domain

### `check_permissions`

Checks whether required OS permissions are granted.

```rust
#[tauri::command]
async fn check_permissions() -> Result<PermissionStatus, CommandError>
```

**Input**: None
**Output**:
```rust
pub struct PermissionStatus {
    pub microphone: bool,
    pub accessibility: bool,
}
```

**Maps to**: FR-014

---

### `request_permission`

Prompts the user to grant a specific permission.

```rust
#[tauri::command]
async fn request_permission(
    permission_type: String,
) -> Result<bool, CommandError>
```

**Input**: `permission_type` — `"microphone"` or `"accessibility"`
**Output**: `bool` — whether permission was granted

**Maps to**: FR-014

---

## Error Type

All commands share a common error type:

```rust
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}
```

```typescript
interface CommandError {
  code: string;
  message: string;
}
```

## FR Mapping Summary

| Command | Functional Requirements |
|---------|------------------------|
| `start_recording` | FR-001, FR-015 |
| `stop_recording` | FR-001, FR-002 |
| `list_models` | FR-004 |
| `download_model` | FR-004 |
| `delete_model` | FR-004 |
| `set_active_model` | FR-004 |
| `inject_text` | FR-003, FR-008 |
| `list_windows` | FR-008 |
| `set_target_window` | FR-008 |
| `get_preferences` | FR-009, FR-013 |
| `update_preferences` | FR-006, FR-009, FR-013 |
| `check_permissions` | FR-014 |
| `request_permission` | FR-014 |
