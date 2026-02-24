# Tasks: Voice Input

**Input**: Design documents from `/specs/001-voice-input/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per Constitution Principle I (Test-First / TDD).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend (Rust)**: `src-tauri/src/`
- **Frontend (React)**: `src/`
- **Tests**: `tests/` (Rust), `src/**/*.test.ts` (frontend)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, Tauri scaffold, and tooling configuration

- [X] T001 Initialize Tauri v2 project with `npm create tauri-app` in repository root, selecting React + TypeScript + Vite template
- [X] T002 Configure `src-tauri/Cargo.toml` with all Rust dependencies per research.md dependency summary (whisper-rs, cpal, rubato, hf-hub, enigo, arboard, x-win, tauri-plugin-global-shortcut, serde, serde_json, tokio)
- [X] T003 [P] Configure `package.json` with frontend dependencies per research.md (react 19, tailwindcss 4, @tauri-apps/api, @tauri-apps/plugin-global-shortcut, vitest, @testing-library/react, eslint, prettier)
- [X] T004 [P] Configure `tsconfig.json` with `strict: true`, path aliases, and Tauri type declarations
- [X] T005 [P] Configure `tailwind.config.ts` with constrained design token set (colors, spacing, font sizes — no arbitrary values per Constitution Principle III)
- [X] T006 [P] Configure ESLint and Prettier for TypeScript/React in `.eslintrc.cjs` and `.prettierrc`
- [X] T007 Configure `src-tauri/tauri.conf.json` with app metadata, two windows (main + recording-overlay), `macOSPrivateApi: true`, `LSUIElement` in Info.plist, CSP policy per research.md R7/R8
- [X] T008 Configure `src-tauri/capabilities/default.json` with required permissions (window management, global-shortcut, shell) per research.md R7
- [X] T009 Create directory structure for Rust domain modules: `src-tauri/src/audio/`, `src-tauri/src/transcription/`, `src-tauri/src/injection/`, `src-tauri/src/preferences/`, `src-tauri/src/commands/`
- [X] T010 [P] Create directory structure for frontend: `src/pages/`, `src/components/`, `src/hooks/`, `src/types/`
- [X] T011 [P] Create directory structure for tests: `tests/contract/`, `tests/integration/`, `tests/unit/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, error handling, app state, and system tray — required before ANY user story

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T012 Define shared TypeScript interfaces in `src/types/index.ts` per data-model.md (TranscriptionModel, RecordingSession, HotkeyBinding, TargetWindow, UserPreferences, all enums and discriminated unions)
- [X] T013 [P] Define shared Rust domain types in `src-tauri/src/transcription/mod.rs` (TranscriptionModel, ModelVariant, Quantization, DownloadStatus structs/enums per data-model.md)
- [X] T014 [P] Define shared Rust domain types in `src-tauri/src/audio/mod.rs` (RecordingSession, RecordingStatus, AudioEvent enum with AmplitudeUpdate/RecordingStarted/RecordingStopped variants per contracts)
- [X] T015 [P] Define shared Rust domain types in `src-tauri/src/injection/mod.rs` (TargetWindow, TargetWindowRef per data-model.md)
- [X] T016 [P] Define shared Rust domain types in `src-tauri/src/preferences/mod.rs` (UserPreferences, HotkeyBinding, HotkeyAction, RecordingMode, TargetMode, TextInjectionMethod, OverlayPosition per data-model.md)
- [X] T017 Define CommandError type and error handling in `src-tauri/src/commands/mod.rs` per contracts (code + message fields, From impls for common error types)
- [X] T018 Implement UserPreferences JSON persistence (load/save/defaults) in `src-tauri/src/preferences/storage.rs` with default hotkey bindings per data-model.md
- [X] T019 Define AppState struct in `src-tauri/src/main.rs` holding RwLock<Option<WhisperContext>>, preferences, and recording session state
- [X] T020 Implement system tray with context menu (Show Settings, Quit) in `src-tauri/src/main.rs` per research.md R8, intercept window close to hide, prevent exit on last window close
- [X] T021 Implement `check_permissions` and `request_permission` Tauri commands in `src-tauri/src/commands/system_commands.rs` per contracts (PermissionStatus struct, macOS Accessibility check)
- [X] T022 [P] Implement `get_preferences` and `update_preferences` Tauri commands in `src-tauri/src/commands/preferences_commands.rs` per contracts, including hotkey re-registration side effect
- [X] T023 Register all Tauri commands and plugins (global-shortcut, shell) in `src-tauri/src/main.rs` builder setup
- [X] T024 [P] Create `src/hooks/use-preferences.ts` hook for reading and updating preferences via Tauri invoke
- [X] T025 Implement React app shell in `src/App.tsx` with basic routing between settings, models, and hotkeys pages
- [X] T026 [P] Create minimal `src/pages/settings.tsx` page with navigation to sub-pages (models, hotkeys) and permission status display

