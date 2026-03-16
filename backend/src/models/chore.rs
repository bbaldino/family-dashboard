use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Chore {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateChore {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChore {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChoreAssignment {
    pub id: i64,
    pub chore_id: i64,
    pub child_name: String,
    pub day_of_week: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssignmentWithStatus {
    pub id: i64,
    pub chore_id: i64,
    pub chore_name: String,
    pub child_name: String,
    pub day_of_week: i32,
    pub completed: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetAssignments {
    pub assignments: Vec<AssignmentEntry>,
}

#[derive(Debug, Deserialize)]
pub struct AssignmentEntry {
    pub child_name: String,
    pub day_of_week: i32,
}

#[derive(Debug, Deserialize)]
pub struct CompleteRequest {
    pub date: String,
}
