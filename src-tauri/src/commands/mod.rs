pub mod audio_commands;
pub mod history_commands;
pub mod injection_commands;
pub mod model_commands;
pub mod preferences_commands;
pub mod system_commands;
pub mod window_commands;

use serde::Serialize;

#[derive(Debug, Serialize, PartialEq)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}
