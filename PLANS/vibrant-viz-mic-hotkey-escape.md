# Vibrant Visualizations, Mic Selection, Hotkey on Pill, Escape to Cancel

## Context

The overlay pill visualizations lack vibrancy — they need more bars, brighter colors, and glow effects. The app is also missing microphone input selection (currently hardcoded to system default), the pill doesn't show which hotkey to use, and there's no way to cancel a recording without transcribing.

## Domain Model Changes

### New Domain Concepts

- **AudioDevice** — represents an available audio input device (name + default flag)
- **CancelRecording** — a new recording lifecycle action that discards audio without transcribing
- **HotkeyDisplayFormat** — platform-aware formatting of shortcut strings for UI display

### Modified Domain Concepts

- **UserPreferences** — gains `selected_audio_device: Option<String>`
- **HotkeyResponse** — gains `CancelRecording` variant
- **AudioCapture** — accepts optional device name for targeted capture
- **RecordingPill** — gains hotkey display prop

## Development Approach: TDD + DDD

Each feature follows the Red-Green-Refactor cycle:
1. **Red**: Write failing tests that define the expected behavior
2. **Green**: Implement the minimum code to make tests pass
3. **Refactor**: Clean up while keeping tests green

Domain boundaries are respected:
- **Audio domain** (`src-tauri/src/audio/`) — capture, device enumeration, resampling
- **Preferences domain** (`src-tauri/src/preferences/`) — types, validation, storage
- **Hotkey domain** (`src-tauri/src/hotkeys.rs`) — event resolution, response routing
- **Command layer** (`src-tauri/src/commands/`) — orchestrates domains, exposes to frontend
- **Visualization domain** (`src/components/visualizations/`) — canvas rendering
- **UI layer** (`src/components/`, `src/pages/`) — React components, state, events

---

## Feature 1: More Vibrant Visualizations

### 1.1 Domain: Audio (backend bin count)
- **Test**: Existing `test_downsample_basic` in `capture.rs` — add test for 48 bins
- **Change**: `src-tauri/src/audio/capture.rs` line 67 — `downsample_for_visualization(&samples, 32)` → 48

### 1.2 Domain: Visualization (frontend canvas rendering)
- **Test**: Update canvas mock in `recording-pill.test.tsx` to include `shadowColor`/`shadowBlur`
- **Changes**:

**`src/components/visualizations/bars.tsx`**:
- 32 → 48 bars, color `#2563eb`, opacity `0.3 + amp * 0.7`
- Canvas glow: `shadowColor="#3b82f6"`, `shadowBlur = 8 * amp`
- Border radius 1 → 2, bar height factor 0.8 → 0.85

**`src/components/visualizations/sine.tsx`**:
- Add 4th wave (amber `#f59e0b`, freqMult 2.5, alpha 0.45)
- Saturated colors: `#2563eb`, `#7c3aed`; alphas: 0.7/0.6/0.55
- Line width 2 → 3, canvas shadow per wave, wave height 0.4 → 0.45

**`src/components/visualizations/rainbow.tsx`**:
- 32 → 48 bars, 5 color stops (+ amber), opacity `0.3 + amp * 0.7`
- Canvas glow per bar, border radius 1 → 2

**`src/components/panels/general-panel.tsx`**:
- `useFakeAmplitudes`: 32 → 48 values

---

## Feature 2: Microphone Input Selection

### 2.1 Domain: Audio — device enumeration
- **Test (Rust)**: Unit test `list_audio_devices` returns non-empty Vec on dev machine
- **Change**: `src-tauri/src/audio/capture.rs` — new public function `list_input_devices() -> Result<Vec<AudioDeviceInfo>>` using `cpal::default_host().input_devices()`

### 2.2 Domain: Audio — device-targeted capture
- **Test (Rust)**: Unit test that `AudioCapture::start(callback, None)` still works (default device)
- **Change**: `AudioCapture::start()` gains `device_name: Option<&str>` param. If Some, finds device; if not found, falls back to default with warning log.

### 2.3 Domain: Preferences — new field
- **Test**: Verify deserialization of old prefs JSON without `selectedAudioDevice` field (serde default)
- **Changes**:
  - `src-tauri/src/preferences/mod.rs` — add `#[serde(default)] pub selected_audio_device: Option<String>`
  - `src/types/index.ts` — add `selectedAudioDevice: string | null` to UserPreferences, add `AudioDevice` interface

