// T033b: Unit tests for push-to-talk recording mode
//
// Tests the hotkey event routing logic for push-to-talk:
// - Press PushToTalk hotkey → start recording
// - Release PushToTalk hotkey → stop recording and transcribe
// - Behavior gated on RecordingMode preference

use text_to_code_lib::hotkeys::{resolve_hotkey_event, HotkeyEvent, HotkeyResponse};
use text_to_code_lib::preferences::{HotkeyAction, RecordingMode};

// --- Push-to-talk press: should start recording ---

#[test]
fn test_push_to_talk_press_starts_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::PushToTalk),
        &RecordingMode::PushToTalk,
        false, // not currently recording
    );
    assert_eq!(
        response,
        HotkeyResponse::StartRecording,
        "Pressing PushToTalk hotkey should start recording when not recording"
    );
}

#[test]
fn test_push_to_talk_press_noop_when_already_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::PushToTalk),
        &RecordingMode::PushToTalk,
        true, // already recording
    );
    assert_eq!(
        response,
        HotkeyResponse::NoOp,
        "Pressing PushToTalk when already recording should be NoOp"
    );
}

// --- Push-to-talk release: should stop recording and transcribe ---

#[test]
fn test_push_to_talk_release_stops_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Released(HotkeyAction::PushToTalk),
        &RecordingMode::PushToTalk,
        true, // currently recording
    );
    assert_eq!(
        response,
        HotkeyResponse::StopRecordingAndTranscribe,
        "Releasing PushToTalk hotkey should stop recording and transcribe"
    );
}

#[test]
fn test_push_to_talk_release_noop_when_not_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Released(HotkeyAction::PushToTalk),
        &RecordingMode::PushToTalk,
        false, // not recording
    );
    assert_eq!(
        response,
        HotkeyResponse::NoOp,
        "Releasing PushToTalk when not recording should be NoOp"
    );
}

// --- Push-to-talk ignored when recording mode is Toggle ---

#[test]
fn test_push_to_talk_press_noop_in_toggle_mode() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::PushToTalk),
        &RecordingMode::Toggle,
        false,
    );
    assert_eq!(
        response,
        HotkeyResponse::NoOp,
        "PushToTalk press should be NoOp when recording mode is Toggle"
    );
}

#[test]
fn test_push_to_talk_release_noop_in_toggle_mode() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Released(HotkeyAction::PushToTalk),
        &RecordingMode::Toggle,
        true,
    );
    assert_eq!(
        response,
        HotkeyResponse::NoOp,
        "PushToTalk release should be NoOp when recording mode is Toggle"
    );
}

// --- Toggle recording (non push-to-talk) still works ---

#[test]
fn test_toggle_recording_starts_when_not_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::ToggleRecording),
        &RecordingMode::Toggle,
        false,
    );
    assert_eq!(response, HotkeyResponse::StartRecording);
}

#[test]
fn test_toggle_recording_stops_when_recording() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::ToggleRecording),
        &RecordingMode::Toggle,
        true,
    );
    assert_eq!(response, HotkeyResponse::StopRecordingAndTranscribe);
}

// --- Other hotkey actions ---

#[test]
fn test_open_settings_returns_show_settings() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::OpenSettings),
        &RecordingMode::Toggle,
        false,
    );
    assert_eq!(response, HotkeyResponse::ShowSettings);
}

#[test]
fn test_open_target_selector_returns_show_target_selector() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Pressed(HotkeyAction::OpenTargetSelector),
        &RecordingMode::Toggle,
        false,
    );
    assert_eq!(response, HotkeyResponse::ShowTargetSelector);
}

#[test]
fn test_released_toggle_recording_is_noop() {
    let response = resolve_hotkey_event(
        HotkeyEvent::Released(HotkeyAction::ToggleRecording),
        &RecordingMode::Toggle,
        true,
    );
    assert_eq!(
        response,
        HotkeyResponse::NoOp,
        "Releasing ToggleRecording key should always be NoOp"
    );
}
