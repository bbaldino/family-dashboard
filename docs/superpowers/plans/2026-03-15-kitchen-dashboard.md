# Kitchen Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a kitchen dashboard SPA with Rust backend, deploying to a wall-mounted Android tablet running Fully Kiosk Browser.

**Architecture:** React SPA served by an Axum/Rust backend. The backend provides REST APIs for custom data (chores, lunch menus) and proxies Google Calendar OAuth. The frontend uses HAKit for HA integration (opt-in per widget), direct WebRTC for camera feeds, and the Dashboard API for everything else. Admin routes live in the same SPA under `/admin`.

**Tech Stack:** React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui, Rust + Axum + SQLite (sqlx), HAKit, React Router

**Spec:** `docs/superpowers/specs/2026-03-15-kitchen-dashboard-design.md`

---

## File Structure

### Backend (`backend/`)

```
backend/
  Cargo.toml
  src/
    main.rs                    -- Axum server setup, router, static file serving
    db.rs                      -- SQLite pool setup, migrations
    error.rs                   -- AppError type, IntoResponse impl
    routes/
      mod.rs                   -- router assembly
      chores.rs                -- chore CRUD + assignment endpoints
      lunch_menu.rs            -- lunch menu get/upsert endpoints
      google_auth.rs           -- OAuth initiate + callback
      google_calendar.rs       -- calendar list + events proxy
    models/
      mod.rs
      chore.rs                 -- Chore, ChoreAssignment structs
      lunch_menu.rs            -- LunchMenu, LunchDay structs
      google.rs                -- OAuthToken, CalendarEvent structs
  migrations/
    001_initial.sql            -- chores, chore_assignments, lunch_menus, google_tokens tables
  tests/
    api/
      mod.rs
      chores_test.rs
      lunch_menu_test.rs
      google_calendar_test.rs
    helpers.rs                 -- test app setup, test database
```

### Frontend (`frontend/`)

```
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx                   -- React entry point
    App.tsx                    -- Router setup
    app/
      AppShell.tsx             -- tab bar + Outlet
      routes.tsx               -- route definitions
    boards/
      HomeBoard.tsx            -- main dashboard layout
      MediaBoard.tsx           -- placeholder
      CamerasBoard.tsx         -- placeholder
    widgets/
      clock/
        ClockWidget.tsx
        index.ts
      weather/
        WeatherWidget.tsx
        WeatherDetail.tsx
        index.ts
      calendar/
        CalendarWidget.tsx
        CalendarDetail.tsx
        useGoogleCalendar.ts
        index.ts
      chores/
        ChoresWidget.tsx
        ChoresDetail.tsx
        useChores.ts
        index.ts
      lunch-menu/
        LunchMenuWidget.tsx
        useLunchMenu.ts
        index.ts
      doorbell/
        DoorbellWidget.tsx
        useWebRtcStream.ts
        index.ts
    hooks/
      useHaEntity.ts
      useHaService.ts
      usePolling.ts
    ui/
      WidgetCard.tsx
      BottomSheet.tsx
      TabBar.tsx
      Button.tsx
      LoadingSpinner.tsx
      ErrorDisplay.tsx
    lib/
      dashboard-api.ts         -- typed fetch wrapper for backend API
      ha-client.ts             -- HAKit setup
    admin/
      AdminLayout.tsx
      ChoreAdmin.tsx
      LunchMenuAdmin.tsx
    theme/
      variables.css            -- CSS custom properties
```

---

## Chunk 1: Backend Scaffolding & Chore API

### Task 1: Initialize Rust project

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/src/db.rs`
- Create: `backend/src/error.rs`

- [ ] **Step 1: Create Cargo project**

```bash
cd /home/bbaldino/work/dashboard
cargo init backend
cd backend
cargo add axum --features json
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add sqlx --features runtime-tokio,sqlite
cargo add tower-http --features fs,cors
cargo add tracing
cargo add tracing-subscriber
cargo add thiserror
```

- [ ] **Step 2: Write main.rs with basic Axum server**

```rust
// backend/src/main.rs
mod db;
mod error;
mod routes;
mod models;

use std::net::SocketAddr;
use axum::Router;
use tower_http::services::ServeDir;
use tracing_subscriber;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let pool = db::init_pool().await;

    let api_routes = routes::router(pool.clone());

    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("static"));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [ ] **Step 3: Write db.rs with SQLite pool and migrations**

```rust
// backend/src/db.rs
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

pub async fn init_pool() -> SqlitePool {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:dashboard.db?mode=rwc".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}
```

- [ ] **Step 4: Write error.rs with AppError type**

```rust
// backend/src/error.rs
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

- [ ] **Step 5: Create placeholder route module**

```rust
// backend/src/routes/mod.rs
pub mod chores;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
}
```

```rust
// backend/src/routes/chores.rs
use axum::Router;
use sqlx::SqlitePool;

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
}
```

```rust
// backend/src/models/mod.rs
pub mod chore;
```

```rust
// backend/src/models/chore.rs
```

- [ ] **Step 6: Create migrations directory with initial schema**

```sql
-- backend/migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chore_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
    child_name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    UNIQUE(chore_id, child_name, day_of_week)
);

CREATE TABLE IF NOT EXISTS chore_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES chore_assignments(id) ON DELETE CASCADE,
    completed_date TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(assignment_id, completed_date)
);

CREATE TABLE IF NOT EXISTS lunch_menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_of TEXT NOT NULL UNIQUE,
    menu_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
```

- [ ] **Step 7: Verify it compiles and starts**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo build
```
Expected: builds successfully (server won't run without creating the empty routes, but compilation should pass)

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Rust backend with Axum, SQLite, and initial schema"
```

---

### Task 2: Set up backend test infrastructure

**Files:**
- Create: `backend/tests/helpers.rs`
- Create: `backend/tests/api/mod.rs`

- [ ] **Step 1: Write test helper to create a test app with in-memory SQLite**

```rust
// backend/tests/helpers.rs
use axum::Router;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use dashboard_backend::models::google::GoogleOAuthConfig;

pub async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to create test database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

pub async fn test_app() -> (Router, SqlitePool) {
    let pool = test_pool().await;
    let google_config = GoogleOAuthConfig {
        client_id: String::new(),
        client_secret: String::new(),
        redirect_uri: String::new(),
    };
    let app = dashboard_backend::routes::router(pool.clone(), google_config);
    (app, pool)
}
```

Note: This requires making the `routes` module public in `main.rs`. Add `pub` to the module declarations:

```rust
// In backend/src/main.rs, change:
pub mod db;
pub mod error;
pub mod routes;
pub mod models;
```

Also add a `lib.rs` so tests can import from the crate:

```rust
// backend/src/lib.rs
pub mod db;
pub mod error;
pub mod models;
pub mod routes;
```

Update `main.rs` to use the lib:

```rust
// backend/src/main.rs
use dashboard_backend::{db, routes};
// ... rest of main unchanged
```

- [ ] **Step 2: Create api test module**

```rust
// backend/tests/api/mod.rs
pub mod chores_test;
```

```rust
// backend/tests/api/chores_test.rs
// Tests will be added in Task 3
```

- [ ] **Step 3: Verify tests compile**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo test
```
Expected: 0 tests run, no compilation errors

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: add backend test infrastructure with in-memory SQLite"
```

---

### Task 3: Chore CRUD API

**Files:**
- Create: `backend/src/models/chore.rs`
- Create: `backend/src/routes/chores.rs`
- Modify: `backend/tests/api/chores_test.rs`

- [ ] **Step 1: Write chore model**

```rust
// backend/src/models/chore.rs
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
```

- [ ] **Step 2: Write test for creating a chore**

```rust
// backend/tests/api/chores_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "../helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_create_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/chores")
        .json(&json!({
            "name": "Take out trash",
            "description": "Both bins"
        }))
        .await;

    response.assert_status(StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["name"], "Take out trash");
    assert_eq!(body["description"], "Both bins");
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_list_chores() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Create two chores
    server.post("/chores").json(&json!({"name": "Chore A"})).await;
    server.post("/chores").json(&json!({"name": "Chore B"})).await;

    let response = server.get("/chores").await;
    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 2);
}

#[tokio::test]
async fn test_update_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let create_resp = server.post("/chores").json(&json!({"name": "Old name"})).await;
    let id = create_resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    let response = server
        .put(&format!("/chores/{}", id))
        .json(&json!({"name": "New name"}))
        .await;

    response.assert_status_ok();
    assert_eq!(response.json::<serde_json::Value>()["name"], "New name");
}

