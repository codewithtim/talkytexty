use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const MAX_ENTRIES: usize = 5000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub created_at: String,
    pub text: String,
    pub model_id: String,
    pub recording_duration_ms: u64,
    pub transcription_duration_ms: u64,
    pub audio_device: Option<String>,
    #[serde(default)]
    pub audio_file_name: Option<String>,
}

pub fn get_history_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("history.json")
}

pub fn get_recordings_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("recordings")
}

pub fn save_audio_wav(
    app_data_dir: &Path,
    id: &str,
    samples: &[f32],
    sample_rate: u32,
) -> Result<String, String> {
    let dir = get_recordings_dir(app_data_dir);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create recordings directory: {}", e))?;

    let file_name = format!("{}.wav", id);
    let path = dir.join(&file_name);

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(&path, spec)
        .map_err(|e| format!("Failed to create WAV file: {}", e))?;

    for &sample in samples {
        let clamped = sample.clamp(-1.0, 1.0);
        let int_sample = (clamped * i16::MAX as f32) as i16;
        writer
            .write_sample(int_sample)
            .map_err(|e| format!("Failed to write WAV sample: {}", e))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize WAV file: {}", e))?;

    Ok(file_name)
}

pub fn load_audio_bytes(app_data_dir: &Path, file_name: &str) -> Result<Vec<u8>, String> {
    let path = get_recordings_dir(app_data_dir).join(file_name);
    fs::read(&path).map_err(|e| format!("Failed to read audio file: {}", e))
}

pub fn delete_audio_file(app_data_dir: &Path, file_name: &str) {
    let path = get_recordings_dir(app_data_dir).join(file_name);
    let _ = fs::remove_file(path);
}

pub fn load_history(app_data_dir: &Path) -> Result<Vec<HistoryEntry>, String> {
    let path = get_history_path(app_data_dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read history file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse history: {}", e))
}

pub fn save_history(app_data_dir: &Path, entries: &[HistoryEntry]) -> Result<(), String> {
    let path = get_history_path(app_data_dir);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create history directory: {}", e))?;
    }

    // Prune to max entries
    let to_save: &[HistoryEntry] = if entries.len() > MAX_ENTRIES {
        &entries[..MAX_ENTRIES]
    } else {
        entries
    };

    let contents = serde_json::to_string_pretty(to_save)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write history file: {}", e))
}

pub fn add_entry(app_data_dir: &Path, entry: &HistoryEntry) -> Result<(), String> {
    let mut entries = load_history(app_data_dir)?;
    entries.insert(0, entry.clone());
    save_history(app_data_dir, &entries)
}

pub fn delete_entry(app_data_dir: &Path, id: &str) -> Result<(), String> {
    let entries = load_history(app_data_dir)?;
    // Delete audio file if present
    if let Some(entry) = entries.iter().find(|e| e.id == id) {
        if let Some(ref file_name) = entry.audio_file_name {
            delete_audio_file(app_data_dir, file_name);
        }
    }
    let entries: Vec<_> = entries.into_iter().filter(|e| e.id != id).collect();
    save_history(app_data_dir, &entries)
}

pub fn clear_history(app_data_dir: &Path) -> Result<(), String> {
    // Delete the entire recordings directory
    let recordings_dir = get_recordings_dir(app_data_dir);
    if recordings_dir.exists() {
        let _ = fs::remove_dir_all(&recordings_dir);
    }
    save_history(app_data_dir, &[])
}
