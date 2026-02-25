# Changelog

All notable changes to TalkyTexty are documented here.

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
- Custom parrot pixel art icon

### Fixed

- Alt+Space hotkey registration on macOS (non-breaking space handling)
- Settings dropdowns hidden behind menu items (overflow clipping)
