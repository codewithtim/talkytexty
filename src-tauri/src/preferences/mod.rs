pub mod storage;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub active_model_id: Option<String>,
    pub recording_mode: RecordingMode,
    pub hotkeys: Vec<HotkeyBinding>,
    pub target_mode: TargetMode,
    pub text_injection_method: TextInjectionMethod,
    pub overlay_position: OverlayPosition,
    pub overlay_opacity: f32,
    pub overlay_visualization: VisualizationStyle,
    #[serde(default)]
    pub overlay_processing_animation: ProcessingAnimation,
    #[serde(default)]
    pub overlay_mode: OverlayMode,
    #[serde(default)]
    pub overlay_custom_position: Option<OverlayCustomPosition>,
    #[serde(default)]
    pub selected_audio_device: Option<String>,
    #[serde(default = "default_input_gain")]
    pub input_gain: f32,  // Microphone sensitivity multiplier (0.5-2.0, default 1.0)
    #[serde(default)]
    pub enable_noise_suppression: bool,
    #[serde(default)]
    pub enable_streaming_transcription: bool,  // Show partial results while recording
    #[serde(default)]
    pub voice_macros: Vec<VoiceMacro>,
    #[serde(default)]
    pub enable_vad: bool,
    #[serde(default = "default_vad_silence")]
    pub vad_silence_duration_ms: u32,
    #[serde(default)]
    pub enable_sounds: bool,
    #[serde(default)]
    pub enable_translation: bool,
    pub target_language: Option<String>,
    #[serde(default)]
    pub enable_app_specific_formatting: bool,
    #[serde(default = "default_true")]
    pub enable_history: bool,
    #[serde(default = "default_true")]
    pub enable_correction_hud: bool,
    #[serde(default)]
    pub enable_review_step: bool,
    #[serde(default)]
    pub formatting_options: FormattingOptions,
    #[serde(default)]
    pub clipboard_fallback: bool,
    #[serde(default)]
    pub close_behavior: CloseBehavior,
    #[serde(default)]
    pub show_tray_tooltip: bool,
    #[serde(default)]
    pub offline_only_mode: bool,
    #[serde(default)]
    pub enable_telemetry: bool,
    #[serde(default)]
    pub auto_cleanup_models: AutoCleanupSettings,
    #[serde(default)]
    pub macro_preview_test_text: String,
    pub launch_at_login: bool,
}