**Checkpoint**: Foundation ready — app launches to tray, settings window opens, preferences persist. User story implementation can now begin.

---

## Phase 3: User Story 1 — Speak and Transcribe to Active Window (Priority: P1) MVP

**Goal**: User presses a global hotkey, speaks, presses it again, and transcribed text appears in the active window.

**Independent Test**: Press hotkey, speak a sentence, stop recording, verify text appears in a text editor.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T027 [P] [US1] Unit test for audio capture module (mock cpal device, verify 16kHz f32 output) in `tests/unit/test_audio_capture.rs`
- [X] T028 [P] [US1] Unit test for audio resampling (verify rubato converts 44.1kHz/48kHz to 16kHz mono) in `tests/unit/test_resample.rs`
- [X] T029 [P] [US1] Unit test for whisper-rs engine wrapper (load model from fixture, transcribe known audio, verify text output) in `tests/unit/test_engine.rs`
- [X] T030 [P] [US1] Unit test for keyboard injection via enigo (verify text() call, verify clipboard fallback path) in `tests/unit/test_keyboard.rs`
- [X] T031 [P] [US1] Contract test for `start_recording` command (verify returns session ID, errors on no model, errors on already recording) in `tests/contract/test_audio_commands.rs`
- [X] T032 [P] [US1] Contract test for `stop_recording` command (verify returns TranscriptionResult, errors on not recording) in `tests/contract/test_audio_commands.rs`
- [X] T033 [P] [US1] Contract test for `inject_text` command (verify accepts text string, errors on permission denied) in `tests/contract/test_injection_commands.rs`
- [X] T033a [P] [US1] Integration test for hotkey → record → transcribe → inject round-trip via Tauri command invocation in `tests/integration/test_recording_flow.rs`
- [X] T033b [P] [US1] Unit test for push-to-talk mode (verify press starts recording, release stops and triggers transcription) in `tests/unit/test_push_to_talk.rs`

### Implementation for User Story 1

- [X] T034 [US1] Implement audio capture with cpal in `src-tauri/src/audio/capture.rs` (open default input device, stream f32 samples to buffer, emit amplitude data via callback)
- [X] T035 [US1] Implement sample rate conversion in `src-tauri/src/audio/resample.rs` (rubato resampler converting device native rate to 16kHz mono f32 for Whisper)
- [X] T036 [US1] Implement whisper-rs inference wrapper in `src-tauri/src/transcription/engine.rs` (load WhisperContext from path, transcribe f32 audio buffer, return text, handle errors with Result<T, E>)
- [X] T037 [US1] Implement model registry with built-in model definitions (base.en-q5_1, small.en, small.en-q5_1, large-v3-turbo-q5_0) in `src-tauri/src/transcription/models.rs` per research.md R3 model lineup
- [X] T038 [US1] Implement `list_models` and `set_active_model` Tauri commands in `src-tauri/src/commands/model_commands.rs` per contracts (load model into WhisperContext on activation)
- [X] T039 [US1] Implement `start_recording` Tauri command in `src-tauri/src/commands/audio_commands.rs` per contracts (spawn audio capture thread, stream AmplitudeUpdate events via Channel, return session ID)
- [X] T040 [US1] Implement `stop_recording` Tauri command in `src-tauri/src/commands/audio_commands.rs` per contracts (stop capture, pass audio to engine, return TranscriptionResult)
- [X] T041 [US1] Implement keyboard text injection via enigo in `src-tauri/src/injection/keyboard.rs` (enigo.text() primary path, handle errors)
- [X] T042 [US1] Implement clipboard paste fallback in `src-tauri/src/injection/clipboard.rs` (arboard set_text + Cmd/Ctrl+V via enigo, restore previous clipboard)
- [X] T043 [US1] Implement `inject_text` Tauri command in `src-tauri/src/commands/injection_commands.rs` per contracts (dispatch to keyboard or clipboard based on preferences)
- [X] T044 [US1] Register all enabled default global hotkeys (ToggleRecording, OpenTargetSelector, OpenSettings per data-model.md defaults) in `src-tauri/src/main.rs` setup using tauri-plugin-global-shortcut, wire to start/stop_recording commands
- [X] T044a [US1] Implement push-to-talk recording mode in `src-tauri/src/hotkeys.rs` and `src-tauri/src/lib.rs` (detect hotkey press = start recording, hotkey release = stop recording and transcribe, gate behavior on RecordingMode preference from UserPreferences)
- [X] T045 [US1] Implement `src/hooks/use-recording.ts` hook managing recording state (idle → recording → transcribing → injecting → idle) via Tauri invoke of start_recording/stop_recording/inject_text
- [X] T046 [US1] Implement `src/hooks/use-audio-stream.ts` hook receiving AudioEvent amplitude data from Tauri Channel for visualization

