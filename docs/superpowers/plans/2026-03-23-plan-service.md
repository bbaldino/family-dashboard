# PLAN Service Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone self-hosted service (PLAN — Projects, Logistics, Activities, Notes) for planning trips, events, and projects, with a REST API, React web UI, and dashboard widget.

**Architecture:** Rust/Axum/SQLite backend + React/TypeScript/Tailwind frontend in a monorepo at `/home/bbaldino/work/plan/`. The backend serves the REST API; the frontend is a Vite-powered SPA served as static files in production. Three consumers share the API: web UI, dashboard widget, agent.

**Tech Stack:** Rust, Axum, SQLite (sqlx), serde, chrono, uuid | React, TypeScript, Tailwind CSS v4, Vite, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-23-plan-service-design.md` (in the dashboard repo at `/home/bbaldino/work/dashboard/`)

---

## File Structure

### Backend (`backend/`)

| File | Responsibility |
|------|---------------|
| `Cargo.toml` | Dependencies |
| `migrations/001_initial.sql` | All tables + triggers |
| `src/main.rs` | Server startup, router composition, static file serving |
| `src/lib.rs` | Module declarations |
| `src/db.rs` | SQLite pool initialization + migrations |
| `src/error.rs` | `AppError` enum with `IntoResponse` |
| `src/models.rs` | Shared types: `Plan`, `Item`, `ItemData` enum, `Checklist`, `Guest`, `Note`, query/response structs |
| `src/api/mod.rs` | Router composition (`/api/plans`, nested routes) |
| `src/api/plans.rs` | Plan CRUD + upcoming endpoint |
| `src/api/items.rs` | Item CRUD + reorder + itinerary view |
| `src/api/checklists.rs` | Checklist + checklist item CRUD + reorder |
| `src/api/guests.rs` | Guest CRUD |
| `src/api/notes.rs` | Note CRUD |

### Frontend (`frontend/`)

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies |
| `vite.config.ts` | Vite config with API proxy + path aliases |
| `tsconfig.json` | TypeScript config |
| `index.html` | SPA entry point |
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Router + QueryClient setup |
| `src/api/client.ts` | Typed fetch wrapper for all API calls |
| `src/types.ts` | TypeScript types mirroring backend models |
| `src/components/Sidebar.tsx` | Plan list grouped by type, create plan button |
| `src/components/PlanDetail.tsx` | Tab container for the selected plan |
| `src/components/PlanHeader.tsx` | Plan name, type badge, status, date range, edit controls |
| `src/components/tabs/ItemsTab.tsx` | Item list with filters, status badges, create/edit |
| `src/components/tabs/ItineraryTab.tsx` | Items grouped by day, sorted by time |
| `src/components/tabs/ChecklistsTab.tsx` | Named checklists with toggleable items |
| `src/components/tabs/NotesTab.tsx` | Note list with create/edit |
| `src/components/tabs/GuestsTab.tsx` | Guest table with RSVP management |
| `src/components/ItemForm.tsx` | Create/edit item form with category-specific fields |
| `src/components/ui/Badge.tsx` | Status/category badge component |
| `src/components/ui/Modal.tsx` | Reusable modal |
| `src/components/ui/ProgressBar.tsx` | Checklist progress bar |
| `src/styles/index.css` | Tailwind imports + CSS variables |

---

## Chunk 1: Project Scaffolding + Data Model + Plans & Items API

### Task 1: Initialize the Rust backend project

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/src/lib.rs`
- Create: `backend/.env`

- [ ] **Step 1: Create the project directory and initialize Cargo**

```bash
mkdir -p /home/bbaldino/work/plan/backend
cd /home/bbaldino/work/plan/backend
cargo init --name plan-backend
```

- [ ] **Step 2: Add dependencies**

```bash
cd /home/bbaldino/work/plan/backend
cargo add axum --features json
cargo add chrono --features serde
cargo add dotenvy
cargo add serde --features derive
cargo add serde_json
cargo add sqlx --features "runtime-tokio sqlite"
cargo add tokio --features full
cargo add tower-http --features "fs cors"
cargo add tracing
cargo add tracing-subscriber
cargo add uuid --features v4
cargo add thiserror
```

- [ ] **Step 3: Create `.env` file**

Create `backend/.env`:
```
DATABASE_URL=sqlite:plan.db?mode=rwc
PORT=4000
```

- [ ] **Step 4: Create `src/lib.rs`**

Create `backend/src/lib.rs`:
```rust
pub mod api;
pub mod db;
pub mod error;
pub mod models;
```

- [ ] **Step 5: Create `src/main.rs`**

