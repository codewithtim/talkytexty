use crate::preferences::{HotkeyAction, RecordingMode};

/// Represents a hotkey event with its press/release state.
#[derive(Debug, Clone, PartialEq)]
pub enum HotkeyEvent {
    Pressed(HotkeyAction),
    Released(HotkeyAction),
}

/// The action the application should take in response to a hotkey event.
#[derive(Debug, Clone, PartialEq)]
pub enum HotkeyResponse {
    StartRecording,
    StopRecordingAndTranscribe,
    CancelRecording,
    ShowSettings,
    ShowTargetSelector,
    NoOp,
}

/// Resolve a hotkey event into an application response.
///
/// This pure function encapsulates the hotkey routing logic,
/// making it testable without the Tauri runtime.
pub fn resolve_hotkey_event(
    event: HotkeyEvent,
    recording_mode: &RecordingMode,
    is_recording: bool,
) -> HotkeyResponse {
    match event {
        HotkeyEvent::Pressed(HotkeyAction::ToggleRecording) => {
            if is_recording {
                HotkeyResponse::StopRecordingAndTranscribe
            } else {
                HotkeyResponse::StartRecording
            }
        }
        HotkeyEvent::Pressed(HotkeyAction::OpenSettings) => HotkeyResponse::ShowSettings,
        HotkeyEvent::Pressed(HotkeyAction::OpenTargetSelector) => {
            HotkeyResponse::ShowTargetSelector
        }
        HotkeyEvent::Pressed(HotkeyAction::PushToTalk) => {
            if matches!(recording_mode, RecordingMode::PushToTalk) && !is_recording {
                HotkeyResponse::StartRecording
            } else {
                HotkeyResponse::NoOp
            }
        }
        HotkeyEvent::Released(HotkeyAction::PushToTalk) => {
            if matches!(recording_mode, RecordingMode::PushToTalk) && is_recording {
                HotkeyResponse::StopRecordingAndTranscribe
            } else {
                HotkeyResponse::NoOp
            }
        }
        // All other Released events are no-ops
        HotkeyEvent::Released(_) => HotkeyResponse::NoOp,
    }
}