#[tokio::test]
async fn test_delete_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let create_resp = server.post("/chores").json(&json!({"name": "To delete"})).await;
    let id = create_resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    let response = server.delete(&format!("/chores/{}", id)).await;
    response.assert_status(StatusCode::NO_CONTENT);

    // Verify it's gone
    let list_resp = server.get("/chores").await;
    let body: Vec<serde_json::Value> = list_resp.json();
    assert_eq!(body.len(), 0);
}
```

Note: Add `axum-test` as a dev dependency:
```bash
cargo add axum-test --dev
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cargo test
```
Expected: compilation errors or test failures (routes not implemented yet)

- [ ] **Step 4: Implement chore CRUD routes**

```rust
// backend/src/routes/chores.rs
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, put, delete},
    Json, Router,
};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::models::chore::{Chore, CreateChore, UpdateChore};

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/chores", get(list_chores).post(create_chore))
        .route("/chores/{id}", put(update_chore).delete(delete_chore))
        .with_state(pool)
}

async fn list_chores(
    State(pool): State<SqlitePool>,
) -> Result<Json<Vec<Chore>>, AppError> {
    let chores = sqlx::query_as::<_, Chore>("SELECT * FROM chores ORDER BY name")
        .fetch_all(&pool)
        .await?;
    Ok(Json(chores))
}

async fn create_chore(
    State(pool): State<SqlitePool>,
    Json(input): Json<CreateChore>,
) -> Result<(StatusCode, Json<Chore>), AppError> {
    let chore = sqlx::query_as::<_, Chore>(
        "INSERT INTO chores (name, description) VALUES (?, ?) RETURNING *"
    )
        .bind(&input.name)
        .bind(&input.description)
        .fetch_one(&pool)
        .await?;
    Ok((StatusCode::CREATED, Json(chore)))
}

async fn update_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<UpdateChore>,
) -> Result<Json<Chore>, AppError> {
    // Verify exists
    let existing = sqlx::query_as::<_, Chore>("SELECT * FROM chores WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", id)))?;

    let name = input.name.unwrap_or(existing.name);
    // If description is Some(value), use it (even if empty string = clear).
    // If description is None, keep existing.
    let description = if input.description.is_some() {
        input.description
    } else {
        existing.description
    };

    let chore = sqlx::query_as::<_, Chore>(
        "UPDATE chores SET name = ?, description = ? WHERE id = ? RETURNING *"
    )
        .bind(&name)
        .bind(&description)
        .bind(id)
        .fetch_one(&pool)
        .await?;
    Ok(Json(chore))
}

async fn delete_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM chores WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Chore {} not found", id)));
    }
    Ok(StatusCode::NO_CONTENT)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cargo test
```
Expected: all 4 chore tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement chore CRUD API with tests"
```

---

### Task 4: Chore Assignments API

**Files:**
- Modify: `backend/src/models/chore.rs`
- Modify: `backend/src/routes/chores.rs`
- Modify: `backend/tests/api/chores_test.rs`

- [ ] **Step 1: Add assignment models**

Add to `backend/src/models/chore.rs`:

```rust
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
```

- [ ] **Step 2: Write assignment tests**

Add to `backend/tests/api/chores_test.rs`:

```rust
#[tokio::test]
async fn test_set_assignments() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Create a chore first
    let create_resp = server.post("/chores").json(&json!({"name": "Dishes"})).await;
    let chore_id = create_resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    // Set assignments
    let response = server
        .put(&format!("/chores/{}/assignments", chore_id))
        .json(&json!({
            "assignments": [
                {"child_name": "Alice", "day_of_week": 1},
                {"child_name": "Bob", "day_of_week": 2}
            ]
        }))
        .await;

    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 2);
}

#[tokio::test]
async fn test_get_assignments_for_date() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Create chore and assign
    let create_resp = server.post("/chores").json(&json!({"name": "Vacuum"})).await;
    let chore_id = create_resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    server
        .put(&format!("/chores/{}/assignments", chore_id))
        .json(&json!({
            "assignments": [{"child_name": "Alice", "day_of_week": 1}]
        }))
        .await;

    // Query for a Monday (day_of_week = 1)
    // 2026-03-16 is a Monday
    let response = server.get("/chores/assignments?date=2026-03-16").await;
    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["child_name"], "Alice");
    assert_eq!(body[0]["chore_name"], "Vacuum");
    assert_eq!(body[0]["completed"], false);
}

#[tokio::test]
async fn test_complete_assignment() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Create chore, assign, then complete
    let create_resp = server.post("/chores").json(&json!({"name": "Sweep"})).await;
    let chore_id = create_resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    server
        .put(&format!("/chores/{}/assignments", chore_id))
        .json(&json!({
            "assignments": [{"child_name": "Alice", "day_of_week": 1}]
        }))
        .await;

    // Get assignments to find the assignment ID
    let list_resp = server.get("/chores/assignments?date=2026-03-16").await;
    let assignments: Vec<serde_json::Value> = list_resp.json();
    let assignment_id = assignments[0]["id"].as_i64().unwrap();

    // Complete it
    let response = server
        .post(&format!("/chores/assignments/{}/complete", assignment_id))
        .json(&json!({"date": "2026-03-16"}))
        .await;
    response.assert_status_ok();

    // Verify it shows as completed
    let list_resp = server.get("/chores/assignments?date=2026-03-16").await;
    let assignments: Vec<serde_json::Value> = list_resp.json();
    assert_eq!(assignments[0]["completed"], true);
}
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cargo test
```
Expected: new tests fail (routes not implemented)

- [ ] **Step 4: Implement assignment routes**

Add to `backend/src/routes/chores.rs`:

```rust
use crate::models::chore::{AssignmentWithStatus, ChoreAssignment, SetAssignments};

// Add these routes to the router function:
// .route("/chores/{id}/assignments", put(set_assignments))
// .route("/chores/assignments", get(get_assignments))
// .route("/chores/assignments/{id}/complete", post(complete_assignment))

async fn set_assignments(
    State(pool): State<SqlitePool>,
    Path(chore_id): Path<i64>,
    Json(input): Json<SetAssignments>,
) -> Result<Json<Vec<ChoreAssignment>>, AppError> {
    // Verify chore exists
    sqlx::query("SELECT id FROM chores WHERE id = ?")
        .bind(chore_id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", chore_id)))?;

    // Replace all assignments for this chore
    sqlx::query("DELETE FROM chore_assignments WHERE chore_id = ?")
        .bind(chore_id)
        .execute(&pool)
        .await?;

    for entry in &input.assignments {
        sqlx::query(
            "INSERT INTO chore_assignments (chore_id, child_name, day_of_week) VALUES (?, ?, ?)"
        )
            .bind(chore_id)
            .bind(&entry.child_name)
            .bind(entry.day_of_week)
            .execute(&pool)
            .await?;
    }

    let assignments = sqlx::query_as::<_, ChoreAssignment>(
        "SELECT * FROM chore_assignments WHERE chore_id = ?"
    )
        .bind(chore_id)
        .fetch_all(&pool)
        .await?;

    Ok(Json(assignments))
}

async fn get_assignments(
    State(pool): State<SqlitePool>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<AssignmentWithStatus>>, AppError> {
    let date = params.get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required".to_string()))?;

    // Parse the date to get day of week (0 = Sunday, 6 = Saturday)
    let parsed_date = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid date format, use YYYY-MM-DD".to_string()))?;
    let day_of_week = parsed_date.format("%w").to_string().parse::<i32>().unwrap();

    let assignments = sqlx::query_as::<_, AssignmentWithStatus>(
        r#"
        SELECT
            ca.id,
            ca.chore_id,
            c.name as chore_name,
            ca.child_name,
            ca.day_of_week,
            CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END as completed
        FROM chore_assignments ca
        JOIN chores c ON c.id = ca.chore_id
        LEFT JOIN chore_completions cc ON cc.assignment_id = ca.id AND cc.completed_date = ?1
        WHERE ca.day_of_week = ?2
        ORDER BY c.name, ca.child_name
        "#,
    )
        .bind(date)
        .bind(day_of_week)
        .fetch_all(&pool)
        .await?;

    Ok(Json(assignments))
}

#[derive(Deserialize)]
struct CompleteRequest {
    date: String,
}

async fn complete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<CompleteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify assignment exists
    sqlx::query("SELECT id FROM chore_assignments WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Assignment {} not found", id)))?;

    sqlx::query(
        "INSERT OR IGNORE INTO chore_completions (assignment_id, completed_date) VALUES (?, ?)"
    )
        .bind(id)
        .bind(&input.date)
        .execute(&pool)
        .await?;

    Ok(Json(serde_json::json!({"status": "completed"})))
}
```