Create `backend/src/main.rs`:
```rust
use plan_backend::{api, db};
use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let pool = db::init_pool().await;
    let api_routes = api::router(pool);

    let spa_service =
        ServeDir::new("static").not_found_service(ServeFile::new("static/index.html"));

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .fallback_service(spa_service);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("PLAN service listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [ ] **Step 6: Create stub modules so it compiles**

Create `backend/src/db.rs`:
```rust
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

pub async fn init_pool() -> SqlitePool {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:plan.db?mode=rwc".to_string());

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

Create `backend/src/error.rs`:
```rust
use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
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
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

Create `backend/src/models.rs`:
```rust
// Models will be added in Task 3
```

Create `backend/src/api/mod.rs`:
```rust
use axum::Router;
use sqlx::SqlitePool;

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
}
```

- [ ] **Step 7: Create empty migration directory**

```bash
mkdir -p /home/bbaldino/work/plan/backend/migrations
touch /home/bbaldino/work/plan/backend/migrations/.gitkeep
```

- [ ] **Step 8: Verify it compiles**

```bash
cd /home/bbaldino/work/plan/backend
cargo check
```

- [ ] **Step 9: Initialize git and commit**

```bash
cd /home/bbaldino/work/plan
git init
echo "target/" > .gitignore
echo "*.db" >> .gitignore
echo "*.db-journal" >> .gitignore
echo "*.db-shm" >> .gitignore
echo "*.db-wal" >> .gitignore
echo ".env" >> .gitignore
echo "static/" >> .gitignore
echo "node_modules/" >> .gitignore
echo ".superpowers/" >> .gitignore
git add -A
git commit -m "feat: initialize PLAN backend project scaffold"
```

---

### Task 2: Database migration

**Files:**
- Create: `backend/migrations/001_initial.sql`

- [ ] **Step 1: Create the migration with all tables and triggers**

Create `backend/migrations/001_initial.sql`:
```sql
-- Plans
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trip', 'event', 'project')),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Items
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'researching', 'option', 'confirmed', 'completed', 'cancelled')),
  cost REAL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  url TEXT,
  start_at TEXT,
  start_tz TEXT,
  end_at TEXT,
  end_tz TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklists
CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Guests
CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'maybe')),
  plus_ones INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notes
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- updated_at triggers
CREATE TRIGGER plans_updated_at AFTER UPDATE ON plans
  BEGIN UPDATE plans SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER items_updated_at AFTER UPDATE ON items
  BEGIN UPDATE items SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER checklists_updated_at AFTER UPDATE ON checklists
  BEGIN UPDATE checklists SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER guests_updated_at AFTER UPDATE ON guests
  BEGIN UPDATE guests SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER notes_updated_at AFTER UPDATE ON notes
  BEGIN UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Indexes
