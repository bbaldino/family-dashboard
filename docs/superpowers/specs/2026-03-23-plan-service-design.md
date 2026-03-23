# PLAN Service Design Spec

> **PLAN** — Projects, Logistics, Activities, Notes

A standalone self-hosted service for planning trips, events, and projects. Provides a web UI for visual planning, a REST API for agent and dashboard integration, and structured data models for common planning artifacts (flights, hotels, venues, checklists, itineraries).

## Goals

- Single service for organizing trips, events (birthday parties, etc.), and general projects
- Well-designed REST API that an agent can interact with as a tool (create plans, add items, update statuses, query upcoming plans)
- Web UI for visual planning sessions (comparing options, organizing itineraries, managing checklists)
- Dashboard widget for at-a-glance status (upcoming plans, checklist progress, next itinerary item)
- Timezone-aware timestamps throughout

## Architecture

### Tech Stack

- **Backend:** Rust, Axum, SQLite (via sqlx), reqwest
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Repo structure:** Monorepo with `backend/` and `frontend/` directories (same pattern as the dashboard)

### Deployment

Single Rust binary serves the API. Frontend is a React SPA (served by the binary in production as static files, or by Vite dev server in development). One repo, one binary.

### Consumers

Three consumers share the same REST API:

1. **Web UI** — full CRUD, all endpoints. Used for visual planning sessions.
2. **Dashboard widget** — read-only subset. Shows upcoming plans, checklist progress, next itinerary item. Calls the PLAN service directly (no agent/LLM involved).
3. **Agent** — reads and writes via REST. Parses forwarded emails into structured bookings, does research and proposes items, provides proactive reminders. Agent integration is external to this service — PLAN just exposes a good API.

---

## Data Model

### Plans

The top-level entity. Three types with a shared core.

```sql
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trip', 'event', 'project')),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  description TEXT,
  start_date TEXT,  -- ISO date, nullable (projects may be open-ended)
  end_date TEXT,    -- ISO date, nullable
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Items

Things within a plan. Has common columns for filtering/sorting plus a `data` JSON column for type-specific structured fields.

```sql
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
  start_at TEXT,   -- ISO datetime (UTC)
  start_tz TEXT,   -- IANA timezone, e.g. "America/Los_Angeles"
  end_at TEXT,     -- ISO datetime (UTC)
  end_tz TEXT,     -- IANA timezone
  data TEXT,       -- JSON blob with type-specific fields
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Category values:** `flight`, `hotel`, `restaurant`, `activity`, `transport`, `venue`, `catering`, `entertainment`, `decoration`, `rental`, `task`, `reference`, `generic`

**Status lifecycle:** `idea` → `researching` → `option` → `confirmed` → `completed` (or `cancelled` at any stage). Not every item needs every stage.

### Item Type Schemas (data JSON)

Each category has a Rust enum variant with typed fields. All fields within `data` are optional — items can start as just a name and get details filled in over time.

**Trip items:**

- **Flight:** airline, flight_number, departure_airport, arrival_airport, departure_at (UTC), departure_tz, arrival_at (UTC), arrival_tz, confirmation_number, seat, booking_url
- **Hotel:** property_name, address, check_in_date, check_out_date, check_in_time, confirmation_number, room_type, booking_url
- **Restaurant:** address, cuisine, reservation_at (UTC), reservation_tz, party_size, confirmation_number, booking_url, price_range
- **Activity:** address, duration_minutes, booking_url, confirmation_number, description
- **Transport:** transport_type (rental_car|train|bus|ferry|rideshare), provider, pickup_location, dropoff_location, pickup_at (UTC), pickup_tz, dropoff_at (UTC), dropoff_tz, confirmation_number, booking_url

**Event items:**

- **Venue:** address, capacity, contact_name, contact_phone, contact_email, booking_url
- **Catering:** provider, menu_notes, headcount, dietary_notes
- **Entertainment:** provider, description, duration_minutes
- **Decoration:** description, quantity
- **Rental:** provider, description, quantity, pickup_at (UTC), pickup_tz, return_at (UTC), return_tz

**Shared items (all plan types):**

- **Task:** priority (low|medium|high), due_date, assignee (freeform string)
- **Reference:** url, description, source
- **Generic:** serde_json::Value (freeform JSON)

In Rust, this maps to:

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ItemData {
    Flight { airline: Option<String>, flight_number: Option<String>, ... },
    Hotel { property_name: Option<String>, address: Option<String>, ... },
    // ... etc
    Generic(serde_json::Value),
}
```

### Timezone Handling

All timestamps stored as UTC in the database. An accompanying `_tz` column stores the IANA timezone string (e.g., `"Pacific/Honolulu"`) so the UI can display in local time. The timezone column is optional — only relevant for items where local time matters (flights, reservations).

This supports the common case of a flight departing SFO at 2:00 PM Pacific arriving HNL at 5:00 PM Hawaii time — both stored as UTC, displayed in their respective local times.

### Checklists

Named todo lists attached to a plan.

```sql
CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Guests (events only)

