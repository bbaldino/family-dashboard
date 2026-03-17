# Chore Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured chore management system with people, tagged chores, meta-chores (bonus chore picker), weekly assignment grid, and dashboard widget.

**Architecture:** Replaces the existing simplified chore integration. Backend uses SQLite with new tables (people, chores, assignments). Frontend has a three-tab admin page (weekly assignments grid with drag-to-assign, manage chores, people management) and a dashboard widget showing today's chores with meta-chore picker. Follows the integration architecture pattern (scoped routes, IntegrationConfig, defineIntegration).

**Tech Stack:** Rust/Axum/SQLite (backend), React/TypeScript/Tailwind (frontend), dnd-kit for drag-and-drop

**Spec:** `docs/superpowers/specs/2026-03-16-chore-manager-design.md`

---

## File Structure

### Backend (replace existing `backend/src/integrations/chores/`)

```
backend/src/integrations/chores/
  mod.rs                    -- INTEGRATION_ID, router combining all sub-routers
  models.rs                 -- Person, Chore, Assignment structs + request/response types
  people.rs                 -- People CRUD routes
  chores_crud.rs            -- Chore CRUD + by-tags routes
  assignments.rs            -- Assignment CRUD + complete/uncomplete/pick/clear-pick
  weeks.rs                  -- Week copy/rotate + today endpoint
backend/migrations/
  004_chore_manager.sql     -- Drop old tables, create new ones
backend/tests/
  chores_test.rs            -- Updated integration tests
```

### Frontend (replace existing `frontend/src/integrations/chores/`)

```
frontend/src/integrations/chores/
  config.ts                 -- defineIntegration
  types.ts                  -- TypeScript interfaces matching backend models
  useChores.ts              -- Data hook for dashboard widget (calls /today)
  useAssignments.ts         -- Data hook for admin (calls /assignments?week=)
  ChoresWidget.tsx          -- Dashboard card widget
  MetaChorePicker.tsx       -- Bottom sheet for picking a bonus chore
  index.ts                  -- Barrel exports
frontend/src/admin/
  ChoreAdmin.tsx            -- Three-tab admin page (replaces existing)
  chore-admin/
    AssignmentsTab.tsx       -- Weekly assignment grid with drag-and-drop
    ChoresTab.tsx            -- Manage chores list
    PeopleTab.tsx            -- People management with color picker + avatar upload
    ChorePool.tsx            -- Draggable chore pool
    ColorPicker.tsx          -- Preset palette + custom color picker
```

---

## Chunk 1: Database Migration + Backend Models + People/Chore CRUD

### Task 1: Database migration

**Files:**
- Create: `backend/migrations/004_chore_manager.sql`

- [ ] **Step 1: Write migration**

```sql
-- backend/migrations/004_chore_manager.sql

-- Drop old chore tables
DROP TABLE IF EXISTS chore_completions;
DROP TABLE IF EXISTS chore_assignments;
DROP TABLE IF EXISTS chores;

-- Create new tables
CREATE TABLE people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#888888',
    avatar BLOB
);

CREATE TABLE chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    chore_type TEXT NOT NULL DEFAULT 'regular' CHECK (chore_type IN ('regular', 'meta')),
    tags TEXT NOT NULL DEFAULT '[]',
    pick_from_tags TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    week_of TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    picked_chore_id INTEGER REFERENCES chores(id) ON DELETE SET NULL,
    completed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_assignments_week ON assignments(week_of);
CREATE INDEX idx_assignments_person ON assignments(person_id);
```

- [ ] **Step 2: Delete old database and verify migration runs**

```bash
cd /home/bbaldino/work/dashboard/backend
rm -f dashboard.db
cargo run &
sleep 2
kill %1
# DB should be created with new schema
sqlite3 dashboard.db ".tables"
```
Expected: `assignments  chores  config  google_tokens  people`