CREATE INDEX idx_items_plan_id ON items(plan_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_start_at ON items(start_at);
CREATE INDEX idx_checklists_plan_id ON checklists(plan_id);
CREATE INDEX idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX idx_guests_plan_id ON guests(plan_id);
CREATE INDEX idx_notes_plan_id ON notes(plan_id);
CREATE INDEX idx_notes_item_id ON notes(item_id);
```

- [ ] **Step 2: Verify migration runs**

```bash
cd /home/bbaldino/work/plan/backend
cargo run
```

The server should start and create `plan.db` with all tables. Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/migrations/
git commit -m "feat: add initial database migration with all tables"
```

---

### Task 3: Models — Plan, Item, ItemData enum

**Files:**
- Modify: `backend/src/models.rs`

- [ ] **Step 1: Define all model types**

Replace `backend/src/models.rs` with the full model definitions. This file defines:

- `Plan` + `PlanType` + `PlanStatus` enums
- `CreatePlan` / `UpdatePlan` request types
- `Item` / `ItemRow` + `CreateItem` / `UpdateItem` request types
- `Checklist`, `ChecklistItem`, `Guest`, `Note` and their create/update request types
- Serde + sqlx derives for database mapping
- Query filter and reorder types

Key design decisions:
- Item `data` is stored and transmitted as `serde_json::Value` — the JSON blob is opaque at the DB/API layer. The frontend and agent are responsible for populating the correct fields per category (see spec's "Item Type Schemas" for field lists). This keeps the backend simple and avoids needing to update Rust types when adding new item categories.
- `sqlx::FromRow` on database row types; API response types are separate where needed (e.g., `ItemRow` → `Item` conversion parses the JSON string)
- UUIDs generated via `uuid::Uuid::new_v4().to_string()`

```rust
use serde::{Deserialize, Serialize};

// ─── Plan ───

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "camelCase")]
#[sqlx(rename_all = "lowercase")]
pub enum PlanType {
    Trip,
    Event,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "camelCase")]
#[sqlx(rename_all = "lowercase")]
pub enum PlanStatus {
    Planning,
    Active,
    Completed,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: String,
    pub name: String,
    #[sqlx(rename = "type")]
    pub plan_type: String,
    pub status: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlan {
    pub name: String,
    #[serde(rename = "type")]
    pub plan_type: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlan {
    pub name: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

// ─── Item ───

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ItemRow {
    pub id: String,
    pub plan_id: String,
    pub category: String,
    pub name: String,
    pub status: String,
    pub cost: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub url: Option<String>,
    pub start_at: Option<String>,
    pub start_tz: Option<String>,
    pub end_at: Option<String>,
    pub end_tz: Option<String>,
    pub data: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// API response for items — includes parsed data
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub plan_id: String,
    pub category: String,
    pub name: String,
    pub status: String,
    pub cost: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub url: Option<String>,
    pub start_at: Option<String>,
    pub start_tz: Option<String>,
    pub end_at: Option<String>,
    pub end_tz: Option<String>,
    pub data: serde_json::Value,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ItemRow> for Item {
    fn from(row: ItemRow) -> Self {
        let data = serde_json::from_str(&row.data).unwrap_or(serde_json::json!({}));
        Self {
            id: row.id,
            plan_id: row.plan_id,
            category: row.category,
            name: row.name,
            status: row.status,
            cost: row.cost,
            currency: row.currency,
            notes: row.notes,
            url: row.url,
            start_at: row.start_at,
            start_tz: row.start_tz,
            end_at: row.end_at,
            end_tz: row.end_tz,
            data,
            sort_order: row.sort_order,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItem {
    pub category: String,
    pub name: String,
    pub status: Option<String>,
    pub cost: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub url: Option<String>,
    pub start_at: Option<String>,
    pub start_tz: Option<String>,
    pub end_at: Option<String>,
    pub end_tz: Option<String>,
    pub data: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItem {
    pub name: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub cost: Option<f64>,
    pub currency: Option<String>,
    pub notes: Option<String>,
    pub url: Option<String>,
    pub start_at: Option<String>,
    pub start_tz: Option<String>,
    pub end_at: Option<String>,
    pub end_tz: Option<String>,
    pub data: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderRequest {
    pub items: Vec<ReorderEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderEntry {
    pub id: String,
    pub sort_order: i32,
}

// ─── Checklist ───

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistRow {
    pub id: String,
    pub plan_id: String,
    pub name: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItemRow {
    pub id: String,
    pub checklist_id: String,
    pub text: String,
    pub completed: bool,
    pub sort_order: i32,
    pub created_at: String,
}

/// Checklist with nested items for API response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Checklist {
    pub id: String,
    pub plan_id: String,
    pub name: String,
    pub sort_order: i32,
    pub items: Vec<ChecklistItemRow>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChecklist {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChecklist {
    pub name: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChecklistItem {
    pub text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChecklistItem {
    pub text: Option<String>,
    pub completed: Option<bool>,
}

// ─── Guest ───

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Guest {
    pub id: String,
    pub plan_id: String,
    pub name: String,
    pub email: Option<String>,
    pub rsvp_status: String,
    pub plus_ones: i32,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGuest {
    pub name: String,
    pub email: Option<String>,
    pub rsvp_status: Option<String>,
    pub plus_ones: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGuest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub rsvp_status: Option<String>,
    pub plus_ones: Option<i32>,
    pub notes: Option<String>,
}

// ─── Note ───

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub plan_id: String,
    pub item_id: Option<String>,
    pub title: Option<String>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNote {
    pub item_id: Option<String>,
    pub title: Option<String>,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNote {
    pub title: Option<String>,
    pub body: Option<String>,
}

// ─── Query params ───

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanFilters {
    #[serde(rename = "type")]
    pub plan_type: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemFilters {
    pub status: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpcomingQuery {
    pub days: Option<i64>,
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 3: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/models.rs
git commit -m "feat: add all model types (Plan, Item, Checklist, Guest, Note)"
```

---

### Task 4: Plans API (CRUD + upcoming)

**Files:**
- Create: `backend/src/api/plans.rs`
- Modify: `backend/src/api/mod.rs`

- [ ] **Step 1: Implement plans API**

Create `backend/src/api/plans.rs` with these handlers:

- `list_plans` — `GET /plans` with optional `?type=` and `?status=` query filters
- `create_plan` — `POST /plans` (generates UUID, validates type)
- `upcoming_plans` — `GET /plans/upcoming?days=30` (enriched response with checklist progress, next itinerary item, item counts — see spec for full response shape)
- `get_plan` — `GET /plans/:id` (returns plan with summary counts: total items, confirmed items, checklist progress)
- `update_plan` — `PUT /plans/:id` (partial update — only provided fields change)
- `delete_plan` — `DELETE /plans/:id`

All handlers take `State(pool): State<SqlitePool>` and return `Result<Json<...>, AppError>`.

For `upcoming_plans`, the enriched response includes:
```rust
struct UpcomingPlan {
    // all Plan fields, plus:
    checklist_progress: Option<ChecklistProgress>,  // { total, completed }
    next_itinerary_item: Option<NextItineraryItem>, // { name, category, start_at, start_tz }
    item_counts: ItemCounts,  // { confirmed, ideas }
}
```

These summary structs can be defined in this file or in `models.rs`.

- [ ] **Step 2: Wire up the router**

Update `backend/src/api/mod.rs`:
```rust
pub mod plans;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new().nest("/plans", plans::router(pool))
}
```

In `plans.rs`, define the router function:
```rust
pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/", get(list_plans).post(create_plan))
        .route("/upcoming", get(upcoming_plans))
        .route("/{id}", get(get_plan).put(update_plan).delete(delete_plan))
        .with_state(pool)
}
```

Note: `/upcoming` is registered before `/{id}` to avoid route conflicts.

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Test with curl**

```bash
cd /home/bbaldino/work/plan/backend
cargo run &
sleep 2

# Create a trip
curl -s -X POST http://localhost:4000/api/plans \
  -H "Content-Type: application/json" \
  -d '{"name":"Hawaii 2026","type":"trip","startDate":"2026-06-15","endDate":"2026-06-22"}' | python3 -m json.tool

# List plans
curl -s http://localhost:4000/api/plans | python3 -m json.tool

# Get upcoming
curl -s "http://localhost:4000/api/plans/upcoming?days=365" | python3 -m json.tool

kill %1
```

- [ ] **Step 5: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/api/
git commit -m "feat: add Plans API (CRUD + upcoming endpoint)"
```

---

### Task 5: Items API (CRUD + reorder + itinerary)

**Files:**
- Create: `backend/src/api/items.rs`
- Modify: `backend/src/api/mod.rs`

- [ ] **Step 1: Implement items API**

Create `backend/src/api/items.rs` with these handlers:

- `list_items` — `GET /plans/:id/items` with optional `?status=` and `?category=` filters. Returns items as `Vec<Item>` (with parsed `data` JSON).
- `create_item` — `POST /plans/:id/items` (generates UUID, validates plan exists, stores `data` as JSON string)
- `reorder_items` — `PATCH /plans/:id/items/reorder` (accepts `ReorderRequest` with array of `{id, sortOrder}`)
- `get_item` — `GET /plans/:id/items/:itemId`
- `update_item` — `PUT /plans/:id/items/:itemId` (partial update)
- `delete_item` — `DELETE /plans/:id/items/:itemId`
- `get_itinerary` — `GET /plans/:id/itinerary` (returns items that have `start_at` set, grouped by date, sorted by time)

For `get_itinerary`, the response groups items by day:
```rust
struct ItineraryDay {
    date: String,        // "2026-06-15"
    day_label: String,   // "Sun, Jun 15"
    items: Vec<Item>,
}
```

- [ ] **Step 2: Register items routes**

Update `backend/src/api/mod.rs` to add:
```rust
pub mod items;
```

In `plans.rs` router, nest the items routes:
```rust
pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/", get(list_plans).post(create_plan))
        .route("/upcoming", get(upcoming_plans))
        .route("/{id}", get(get_plan).put(update_plan).delete(delete_plan))
        .route("/{id}/items", get(items::list_items).post(items::create_item))
        .route("/{id}/items/reorder", patch(items::reorder_items))
        .route("/{id}/items/{item_id}", get(items::get_item).put(items::update_item).delete(items::delete_item))
        .route("/{id}/itinerary", get(items::get_itinerary))
        .with_state(pool)
}
```

Note: `/items/reorder` is registered before `/items/{item_id}`.

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Test with curl**

```bash
cd /home/bbaldino/work/plan/backend
cargo run &
sleep 2

# Get plan ID from previous test (or create a new one)
PLAN_ID=$(curl -s http://localhost:4000/api/plans | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Create a flight item
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/items" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "flight",
    "name": "SFO to HNL",
    "status": "confirmed",
    "startAt": "2026-06-15T21:00:00Z",
    "startTz": "America/Los_Angeles",
    "endAt": "2026-06-16T01:30:00Z",
    "endTz": "Pacific/Honolulu",
    "data": {"airline": "Hawaiian Airlines", "flightNumber": "HA101", "departureAirport": "SFO", "arrivalAirport": "HNL"}
  }' | python3 -m json.tool

# Create a restaurant idea
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"category": "restaurant", "name": "Dukes Waikiki", "status": "idea"}' | python3 -m json.tool