### 2.4 Command layer — wire it up
- **Change**: `src-tauri/src/commands/audio_commands.rs` — new `list_audio_devices` command; `start_recording` reads device from prefs and passes to `AudioCapture::start()`
- **Change**: `src-tauri/src/lib.rs` — register `list_audio_devices` in invoke_handler

### 2.5 UI layer — mic selector
- **Change**: `src/components/panels/general-panel.tsx` — "Microphone" section with `<select>` dropdown. Fetches devices on mount via `invoke("list_audio_devices")`. Options: "System Default" + enumerated devices (with "(Default)" suffix on current default).

---

## Feature 3: Hotkey Displayed on Pill

### 3.1 Domain: Hotkey display formatting
- **Test (Vitest)**: Create `src/utils/format-hotkey.test.ts`:
  - `"CommandOrControl+Shift+Space"` → `"⌘⇧Space"` (Mac)
  - `"CommandOrControl+Shift+Space"` → `"Ctrl+Shift+Space"` (non-Mac)
  - Edge cases: single modifier, Alt/Option
- **Change**: Create `src/utils/format-hotkey.ts` — `formatHotkeyForDisplay(keyCombination: string): string`

### 3.2 UI layer — pill display
- **Test**: `recording-pill.test.tsx` — add tests:
  - "displays hotkey when provided" — render with `hotkey="⌘⇧Space"`, assert text present
  - "does not display hotkey when not provided" — render without prop, assert not present
- **Change**: `src/components/recording-pill.tsx` — add `hotkey?: string` prop, render below status row in subtle gray monospace

### 3.3 UI layer — overlay wiring
- **Change**: `src/pages/overlay.tsx` — extract active ToggleRecording/PushToTalk hotkey from prefs, format with utility, pass as `hotkey` prop

---

## Feature 4: Escape to Cancel Recording

### 4.1 Domain: Hotkey — new response variant
- **Test (Rust)**: Update existing hotkey tests if present; add test that CancelRecording variant exists
- **Change**: `src-tauri/src/hotkeys.rs` — add `CancelRecording` to `HotkeyResponse` enum

### 4.2 Command layer — cancel_recording command
- **Test (Rust)**: Unit test `cancel_recording` when recording active → Ok, sets recording_active false
- **Change**: `src-tauri/src/commands/audio_commands.rs` — new `cancel_recording` command:
  - Validates can stop, takes capture, drops it (discards audio — no transcription)
  - Sets `recording_active = false`, unregisters Escape shortcut
  - Emits `"recording-cancelled"`, hides overlay, updates tray

### 4.3 Command layer — dynamic Escape registration
- **Change**: `src-tauri/src/commands/audio_commands.rs`:
  - In `start_recording`: register Escape as global shortcut after showing overlay
  - In `stop_recording`: unregister Escape after marking stopped
- **Change**: `src-tauri/src/lib.rs`:
  - In global shortcut handler: check if shortcut is Escape, emit `"hotkey-cancel-recording"` if recording
  - In tray toggle handler: register/unregister Escape alongside start/stop
  - Register `cancel_recording` in invoke_handler

### 4.4 Frontend — recording hook
- **Test**: Add test for cancel flow in use-recording if test file exists
- **Change**: `src/hooks/use-recording.ts`:
  - Add `cancelRecording` callback: calls `invoke("cancel_recording")`, sets state to idle
  - Listen for `"hotkey-cancel-recording"` event → call cancelRecording
  - Export in return type

### 4.5 Frontend — overlay
- **Change**: `src/pages/overlay.tsx` — listen for `"recording-cancelled"` event → setVisible(false)

---

## To-Do List

### Feature 1: Vibrant Visualizations
- [ ] **1.1** Write Rust test for 48-bin downsample in `capture.rs`
- [ ] **1.2** Update `downsample_for_visualization` call from 32 → 48 bins
- [ ] **1.3** Update canvas mock in `recording-pill.test.tsx` with `shadowColor`/`shadowBlur`
- [ ] **1.4** Enhance `bars.tsx` — 48 bars, glow, saturated color, wider opacity
- [ ] **1.5** Enhance `sine.tsx` — 4th wave, glow, thicker lines, higher alphas
- [ ] **1.6** Enhance `rainbow.tsx` — 48 bars, 5 color stops, glow, wider opacity
- [ ] **1.7** Update `general-panel.tsx` `useFakeAmplitudes` to 48 values
- [ ] **1.8** Run tests, verify `tsc` and `cargo check` pass