- [ ] **Step 3: Re-inject saved config values** (Google tokens, calendar selection, weather API key — same values as before)

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/004_chore_manager.sql
git commit -m "feat: add chore manager migration with people, chores, assignments tables"
```

---

### Task 2: Backend models

**Files:**
- Replace: `backend/src/integrations/chores/models.rs`

- [ ] **Step 1: Write all model structs**

```rust
// backend/src/integrations/chores/models.rs
use serde::{Deserialize, Serialize};

// --- People ---

#[derive(Debug, Serialize, sqlx::FromRow)]
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
    pub avatar: Option<String>, // base64 data URL
}

impl From<PersonRow> for Person {
    fn from(row: PersonRow) -> Self {
        let avatar = row.avatar.map(|bytes| {
            format!("data:image/png;base64,{}", base64_encode(&bytes))
        });
        Self {
            id: row.id,
            name: row.name,
            color: row.color,
            avatar,
        }
    }
}

fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

// --- Chores ---

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Chore {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub chore_type: String,
    pub tags: String,           // JSON string
    pub pick_from_tags: String, // JSON string
}

#[derive(Debug, Deserialize)]
pub struct CreateChore {
    pub name: String,
    pub description: Option<String>,
    pub chore_type: Option<String>, // defaults to "regular"
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

// --- Assignments ---

#[derive(Debug, sqlx::FromRow)]
pub struct AssignmentRow {
    pub id: i64,
    pub chore_id: i64,
    pub person_id: i64,
    pub week_of: String,
    pub day_of_week: i32,
    pub picked_chore_id: Option<i64>,
    pub completed: bool,
    // Denormalized fields from JOINs
    pub chore_name: String,
    pub chore_type: String,
    pub chore_tags: String,
    pub person_name: String,
    pub person_color: String,
    pub picked_chore_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssignmentResponse {
    pub id: i64,
    pub chore: ChoreRef,
    pub person: PersonRef,
    pub week_of: String,
    pub day_of_week: i32,
    pub picked_chore: Option<ChoreRef>,
    pub completed: bool,
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
    pub avatar: Option<String>,
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

// --- Today response ---

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
```

Note: Add `base64` dependency: `cargo add base64`

- [ ] **Step 2: Verify compilation**

```bash
cargo build
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/chores/models.rs backend/Cargo.toml backend/Cargo.lock
git commit -m "feat: add chore manager models with people, chores, assignments"
```

---

### Task 3: People CRUD routes

**Files:**
- Create: `backend/src/integrations/chores/people.rs`
- Modify: `backend/src/integrations/chores/mod.rs`

- [ ] **Step 1: Implement people routes**

`GET /people` — list all, convert avatar blob to base64
`POST /people` — create (multipart form: name, color, optional avatar file)
`PUT /people/{id}` — update (multipart form)
`DELETE /people/{id}` — delete with cascade

For multipart handling, add: `cargo add axum-extra --features multipart`

The POST/PUT handlers use `axum::extract::Multipart` to receive form data with optional file upload.

- [ ] **Step 2: Register in mod.rs**

Update `backend/src/integrations/chores/mod.rs` to include the people router merged in.

- [ ] **Step 3: Verify compilation**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add people CRUD routes with avatar upload"
```

---

### Task 4: Chore CRUD routes

**Files:**
- Create: `backend/src/integrations/chores/chores_crud.rs`
- Modify: `backend/src/integrations/chores/mod.rs`

- [ ] **Step 1: Implement chore routes**

`GET /chores` — list all chores
`POST /chores` — create chore (JSON body: name, description, chore_type, tags, pick_from_tags). Tags/pick_from_tags are received as `Vec<String>` and stored as JSON strings.
`PUT /chores/{id}` — update chore
`DELETE /chores/{id}` — delete with cascade
`GET /chores/by-tags?tags=bonus,outdoor` — split comma-separated tags, query chores where any tag matches. Uses SQLite JSON functions or parses tags JSON in Rust.

- [ ] **Step 2: Register in mod.rs**

- [ ] **Step 3: Verify compilation**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add chore CRUD routes with tag filtering"
```

---

## Chunk 2: Backend Assignments + Week Management + Tests

### Task 5: Assignment CRUD + actions

**Files:**
- Create: `backend/src/integrations/chores/assignments.rs`
- Modify: `backend/src/integrations/chores/mod.rs`

- [ ] **Step 1: Implement assignment routes**

The core query for fetching assignments with denormalized data:

```sql
SELECT
    a.id, a.chore_id, a.person_id, a.week_of, a.day_of_week,
    a.picked_chore_id, a.completed,
    c.name as chore_name, c.chore_type, c.tags as chore_tags,
    p.name as person_name, p.color as person_color,
    pc.name as picked_chore_name
FROM assignments a
JOIN chores c ON c.id = a.chore_id
JOIN people p ON p.id = a.person_id
LEFT JOIN chores pc ON pc.id = a.picked_chore_id
WHERE a.week_of = ?
ORDER BY p.name, a.day_of_week
```

Endpoints:
- `GET /assignments?week=` — fetch and convert to `Vec<AssignmentResponse>`
- `POST /assignments` — create (JSON: chore_id, person_id, week_of, day_of_week)
- `DELETE /assignments/{id}` — delete
- `POST /assignments/{id}/complete` — set completed = 1
- `POST /assignments/{id}/uncomplete` — set completed = 0
- `POST /assignments/{id}/pick` — set picked_chore_id (JSON: chore_id)
- `POST /assignments/{id}/clear-pick` — set picked_chore_id = NULL

- [ ] **Step 2: Register in mod.rs**

- [ ] **Step 3: Verify compilation**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add assignment CRUD with complete/pick actions"
```

---

### Task 6: Week management + Today endpoint

**Files:**
- Create: `backend/src/integrations/chores/weeks.rs`
- Modify: `backend/src/integrations/chores/mod.rs`

- [ ] **Step 1: Implement week copy**

`POST /weeks/copy` — body: `{ from_week, to_week }`. Query all assignments for `from_week`, insert copies for `to_week` with `completed = 0` and `picked_chore_id = NULL`.

- [ ] **Step 2: Implement week rotate**

`POST /weeks/rotate` — body: `{ week }`. Get all people ordered by ID. For each assignment in the week, shift `person_id` to the next person in the ordered list (last person wraps to first).

- [ ] **Step 3: Implement /today**

`GET /today` — compute current week's Monday and today's day-of-week (0=Monday). Query assignments for that week+day, group by person, return `TodayResponse`.

```rust
let now = chrono::Local::now().naive_local().date();
let weekday = now.weekday().num_days_from_monday() as i32; // 0=Mon
let monday = now - chrono::Duration::days(weekday as i64);
let week_of = monday.format("%Y-%m-%d").to_string();
```

- [ ] **Step 4: Register in mod.rs**

- [ ] **Step 5: Verify compilation and test manually**

```bash
cargo build
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add week copy/rotate and today endpoint"
```

---

### Task 7: Backend tests

**Files:**
- Replace: `backend/tests/chores_test.rs`

- [ ] **Step 1: Write integration tests**

Tests covering:
1. Create person → list people → verify
2. Create chore with tags → list → verify
3. Create chore with type "meta" → get by-tags → verify
4. Create assignment → get assignments for week → verify response shape
5. Complete/uncomplete assignment
6. Meta-chore pick/clear-pick
7. Week copy — create assignments in week A, copy to week B, verify B has same chores but completed=false
8. Week rotate — create assignments for 2 people, rotate, verify person_ids swapped
9. Today endpoint — create assignment for today's day, verify it appears

- [ ] **Step 2: Run tests**

```bash
cargo test
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add chore manager integration tests"
```

---

## Chunk 3: Frontend Dashboard Widget

### Task 8: Frontend types and config

**Files:**
- Replace: `frontend/src/integrations/chores/types.ts`
- Replace: `frontend/src/integrations/chores/config.ts`

- [ ] **Step 1: Define TypeScript types matching backend**

```typescript
// frontend/src/integrations/chores/types.ts
export interface PersonRef {
  id: number
  name: string
  color: string
  avatar: string | null
}

export interface ChoreRef {
  id: number
  name: string
  chore_type: 'regular' | 'meta'
  tags: string[]
}

export interface TodayAssignment {
  id: number
  chore: ChoreRef
  picked_chore: ChoreRef | null
  completed: boolean
}

export interface PersonAssignments {
  person: PersonRef
  assignments: TodayAssignment[]
}

export interface TodayResponse {
  persons: PersonAssignments[]
  completed_count: number
  total_count: number
}

// For admin
export interface Person {
  id: number
  name: string
  color: string
  avatar: string | null
}

export interface Chore {
  id: number
  name: string
  description: string | null
  chore_type: 'regular' | 'meta'
  tags: string[]
  pick_from_tags: string[]
}

export interface AssignmentResponse {
  id: number
  chore: ChoreRef
  person: PersonRef
  week_of: string
  day_of_week: number
  picked_chore: ChoreRef | null
  completed: boolean
}
```

- [ ] **Step 2: Update config.ts** (empty schema, same as before)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add chore manager frontend types and config"
```

---

### Task 9: Dashboard widget + meta-chore picker

**Files:**
- Replace: `frontend/src/integrations/chores/useChores.ts`
- Replace: `frontend/src/integrations/chores/ChoresWidget.tsx`
- Create: `frontend/src/integrations/chores/MetaChorePicker.tsx`
- Replace: `frontend/src/integrations/chores/ChoresDetail.tsx` (remove — deferred)
- Modify: `frontend/src/integrations/chores/index.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Rewrite useChores hook**

Calls `/today` endpoint. Returns `TodayResponse` data plus action functions:
- `completeAssignment(id)` — POST `/assignments/{id}/complete`, refetch
- `uncompleteAssignment(id)` — POST `/assignments/{id}/uncomplete`, refetch
- `pickChore(assignmentId, choreId)` — POST `/assignments/{id}/pick`, refetch
- `clearPick(id)` — POST `/assignments/{id}/clear-pick`, refetch

Use TanStack Query with `queryKey: ['chores', 'today']`.

- [ ] **Step 2: Build ChoresWidget**

Grouped by person:
- Person avatar (image or color+initial) + name as section header
- Regular chores: checkbox + name
- Meta-chores (unpicked): "Pick a chore" button styled as a tappable chip
- Meta-chores (picked): checkbox + picked chore name + small "change" link
- Badge: "X of Y done"

WidgetCard with `title="Chores"`, `category="chores"`, `badge="3 of 7 done"`.

- [ ] **Step 3: Build MetaChorePicker**

Bottom sheet that shows when tapping "Pick a chore":
- Fetches chores by tags via `/chores/by-tags?tags=...`
- Shows list of matching chores as tappable items
- Tapping one calls `pickChore(assignmentId, choreId)` and closes
- "Clear" button at bottom to clear current pick

- [ ] **Step 4: Update HomeBoard**

Remove old chores imports, update to new `useChores` and `ChoresWidget`. The new widget handles its own data (calls `/today` internally via the hook), so HomeBoard just places `<ChoresWidget />` without passing props.

- [ ] **Step 5: Delete ChoresDetail.tsx** (deferred per spec)

- [ ] **Step 6: Update index.ts barrel**

- [ ] **Step 7: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git commit -m "feat: add chore manager dashboard widget with meta-chore picker"
```

---

## Chunk 4: Frontend Admin — People + Chores Tabs

### Task 10: People management tab

**Files:**
- Create: `frontend/src/admin/chore-admin/PeopleTab.tsx`
- Create: `frontend/src/admin/chore-admin/ColorPicker.tsx`

- [ ] **Step 1: Build ColorPicker component**

Row of 10 preset color circles:
```
#e88a6a #6a9aba #8a6aba #4a8a6a #ba6a8a
#c0a030 #4a7a9a #aa5a5a #5aaa8a #7a7a7a
```
Plus a "Custom" button that opens a native `<input type="color">`.

Selected color has a border/ring indicator.

- [ ] **Step 2: Build PeopleTab**

List of people with:
- Avatar (image or color+initial circle)
- Name
- Edit / Delete buttons

"Add Person" button opens inline form:
- Name text input
- ColorPicker
- Avatar upload (file input + preview)
- Save / Cancel buttons

Edit mode replaces the row with the same form, pre-filled.

Uses `choresIntegration.api` for CRUD. People POST/PUT use `FormData` (not JSON) for multipart upload. The scoped `api.post()` won't work directly for multipart — use raw `fetch` with the integration's URL prefix.

- [ ] **Step 3: Verify compilation**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add people management tab with color picker and avatar upload"
```

---

### Task 11: Chores management tab

**Files:**
- Create: `frontend/src/admin/chore-admin/ChoresTab.tsx`

- [ ] **Step 1: Build ChoresTab**

List of all chores:
- Name
- Tags as small pills
- Type badge ("meta" in blue if applicable)
- Edit / Delete buttons

"Add Chore" button opens inline form:
- Name text input
- Description text input (optional)
- Tags input (comma-separated, converts to chips on blur/enter)
- Type toggle: Regular / Meta
- If Meta: "Pick from tags" input (comma-separated)
- Save / Cancel buttons

Uses `choresIntegration.api` for CRUD (JSON).

- [ ] **Step 2: Verify compilation**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add chores management tab with tags and meta-chore support"
```

---

## Chunk 5: Frontend Admin — Weekly Assignments Tab

### Task 12: Assignment grid + chore pool with drag-and-drop

**Files:**
- Create: `frontend/src/admin/chore-admin/AssignmentsTab.tsx`
- Create: `frontend/src/admin/chore-admin/ChorePool.tsx`
- Replace: `frontend/src/admin/ChoreAdmin.tsx`

- [ ] **Step 1: Install dnd-kit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm install @dnd-kit/core @dnd-kit/utilities
```

- [ ] **Step 2: Build ChorePool**

Displays all chores as draggable chips. Uses `@dnd-kit/core`'s `useDraggable`. Chores stay in the pool when assigned (they don't disappear). Meta-chores styled with dashed blue border.

- [ ] **Step 3: Build AssignmentsTab**

Main layout:
- Week selector (left/right arrows + "Week of ..." label)
- Action buttons ("Copy from Last Week", "Rotate")
- Grid: people rows × day columns
  - Grid cells are `useDroppable` targets
  - When a chore is dropped on a cell → POST `/assignments` with chore_id, person_id, week_of, day_of_week
  - Each chip in a cell has a remove button → DELETE `/assignments/{id}`
- ChorePool below the grid

Uses `@dnd-kit/core`'s `DndContext`, `DragOverlay` for the drag preview.

Week navigation: fetches `/assignments?week=YYYY-MM-DD` for the selected week. Week defaults to current week's Monday.

"Copy from Last Week": computes previous Monday, calls POST `/weeks/copy` with `{ from_week: prevMonday, to_week: currentMonday }`, refetches.

"Rotate": calls POST `/weeks/rotate` with `{ week: currentMonday }`, refetches.

- [ ] **Step 4: Rewrite ChoreAdmin.tsx**

Three-tab layout matching the mockup:
- "Weekly Assignments" (default) → AssignmentsTab
- "Manage Chores" → ChoresTab
- "People" → PeopleTab

```tsx
import { useState } from 'react'
import { AssignmentsTab } from './chore-admin/AssignmentsTab'
import { ChoresTab } from './chore-admin/ChoresTab'
import { PeopleTab } from './chore-admin/PeopleTab'

const tabs = ['Weekly Assignments', 'Manage Chores', 'People'] as const

export function ChoreAdmin() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Weekly Assignments')

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-bg-card rounded-lg p-1 shadow-sm">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-calendar text-white' : 'text-text-secondary hover:bg-bg-card-hover'
            }`}
          >{tab}</button>
        ))}
      </div>

      {activeTab === 'Weekly Assignments' && <AssignmentsTab />}
      {activeTab === 'Manage Chores' && <ChoresTab />}
      {activeTab === 'People' && <PeopleTab />}
    </div>
  )
}
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Full build test**

```bash
cd /home/bbaldino/work/dashboard/backend && cargo build && cargo test
cd ../frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: add weekly assignments tab with drag-and-drop grid"
```