# List items
curl -s "http://localhost:4000/api/plans/$PLAN_ID/items" | python3 -m json.tool

# Get itinerary
curl -s "http://localhost:4000/api/plans/$PLAN_ID/itinerary" | python3 -m json.tool

kill %1
```

- [ ] **Step 5: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/api/
git commit -m "feat: add Items API (CRUD + reorder + itinerary view)"
```

---

## Chunk 2: Remaining API Resources

### Task 6: Checklists API

**Files:**
- Create: `backend/src/api/checklists.rs`
- Modify: `backend/src/api/mod.rs`
- Modify: `backend/src/api/plans.rs` (add routes)

- [ ] **Step 1: Implement checklists API**

Create `backend/src/api/checklists.rs` with handlers:

- `list_checklists` — `GET /plans/:id/checklists` (returns checklists with nested items)
- `create_checklist` — `POST /plans/:id/checklists`
- `update_checklist` — `PUT /plans/:id/checklists/:clId` (rename, reorder)
- `delete_checklist` — `DELETE /plans/:id/checklists/:clId`
- `create_checklist_item` — `POST /plans/:id/checklists/:clId/items`
- `reorder_checklist_items` — `PATCH /plans/:id/checklists/:clId/items/reorder`
- `update_checklist_item` — `PUT /plans/:id/checklists/:clId/items/:i` (toggle completed, edit text)
- `delete_checklist_item` — `DELETE /plans/:id/checklists/:clId/items/:i`

