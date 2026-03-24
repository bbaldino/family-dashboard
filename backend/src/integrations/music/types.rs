use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct MaCommand {
    pub message_id: String,
    pub command: String,
    pub args: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct PlayRequest {
    pub uri: String,
    pub queue_id: Option<String>,
    pub radio: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct QueueCommand {
    pub queue_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VolumeRequest {
    pub player_id: String,
    pub level: i32,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Deserialize)]
pub struct ImageProxyQuery {
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueState {
    pub queue_id: String,
    pub display_name: String,
    pub state: String, // "playing", "paused", "idle"
    pub current_item: Option<TrackInfo>,
    pub volume_level: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub name: String,
    pub artist: String,
    pub album: Option<String>,
    pub image_url: Option<String>,
    pub duration: Option<i64>,
    pub elapsed: Option<i64>,
    pub uri: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SseEvent {
    State { queues: Vec<QueueState> },
    QueueUpdated { queue: QueueState },
}
