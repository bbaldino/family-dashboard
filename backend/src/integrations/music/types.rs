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
    /// MA queue enqueue option:
    ///   - `"play"` (default) — replace the queue and start immediately.
    ///   - `"next"` — keep the queue, insert this as the next track.
    ///   - `"add"` — append to the end of the queue.
    #[serde(default)]
    pub enqueue_mode: Option<String>,
    /// Optional display metadata so the explicit-play log can render in
    /// Recently Played without re-querying MA for the URI's details.
    #[serde(default)]
    pub media_type: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub album: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
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
pub struct GroupRequest {
    /// Player being grouped into the leader.
    pub player_id: String,
    /// The leader / target player (whoever is already playing or designated).
    pub target_player: String,
}

#[derive(Debug, Deserialize)]
pub struct UngroupRequest {
    pub player_id: String,
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
