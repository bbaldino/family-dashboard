use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LunchMenu {
    pub id: i64,
    pub week_of: String,
    pub menu_data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchMenuResponse {
    pub week_of: String,
    pub days: Vec<LunchDay>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchDay {
    pub day: String,
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertLunchMenu {
    pub days: Vec<LunchDay>,
}
