use serde::{Deserialize, Serialize};

// Wikipedia API response types
#[derive(Debug, Clone, Deserialize)]
pub struct WikiThumbnail {
    pub source: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WikiEventPage {
    pub thumbnail: Option<WikiThumbnail>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WikiEvent {
    pub text: String,
    pub year: Option<i32>,
    pub pages: Option<Vec<WikiEventPage>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiSelectedResponse {
    pub selected: Option<Vec<WikiEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiEventsResponse {
    pub events: Option<Vec<WikiEvent>>,
}

// API response types
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnThisDayEvent {
    pub year: Option<i32>,
    pub text: String,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OnThisDayResponse {
    pub events: Vec<OnThisDayEvent>,
}