fn default_vad_silence() -> u32 {
    1500
}
fn default_input_gain() -> f32 {
    1.0  // No gain adjustment by default
}
fn default_true() -> bool {
    true
}
fn default_capitalize() -> bool {
    true
}
fn default_join_mode() -> JoinMode {
    JoinMode::Space
}
fn default_keep_count() -> u32 {
    2
}
fn default_days_unused() -> u32 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingMode {
    PushToTalk,
    Toggle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TargetMode {
    ActiveWindow,
    WindowPicker,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VisualizationStyle {
    Bars,
    Sine,
    Rainbow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessingAnimation {
    Pulse,
    FrozenFrame,
    TypingParrot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceMacro {
    pub name: String,
    pub trigger: String,
    pub action: MacroAction,
    pub enabled: bool,
    #[serde(default)]
    pub target_apps: Vec<String>, // Empty = global macro
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum MacroAction {
    TypeText(String),
    PressKey(String),
    DeleteBack,
    InsertTemplate { template: String, description: String },
    RunSequence(Vec<MacroSequenceStep>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MacroSequenceStep {
    TypeText(String),
    PressKey(String),
    WaitMs(u64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormattingOptions {
    #[serde(default)]
    pub auto_punctuation: bool,
    #[serde(default = "default_capitalize")]
    pub capitalize_first_letter: bool,
    #[serde(default = "default_join_mode")]
    pub join_mode: JoinMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JoinMode {
    Space,
    Newline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CloseBehavior {
    HideToTray,
    Quit,
}

impl Default for CloseBehavior {
    fn default() -> Self {
        CloseBehavior::HideToTray
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoCleanupSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_keep_count")]
    pub keep_count: u32,
    #[serde(default = "default_days_unused")]
    pub delete_after_days_unused: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OverlayMode {
    None,
    Full,
    Mini,
}

impl Default for OverlayMode {
    fn default() -> Self {
        OverlayMode::Full
    }
}

impl Default for ProcessingAnimation {
    fn default() -> Self {
        ProcessingAnimation::Pulse
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayCustomPosition {
    pub x: f64,
    pub y: f64,
}

/// Known modifier keys in Tauri shortcut format.
const MODIFIERS: &[&str] = &[
    "CommandOrControl",
    "Command",
    "Control",
    "Ctrl",
    "Shift",
    "Alt",
    "Option",
    "Super",
];

/// Validate that a hotkey string is a valid Tauri shortcut format.
/// Requires at least one modifier + one non-modifier key.
pub fn validate_hotkey_format(combo: &str) -> Result<(), String> {
    if combo.is_empty() {
        return Err("Hotkey combination cannot be empty.".to_string());
    }

    let parts: Vec<&str> = combo.split('+').collect();
    let mut has_modifier = false;
    let mut has_key = false;

    for part in &parts {
        if MODIFIERS.iter().any(|m| m.eq_ignore_ascii_case(part)) {
            has_modifier = true;
        } else {
            has_key = true;
        }
    }

    if !has_modifier {
        return Err(format!(
            "Hotkey '{}' must include at least one modifier (CommandOrControl, Shift, Alt).",
            combo
        ));
    }
    if !has_key {
        return Err(format!(
            "Hotkey '{}' must include a non-modifier key.",
            combo
        ));
    }

    Ok(())
}

/// Detect conflicting hotkey bindings (same key combination on multiple enabled actions).
/// Returns a list of conflicting key combinations.
pub fn detect_hotkey_conflicts(bindings: &[HotkeyBinding]) -> Vec<String> {
    let mut seen = std::collections::HashMap::new();
    let mut conflicts = Vec::new();

    for binding in bindings {
        if !binding.enabled {
            continue;
        }
        let key = binding.key_combination.to_lowercase();
        let count = seen.entry(key.clone()).or_insert(0u32);
        *count += 1;
        if *count == 2 {
            conflicts.push(binding.key_combination.clone());
        }
    }

    conflicts
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            active_model_id: None,
            recording_mode: RecordingMode::Toggle,
            hotkeys: vec![
                HotkeyBinding {
                    action: HotkeyAction::ToggleRecording,
                    key_combination: "CommandOrControl+Shift+Space".to_string(),
                    enabled: true,
                },
                HotkeyBinding {
                    action: HotkeyAction::PushToTalk,
                    key_combination: "CommandOrControl+Shift+V".to_string(),
                    enabled: false,
                },
                HotkeyBinding {
                    action: HotkeyAction::OpenTargetSelector,
                    key_combination: "CommandOrControl+Shift+T".to_string(),
                    enabled: true,
                },
                HotkeyBinding {
                    action: HotkeyAction::OpenSettings,
                    key_combination: "CommandOrControl+Shift+,".to_string(),
                    enabled: true,
                },
            ],
            target_mode: TargetMode::ActiveWindow,
            text_injection_method: TextInjectionMethod::SimulatedKeystrokes,
            overlay_position: OverlayPosition::TopCenter,
            overlay_opacity: 0.9,
            overlay_visualization: VisualizationStyle::Bars,
            overlay_processing_animation: ProcessingAnimation::Pulse,
            overlay_mode: OverlayMode::Full,
            overlay_custom_position: None,
            selected_audio_device: None,
            input_gain: 1.0,
            enable_noise_suppression: false,
            enable_streaming_transcription: true,  // Enable by default for better UX
            voice_macros: vec![
                VoiceMacro {
                    name: "New Line".to_string(),
                    trigger: "newline".to_string(),
                    action: MacroAction::PressKey("Enter".to_string()),
                    enabled: true,
                    target_apps: vec![],
                },
                VoiceMacro {
                    name: "Indent".to_string(),
                    trigger: "indent".to_string(),
                    action: MacroAction::PressKey("Tab".to_string()),
                    enabled: true,
                    target_apps: vec![],
                },
                VoiceMacro {
                    name: "Scratch That".to_string(),
                    trigger: "scratch that".to_string(),
                    action: MacroAction::DeleteBack,
                    enabled: true,
                    target_apps: vec![],
                },
            ],
            enable_vad: false,
            vad_silence_duration_ms: 1500,
            enable_sounds: true,
            enable_translation: false,
            target_language: Some("English".to_string()),
            enable_app_specific_formatting: true,
            enable_history: true,
            enable_correction_hud: true,
            enable_review_step: false,
            formatting_options: FormattingOptions::default(),
            clipboard_fallback: true,
            close_behavior: CloseBehavior::HideToTray,
            show_tray_tooltip: true,
            offline_only_mode: false,
            enable_telemetry: false,
            auto_cleanup_models: AutoCleanupSettings::default(),
            macro_preview_test_text: "Hello world this is a test".to_string(),
            launch_at_login: false,
        }
    }
}

impl Default for FormattingOptions {
    fn default() -> Self {
        Self {
            auto_punctuation: false,
            capitalize_first_letter: true,
            join_mode: JoinMode::Space,
        }
    }
}

impl Default for AutoCleanupSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            keep_count: 2,
            delete_after_days_unused: 30,
        }
    }
}