For `list_checklists`, fetch all checklists for the plan, then fetch all checklist_items for those checklists, and nest them in the response. This is two queries, not N+1.

- [ ] **Step 2: Register routes in plans.rs**

Add checklist routes to the plans router. The checklist item routes nest under `/{id}/checklists/{cl_id}/items`.

- [ ] **Step 3: Format, verify, test with curl**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

Test creating a checklist, adding items, toggling completion.

- [ ] **Step 4: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/api/
git commit -m "feat: add Checklists API (CRUD + items + reorder)"
```

---

### Task 7: Guests API

**Files:**
- Create: `backend/src/api/guests.rs`
- Modify: `backend/src/api/mod.rs`
- Modify: `backend/src/api/plans.rs` (add routes)

- [ ] **Step 1: Implement guests API**

Create `backend/src/api/guests.rs` with handlers:

- `list_guests` — `GET /plans/:id/guests`
- `create_guest` — `POST /plans/:id/guests`
- `update_guest` — `PUT /plans/:id/guests/:gId` (update RSVP, notes, etc.)
- `delete_guest` — `DELETE /plans/:id/guests/:gId`

Straightforward CRUD — simplest of all the resources.

- [ ] **Step 2: Register module and routes**

Add `pub mod guests;` to `backend/src/api/mod.rs`.

Add guest routes to the plans router in `plans.rs`:
```rust
.route("/{id}/guests", get(guests::list_guests).post(guests::create_guest))
.route("/{id}/guests/{guest_id}", put(guests::update_guest).delete(guests::delete_guest))
```

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/api/
git commit -m "feat: add Guests API (CRUD)"
```

---

### Task 8: Notes API

**Files:**
- Create: `backend/src/api/notes.rs`
- Modify: `backend/src/api/mod.rs`
- Modify: `backend/src/api/plans.rs` (add routes)

- [ ] **Step 1: Implement notes API**

Create `backend/src/api/notes.rs` with handlers:

- `list_notes` — `GET /plans/:id/notes` (returns all notes for the plan, both plan-level and item-level)
- `create_note` — `POST /plans/:id/notes` (item_id optional in body)
- `update_note` — `PUT /plans/:id/notes/:nId`
- `delete_note` — `DELETE /plans/:id/notes/:nId`

- [ ] **Step 2: Register module and routes**

Add `pub mod notes;` to `backend/src/api/mod.rs`.

Add note routes to the plans router in `plans.rs`:
```rust
.route("/{id}/notes", get(notes::list_notes).post(notes::create_note))
.route("/{id}/notes/{note_id}", put(notes::update_note).delete(notes::delete_note))
```

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/plan/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Commit**

```bash
cd /home/bbaldino/work/plan
git add backend/src/api/
git commit -m "feat: add Notes API (CRUD)"
```

---

### Task 9: Backend verification — full API smoke test

- [ ] **Step 1: Start the server and run through all endpoints**