### Feature 2: Microphone Input Selection
- [ ] **2.1** Add `AudioDevice` struct to `audio_commands.rs`
- [ ] **2.2** Implement `list_audio_devices` Tauri command
- [ ] **2.3** Add `device_name: Option<&str>` param to `AudioCapture::start()`
- [ ] **2.4** Add `selected_audio_device` to Rust `UserPreferences` with `#[serde(default)]`
- [ ] **2.5** Add `AudioDevice` interface and `selectedAudioDevice` to TS types
- [ ] **2.6** Wire device selection in `start_recording` command
- [ ] **2.7** Register `list_audio_devices` in `lib.rs` invoke_handler
- [ ] **2.8** Add `MicrophoneSelector` component to `general-panel.tsx`
- [ ] **2.9** Run tests, verify compilation

### Feature 3: Hotkey on Pill
- [ ] **3.1** Write tests for `formatHotkeyForDisplay` in `src/utils/format-hotkey.test.ts`
- [ ] **3.2** Implement `src/utils/format-hotkey.ts`
- [ ] **3.3** Write recording-pill tests for hotkey prop display
- [ ] **3.4** Add `hotkey` prop to `RecordingPill` component
- [ ] **3.5** Wire hotkey extraction and formatting in `overlay.tsx`
- [ ] **3.6** Run tests, verify compilation

### Feature 4: Escape to Cancel
- [ ] **4.1** Add `CancelRecording` to `HotkeyResponse` enum in `hotkeys.rs`
- [ ] **4.2** Implement `cancel_recording` command in `audio_commands.rs`
- [ ] **4.3** Add Escape register/unregister to `start_recording` and `stop_recording`
- [ ] **4.4** Add Escape handling to global shortcut handler in `lib.rs`
- [ ] **4.5** Add Escape register/unregister to tray toggle handler in `lib.rs`
- [ ] **4.6** Register `cancel_recording` in `lib.rs` invoke_handler
- [ ] **4.7** Add `cancelRecording` to `use-recording.ts` hook with event listener
- [ ] **4.8** Add `recording-cancelled` listener to `overlay.tsx`
- [ ] **4.9** Run full test suite, verify all compilation passes

### Final Verification
- [ ] `cargo test` — Rust unit tests pass
- [ ] `cargo check` — Rust compiles
- [ ] `npx tsc --noEmit` — TypeScript compiles
- [ ] `pnpm test` — Frontend tests pass
- [ ] Manual: visualizations are vibrant with glow effects
- [ ] Manual: mic selector lists devices, selection persists
- [ ] Manual: pill shows formatted hotkey
- [ ] Manual: Escape cancels recording, no transcription occurs

## Files Summary

| Action | File | Domain |
|--------|------|--------|
| Edit | `src-tauri/src/audio/capture.rs` | Audio |
| Edit | `src-tauri/src/commands/audio_commands.rs` | Command |
| Edit | `src-tauri/src/preferences/mod.rs` | Preferences |
| Edit | `src-tauri/src/hotkeys.rs` | Hotkey |
| Edit | `src-tauri/src/lib.rs` | App orchestration |
| Edit | `src/types/index.ts` | Shared types |
| Edit | `src/components/visualizations/bars.tsx` | Visualization |
| Edit | `src/components/visualizations/sine.tsx` | Visualization |
| Edit | `src/components/visualizations/rainbow.tsx` | Visualization |
| Edit | `src/components/recording-pill.tsx` | UI |
| Edit | `src/pages/overlay.tsx` | UI |
| Edit | `src/hooks/use-recording.ts` | UI hooks |
| Edit | `src/components/panels/general-panel.tsx` | UI |
| Create | `src/utils/format-hotkey.ts` | Hotkey display |
| Create | `src/utils/format-hotkey.test.ts` | Test |
| Edit | `src/components/recording-pill.test.tsx` | Test |