Note: Add `chrono` dependency:
```bash
cargo add chrono --features serde
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cargo test
```
Expected: all chore tests pass (CRUD + assignments)

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement chore assignment and completion API"
```

---

### Task 5: Lunch Menu API

**Files:**
- Create: `backend/src/models/lunch_menu.rs`
- Create: `backend/src/routes/lunch_menu.rs`
- Create: `backend/tests/api/lunch_menu_test.rs`

- [ ] **Step 1: Write lunch menu model**

```rust
// backend/src/models/lunch_menu.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LunchMenu {
    pub id: i64,
    pub week_of: String,
    pub menu_data: String, // JSON string of daily menus
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchMenuResponse {
    pub week_of: String,
    pub days: Vec<LunchDay>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchDay {
    pub day: String,       // "Monday", "Tuesday", etc.
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertLunchMenu {
    pub days: Vec<LunchDay>,
}
```

Add to `backend/src/models/mod.rs`:
```rust
pub mod lunch_menu;
```

- [ ] **Step 2: Write lunch menu tests**

```rust
// backend/tests/api/lunch_menu_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "../helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_upsert_and_get_lunch_menu() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Upsert a menu
    let response = server
        .put("/lunch-menu/2026-03-16")
        .json(&json!({
            "days": [
                {"day": "Monday", "items": ["Pizza", "Salad"]},
                {"day": "Tuesday", "items": ["Tacos", "Rice"]}
            ]
        }))
        .await;

    response.assert_status_ok();

    // Get it back
    let response = server.get("/lunch-menu?week=2026-03-16").await;
    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["week_of"], "2026-03-16");
    assert_eq!(body["days"][0]["day"], "Monday");
    assert_eq!(body["days"][0]["items"][0], "Pizza");
}

#[tokio::test]
async fn test_get_missing_lunch_menu_returns_404() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server.get("/lunch-menu?week=2026-01-01").await;
    response.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_upsert_replaces_existing_menu() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    // Create initial menu
    server
        .put("/lunch-menu/2026-03-16")
        .json(&json!({"days": [{"day": "Monday", "items": ["Pizza"]}]}))
        .await;

    // Update it
    server
        .put("/lunch-menu/2026-03-16")
        .json(&json!({"days": [{"day": "Monday", "items": ["Burgers", "Fries"]}]}))
        .await;

    let response = server.get("/lunch-menu?week=2026-03-16").await;
    let body: serde_json::Value = response.json();
    assert_eq!(body["days"][0]["items"][0], "Burgers");
}
```

Add to `backend/tests/api/mod.rs`:
```rust
pub mod lunch_menu_test;
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cargo test lunch_menu
```
Expected: compilation/test failures

- [ ] **Step 4: Implement lunch menu routes**

```rust
// backend/src/routes/lunch_menu.rs
use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Json, Router,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::lunch_menu::{LunchMenu, LunchMenuResponse, UpsertLunchMenu};

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/lunch-menu", get(get_lunch_menu))
        .route("/lunch-menu/{week}", put(upsert_lunch_menu))
        .with_state(pool)
}

async fn get_lunch_menu(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let week = params.get("week")
        .ok_or_else(|| AppError::BadRequest("week parameter required".to_string()))?;

    let menu = sqlx::query_as::<_, LunchMenu>(
        "SELECT * FROM lunch_menus WHERE week_of = ?"
    )
        .bind(week)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("No menu for week {}", week)))?;

    let response = LunchMenuResponse {
        week_of: menu.week_of,
        days: serde_json::from_str(&menu.menu_data)
            .map_err(|e| AppError::Internal(format!("Invalid menu data: {}", e)))?,
    };

    Ok(Json(response))
}

async fn upsert_lunch_menu(
    State(pool): State<SqlitePool>,
    Path(week): Path<String>,
    Json(input): Json<UpsertLunchMenu>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let menu_json = serde_json::to_string(&input.days)
        .map_err(|e| AppError::Internal(format!("Failed to serialize menu: {}", e)))?;

    sqlx::query(
        "INSERT INTO lunch_menus (week_of, menu_data) VALUES (?, ?)
         ON CONFLICT(week_of) DO UPDATE SET menu_data = excluded.menu_data"
    )
        .bind(&week)
        .bind(&menu_json)
        .execute(&pool)
        .await?;

    Ok(Json(LunchMenuResponse {
        week_of: week,
        days: input.days,
    }))
}
```

Add to `backend/src/routes/mod.rs`:
```rust
pub mod lunch_menu;

// In router():
.merge(lunch_menu::router(pool.clone()))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cargo test lunch_menu
```
Expected: all 3 lunch menu tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement lunch menu API with upsert support"
```

---

### Task 6: Google Calendar OAuth & Proxy API

**Files:**
- Create: `backend/src/models/google.rs`
- Create: `backend/src/routes/google_auth.rs`
- Create: `backend/src/routes/google_calendar.rs`

- [ ] **Step 1: Add Google dependencies**

```bash
cargo add reqwest --features json
```

- [ ] **Step 2: Write Google models**

```rust
// backend/src/models/google.rs
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}
```

Add to `backend/src/models/mod.rs`:
```rust
pub mod google;
```

- [ ] **Step 3: Implement OAuth routes**

```rust
// backend/src/routes/google_auth.rs
use axum::{
    extract::{Query, State},
    response::Redirect,
    routing::get,
    Json, Router,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::google::GoogleOAuthConfig;

#[derive(Clone)]
pub struct GoogleAuthState {
    pub pool: SqlitePool,
    pub config: GoogleOAuthConfig,
}

pub fn router(pool: SqlitePool, config: GoogleOAuthConfig) -> Router {
    let state = GoogleAuthState { pool, config };
    Router::new()
        .route("/google/auth", get(initiate_auth))
        .route("/google/callback", get(oauth_callback))
        .with_state(state)
}

async fn initiate_auth(
    State(state): State<GoogleAuthState>,
) -> Redirect {
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&\
         redirect_uri={}&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/calendar.readonly&\
         access_type=offline&\
         prompt=consent",
        urlencoding::encode(&state.config.client_id),
        urlencoding::encode(&state.config.redirect_uri),
    );
    Redirect::temporary(&auth_url)
}

#[derive(Debug, serde::Deserialize)]
struct CallbackParams {
    code: String,
}

#[derive(Debug, serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
}

async fn oauth_callback(
    State(state): State<GoogleAuthState>,
    Query(params): Query<CallbackParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let client = reqwest::Client::new();
    let token_resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", params.code.as_str()),
            ("client_id", &state.config.client_id),
            ("client_secret", &state.config.client_secret),
            ("redirect_uri", &state.config.redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Token exchange failed: {}", e)))?
        .json::<TokenResponse>()
        .await
        .map_err(|e| AppError::Internal(format!("Token parse failed: {}", e)))?;

    let refresh_token = token_resp.refresh_token
        .ok_or_else(|| AppError::Internal("No refresh token received".to_string()))?;

    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(token_resp.expires_in);

    sqlx::query(
        "INSERT INTO google_tokens (id, access_token, refresh_token, expires_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           expires_at = excluded.expires_at"
    )
        .bind(&token_resp.access_token)
        .bind(&refresh_token)
        .bind(expires_at.to_rfc3339())
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({"status": "authenticated"})))
}
```

Note: Add dependencies:
```bash
cargo add urlencoding
```

- [ ] **Step 4: Implement calendar proxy routes**

