# Feature Specification: Voice Input

**Feature Branch**: `001-voice-input`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "Cross-platform desktop app that allows a user to speak and have their speech transcribed and passed into a particular program as text. Support local transcription models, customizable hotkeys, clean UI with soundwave visualization, and flexible text injection into target programs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Speak and Transcribe to Active Window (Priority: P1)

A user is working in a terminal running Claude Code. They press a global hotkey to start recording, speak their prompt naturally, and press the hotkey again (or release it) to stop. The transcribed text appears in the terminal as if they had typed it. The entire flow happens without leaving the target application.

**Why this priority**: This is the core value proposition. Without reliable capture-transcribe-inject into the active window, nothing else matters.

**Independent Test**: Can be fully tested by pressing the hotkey, speaking a sentence, stopping, and verifying the transcribed text appears in the currently focused application.

**Acceptance Scenarios**:

1. **Given** the app is running in the background and a terminal is focused, **When** the user presses the record hotkey and speaks "list all files in this directory", **Then** the text "list all files in this directory" is injected into the terminal as keyboard input.
2. **Given** the app is recording, **When** the user presses the stop hotkey, **Then** recording stops, transcription completes, and the result is injected into the active window within 3 seconds of stopping.
3. **Given** the app is running, **When** no transcription model is configured, **Then** the app prompts the user to select and configure a model before allowing recording.

---

### User Story 2 - Choose and Configure Transcription Model (Priority: P2)

A user opens the app settings and browses available transcription models. They can select a local model (e.g., Whisper variants), download it if needed, and set it as their active model. The user can switch between models at any time and compare transcription quality.

**Why this priority**: Model selection directly affects transcription accuracy and performance. Users need control over which model runs on their hardware, especially for privacy-sensitive workflows.

**Independent Test**: Can be tested by opening settings, selecting a model, running a transcription, switching to a different model, and confirming each produces output.

**Acceptance Scenarios**:

1. **Given** the user opens the model settings, **When** they view the model list, **Then** they see available local models with details (name, size, language support, estimated performance).
2. **Given** a model is not yet downloaded, **When** the user selects it, **Then** the app downloads the model with a progress indicator and makes it available for use.
3. **Given** the user has multiple models available, **When** they switch the active model, **Then** subsequent transcriptions use the newly selected model without restarting the app.

---

### User Story 3 - Customize Hotkeys (Priority: P3)

A user wants to change the default hotkey for starting/stopping voice recording to avoid conflicts with their existing workflow shortcuts. They open the hotkey settings, press their desired key combination, and the app registers it as the new trigger.

**Why this priority**: Hotkey conflicts can make the app unusable for specific workflows. Customization is essential but not blocking for initial use since sensible defaults exist.

**Independent Test**: Can be tested by opening hotkey settings, recording a new key combination, and verifying the new hotkey triggers recording.

**Acceptance Scenarios**:

1. **Given** the user opens hotkey settings, **When** they click "Record new hotkey" and press a key combination, **Then** the app captures and displays the combination.
2. **Given** a new hotkey is set, **When** the user presses it from any application, **Then** voice recording starts/stops as expected.
3. **Given** the user sets a hotkey that conflicts with a system shortcut, **When** they save, **Then** the app warns about the potential conflict and allows them to proceed or choose a different combination.

---

### User Story 4 - Visual Recording Feedback (Priority: P4)

While recording, the user sees a floating pill-shaped overlay with a soundwave animation that responds to their voice input. This provides clear visual confirmation that the app is listening and capturing audio. The overlay is minimal and non-intrusive.

**Why this priority**: Visual feedback is important for confidence in the recording state, but the app is functional without it (hotkey press/release provides implicit feedback).

**Independent Test**: Can be tested by triggering recording and observing the overlay appears with reactive soundwave animation, then stopping and confirming it disappears.

**Acceptance Scenarios**:

1. **Given** the user starts recording, **When** audio is being captured, **Then** a pill-shaped overlay appears showing a soundwave animation that responds to voice amplitude.
2. **Given** the overlay is visible, **When** the user stops speaking (silence), **Then** the soundwave flattens but the overlay remains visible indicating the app is still listening.
3. **Given** the user stops recording, **When** transcription begins, **Then** the overlay transitions to a brief "processing" state and then dismisses.
4. **Given** the overlay is visible, **When** the user moves between screens or virtual desktops, **Then** the overlay remains visible on the current screen.

---

### User Story 5 - Target Window Selection (Priority: P5)

Instead of always injecting text into the active window, the user wants to pick a specific target application. They use an app-switcher-style interface (similar to Cmd+Tab on macOS) to select which window receives the transcribed text. This is useful when the user wants to dictate into one app while reading from another.

**Why this priority**: The default active-window behavior covers most use cases. Explicit target selection is a power-user feature that adds significant flexibility but is not required for core functionality.