```bash
cd /home/bbaldino/work/plan/backend
cargo run &
sleep 2

# Create a trip
PLAN=$(curl -s -X POST http://localhost:4000/api/plans \
  -H "Content-Type: application/json" \
  -d '{"name":"Hawaii 2026","type":"trip","startDate":"2026-06-15","endDate":"2026-06-22"}')
PLAN_ID=$(echo $PLAN | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Add items
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"category":"flight","name":"SFO → HNL","status":"confirmed","startAt":"2026-06-15T21:00:00Z","startTz":"America/Los_Angeles","data":{"airline":"Hawaiian","flightNumber":"HA101","departureAirport":"SFO","arrivalAirport":"HNL"}}'

# Add checklist
CL=$(curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/checklists" \
  -H "Content-Type: application/json" \
  -d '{"name":"Packing"}')
CL_ID=$(echo $CL | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Add checklist items
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/checklists/$CL_ID/items" \
  -H "Content-Type: application/json" -d '{"text":"Sunscreen"}'
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/checklists/$CL_ID/items" \
  -H "Content-Type: application/json" -d '{"text":"Swimsuit"}'

# Add note
curl -s -X POST "http://localhost:4000/api/plans/$PLAN_ID/notes" \
  -H "Content-Type: application/json" \
  -d '{"title":"Travel tips","body":"Remember to check in 24h before flight"}'

# Verify upcoming includes enriched data
curl -s "http://localhost:4000/api/plans/upcoming?days=365" | python3 -m json.tool

# Verify itinerary
curl -s "http://localhost:4000/api/plans/$PLAN_ID/itinerary" | python3 -m json.tool

# Verify checklists with items
curl -s "http://localhost:4000/api/plans/$PLAN_ID/checklists" | python3 -m json.tool

kill %1
```

- [ ] **Step 2: Fix any issues found during smoke test**

- [ ] **Step 3: Commit any fixes**

```bash
cd /home/bbaldino/work/plan
git add -A
git commit -m "fix: backend API smoke test fixes"
```

---

## Chunk 3: Frontend + Dashboard Widget

### Task 10: Initialize React frontend

**Files:**
- Create: `frontend/` project via Vite

- [ ] **Step 1: Scaffold Vite React TypeScript project**

```bash
cd /home/bbaldino/work/plan
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Add dependencies**

```bash
cd /home/bbaldino/work/plan/frontend
npm install @tanstack/react-query react-router-dom lucide-react
npm install -D @tailwindcss/vite
```

- [ ] **Step 3: Configure Vite**

Replace `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
})
```

- [ ] **Step 4: Set up Tailwind CSS**

Replace `frontend/src/index.css`:
```css
@import 'tailwindcss';
```

- [ ] **Step 5: Set up TypeScript path alias**

Add to `frontend/tsconfig.json` (or `tsconfig.app.json` if Vite creates that):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd /home/bbaldino/work/plan/frontend
npm run dev
```

Should start on port 5173. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
cd /home/bbaldino/work/plan
git add frontend/
git commit -m "feat: initialize React frontend with Vite + Tailwind + TanStack Query"
```

---

### Task 11: TypeScript types + API client

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Define TypeScript types**

Create `frontend/src/types.ts` mirroring the backend models. All the types the UI needs: `Plan`, `Item`, `Checklist`, `ChecklistItem`, `Guest`, `Note`, `UpcomingPlan`, plus create/update request types and filter types.

- [ ] **Step 2: Create API client**

Create `frontend/src/api/client.ts` with typed fetch functions for every endpoint:

```typescript
const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