```rust
// backend/src/routes/google_calendar.rs
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::google::{
    CalendarEvent, CalendarListEntry, CalendarListResponse, EventsListResponse,
    GoogleOAuthConfig, GoogleToken,
};

#[derive(Clone)]
pub struct CalendarState {
    pub pool: SqlitePool,
    pub config: GoogleOAuthConfig,
}

pub fn router(pool: SqlitePool, config: GoogleOAuthConfig) -> Router {
    let state = CalendarState { pool, config };
    Router::new()
        .route("/google/calendars", get(list_calendars))
        .route("/google/events", get(list_events))
        .with_state(state)
}

async fn get_valid_token(state: &CalendarState) -> Result<String, AppError> {
    let token = sqlx::query_as::<_, GoogleToken>(
        "SELECT * FROM google_tokens WHERE id = 1"
    )
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::BadRequest(
            "Google Calendar not connected. Complete OAuth setup in admin.".to_string()
        ))?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(&token.expires_at)
        .map_err(|e| AppError::Internal(format!("Invalid expiry: {}", e)))?;

    if expires_at <= chrono::Utc::now() + chrono::Duration::minutes(5) {
        // Refresh the token
        let client = reqwest::Client::new();
        let resp = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", state.config.client_id.as_str()),
                ("client_secret", state.config.client_secret.as_str()),
                ("refresh_token", token.refresh_token.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Token refresh failed: {}", e)))?;

        #[derive(serde::Deserialize)]
        struct RefreshResponse {
            access_token: String,
            expires_in: i64,
        }

        let refresh_resp = resp.json::<RefreshResponse>().await
            .map_err(|e| AppError::Internal(format!("Refresh parse failed: {}", e)))?;

        let new_expiry = chrono::Utc::now() + chrono::Duration::seconds(refresh_resp.expires_in);

        sqlx::query(
            "UPDATE google_tokens SET access_token = ?, expires_at = ? WHERE id = 1"
        )
            .bind(&refresh_resp.access_token)
            .bind(new_expiry.to_rfc3339())
            .execute(&state.pool)
            .await?;

        return Ok(refresh_resp.access_token);
    }

    Ok(token.access_token)
}

async fn list_calendars(
    State(state): State<CalendarState>,
) -> Result<Json<Vec<CalendarListEntry>>, AppError> {
    let token = get_valid_token(&state).await?;

    let client = reqwest::Client::new();
    let resp = client
        .get("https://www.googleapis.com/calendar/v3/users/me/calendarList")
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Calendar API error: {}", e)))?
        .json::<CalendarListResponse>()
        .await
        .map_err(|e| AppError::Internal(format!("Calendar parse error: {}", e)))?;

    Ok(Json(resp.items))
}

async fn list_events(
    State(state): State<CalendarState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<CalendarEvent>>, AppError> {
    let calendar = params.get("calendar")
        .ok_or_else(|| AppError::BadRequest("calendar parameter required".to_string()))?;
    let start = params.get("start")
        .ok_or_else(|| AppError::BadRequest("start parameter required".to_string()))?;
    let end = params.get("end")
        .ok_or_else(|| AppError::BadRequest("end parameter required".to_string()))?;

    let token = get_valid_token(&state).await?;

    let client = reqwest::Client::new();
    let resp = client
        .get(format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events",
            urlencoding::encode(calendar)
        ))
        .bearer_auth(&token)
        .query(&[
            ("timeMin", start.as_str()),
            ("timeMax", end.as_str()),
            ("singleEvents", "true"),
            ("orderBy", "startTime"),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Events API error: {}", e)))?
        .json::<EventsListResponse>()
        .await
        .map_err(|e| AppError::Internal(format!("Events parse error: {}", e)))?;

    Ok(Json(resp.items.unwrap_or_default()))
}
```

Add to `backend/src/routes/mod.rs`:
```rust
pub mod google_auth;
pub mod google_calendar;

// In router(), accept GoogleOAuthConfig and wire up:
pub fn router(pool: SqlitePool, google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
        .merge(lunch_menu::router(pool.clone()))
        .merge(google_auth::router(pool.clone(), google_config.clone()))
        .merge(google_calendar::router(pool.clone(), google_config))
}
```

Update `main.rs` to load Google config from env:
```rust
let google_config = GoogleOAuthConfig {
    client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
    client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
    redirect_uri: std::env::var("GOOGLE_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:3000/api/google/callback".to_string()),
};

let api_routes = routes::router(pool.clone(), google_config);
```

- [ ] **Step 5: Verify compilation**

```bash
cargo build
```
Expected: compiles successfully

Note: Tests for Google OAuth and Calendar proxy endpoints are intentionally deferred. These endpoints make external HTTP calls to Google APIs, so meaningful tests require mocking the HTTP client (e.g., with `wiremock`). Add integration tests when the Google Calendar widget is being iterated on.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement Google Calendar OAuth and proxy API"
```

---

## Chunk 2: Frontend Scaffolding & Shared UI

### Task 7: Initialize frontend project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Create Vite project**

```bash
cd /home/bbaldino/work/dashboard
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm install react-router-dom @hakit/core lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx shadcn@latest init
```
Follow prompts: TypeScript, default style, base color neutral. This sets up the shadcn configuration. Individual components will be added as needed during widget development.

- [ ] **Step 4: Configure Vite with Tailwind and API proxy**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 5: Set up Tailwind with CSS variables**

```css
/* frontend/src/theme/variables.css */
@import "tailwindcss";

@theme {
  /* Background */
  --color-bg-primary: #f8f7f4;
  --color-bg-card: #ffffff;
  --color-bg-card-hover: #f5f3ef;
  --color-bg-overlay: rgba(0, 0, 0, 0.3);

  /* Text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #6b6b6b;
  --color-text-muted: #9a9a9a;

  /* Accent */
  --color-accent: #e07a3a;
  --color-accent-muted: #f0c4a0;
  --color-accent-text: #ffffff;

  /* Status */
  --color-success: #4caf50;
  --color-error: #e53935;

  /* Borders & Shadows */
  --color-border: #e8e4de;
  --radius-card: 16px;
  --radius-button: 10px;
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.08);

  /* Spacing */
  --spacing-card-padding: 16px;
  --spacing-grid-gap: 12px;

  /* Tab bar */
  --height-tab-bar: 64px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

- [ ] **Step 6: Set up main entry and App with router**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './theme/variables.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

```tsx
// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 7: Create AppShell with TabBar**

```tsx
// frontend/src/app/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { TabBar } from '../ui/TabBar'

export function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
```

```tsx
// frontend/src/ui/TabBar.tsx
import { NavLink } from 'react-router-dom'
import { Home, Music, Camera, type LucideIcon } from 'lucide-react'

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/media', label: 'Media', icon: Music },
  { to: '/cameras', label: 'Cameras', icon: Camera },
]

export function TabBar() {
  return (
    <nav
      className="flex items-center justify-around bg-bg-card border-t border-border"
      style={{ height: 'var(--height-tab-bar)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-[var(--radius-button)] transition-colors min-w-[72px] min-h-[48px] ${
                isActive
                  ? 'text-accent bg-accent-muted/30'
                  : 'text-text-secondary'
              }`
            }
          >
            <Icon size={22} />
            <span className="text-xs font-medium">{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 8: Create placeholder boards**

```tsx
// frontend/src/boards/HomeBoard.tsx
export function HomeBoard() {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Home Board — widgets coming soon
    </div>
  )
}
```

```tsx
// frontend/src/boards/MediaBoard.tsx
export function MediaBoard() {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Media Board
    </div>
  )
}
```

```tsx
// frontend/src/boards/CamerasBoard.tsx
export function CamerasBoard() {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Cameras Board
    </div>
  )
}
```

- [ ] **Step 9: Verify dev server runs**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run dev
```
Expected: Vite dev server starts, app loads in browser with tab bar and "Home Board" placeholder

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React Router, Tailwind, and tab bar"
```

---

### Task 8: Shared UI Components

**Files:**
- Create: `frontend/src/ui/WidgetCard.tsx`
- Create: `frontend/src/ui/BottomSheet.tsx`
- Create: `frontend/src/ui/Button.tsx`
- Create: `frontend/src/ui/LoadingSpinner.tsx`
- Create: `frontend/src/ui/ErrorDisplay.tsx`

- [ ] **Step 1: Create WidgetCard**

```tsx
// frontend/src/ui/WidgetCard.tsx
import { ReactNode, useState, useCallback } from 'react'
import { BottomSheet } from './BottomSheet'

interface WidgetCardProps {
  children: ReactNode
  detail?: ReactNode
  className?: string
  padding?: boolean
}

export function WidgetCard({
  children,
  detail,
  className = '',
  padding = true,
}: WidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleTap = useCallback(() => {
    if (detail) {
      setIsExpanded(true)
    }
  }, [detail])

  return (
    <>
      <div
        className={`bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] ${
          detail ? 'cursor-pointer active:shadow-[var(--shadow-card-hover)] active:bg-bg-card-hover transition-all' : ''
        } ${padding ? 'p-[var(--spacing-card-padding)]' : ''} ${className}`}
        onClick={handleTap}
      >
        {children}
      </div>
      {detail && (
        <BottomSheet
          isOpen={isExpanded}
          onClose={() => setIsExpanded(false)}
        >
          {detail}
        </BottomSheet>
      )}
    </>
  )
}
```

- [ ] **Step 2: Create BottomSheet**

```tsx
// frontend/src/ui/BottomSheet.tsx
import { ReactNode, useEffect, useRef } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  height?: 'partial' | 'full'
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  height = 'partial',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const heightClass = height === 'full' ? 'h-full' : 'h-[85vh]'

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg-overlay animate-[fadeIn_200ms_ease-out]" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 ${heightClass} bg-bg-card rounded-t-[24px] shadow-lg animate-[slideUp_300ms_ease-out] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-bg-card">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Button**