**Checkpoint**: At this point, the full speak-transcribe-inject loop works with a hardcoded default model via global hotkey. User Story 1 is independently testable.

---

## Phase 4: User Story 2 — Choose and Configure Transcription Model (Priority: P2)

**Goal**: User can browse models, download them with progress, switch active model at runtime.

**Independent Test**: Open model settings, download a model, verify it appears as downloaded, switch active model, run a transcription.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T047 [P] [US2] Unit test for model downloading via hf-hub (mock HTTP, verify progress callback, verify file written to app data dir) in `tests/unit/test_model_download.rs`
- [X] T048 [P] [US2] Contract test for `download_model` command (verify progress events, verify final Downloaded status, error on already downloaded) in `tests/contract/test_model_commands.rs`
- [X] T049 [P] [US2] Contract test for `delete_model` command (verify file removed, error on model in use) in `tests/contract/test_model_commands.rs`
- [X] T050 [P] [US2] Frontend test for ModelCard component (renders model name, size, download button, progress bar) in `src/components/model-card.test.tsx`
- [X] T050a [P] [US2] Integration test for model download → activate → transcribe round-trip via Tauri command invocation in `tests/integration/test_model_lifecycle.rs`

### Implementation for User Story 2

- [X] T051 [US2] Implement model downloading with hf-hub in `src-tauri/src/transcription/models.rs` (download from Hugging Face repo, emit DownloadProgress via Channel, save to app data dir, update registry.json)
- [X] T052 [US2] Implement model deletion in `src-tauri/src/transcription/models.rs` (remove file from disk, update registry.json, prevent deleting active model)
- [X] T053 [US2] Implement `download_model` and `delete_model` Tauri commands in `src-tauri/src/commands/model_commands.rs` per contracts
- [X] T054 [US2] Implement hot-swap model loading in `src-tauri/src/transcription/engine.rs` (drop old WhisperContext, load new one, RwLock write guard ensures no concurrent transcription)
- [X] T055 [US2] Implement `src/hooks/use-models.ts` hook for listing, downloading, deleting, and activating models via Tauri invoke
- [X] T056 [US2] Implement `src/components/model-card.tsx` component displaying model name, variant, size, languages, download status, and download/delete/activate actions with progress bar
- [X] T057 [US2] Implement `src/pages/models.tsx` page listing all models using model-card components, with active model indicator

**Checkpoint**: User Stories 1 AND 2 are independently functional. User can download models and switch between them.

---

## Phase 5: User Story 3 — Customize Hotkeys (Priority: P3)

**Goal**: User can view and change hotkey bindings for all actions through a settings UI.

**Independent Test**: Open hotkey settings, record a new key combination, verify it replaces the old one, press the new hotkey from another app, verify recording starts.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T058 [P] [US3] Unit test for hotkey validation (valid formats accepted, invalid rejected, conflict detection) in `tests/unit/test_hotkey_validation.rs`
- [X] T059 [P] [US3] Frontend test for HotkeyRecorder component (captures key combination, displays it, handles cancel) in `src/components/hotkey-recorder.test.tsx`
- [X] T059a [P] [US3] Integration test for hotkey re-registration after preference update via Tauri command invocation in `tests/integration/test_hotkey_rebind.rs`

### Implementation for User Story 3

- [X] T060 [US3] Implement hotkey validation and conflict detection in `src-tauri/src/preferences/mod.rs` (validate Tauri shortcut format, detect system shortcut conflicts)
- [X] T061 [US3] Implement dynamic hotkey re-registration in `src-tauri/src/main.rs` or dedicated module (unregister old, register new when preferences update)
- [X] T062 [US3] Implement `src/components/hotkey-recorder.tsx` component (listen for keydown, capture modifier+key combo, display formatted string, confirm/cancel UX)
- [X] T063 [US3] Implement `src/pages/hotkeys.tsx` page listing all HotkeyAction bindings with HotkeyRecorder for each, conflict warnings, save/reset buttons

