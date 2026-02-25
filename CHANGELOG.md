# Changelog

All notable changes to TalkyTexty are documented here.

## [0.2.1] - 2026-02-25

### Added

- Stats widget on General panel showing avg WPM, words this week, total transcriptions, and time saved
- macOS microphone permission request on first launch via Info.plist
- Accessibility permission enforcement — blocks recording until both mic and accessibility are granted
- Permission banner with real-time status indicators and grant buttons (polls every 2s for accessibility changes)

### Changed

- Moved settings hotkey into the General panel's Recording section
- Removed dedicated Hotkeys sidebar item and tray menu entry
- Removed Hotkeys item from system tray menu

## [0.2.0] - 2026-02-25

### Added

- "What's New" changelog panel in the sidebar
- CONTRIBUTING.md with setup and quality gate instructions
- Custom parrot pixel art icon (transparent background)

### Changed

- Renamed app from "Text to Code" to "TalkyTexty" throughout the UI
- Microphone selection now syncs between status bar and settings panel
- About panel uses the parrot icon instead of a generic microphone

### Fixed

- Alt+Space hotkey registration on macOS (non-breaking space handling)
- Settings dropdowns hidden behind menu items (overflow clipping)

## [0.1.0] - 2025-02-25

### Added

- Global hotkey recording with toggle and push-to-talk modes
- Local speech-to-text transcription using whisper.cpp (runs entirely offline)
- Text injection into any application via simulated keystrokes or clipboard paste
- Model management — download, switch, and delete Whisper models from the UI
- Recording overlay with animated soundwave (Bars, Sine, Rainbow visualizations)
- Processing animations (Pulse, Frozen Frame, Typing Parrot)
- Overlay mode options: Full, Mini, or None
- System tray with recording status, quick actions, and red recording dot indicator
- Microphone selection and audio device management
- Target window picker for choosing where to inject text
- History panel with playback and transcript review
- Hotkey customization for all actions
- Launch at login option