```tsx
// frontend/src/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-[var(--radius-button)] transition-all active:scale-95 disabled:opacity-50'

  const variants = {
    primary: 'bg-accent text-accent-text hover:opacity-90',
    secondary: 'bg-bg-card-hover text-text-primary border border-border',
    ghost: 'text-text-secondary hover:bg-bg-card-hover',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[48px]',
    lg: 'px-6 py-3 text-lg min-h-[56px]',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Create LoadingSpinner and ErrorDisplay**

```tsx
// frontend/src/ui/LoadingSpinner.tsx
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}
```

```tsx
// frontend/src/ui/ErrorDisplay.tsx
import { Button } from './Button'

interface ErrorDisplayProps {
  message: string
  onRetry?: () => void
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-error text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/ui/
git commit -m "feat: add shared UI components (WidgetCard, BottomSheet, Button, LoadingSpinner, ErrorDisplay)"
```

---

### Task 9: Shared hooks and API client

**Files:**
- Create: `frontend/src/hooks/usePolling.ts`
- Create: `frontend/src/lib/dashboard-api.ts`

- [ ] **Step 1: Create usePolling hook**

```typescript
// frontend/src/hooks/usePolling.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  intervalMs: number
  enabled?: boolean
}

export interface UsePollingResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  refetch: () => Promise<void>
}

