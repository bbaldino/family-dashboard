use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GoogleToken {
    pub id: i64,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarListEntry {
    pub id: String,
    pub summary: String,
    pub primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarListResponse {
    pub items: Vec<CalendarListEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: Option<String>,
    pub start: EventDateTime,
    pub end: EventDateTime,
    pub description: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventDateTime {
    #[serde(rename = "dateTime")]
    pub date_time: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventsListResponse {
    pub items: Option<Vec<CalendarEvent>>,
}