export const api = {
  plans: {
    list: (filters?: { type?: string; status?: string }) => ...,
    create: (data: CreatePlan) => ...,
    get: (id: string) => ...,
    update: (id: string, data: UpdatePlan) => ...,
    delete: (id: string) => ...,
    upcoming: (days?: number) => ...,
  },
  items: {
    list: (planId: string, filters?: { status?: string; category?: string }) => ...,
    create: (planId: string, data: CreateItem) => ...,
    get: (planId: string, itemId: string) => ...,
    update: (planId: string, itemId: string, data: UpdateItem) => ...,
    delete: (planId: string, itemId: string) => ...,
    reorder: (planId: string, items: { id: string; sortOrder: number }[]) => ...,
    itinerary: (planId: string) => ...,
  },
  checklists: {
    list: (planId: string) => ...,
    create: (planId: string, data: CreateChecklist) => ...,
    update: (planId: string, clId: string, data: UpdateChecklist) => ...,
    delete: (planId: string, clId: string) => ...,
    addItem: (planId: string, clId: string, data: CreateChecklistItem) => ...,
    reorderItems: (planId: string, clId: string, items: { id: string; sortOrder: number }[]) => ...,
    updateItem: (planId: string, clId: string, itemId: string, data: UpdateChecklistItem) => ...,
    deleteItem: (planId: string, clId: string, itemId: string) => ...,
  },
  guests: {
    list: (planId: string) => ...,
    create: (planId: string, data: CreateGuest) => ...,
    update: (planId: string, guestId: string, data: UpdateGuest) => ...,
    delete: (planId: string, guestId: string) => ...,
  },
  notes: {
    list: (planId: string) => ...,
    create: (planId: string, data: CreateNote) => ...,
    update: (planId: string, noteId: string, data: UpdateNote) => ...,
    delete: (planId: string, noteId: string) => ...,
  },
}
```

Fill out every method as typed `request<T>()` calls.

- [ ] **Step 3: Verify it compiles**

```bash
cd /home/bbaldino/work/plan/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /home/bbaldino/work/plan
git add frontend/src/types.ts frontend/src/api/
git commit -m "feat: add TypeScript types and API client"
```

---

### Task 12: App shell — Router + Sidebar + PlanDetail

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/PlanDetail.tsx`
- Create: `frontend/src/components/PlanHeader.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Set up App with router and layout**

Create `frontend/src/App.tsx`:
- `QueryClientProvider` wrapping everything
- `BrowserRouter` with routes
- Main layout: sidebar (fixed width) + content area (flex-1)
- Route: `/` shows empty state ("Select a plan"), `/plans/:id` shows `PlanDetail`

- [ ] **Step 2: Create Sidebar**

Create `frontend/src/components/Sidebar.tsx`:
- Fetches plans via `useQuery` calling `api.plans.list()`
- Groups by type (Trips, Events, Projects) with colored section headers
- Each plan is a `NavLink` to `/plans/:id`
- "New Plan" button at bottom — opens a simple form/modal to create a plan (name + type)
- Active plan highlighted

- [ ] **Step 3: Create PlanHeader**

Create `frontend/src/components/PlanHeader.tsx`:
- Shows plan name (editable inline), type badge, status dropdown, date range
- Uses `api.plans.update()` on changes

- [ ] **Step 4: Create PlanDetail with tabs**

Create `frontend/src/components/PlanDetail.tsx`:
- Gets `planId` from route params
- Fetches plan via `useQuery`
- Renders `PlanHeader` + tab bar
- Tabs depend on plan type (see spec's tab matrix)
- Each tab renders placeholder content for now — real tab components come in Task 13

- [ ] **Step 5: Update main.tsx**

Wire up `App` as the root component with `BrowserRouter`.

- [ ] **Step 6: Verify it works**

Start backend (`cargo run` in backend/) and frontend (`npm run dev` in frontend/). Navigate to `http://localhost:5173`, create a plan via the sidebar, verify it appears and selecting it shows the detail view with tabs.

- [ ] **Step 7: Commit**

```bash
cd /home/bbaldino/work/plan
git add frontend/src/
git commit -m "feat: add app shell with sidebar navigation and plan detail view"
```

---

### Task 13: Tab components — Items, Itinerary, Checklists, Notes, Guests

**Files:**
- Create: `frontend/src/components/tabs/ItemsTab.tsx`
- Create: `frontend/src/components/tabs/ItineraryTab.tsx`
- Create: `frontend/src/components/tabs/ChecklistsTab.tsx`
- Create: `frontend/src/components/tabs/NotesTab.tsx`
- Create: `frontend/src/components/tabs/GuestsTab.tsx`
- Create: `frontend/src/components/ItemForm.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Modal.tsx`
- Create: `frontend/src/components/ui/ProgressBar.tsx`
- Modify: `frontend/src/components/PlanDetail.tsx` (wire in real tabs)

- [ ] **Step 1: Create shared UI components**

Create `Badge.tsx` (status/category colored badges), `Modal.tsx` (reusable overlay), `ProgressBar.tsx` (checklist completion bar).

- [ ] **Step 2: Create ItemForm**

Create `frontend/src/components/ItemForm.tsx`:
- Used for both create and edit
- Category selector that reveals category-specific fields
- Common fields: name, status, cost, notes, url, start_at/tz, end_at/tz
- Category-specific fields rendered based on selected category (Flight shows airport fields, Hotel shows check-in/out, etc.)
- Renders in a Modal

- [ ] **Step 3: Create ItemsTab**

Create `frontend/src/components/tabs/ItemsTab.tsx`:
- Fetches items via `useQuery` calling `api.items.list(planId)`
- Filter bar: category dropdown + status dropdown
- Item list with: category icon, name, status badge, cost, key detail from `data` (e.g., airline for flights)
- Click item to open edit form in modal
- "Add Item" button opens create form
- Delete button per item