**Checkpoint**: All hotkey bindings are customizable. User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 — Visual Recording Feedback (Priority: P4)

**Goal**: Floating pill-shaped overlay with real-time soundwave animation appears during recording.

**Independent Test**: Start recording, verify overlay appears with animated soundwave responding to voice, stop recording, verify overlay dismisses.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T064 [P] [US4] Frontend test for Soundwave component (renders canvas, responds to amplitude prop changes) in `src/components/soundwave.test.tsx`
- [X] T065 [P] [US4] Frontend test for RecordingPill component (shows/hides based on recording state, displays processing state) in `src/components/recording-pill.test.tsx`

### Implementation for User Story 4

- [X] T066 [US4] Implement `src/components/soundwave.tsx` Canvas-based soundwave visualization (receives amplitudes array, draws animated bars at 60fps using requestAnimationFrame, responds to amplitude changes, flattens on silence)
- [X] T067 [US4] Implement `src/components/recording-pill.tsx` pill container (dark semi-transparent background with backdrop blur, recording dot, soundwave canvas, "Recording"/"Processing" label, Tailwind styling)
- [X] T068 [US4] Implement `src/pages/overlay.tsx` overlay page (transparent background, centered pill, receives amplitude data from use-audio-stream hook, manages show/hide lifecycle based on recording state)
- [X] T069 [US4] Wire overlay window show/hide to recording lifecycle in `src-tauri/src/commands/audio_commands.rs` (show overlay window on start_recording, hide on transcription complete via Tauri window manager API)
- [X] T070 [US4] Configure overlay window properties at runtime in `src-tauri/src/main.rs` (set_ignore_cursor_events(true), position based on user preference)

**Checkpoint**: Recording now shows visual feedback via floating pill overlay. All stories 1-4 work independently.

---

## Phase 7: User Story 5 — Target Window Selection (Priority: P5)

**Goal**: User can pin a specific window as the text injection target instead of using the active window.

**Independent Test**: Open target selector, pick a specific window, speak and transcribe, verify text appears in the pinned window (not the focused one).

### Tests for User Story 5

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T071 [P] [US5] Unit test for window enumeration via x-win (mock get_open_windows, verify TargetWindow mapping) in `tests/unit/test_windows.rs`
- [X] T072 [P] [US5] Contract test for `list_windows` command (verify returns Vec<TargetWindow>) in `tests/contract/test_injection_commands.rs`
- [X] T073 [P] [US5] Contract test for `set_target_window` command (verify sets pinned mode, verify None clears to active window) in `tests/contract/test_injection_commands.rs`
- [X] T074 [P] [US5] Frontend test for WindowSelector component (renders window list, handles selection, shows pinned state) in `src/components/window-selector.test.tsx`

### Implementation for User Story 5

- [X] T075 [US5] Implement window enumeration via x-win in `src-tauri/src/injection/windows.rs` (get_open_windows, map to TargetWindow struct, filter out own app windows)
- [X] T076 [US5] Implement platform-specific window activation in `src-tauri/src/injection/windows.rs` (cfg(target_os) blocks: macOS via NSRunningApplication/osascript, Windows via SetForegroundWindow, Linux via xdotool)
- [X] T077 [US5] Implement `list_windows` and `set_target_window` Tauri commands in `src-tauri/src/commands/injection_commands.rs` per contracts
- [X] T078 [US5] Update `inject_text` command in `src-tauri/src/commands/injection_commands.rs` to activate pinned window before injecting when TargetMode is Pinned, revert to ActiveWindow if pinned window is gone
- [X] T079 [US5] Implement `src/components/window-selector.tsx` component (app-switcher-style list with window icons and titles, pinned indicator, clear button)
- [X] T080 [US5] Add target window selector to `src/pages/settings.tsx` showing current target mode (Active Window / Pinned: [window name]) with button to open selector
- [X] T081 [US5] Register global hotkey for target selector (CommandOrControl+Shift+T) in `src-tauri/src/main.rs` setup, wire to show/focus window selector UI

**Checkpoint**: All 5 user stories are independently functional. Full feature scope is complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Error handling edge cases, performance, security hardening

