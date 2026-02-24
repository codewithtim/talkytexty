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
    pub overlay_custom_position: Option<OverlayCustomPosition>,
    #[serde(default)]
    pub selected_audio_device: Option<String>,
    pub launch_at_login: bool,
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
            overlay_custom_position: None,
            selected_audio_device: None,
            launch_at_login: false,
        }
    }
}