```sql
CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined', 'maybe')),
  plus_ones INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Notes

Freeform text attached to a plan or a specific item.

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## REST API

Single API consumed by all three consumers (web UI, dashboard widget, agent).

### Plans

```
GET    /api/plans                    -- list plans (?type=trip&status=planning)
POST   /api/plans                   -- create plan
GET    /api/plans/:id               -- get plan with summary counts
PUT    /api/plans/:id               -- update plan
DELETE /api/plans/:id               -- archive/delete plan
GET    /api/plans/upcoming?days=30  -- plans starting within N days (dashboard convenience)
```

### Items

```
GET    /api/plans/:id/items          -- list items (?status=idea&category=restaurant)
POST   /api/plans/:id/items          -- create item (category + optional data in body)
GET    /api/plans/:id/items/:itemId  -- get item with full details
PUT    /api/plans/:id/items/:itemId  -- update item
DELETE /api/plans/:id/items/:itemId  -- delete item
PATCH  /api/plans/:id/items/reorder  -- batch reorder (array of {id, sort_order})
```

### Itinerary (read-only view)

```
GET    /api/plans/:id/itinerary      -- items with start_at, grouped by day, sorted by time
```

Not a separate entity — items are placed on the itinerary by setting `start_at`/`end_at` via the items endpoint.

### Checklists

```
GET    /api/plans/:id/checklists              -- list checklists with items
POST   /api/plans/:id/checklists              -- create checklist
PUT    /api/plans/:id/checklists/:clId        -- rename/reorder
DELETE /api/plans/:id/checklists/:clId        -- delete checklist
POST   /api/plans/:id/checklists/:clId/items  -- add item
PUT    /api/plans/:id/checklists/:clId/items/:i -- toggle/edit item
DELETE /api/plans/:id/checklists/:clId/items/:i -- delete item
```

### Guests (events only)

```
GET    /api/plans/:id/guests         -- list guests
POST   /api/plans/:id/guests         -- add guest
PUT    /api/plans/:id/guests/:gId    -- update RSVP, notes
DELETE /api/plans/:id/guests/:gId    -- remove guest
```

### Notes

```
GET    /api/plans/:id/notes          -- list notes (plan-level + item-level)
POST   /api/plans/:id/notes          -- create note (item_id optional in body)
PUT    /api/plans/:id/notes/:nId     -- edit note
DELETE /api/plans/:id/notes/:nId     -- delete note
```

---

## Web UI

### Navigation

Sidebar navigation with persistent plan list, grouped by type (Trips, Events, Projects). Clicking a plan opens it in the main content area. Tabbed detail view within each plan.

### Plan Detail Tabs

Tabs shown depend on plan type:

| Tab | Trip | Event | Project |
|-----|------|-------|---------|
| Itinerary | ✓ | ✓ | — |
| Items | ✓ | ✓ | ✓ |
| Checklists | ✓ | ✓ | ✓ |
| Notes | ✓ | ✓ | ✓ |
| Guests | — | ✓ | — |

### Key Views

- **Itinerary tab:** Items with dates grouped by day, sorted by time. Shows item type icon, name, time, key details (airport codes, venue name, etc.).
- **Items tab:** All items for the plan, filterable by category and status. Shows status lifecycle badges. Click to expand/edit.
- **Checklists tab:** Named lists with toggleable items. Progress bar per list.
- **Notes tab:** Chronological list of notes. Can be filtered to plan-level or per-item.
- **Guests tab:** Table with name, email, RSVP status, plus-ones. Summary counts at top.

---

## Dashboard Widget

A dashboard integration (`hasBackend: false`) that calls the PLAN service directly, like the timers integration.

**Shows:**
- Upcoming trips/events with countdown
- Checklist progress for the nearest plan (e.g., "Packing: 3/12")
- Next itinerary item for active trips

**Calls:** `GET /api/plans/upcoming?days=30` and renders results.

**Independent from countdowns widget** — countdowns pulls from Google Calendar for general events; the PLAN widget shows plan-specific info.

---

## Deferred (V2+)

- Maps / POI visualization for trips
- User accounts / authentication
- Email parsing pipeline (agent concern)
- Agent research tools (agent concern)
- Evite / invitation integration
- Guest self-service RSVP (via shared link)
- Drag-and-drop itinerary reordering
- Budget tracking / cost rollup views
- Multi-destination trip routing
- Sharing / collaboration
- Mobile-optimized UI
