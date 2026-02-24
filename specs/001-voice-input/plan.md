# Implementation Plan: Voice Input

**Branch**: `001-voice-input` | **Date**: 2026-02-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-voice-input/spec.md`

## Summary

Build a cross-platform desktop application (macOS, Windows, Linux) that
captures speech via a global hotkey, transcribes it locally using
Whisper models (via `whisper-rs`), and injects the text into the active
or a user-pinned target window. The app runs as a system tray background
process with a React/Tailwind settings UI and a floating pill-shaped
recording overlay with real-time soundwave visualization.

## Technical Context

**Language/Version**: Rust 1.80+ (backend), TypeScript 5+ (frontend)
**Primary Dependencies**: Tauri v2, React 19, Tailwind CSS v4,
whisper-rs 0.15, cpal 0.17, enigo 1.85
**Storage**: JSON files in Tauri app data directory (no database)
**Testing**: `cargo test` (Rust), Vitest + Testing Library (frontend)
**Target Platform**: macOS (Metal), Windows (CUDA), Linux (X11/ALSA)
**Project Type**: Tauri desktop app (Rust backend + React frontend)
**Performance Goals**: Transcription injection within 3s of stop;
overlay appears within 200ms of hotkey press
**Constraints**: <500MB RAM during transcription (excluding model);
local-only inference (no cloud APIs)
**Scale/Scope**: Single-user desktop app; ~15 Tauri commands; ~10 React
components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Test-First (TDD)

- [x] **Pre-check**: Test strategy defined — `cargo test` for Rust
  domain logic, Vitest for React components, contract tests for Tauri
  commands
- [x] **Post-check**: Data model and contracts are testable; each
  domain module (audio, transcription, injection, preferences) has
  clear boundaries for unit tests; integration tests cover Rust ↔ React
  IPC via Tauri Channels

### II. Simplicity / YAGNI

- [x] **Pre-check**: No speculative abstractions planned; each crate
  serves a direct requirement
- [x] **Post-check**: Storage is flat JSON files (no ORM/database);
  model registry is a simple JSON array; no plugin architecture or
  extensibility framework; window activation uses direct platform calls
  (no abstraction layer beyond `cfg` target blocks)

### III. Type Safety

- [x] **Pre-check**: Rust types defined for all domain entities; all
  public functions will have explicit signatures
- [x] **Post-check**: Data model defines matching Rust structs and
  TypeScript interfaces; `CommandError` is a typed error enum;
  `unwrap()` prohibited — all Tauri commands return `Result<T, CommandError>`;
  `strict: true` in tsconfig; Tauri Channel events are typed via
  `Channel<AudioEvent>` discriminated union

### IV. Convention over Configuration

- [x] **Pre-check**: `snake_case` for Rust, `camelCase` for TypeScript,
  `kebab-case` for file names
- [x] **Post-check**: Project structure follows Tauri v2 conventions
  (`src-tauri/src/` for Rust, `src/` for React); Tauri commands follow
  the `#[tauri::command]` pattern; React hooks follow `use-` prefix
  convention; domain modules use `mod.rs` barrel pattern

### V. Domain-Driven Design

- [x] **Pre-check**: Entities map to domain concepts (TranscriptionModel,
  RecordingSession, HotkeyBinding, TargetWindow, UserPreferences)
- [x] **Post-check**: Rust source organized by bounded context:
  `audio/`, `transcription/`, `injection/`, `preferences/`; Tauri
  commands map to domain operations (not CRUD); boundary types
  (`CommandError`, `AudioEvent`) preserve domain semantics in both
  Rust and TypeScript

### Quality Gates

- [x] All gates are achievable with the defined tool chain:
  `cargo check`, `tsc --noEmit`, `cargo clippy -D warnings`, ESLint,
  `cargo fmt --check`, Prettier, `cargo build --release`, `npm run build`

### Security Standards

- [x] Tauri commands validate all inputs at the boundary
- [x] `cargo audit` and `npm audit` will be run before merge
- [x] No secrets required (all processing is local)
- [x] File system access scoped via Tauri's allowlist
- [x] CSP will be configured to restrict to `self` + Tauri IPC

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-input/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├── data-model.md        # Entity definitions (Rust + TypeScript)
├── quickstart.md        # Developer setup guide
├── contracts/
│   └── tauri-commands.md # Tauri command API contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/
├── src/
│   ├── main.rs
│   ├── audio/
│   │   ├── mod.rs
│   │   ├── capture.rs
│   │   └── resample.rs
│   ├── transcription/
│   │   ├── mod.rs
│   │   ├── engine.rs
│   │   └── models.rs
│   ├── injection/
│   │   ├── mod.rs
│   │   ├── keyboard.rs
│   │   ├── clipboard.rs
│   │   └── windows.rs
│   ├── preferences/
│   │   ├── mod.rs
│   │   └── storage.rs
│   └── commands/
│       ├── mod.rs
│       ├── audio_commands.rs
│       ├── model_commands.rs
│       ├── injection_commands.rs
│       ├── preferences_commands.rs
│       └── system_commands.rs
├── Cargo.toml
├── tauri.conf.json
└── capabilities/
    └── default.json

src/
├── App.tsx
├── main.tsx
├── pages/
│   ├── settings.tsx
│   ├── models.tsx
│   ├── hotkeys.tsx
│   └── overlay.tsx
├── components/
│   ├── soundwave.tsx
│   ├── recording-pill.tsx
│   ├── model-card.tsx
│   ├── hotkey-recorder.tsx
│   └── window-selector.tsx
├── hooks/
│   ├── use-audio-stream.ts
│   ├── use-recording.ts
│   ├── use-models.ts
│   └── use-preferences.ts
└── types/
    └── index.ts

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Tauri v2 desktop app structure with domain-driven
Rust modules. The backend is organized by bounded context (`audio/`,
`transcription/`, `injection/`, `preferences/`) rather than technical
layer. The frontend follows standard React + Vite conventions with
page-level routing between the settings window and the overlay window
(separate Tauri webview).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `macOSPrivateApi: true` | Required for transparent overlay window on macOS | No alternative — Tauri requires this flag for window transparency on macOS. Trade-off: disqualifies Mac App Store distribution. |
| Platform-specific window activation code | `activate_window()` requires `cfg(target_os)` blocks with different implementations per OS | No cross-platform crate exists for this. The abstraction is a single function with 3 implementations, not a framework. |
