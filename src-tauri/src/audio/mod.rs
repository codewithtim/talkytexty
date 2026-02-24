pub mod capture;
pub mod resample;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSession {
    pub id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_ms: Option<u64>,
    pub status: RecordingStatus,
    pub model_id: String,
    pub transcription: Option<String>,
    pub target_window: TargetWindowRef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum RecordingStatus {
    Recording,
    Transcribing,
    Completed,
    Failed { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TargetWindowRef {
    ActiveWindow,
    WindowPicker,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum AudioEvent {
    RecordingStarted,
    RecordingStopped,
    AmplitudeUpdate { amplitudes: Vec<f32>, rms: f32 },
    TranscriptionStarted,
    TranscriptionCompleted { text: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub session_id: String,
    pub text: String,
    pub duration_ms: u64,
}
