use base64::Engine;
use serde::{Deserialize, Serialize};

// ── Helpers ──────────────────────────────────────────────────────────

fn base64_encode(data: &[u8]) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(data);
    format!("data:image/png;base64,{encoded}")
}

// ── People ───────────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
pub struct PersonRow {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub avatar: Option<Vec<u8>>,
}

#[derive(Debug, Serialize)]
pub struct Person {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub avatar: Option<String>,
}

impl From<PersonRow> for Person {
    fn from(row: PersonRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            color: row.color,
            avatar: row.avatar.as_deref().map(base64_encode),
        }
    }
}

// ── Chores ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Chore {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub chore_type: String,
    /// JSON-encoded array of tag strings
    pub tags: String,
    /// JSON-encoded array of tag strings (for meta chores)
    pub pick_from_tags: String,
}

#[derive(Debug, Serialize)]
pub struct ChoreResponse {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub chore_type: String,
    pub tags: Vec<String>,
    pub pick_from_tags: Vec<String>,
}

impl From<Chore> for ChoreResponse {
    fn from(c: Chore) -> Self {
        Self {
            id: c.id,
            name: c.name,
            description: c.description,
            chore_type: c.chore_type,
            tags: serde_json::from_str(&c.tags).unwrap_or_default(),
            pick_from_tags: serde_json::from_str(&c.pick_from_tags).unwrap_or_default(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateChore {
    pub name: String,
    pub description: Option<String>,
    pub chore_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub pick_from_tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChore {
    pub name: Option<String>,
    pub description: Option<String>,
    pub chore_type: Option<String>,
    pub tags: Option<Vec<String>>,
    pub pick_from_tags: Option<Vec<String>>,
}

// ── Assignments ──────────────────────────────────────────────────────

/// Raw row returned from a JOIN query across assignments, chores, and people.
#[derive(Debug, sqlx::FromRow)]
pub struct AssignmentRow {
    pub id: i64,
    pub chore_id: i64,
    pub person_id: i64,
    pub week_of: String,
    pub day_of_week: i32,
    pub picked_chore_id: Option<i64>,
    pub completed: i32,
    // Denormalized from JOIN
    pub chore_name: String,
    pub chore_type: String,
    pub chore_tags: String,
    pub person_name: String,
    pub person_color: String,
    pub picked_chore_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChoreRef {
    pub id: i64,
    pub name: String,
    pub chore_type: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PersonRef {
    pub id: i64,
    pub name: String,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssignmentResponse {
    pub id: i64,
    pub week_of: String,
    pub day_of_week: i32,
    pub completed: bool,
    pub chore: ChoreRef,
    pub person: PersonRef,
    pub picked_chore: Option<ChoreRef>,
}

impl From<AssignmentRow> for AssignmentResponse {
    fn from(row: AssignmentRow) -> Self {
        let tags: Vec<String> = serde_json::from_str(&row.chore_tags).unwrap_or_default();

        let picked_chore = match (row.picked_chore_id, row.picked_chore_name) {
            (Some(id), Some(name)) => Some(ChoreRef {
                id,
                name,
                chore_type: "regular".to_string(),
                tags: vec![],
            }),
            _ => None,
        };

        Self {
            id: row.id,
            week_of: row.week_of,
            day_of_week: row.day_of_week,
            completed: row.completed != 0,
            chore: ChoreRef {
                id: row.chore_id,
                name: row.chore_name,
                chore_type: row.chore_type,
                tags,
            },
            person: PersonRef {
                id: row.person_id,
                name: row.person_name,
                color: row.person_color,
                avatar: None,
            },
            picked_chore,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateAssignment {
    pub chore_id: i64,
    pub person_id: i64,
    pub week_of: String,
    pub day_of_week: i32,
}

#[derive(Debug, Deserialize)]
pub struct PickChore {
    pub chore_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct CopyWeek {
    pub from_week: String,
    pub to_week: String,
}

#[derive(Debug, Deserialize)]
pub struct RotateWeek {
    pub week: String,
}

// ── Today response ───────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TodayResponse {
    pub persons: Vec<PersonAssignments>,
    pub completed_count: i64,
    pub total_count: i64,
}

#[derive(Debug, Serialize)]
pub struct PersonAssignments {
    pub person: PersonRef,
    pub assignments: Vec<TodayAssignment>,
}

#[derive(Debug, Serialize)]
pub struct TodayAssignment {
    pub id: i64,
    pub chore: ChoreRef,
    pub picked_chore: Option<ChoreRef>,
    pub completed: bool,
}
