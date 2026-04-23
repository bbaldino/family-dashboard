use serde::{Deserialize, Serialize};

// Wikipedia API response types
#[derive(Debug, Deserialize)]
pub struct WikiThumbnail {
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WikiEventPage {
    pub thumbnail: Option<WikiThumbnail>,
}

#[derive(Debug, Deserialize)]
pub struct WikiEvent {
    pub text: String,
    pub year: Option<i32>,
    pub pages: Option<Vec<WikiEventPage>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirthPage {
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirth {
    pub text: String,
    pub year: Option<i32>,
    pub pages: Option<Vec<WikiBirthPage>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiHoliday {
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct WikiSelectedResponse {
    pub selected: Option<Vec<WikiEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirthsResponse {
    pub births: Option<Vec<WikiBirth>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiEventsResponse {
    pub events: Option<Vec<WikiEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiHolidaysResponse {
    pub holidays: Option<Vec<WikiHoliday>>,
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
#[serde(rename_all = "camelCase")]
pub struct OnThisDayBirth {
    pub year: i32,
    pub name: String,
    pub role: String,
    pub known_for: Vec<String>,
    pub photo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OnThisDayResponse {
    pub events: Vec<OnThisDayEvent>,
    pub births: Vec<OnThisDayBirth>,
}