export function usePolling<T>({
  fetcher,
  intervalMs,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    refetch()
    const interval = setInterval(refetch, intervalMs)
    return () => clearInterval(interval)
  }, [enabled, intervalMs, refetch])

  return { data, error, isLoading, refetch }
}
```

- [ ] **Step 2: Create Dashboard API client**

```typescript
// frontend/src/lib/dashboard-api.ts

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> }
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(response.status, body.error || 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Chores
export interface Chore {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface ChoreAssignment {
  id: number
  chore_id: number
  chore_name: string
  child_name: string
  day_of_week: number
  completed: boolean
}

export const choresApi = {
  list: () => request<Chore[]>('/chores'),
  create: (data: { name: string; description?: string }) =>
    request<Chore>('/chores', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string; description?: string }) =>
    request<Chore>(`/chores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/chores/${id}`, { method: 'DELETE' }),
  getAssignments: (date: string) =>
    request<ChoreAssignment[]>(`/chores/assignments?date=${date}`),
  setAssignments: (choreId: number, assignments: { child_name: string; day_of_week: number }[]) =>
    request(`/chores/${choreId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
  completeAssignment: (assignmentId: number, date: string) =>
    request(`/chores/assignments/${assignmentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
}

// Lunch Menu
export interface LunchDay {
  day: string
  items: string[]
}

export interface LunchMenu {
  week_of: string
  days: LunchDay[]
}

export const lunchMenuApi = {
  get: (week: string) => request<LunchMenu>(`/lunch-menu?week=${week}`),
  upsert: (week: string, data: { days: LunchDay[] }) =>
    request<LunchMenu>(`/lunch-menu/${week}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// Google Calendar
export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  location?: string
}

export const googleCalendarApi = {
  listCalendars: () => request<CalendarListEntry[]>('/google/calendars'),
  listEvents: (calendar: string, start: string, end: string) =>
    request<CalendarEvent[]>(
      `/google/events?calendar=${encodeURIComponent(calendar)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    ),
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/ frontend/src/lib/
git commit -m "feat: add usePolling hook and Dashboard API client"
```

---

## Chunk 3: Dashboard Widgets

### Task 10: Clock Widget

**Files:**
- Create: `frontend/src/widgets/clock/ClockWidget.tsx`
- Create: `frontend/src/widgets/clock/index.ts`

- [ ] **Step 1: Implement ClockWidget**

```tsx
// frontend/src/widgets/clock/ClockWidget.tsx
import { useState, useEffect } from 'react'
import { WidgetCard } from '../../ui/WidgetCard'

export function ClockWidget() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <WidgetCard>
      <div className="text-center">
        <div className="text-4xl font-light text-text-primary tracking-tight">
          {time}
        </div>
        <div className="text-sm text-text-secondary mt-1">{date}</div>
      </div>
    </WidgetCard>
  )
}
```

```typescript
// frontend/src/widgets/clock/index.ts
export { ClockWidget } from './ClockWidget'
```

- [ ] **Step 2: Verify compilation**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/clock/
git commit -m "feat: add clock widget"
```

---

### Task 11: Weather Widget (HA integration)

**Files:**
- Create: `frontend/src/hooks/useHaEntity.ts`
- Create: `frontend/src/hooks/useHaService.ts`
- Create: `frontend/src/lib/ha-client.ts`
- Modify: `frontend/src/app/AppShell.tsx`
- Create: `frontend/src/widgets/weather/WeatherWidget.tsx`
- Create: `frontend/src/widgets/weather/WeatherDetail.tsx`
- Create: `frontend/src/widgets/weather/index.ts`

- [ ] **Step 1: Create HA client setup**

Note: HAKit requires wrapping the app (or a subtree) in `<HassConnect>`. Since HA is opt-in, we create a provider component that widgets can wrap themselves in, or that a board can use to provide HA context to a group of HA-dependent widgets.

```typescript
// frontend/src/lib/ha-client.ts
// HAKit configuration
// The HA URL is configured via environment variable
export const HA_URL = import.meta.env.VITE_HA_URL || 'http://homeassistant.local:8123'
```

- [ ] **Step 2: Create useHaEntity hook**

```typescript
// frontend/src/hooks/useHaEntity.ts
import { useEntity } from '@hakit/core'

// Re-export HAKit's useEntity with our naming convention
// This thin wrapper lets us swap implementations later without touching widgets
export function useHaEntity(entityId: string) {
  return useEntity(entityId)
}

export type { EntityName } from '@hakit/core'
```

```typescript
// frontend/src/hooks/useHaService.ts
import { useHass } from '@hakit/core'

// Re-export HAKit's service call wrapper
export function useHaService() {
  const { callService } = useHass()
  return { callService }
}
```

Note: The actual HAKit setup requires `<HassConnect>` higher in the tree. Widgets using HA hooks need to be rendered inside a `<HassConnect>` provider. We'll add this to AppShell as an optional provider — it connects to HA if configured, and HA widgets gracefully handle the missing connection.

Add to `frontend/src/app/AppShell.tsx`:

```tsx
import { HassConnect } from '@hakit/core'
import { HA_URL } from '../lib/ha-client'

export function AppShell() {
  return (
    <HassConnect hassUrl={HA_URL}>
      <div className="flex flex-col h-screen bg-bg-primary">
        <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </HassConnect>
  )
}
```

- [ ] **Step 3: Create WeatherWidget**

```tsx
// frontend/src/widgets/weather/WeatherWidget.tsx
import { useHaEntity } from '../../hooks/useHaEntity'
import { WidgetCard } from '../../ui/WidgetCard'
import { WeatherDetail } from './WeatherDetail'

interface WeatherWidgetProps {
  entityId: string
}

const conditionIcons: Record<string, string> = {
  sunny: '☀️',
  'clear-night': '🌙',
  partlycloudy: '⛅',
  cloudy: '☁️',
  rainy: '🌧️',
  snowy: '❄️',
  'snowy-rainy': '🌨️',
  fog: '🌫️',
  lightning: '⚡',
  'lightning-rainy': '⛈️',
  windy: '💨',
}

export function WeatherWidget({ entityId }: WeatherWidgetProps) {
  const weather = useHaEntity(entityId as any)

  const condition = weather.state
  const temp = weather.attributes.temperature
  const icon = conditionIcons[condition] || '🌡️'

  return (
    <WidgetCard detail={<WeatherDetail entityId={entityId} />}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="text-2xl font-light text-text-primary">
            {temp}°
          </div>
          <div className="text-xs text-text-secondary capitalize">
            {condition?.replace(/-/g, ' ')}
          </div>
        </div>
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 4: Create WeatherDetail**

```tsx
// frontend/src/widgets/weather/WeatherDetail.tsx
import { useHaEntity } from '../../hooks/useHaEntity'

interface WeatherDetailProps {
  entityId: string
}

export function WeatherDetail({ entityId }: WeatherDetailProps) {
  const weather = useHaEntity(entityId as any)
  const forecast = weather.attributes.forecast as any[] | undefined

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        Weather Forecast
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {forecast?.slice(0, 8).map((entry: any, i: number) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 p-3 rounded-[var(--radius-button)] bg-bg-card-hover"
          >
            <span className="text-xs text-text-secondary">
              {new Date(entry.datetime).toLocaleDateString([], {
                weekday: 'short',
              })}
            </span>
            <span className="text-lg">{entry.temperature}°</span>
            <span className="text-xs text-text-muted">
              {entry.templow && `${entry.templow}°`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

```typescript
// frontend/src/widgets/weather/index.ts
export { WeatherWidget } from './WeatherWidget'
export { WeatherDetail } from './WeatherDetail'
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no type errors (HAKit types may need adjustment based on actual library API)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/widgets/weather/ frontend/src/hooks/useHaEntity.ts frontend/src/lib/ha-client.ts frontend/src/app/AppShell.tsx
git commit -m "feat: add weather widget with HA integration and forecast detail"
```

---

### Task 12: Calendar Widget

**Files:**
- Create: `frontend/src/widgets/calendar/useGoogleCalendar.ts`
- Create: `frontend/src/widgets/calendar/CalendarWidget.tsx`
- Create: `frontend/src/widgets/calendar/CalendarDetail.tsx`
- Create: `frontend/src/widgets/calendar/index.ts`

- [ ] **Step 1: Create useGoogleCalendar hook**

```typescript
// frontend/src/widgets/calendar/useGoogleCalendar.ts
import { usePolling } from '../../hooks/usePolling'
import { googleCalendarApi, CalendarEvent } from '../../lib/dashboard-api'

function startOfDay(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
}

function endOfDay(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
}

function endOfWeek(date: Date): string {
  const end = new Date(date)
  end.setDate(end.getDate() + (7 - end.getDay()))
  end.setHours(23, 59, 59)
  return end.toISOString()
}

export function useGoogleCalendar(calendarId: string) {
  const todayEvents = usePolling({
    fetcher: () => {
      const today = new Date() // Recompute on each poll to handle midnight rollover
      return googleCalendarApi.listEvents(
        calendarId,
        startOfDay(today),
        endOfDay(today),
      )
    },
    intervalMs: 5 * 60 * 1000, // 5 minutes
  })

  const weekEvents = usePolling({
    fetcher: () => {
      const today = new Date()
      return googleCalendarApi.listEvents(
        calendarId,
        startOfDay(today),
        endOfWeek(today),
      )
    },
    intervalMs: 10 * 60 * 1000, // 10 minutes
  })

  return { todayEvents, weekEvents }
}

export function formatEventTime(event: CalendarEvent): string {
  const start = event.start.dateTime || event.start.date
  if (!start) return ''

  if (event.start.date && !event.start.dateTime) {
    return 'All day'
  }

  return new Date(start).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
```

- [ ] **Step 2: Create CalendarWidget**

```tsx
// frontend/src/widgets/calendar/CalendarWidget.tsx
import { WidgetCard } from '../../ui/WidgetCard'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { ErrorDisplay } from '../../ui/ErrorDisplay'
import { CalendarDetail } from './CalendarDetail'
import { useGoogleCalendar, formatEventTime } from './useGoogleCalendar'

interface CalendarWidgetProps {
  calendarId: string
}

export function CalendarWidget({ calendarId }: CalendarWidgetProps) {
  const { todayEvents, weekEvents } = useGoogleCalendar(calendarId)

  const detail = <CalendarDetail weekEvents={weekEvents} />

  if (todayEvents.isLoading) {
    return (
      <WidgetCard detail={detail}>
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (todayEvents.error) {
    return (
      <WidgetCard detail={detail}>
        <ErrorDisplay message={todayEvents.error} onRetry={todayEvents.refetch} />
      </WidgetCard>
    )
  }

  const events = todayEvents.data || []

  return (
    <WidgetCard detail={detail}>
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
          Today
        </h3>
        {events.length === 0 ? (
          <p className="text-text-muted text-sm">No events today</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 5).map((event) => (
              <li key={event.id} className="flex gap-2 items-baseline">
                <span className="text-xs text-accent font-medium whitespace-nowrap">
                  {formatEventTime(event)}
                </span>
                <span className="text-sm text-text-primary truncate">
                  {event.summary || 'Untitled'}
                </span>
              </li>
            ))}
            {events.length > 5 && (
              <li className="text-xs text-text-muted">
                +{events.length - 5} more
              </li>
            )}
          </ul>
        )}
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 3: Create CalendarDetail**

```tsx
// frontend/src/widgets/calendar/CalendarDetail.tsx
import { formatEventTime } from './useGoogleCalendar'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { ErrorDisplay } from '../../ui/ErrorDisplay'
import { CalendarEvent } from '../../lib/dashboard-api'
import { UsePollingResult } from '../../hooks/usePolling'

interface CalendarDetailProps {
  weekEvents: UsePollingResult<CalendarEvent[]>
}

export function CalendarDetail({ weekEvents }: CalendarDetailProps) {
  if (weekEvents.isLoading) return <LoadingSpinner />
  if (weekEvents.error) {
    return <ErrorDisplay message={weekEvents.error} onRetry={weekEvents.refetch} />
  }

  const events = weekEvents.data || []

  // Group events by day
  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const start = event.start.dateTime || event.start.date || ''
    const dayKey = new Date(start).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    if (!acc[dayKey]) acc[dayKey] = []
    acc[dayKey].push(event)
    return acc
  }, {})

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        This Week
      </h2>
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day} className="mb-4">
          <h3 className="text-sm font-semibold text-text-secondary mb-2">
            {day}
          </h3>
          <ul className="space-y-2">
            {dayEvents.map((event) => (
              <li
                key={event.id}
                className="p-3 rounded-[var(--radius-button)] bg-bg-card-hover"
              >
                <div className="flex gap-2 items-baseline">
                  <span className="text-xs text-accent font-medium whitespace-nowrap">
                    {formatEventTime(event)}
                  </span>
                  <span className="text-sm text-text-primary font-medium">
                    {event.summary || 'Untitled'}
                  </span>
                </div>
                {event.location && (
                  <div className="text-xs text-text-muted mt-1">
                    {event.location}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

```typescript
// frontend/src/widgets/calendar/index.ts
export { CalendarWidget } from './CalendarWidget'
export { CalendarDetail } from './CalendarDetail'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/calendar/
git commit -m "feat: add calendar widget with Google Calendar integration and week detail view"
```

---

### Task 13: Chores Widget

**Files:**
- Create: `frontend/src/widgets/chores/useChores.ts`
- Create: `frontend/src/widgets/chores/ChoresWidget.tsx`
- Create: `frontend/src/widgets/chores/ChoresDetail.tsx`
- Create: `frontend/src/widgets/chores/index.ts`

- [ ] **Step 1: Create useChores hook**

```typescript
// frontend/src/widgets/chores/useChores.ts
import { usePolling } from '../../hooks/usePolling'
import { choresApi, ChoreAssignment } from '../../lib/dashboard-api'
import { useCallback } from 'react'

function todayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export function useChores() {
  const today = todayDateString()

  const { data, error, isLoading, refetch } = usePolling({
    fetcher: () => choresApi.getAssignments(today),
    intervalMs: 60 * 1000, // 1 minute
  })

  const completeChore = useCallback(async (assignmentId: number) => {
    await choresApi.completeAssignment(assignmentId, today)
    await refetch()
  }, [today, refetch])

  // Group by child
  const byChild = (data || []).reduce<Record<string, ChoreAssignment[]>>((acc, a) => {
    if (!acc[a.child_name]) acc[a.child_name] = []
    acc[a.child_name].push(a)
    return acc
  }, {})

  return { byChild, error, isLoading, refetch, completeChore }
}
```

- [ ] **Step 2: Create ChoresWidget**

```tsx
// frontend/src/widgets/chores/ChoresWidget.tsx
import { WidgetCard } from '../../ui/WidgetCard'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { ErrorDisplay } from '../../ui/ErrorDisplay'
import { ChoresDetail } from './ChoresDetail'
import { useChores } from './useChores'

export function ChoresWidget() {
  const { byChild, error, isLoading, refetch, completeChore } = useChores()

  const detail = <ChoresDetail byChild={byChild} completeChore={completeChore} />

  if (isLoading) {
    return <WidgetCard detail={detail}><LoadingSpinner /></WidgetCard>
  }

  if (error) {
    return (
      <WidgetCard detail={detail}>
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  return (
    <WidgetCard detail={detail}>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
        Chores
      </h3>
      {Object.keys(byChild).length === 0 ? (
        <p className="text-text-muted text-sm">No chores today</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(byChild).map(([child, assignments]) => (
            <div key={child}>
              <div className="text-xs font-medium text-text-secondary mb-1">
                {child}
              </div>
              <ul className="space-y-1">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!a.completed) completeChore(a.id)
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors min-w-[20px] ${
                        a.completed
                          ? 'bg-success border-success text-white'
                          : 'border-border hover:border-accent'
                      }`}
                    >
                      {a.completed && '✓'}
                    </button>
                    <span
                      className={
                        a.completed
                          ? 'line-through text-text-muted'
                          : 'text-text-primary'
                      }
                    >
                      {a.chore_name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
```

- [ ] **Step 3: Create ChoresDetail**

```tsx
// frontend/src/widgets/chores/ChoresDetail.tsx
import { ChoreAssignment } from '../../lib/dashboard-api'

interface ChoresDetailProps {
  byChild: Record<string, ChoreAssignment[]>
  completeChore: (assignmentId: number) => Promise<void>
}

export function ChoresDetail({ byChild, completeChore }: ChoresDetailProps) {

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        Today's Chores
      </h2>
      {Object.entries(byChild).map(([child, assignments]) => (
        <div key={child} className="mb-6">
          <h3 className="text-lg font-medium text-text-primary mb-2">
            {child}
          </h3>
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-button)] bg-bg-card-hover"
              >
                <button
                  onClick={() => !a.completed && completeChore(a.id)}
                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    a.completed
                      ? 'bg-success border-success text-white'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  {a.completed && '✓'}
                </button>
                <span
                  className={`text-base ${
                    a.completed
                      ? 'line-through text-text-muted'
                      : 'text-text-primary'
                  }`}
                >
                  {a.chore_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

```typescript
// frontend/src/widgets/chores/index.ts
export { ChoresWidget } from './ChoresWidget'
export { ChoresDetail } from './ChoresDetail'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/widgets/chores/
git commit -m "feat: add chores widget with completion and detail view"
```

---

### Task 14: Lunch Menu Widget

**Files:**
- Create: `frontend/src/widgets/lunch-menu/useLunchMenu.ts`
- Create: `frontend/src/widgets/lunch-menu/LunchMenuWidget.tsx`
- Create: `frontend/src/widgets/lunch-menu/index.ts`

- [ ] **Step 1: Create useLunchMenu hook**

```typescript
// frontend/src/widgets/lunch-menu/useLunchMenu.ts
import { usePolling } from '../../hooks/usePolling'
import { lunchMenuApi } from '../../lib/dashboard-api'

function currentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export function useLunchMenu() {
  return usePolling({
    fetcher: () => lunchMenuApi.get(currentWeekMonday()), // Recompute on each poll
    intervalMs: 60 * 60 * 1000, // 1 hour
  })
}

export function todayDayName(): string {
  return new Date().toLocaleDateString([], { weekday: 'long' })
}
```

- [ ] **Step 2: Create LunchMenuWidget**

```tsx
// frontend/src/widgets/lunch-menu/LunchMenuWidget.tsx
import { WidgetCard } from '../../ui/WidgetCard'
import { LoadingSpinner } from '../../ui/LoadingSpinner'
import { ErrorDisplay } from '../../ui/ErrorDisplay'
import { useLunchMenu, todayDayName } from './useLunchMenu'

export function LunchMenuWidget() {
  const { data, error, isLoading, refetch } = useLunchMenu()

  if (isLoading) return <WidgetCard><LoadingSpinner /></WidgetCard>
  if (error) {
    return <WidgetCard><ErrorDisplay message={error} onRetry={refetch} /></WidgetCard>
  }

  const today = todayDayName()
  const todayMenu = data?.days.find((d) => d.day === today)

  return (
    <WidgetCard>
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
        Lunch Menu
      </h3>
      {!todayMenu ? (
        <p className="text-text-muted text-sm">No menu for today</p>
      ) : (
        <ul className="space-y-1">
          {todayMenu.items.map((item, i) => (
            <li key={i} className="text-sm text-text-primary">
              {item}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
```

```typescript
// frontend/src/widgets/lunch-menu/index.ts
export { LunchMenuWidget } from './LunchMenuWidget'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/lunch-menu/
git commit -m "feat: add lunch menu widget"
```

---

### Task 15: Doorbell Camera Widget

**Files:**
- Create: `frontend/src/widgets/doorbell/useWebRtcStream.ts`
- Create: `frontend/src/widgets/doorbell/DoorbellWidget.tsx`
- Create: `frontend/src/widgets/doorbell/index.ts`

- [ ] **Step 1: Create useWebRtcStream hook**

```typescript
// frontend/src/widgets/doorbell/useWebRtcStream.ts
import { useEffect, useRef, useState, useCallback } from 'react'

const GO2RTC_URL = import.meta.env.VITE_GO2RTC_URL || 'http://frigate:1984'

interface UseWebRtcStreamOptions {
  streamName: string
  enabled?: boolean
}

export function useWebRtcStream({ streamName, enabled = true }: UseWebRtcStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    try {
      setError(null)

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc

      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        setIsConnected(pc.connectionState === 'connected')
        if (pc.connectionState === 'failed') {
          setError('Connection failed')
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const response = await fetch(
        `${GO2RTC_URL}/api/webrtc?src=${encodeURIComponent(streamName)}`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: { 'Content-Type': 'application/sdp' },
        }
      )

      if (!response.ok) {
        throw new Error(`go2rtc returned ${response.status}`)
      }

      const answerSdp = await response.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    }
  }, [streamName])

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }
    return () => disconnect()
  }, [enabled, connect, disconnect])

  return { videoRef, isConnected, error, reconnect: connect }
}
```

- [ ] **Step 2: Create DoorbellWidget**

```tsx
// frontend/src/widgets/doorbell/DoorbellWidget.tsx
import { WidgetCard } from '../../ui/WidgetCard'
import { ErrorDisplay } from '../../ui/ErrorDisplay'
import { useWebRtcStream } from './useWebRtcStream'

interface DoorbellWidgetProps {
  streamName: string
}

export function DoorbellWidget({ streamName }: DoorbellWidgetProps) {
  const { videoRef, isConnected, error, reconnect } = useWebRtcStream({
    streamName,
  })

  if (error) {
    return (
      <WidgetCard>
        <ErrorDisplay message={`Camera: ${error}`} onRetry={reconnect} />
      </WidgetCard>
    )
  }

  return (
    <WidgetCard padding={false}>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-[var(--radius-card)] bg-black"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-success' : 'bg-error animate-pulse'
            }`}
          />
          <span className="text-xs text-white/80 font-medium drop-shadow">
            Doorbell
          </span>
        </div>
      </div>
    </WidgetCard>
  )
}
```

```typescript
// frontend/src/widgets/doorbell/index.ts
export { DoorbellWidget } from './DoorbellWidget'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/doorbell/
git commit -m "feat: add doorbell camera widget with WebRTC streaming"
```

---

## Chunk 4: Home Board, Admin UI & Integration

### Task 16: Home Board Layout

**Files:**
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Compose Home Board with widgets**

```tsx
// frontend/src/boards/HomeBoard.tsx
import { ClockWidget } from '../widgets/clock'
import { WeatherWidget } from '../widgets/weather'
import { CalendarWidget } from '../widgets/calendar'
import { ChoresWidget } from '../widgets/chores'
import { LunchMenuWidget } from '../widgets/lunch-menu'
import { DoorbellWidget } from '../widgets/doorbell'

export function HomeBoard() {
  return (
    <div className="grid grid-cols-3 gap-[var(--spacing-grid-gap)] h-full auto-rows-min">
      {/* Row 1: Clock + Weather | Calendar | Doorbell */}
      <div className="space-y-[var(--spacing-grid-gap)]">
        <ClockWidget />
        <WeatherWidget entityId="weather.home" />
      </div>
      <div className="row-span-2">
        <CalendarWidget calendarId="primary" />
      </div>
      <div className="row-span-2">
        <DoorbellWidget streamName="doorbell" />
      </div>

      {/* Row 2: Chores + Lunch */}
      <div className="space-y-[var(--spacing-grid-gap)]">
        <ChoresWidget />
        <LunchMenuWidget />
      </div>
    </div>
  )
}
```

Note: The `entityId`, `calendarId`, and `streamName` props are hardcoded here. This is fine — board files are where you decide what goes where and what connects to what. If these ever need to be configurable, they can be extracted to a config file later.

- [ ] **Step 2: Verify it compiles and renders**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
npm run dev
```
Expected: Home board renders with all widget cards visible (some may show errors if backends aren't running — that's expected)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/boards/HomeBoard.tsx
git commit -m "feat: compose Home Board with all Day 1 widgets"
```

---

### Task 17: Admin Layout and Chore Admin

**Files:**
- Create: `frontend/src/admin/AdminLayout.tsx`
- Create: `frontend/src/admin/ChoreAdmin.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create AdminLayout**

```tsx
// frontend/src/admin/AdminLayout.tsx
import { NavLink, Outlet } from 'react-router-dom'

const adminTabs = [
  { to: '/admin/chores', label: 'Chores' },
  { to: '/admin/lunch-menu', label: 'Lunch Menu' },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-card border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">
          Dashboard Admin
        </h1>
        <nav className="flex gap-4 mt-2">
          {adminTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `text-sm px-3 py-1.5 rounded-[var(--radius-button)] transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-text'
                    : 'text-text-secondary hover:bg-bg-card-hover'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="p-6 max-w-4xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create ChoreAdmin**

```tsx
// frontend/src/admin/ChoreAdmin.tsx
import { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/Button'
import { choresApi, Chore } from '../lib/dashboard-api'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ChoreAdmin() {
  const [chores, setChores] = useState<Chore[]>([])
  const [newChoreName, setNewChoreName] = useState('')
  const [newChoreDesc, setNewChoreDesc] = useState('')

  const loadChores = useCallback(async () => {
    const data = await choresApi.list()
    setChores(data)
  }, [])

  useEffect(() => { loadChores() }, [loadChores])

  const handleCreate = async () => {
    if (!newChoreName.trim()) return
    await choresApi.create({
      name: newChoreName.trim(),
      description: newChoreDesc.trim() || undefined,
    })
    setNewChoreName('')
    setNewChoreDesc('')
    loadChores()
  }

  const handleDelete = async (id: number) => {
    await choresApi.delete(id)
    loadChores()
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        Manage Chores
      </h2>

      {/* Add new chore */}
      <div className="bg-bg-card rounded-[var(--radius-card)] p-4 mb-6 border border-border">
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          Add New Chore
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-text-muted block mb-1">Name</label>
            <input
              type="text"
              value={newChoreName}
              onChange={(e) => setNewChoreName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary"
              placeholder="e.g. Take out trash"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-muted block mb-1">Description</label>
            <input
              type="text"
              value={newChoreDesc}
              onChange={(e) => setNewChoreDesc(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary"
              placeholder="Optional details"
            />
          </div>
          <Button onClick={handleCreate} size="md">Add</Button>
        </div>
      </div>

      {/* Chore list */}
      <div className="space-y-3">
        {chores.map((chore) => (
          <ChoreRow
            key={chore.id}
            chore={chore}
            onDelete={() => handleDelete(chore.id)}
          />
        ))}
        {chores.length === 0 && (
          <p className="text-text-muted text-sm">No chores defined yet.</p>
        )}
      </div>
    </div>
  )
}

function ChoreRow({ chore, onDelete }: { chore: Chore; onDelete: () => void }) {
  const [assignments, setAssignments] = useState<{ child_name: string; day_of_week: number }[]>([])
  const [childName, setChildName] = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])

  // Note: Displaying existing assignments requires a per-chore assignment endpoint
  // (not yet in the API). For now, assignments are tracked locally after setting.
  // Add `GET /api/chores/:id/assignments` to the backend when iterating on admin UI.

  const handleAddAssignment = async () => {
    if (!childName.trim() || selectedDays.length === 0) return
    const newAssignments = [
      ...assignments,
      ...selectedDays.map((d) => ({ child_name: childName.trim(), day_of_week: d })),
    ]
    await choresApi.setAssignments(chore.id, newAssignments)
    setAssignments(newAssignments)
    setChildName('')
    setSelectedDays([])
  }

  return (
    <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-text-primary">{chore.name}</h4>
          {chore.description && (
            <p className="text-sm text-text-secondary">{chore.description}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>

      {/* Assignment form */}
      <div className="border-t border-border pt-3 mt-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-xs text-text-muted block mb-1">Child</label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm w-32"
              placeholder="Name"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Days</label>
            <div className="flex gap-1">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setSelectedDays((prev) =>
                      prev.includes(i)
                        ? prev.filter((d) => d !== i)
                        : [...prev, i]
                    )
                  }
                  className={`w-8 h-8 text-xs rounded-[var(--radius-button)] border transition-colors ${
                    selectedDays.includes(i)
                      ? 'bg-accent text-accent-text border-accent'
                      : 'border-border text-text-secondary'
                  }`}
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={handleAddAssignment}>
            Assign
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add admin routes to App**

Modify `frontend/src/App.tsx` — add the admin imports and routes:

Add imports at top:
```tsx
import { AdminLayout } from './admin/AdminLayout'
import { ChoreAdmin } from './admin/ChoreAdmin'
import { LunchMenuAdmin } from './admin/LunchMenuAdmin'
```

Add admin routes inside `<Routes>`, after the dashboard `<Route>` block:
```tsx
      {/* Admin routes */}
      <Route path="admin" element={<AdminLayout />}>
        <Route path="chores" element={<ChoreAdmin />} />
        <Route path="lunch-menu" element={<LunchMenuAdmin />} />
      </Route>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/admin/ frontend/src/App.tsx
git commit -m "feat: add admin layout and chore management page"
```

---

### Task 18: Lunch Menu Admin

**Files:**
- Create: `frontend/src/admin/LunchMenuAdmin.tsx`

- [ ] **Step 1: Create LunchMenuAdmin**

```tsx
// frontend/src/admin/LunchMenuAdmin.tsx
import { useState } from 'react'
import { Button } from '../ui/Button'
import { lunchMenuApi, LunchDay } from '../lib/dashboard-api'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function currentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.getFullYear(), now.getMonth(), diff).toISOString().split('T')[0]
}

export function LunchMenuAdmin() {
  const [weekOf, setWeekOf] = useState(currentWeekMonday())
  const [days, setDays] = useState<LunchDay[]>(
    WEEKDAYS.map((day) => ({ day, items: [''] }))
  )
  const [status, setStatus] = useState<string | null>(null)

  const loadMenu = async () => {
    try {
      const menu = await lunchMenuApi.get(weekOf)
      setDays(menu.days)
      setStatus(null)
    } catch {
      // No menu for this week yet — keep empty template
      setDays(WEEKDAYS.map((day) => ({ day, items: [''] })))
    }
  }

  const handleSave = async () => {
    const cleaned = days.map((d) => ({
      ...d,
      items: d.items.filter((item) => item.trim()),
    }))
    await lunchMenuApi.upsert(weekOf, { days: cleaned })
    setStatus('Saved!')
    setTimeout(() => setStatus(null), 2000)
  }

  const updateItem = (dayIndex: number, itemIndex: number, value: string) => {
    setDays((prev) => {
      const updated = [...prev]
      updated[dayIndex] = {
        ...updated[dayIndex],
        items: updated[dayIndex].items.map((item, i) =>
          i === itemIndex ? value : item
        ),
      }
      return updated
    })
  }

  const addItem = (dayIndex: number) => {
    setDays((prev) => {
      const updated = [...prev]
      updated[dayIndex] = {
        ...updated[dayIndex],
        items: [...updated[dayIndex].items, ''],
      }
      return updated
    })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-4">
        Lunch Menu
      </h2>

      <div className="flex gap-3 items-center mb-6">
        <label className="text-sm text-text-secondary">Week of:</label>
        <input
          type="date"
          value={weekOf}
          onChange={(e) => setWeekOf(e.target.value)}
          className="px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary"
        />
        <Button variant="secondary" size="sm" onClick={loadMenu}>
          Load
        </Button>
      </div>

      <div className="space-y-4">
        {days.map((day, dayIndex) => (
          <div
            key={day.day}
            className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border"
          >
            <h3 className="font-medium text-text-primary mb-2">{day.day}</h3>
            <div className="space-y-2">
              {day.items.map((item, itemIndex) => (
                <input
                  key={itemIndex}
                  type="text"
                  value={item}
                  onChange={(e) =>
                    updateItem(dayIndex, itemIndex, e.target.value)
                  }
                  className="w-full px-3 py-1.5 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
                  placeholder="Menu item"
                />
              ))}
              <button
                onClick={() => addItem(dayIndex)}
                className="text-xs text-accent hover:underline"
              >
                + Add item
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button onClick={handleSave}>Save Menu</Button>
        {status && (
          <span className="text-sm text-success">{status}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/admin/LunchMenuAdmin.tsx
git commit -m "feat: add lunch menu admin page"
```

---

### Task 19: Final integration and cleanup

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Update index.html for fullscreen kiosk**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <title>Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create .gitignore**

```
# frontend
frontend/node_modules/
frontend/dist/

# backend
backend/target/
backend/dashboard.db

# superpowers
.superpowers/
```

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```

- [ ] **Step 3: Verify full app compiles and runs**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
npm run build
```
Expected: build succeeds, outputs to `frontend/dist/`

- [ ] **Step 4: Final commit**

```bash
git add frontend/index.html
git commit -m "feat: finalize kiosk-ready index.html"
```