**Independent Test**: Can be tested by opening the target selector, choosing a specific window, speaking, and verifying text appears in the chosen window rather than the currently focused one.

**Acceptance Scenarios**:

1. **Given** the user triggers the target selector (via hotkey or UI), **When** the selector opens, **Then** it displays a list of open windows with app icons and window titles, similar to the OS app switcher.
2. **Given** the user selects a target window, **When** they subsequently record and transcribe, **Then** the text is injected into the selected target window regardless of which window is currently focused.
3. **Given** a target window is pinned, **When** that window is closed, **Then** the app notifies the user and reverts to active-window mode.
4. **Given** the user wants to return to default behavior, **When** they clear the pinned target, **Then** text injection reverts to the active window.

---

### Edge Cases

- What happens when the user speaks in a language not supported by the selected model? The app MUST indicate that the model may not support the detected language and suggest alternative models.
- What happens when the microphone is unavailable or in use by another app? The app MUST display a clear error message identifying the issue and suggest resolution steps (e.g., close other apps using the mic, check system permissions).
- What happens when the target window becomes unresponsive? The app MUST time out after a configurable period and notify the user that text injection failed, offering to copy the text to clipboard instead.
- What happens when the user speaks for an extended period (e.g., 10+ minutes)? The app MUST handle long-form dictation without degrading transcription quality or memory usage.
- What happens when the system goes to sleep or the lid is closed during recording? The app MUST gracefully stop recording and preserve any partially transcribed text.
- What happens when multiple instances of the app are running? The app MUST prevent multiple instances and focus the existing instance if a second launch is attempted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture audio from the system's default input device when triggered by a global hotkey.
- **FR-002**: System MUST transcribe captured audio using a user-selected local speech-to-text model.
- **FR-003**: System MUST inject transcribed text into the active window as simulated keyboard input by default.
- **FR-004**: System MUST allow users to browse, download, and switch between available local transcription models.
- **FR-005**: System MUST register and respond to global hotkeys that work regardless of which application is focused.
- **FR-006**: System MUST allow users to customize the hotkey bindings for start/stop recording and target window selection.
- **FR-007**: System MUST display a floating pill-shaped overlay with soundwave visualization during recording.
- **FR-008**: System MUST provide a target window selector that allows users to pin a specific window for text injection.
- **FR-009**: System MUST persist user preferences (selected model, hotkey bindings, target window preferences) across sessions.
- **FR-010**: System MUST run as a background process with a system tray icon for quick access to settings and controls.
- **FR-011**: System MUST work on macOS, Windows, and Linux.
- **FR-012**: System MUST prevent multiple simultaneous instances from running.
- **FR-013**: System MUST provide a settings interface for configuring all user preferences (model, hotkeys, behavior).
- **FR-014**: System MUST handle microphone permission requests gracefully on all supported platforms.
- **FR-015**: System MUST support both push-to-talk (hold hotkey) and toggle (press to start, press to stop) recording modes.

### Key Entities

- **Transcription Model**: Represents a speech-to-text model available for use. Attributes include name, size, supported languages, download status, and performance characteristics.
- **Recording Session**: Represents a single voice capture instance from start to stop. Contains audio data, duration, timestamp, and resulting transcription.
- **Hotkey Binding**: Represents a user-configured keyboard shortcut mapped to a specific action (start/stop recording, open target selector, open settings).
- **Target Window**: Represents the application window designated to receive transcribed text. Can be the active window (default) or a user-pinned specific window.
- **User Preferences**: Represents all persisted user configuration including selected model, hotkey bindings, recording mode, and UI preferences.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from pressing the hotkey to seeing transcribed text in their target application within 3 seconds of finishing speaking (for utterances under 30 seconds).
- **SC-002**: Transcription accuracy MUST meet or exceed 90% word accuracy for clear English speech in a quiet environment using the recommended default model.
- **SC-003**: The app MUST consume less than 500MB of RAM during active transcription (excluding model file size on disk).
- **SC-004**: The recording overlay MUST appear within 200ms of pressing the record hotkey, providing immediate visual feedback.
- **SC-005**: The app MUST support at least 3 different local transcription model options at launch.
- **SC-006**: Users can complete initial setup (model selection, first transcription) within 5 minutes of first launch.
- **SC-007**: Hotkey response MUST work reliably across all supported platforms when the app is in the background.

### Assumptions

- Users have a working microphone connected to their computer.
- Users have sufficient disk space to download at least one transcription model (typically 500MB-3GB).
- The primary use case is English language transcription; additional language support is a secondary concern.
- Users are comfortable with granting microphone and accessibility permissions required by the OS.
- Push-to-talk is the default recording mode; toggle mode is available as an alternative preference.
- The default hotkey will be a commonly unused combination that avoids conflicts with popular applications (e.g., Ctrl+Shift+Space / Cmd+Shift+Space).