- [X] T082 Implement microphone unavailable error handling in `src-tauri/src/audio/capture.rs` (detect no device / permission denied, return clear CommandError)
- [ ] T083 [P] Implement system sleep / lid close handling in `src-tauri/src/audio/capture.rs` (listen for system events, gracefully stop recording, preserve partial transcription)
- [X] T084 [P] Implement single-instance enforcement in `src-tauri/src/main.rs` (detect existing instance, focus it, exit new instance) per FR-012
- [X] T085 [P] Implement long-form recording support in `src-tauri/src/audio/capture.rs` (streaming buffer management for 10+ minute sessions without memory degradation)
- [ ] T085a Implement unsupported language warning in `src-tauri/src/transcription/engine.rs` (after transcription, check if detected language differs from model's supported languages, emit warning event to frontend suggesting alternative models) per spec edge case 1
- [ ] T086 Add first-launch onboarding flow in `src/pages/settings.tsx` (permission check → model download → first recording walkthrough) per SC-006
- [X] T087 [P] Run `cargo clippy -- -D warnings` and fix all warnings across all Rust files
- [X] T088 [P] Run ESLint and Prettier across all TypeScript files and fix all violations
- [X] T089 [P] Run `cargo audit` and `npm audit` and resolve any critical/high vulnerabilities
- [ ] T090 Run quickstart.md validation — walk through all steps and verify each works on a clean checkout
- [X] T091 Verify `cargo build --release` and `npm run build` succeed with zero warnings
- [ ] T092 Verify cross-platform builds and smoke test on macOS, Windows, and Linux per FR-011 (build `cargo build --release` on each target, launch app, verify hotkey registration, record and transcribe a test utterance, verify text injection into a text editor)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — this is the MVP
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — can run parallel with US1 but US1 provides the transcription loop US2 enhances
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — independent of US1/US2
- **User Story 4 (Phase 6)**: Depends on US1 (Phase 3) — overlay needs the audio stream and recording lifecycle
- **User Story 5 (Phase 7)**: Depends on US1 (Phase 3) — target selection modifies the injection step from US1
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2. No story dependencies. **MVP target.**
- **User Story 2 (P2)**: After Phase 2. Independent of US1 (model management is standalone), but best done after US1 so hot-swap can be tested with the transcription loop.
- **User Story 3 (P3)**: After Phase 2. Fully independent — hotkey customization works in isolation.
- **User Story 4 (P4)**: After US1. Depends on the audio stream (amplitude data) and recording lifecycle from US1.
- **User Story 5 (P5)**: After US1. Depends on the inject_text command from US1 to add pinned-window behavior.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Domain types before services
- Services before Tauri commands
- Tauri commands before frontend hooks
- Hooks before UI components
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T003, T004, T005, T006 can run in parallel (independent config files); T010, T011 can run in parallel
- **Phase 2**: T013, T014, T015, T016 can run in parallel (independent domain type files); T022, T024, T026 can run in parallel
- **Phase 3 tests**: T027–T033 can ALL run in parallel (independent test files)
- **Phase 4 tests**: T047–T050 can ALL run in parallel
- **Phase 5 tests**: T058, T059 can run in parallel
- **Phase 6 tests**: T064, T065 can run in parallel
- **Phase 7 tests**: T071–T074 can ALL run in parallel
- **Phase 8**: T083, T084, T085, T087, T088, T089 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together (7 parallel tasks):
Task: "T027 Unit test for audio capture in tests/unit/test_audio_capture.rs"
Task: "T028 Unit test for audio resampling in tests/unit/test_resample.rs"
Task: "T029 Unit test for whisper engine in tests/unit/test_engine.rs"
Task: "T030 Unit test for keyboard injection in tests/unit/test_keyboard.rs"
Task: "T031 Contract test for start_recording in tests/contract/test_audio_commands.rs"
Task: "T032 Contract test for stop_recording in tests/contract/test_audio_commands.rs"
Task: "T033 Contract test for inject_text in tests/contract/test_injection_commands.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Press hotkey, speak, verify text appears in active window
5. Deploy/demo if ready — this alone delivers the core value

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Test independently → **MVP!** (hotkey → speak → text in active window)
3. User Story 2 → Test independently → Model browsing and switching
4. User Story 3 → Test independently → Custom hotkeys
5. User Story 4 → Test independently → Visual recording feedback
6. User Story 5 → Test independently → Target window pinning
7. Polish → Edge cases, security, performance

### Parallel Team Strategy

With multiple developers after Foundational phase:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (MVP — highest priority)
   - Developer B: User Story 3 (independent — hotkey customization)
3. After US1 completes:
   - Developer A: User Story 4 (depends on US1 audio stream)
   - Developer B: User Story 5 (depends on US1 injection)
   - Developer C: User Story 2 (model management)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Tests MUST be written and FAIL before implementation (Constitution Principle I)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- `unwrap()` prohibited in all Rust code — use `Result<T, E>` and `?` operator