- [ ] **Step 4: Create ItineraryTab**

Create `frontend/src/components/tabs/ItineraryTab.tsx`:
- Fetches via `api.items.itinerary(planId)`
- Renders day groups with date headers
- Each item shows: category icon, time (in local tz), name, key details
- Items without `start_at` not shown (they're in Items tab)

- [ ] **Step 5: Create ChecklistsTab**

Create `frontend/src/components/tabs/ChecklistsTab.tsx`:
- Fetches via `api.checklists.list(planId)`
- Each checklist: name header + progress bar + item list
- Items are toggleable checkboxes
- "Add item" inline input at bottom of each checklist
- "New Checklist" button
- Delete checklist/item buttons

- [ ] **Step 6: Create NotesTab**

Create `frontend/src/components/tabs/NotesTab.tsx`:
- Fetches via `api.notes.list(planId)`
- Chronological list of notes
- Each note: title (if present), body, timestamp
- Inline create form at top
- Edit/delete per note

- [ ] **Step 7: Create GuestsTab**

Create `frontend/src/components/tabs/GuestsTab.tsx`:
- Fetches via `api.guests.list(planId)`
- Summary counts at top: N invited, N accepted, N declined, N pending
- Table: name, email, RSVP status (dropdown to change), plus-ones, notes
- "Add Guest" button
- Delete per guest

- [ ] **Step 8: Wire tabs into PlanDetail**

Update `PlanDetail.tsx` to render the real tab components instead of placeholders.

- [ ] **Step 9: End-to-end test**

Start both servers. Create a trip, add items (flight, hotel, restaurant), create a checklist with items, add notes. Verify everything renders and updates correctly.

- [ ] **Step 10: Commit**

```bash
cd /home/bbaldino/work/plan
git add frontend/src/
git commit -m "feat: add all tab components (Items, Itinerary, Checklists, Notes, Guests)"
```

---

### Task 14: Dashboard widget integration

**Files:**
- Create: `dashboard/frontend/src/integrations/plan/config.ts`
- Create: `dashboard/frontend/src/integrations/plan/usePlanWidget.ts`
- Create: `dashboard/frontend/src/integrations/plan/PlanWidget.tsx`
- Create: `dashboard/frontend/src/integrations/plan/index.ts`
- Modify: `dashboard/frontend/src/integrations/registry.ts`
- Modify: `dashboard/frontend/src/boards/HomeBoard.tsx`

Note: This task modifies the **dashboard** project at `/home/bbaldino/work/dashboard/`, not the PLAN project.

- [ ] **Step 1: Create plan integration config**

Create `dashboard/frontend/src/integrations/plan/config.ts`:
```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const planIntegration = defineIntegration({
  id: 'plan',
  name: 'PLAN',
  hasBackend: false,
  schema: z.object({
    service_url: z.string().optional().default('http://localhost:4000'),
  }),
  fields: {
    service_url: { label: 'PLAN Service URL', description: 'URL of the PLAN service' },
  },
})
```

- [ ] **Step 2: Create hook**

Create `dashboard/frontend/src/integrations/plan/usePlanWidget.ts`:
- Use `useIntegrationConfig(planIntegration)` to get `service_url` (see existing integrations like `useCountdowns` for this pattern)
- Fetches from `${serviceUrl}/api/plans/upcoming?days=30`
- Uses `usePolling` with 5 minute interval
- Returns upcoming plans with checklist progress, next itinerary item, item counts

- [ ] **Step 3: Create widget**

Create `dashboard/frontend/src/integrations/plan/PlanWidget.tsx`:
- Shows upcoming trips/events as cards
- Each card: plan name, type icon, countdown ("in 23 days"), checklist progress bar, next itinerary item
- Compact design to fit in dashboard grid

- [ ] **Step 4: Create barrel export**

Create `dashboard/frontend/src/integrations/plan/index.ts`:
```typescript
export { planIntegration } from './config'
export { PlanWidget } from './PlanWidget'
```

- [ ] **Step 5: Register and wire into HomeBoard**

Add `import { planIntegration } from './plan/config'` to `registry.ts` and add to the array.

Add `<PlanWidget />` to HomeBoard grid (replacing or alongside the grocery placeholder).

- [ ] **Step 6: Verify on dashboard**

Start PLAN service, start dashboard. Verify widget appears with upcoming plan data.

- [ ] **Step 7: Commit (in dashboard repo)**

```bash
cd /home/bbaldino/work/dashboard
git add frontend/src/integrations/plan/ frontend/src/integrations/registry.ts frontend/src/boards/HomeBoard.tsx
git commit -m "feat: add PLAN dashboard widget"
```
