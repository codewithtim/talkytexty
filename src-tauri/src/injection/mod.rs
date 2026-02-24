pub mod clipboard;
pub mod keyboard;
pub mod windows;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetWindow {
    pub window_id: String,
    pub title: String,
    pub app_name: String,
    pub process_id: u32,
    pub icon: Option<String>,
}
