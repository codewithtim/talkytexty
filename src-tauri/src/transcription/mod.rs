pub mod engine;
pub mod models;

use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionModel {
    pub id: String,
    pub name: String,
    pub model_family: String,
    pub variant: ModelVariant,
    pub size_bytes: u64,
    pub languages: Vec<String>,
    pub quantization: Option<Quantization>,
    pub download_status: DownloadStatus,
    pub huggingface_repo: String,
    #[serde(deserialize_with = "deserialize_filenames", alias = "huggingfaceFilename")]
    pub huggingface_filenames: Vec<String>,
}

/// Custom deserializer that accepts both a single string and an array of strings.
/// This provides backward compatibility with existing registry.json files that
/// use the old `huggingfaceFilename` (single string) field.
fn deserialize_filenames<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OneOrMany {
        One(String),
        Many(Vec<String>),
    }

    match OneOrMany::deserialize(deserializer)? {
        OneOrMany::One(s) => Ok(vec![s]),
        OneOrMany::Many(v) => Ok(v),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelVariant {
    Tiny,
    Base,
    Small,
    Medium,
    LargeV2,
    LargeV3,
    LargeV3Turbo,
    ParakeetCTC,
    ParakeetTDT,
    ParakeetEOU,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Quantization {
    Q4_0,
    Q4_1,
    Q5_0,
    Q5_1,
    Q8_0,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum DownloadStatus {
    NotDownloaded,
    Downloading {
        #[serde(rename = "progressPercent")]
        progress_percent: f32,
    },
    Downloaded {
        #[serde(rename = "localPath")]
        local_path: String,
    },
    Error { message: String },
}
