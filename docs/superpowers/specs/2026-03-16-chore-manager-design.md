# Chore Manager Design Spec

## Overview

Full-featured chore management system replacing the current simplified chore integration. Supports people with avatars, tagged chores, meta-chores (bonus chores where kids pick from a pool), weekly assignment grids with drag-to-assign, and week management helpers (copy/rotate).

## Data Model

### People

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Person's name |
| color | TEXT | Hex color for avatar fallback (e.g. `#e88a6a`) |
| avatar | BLOB | Optional uploaded image |

### Chores

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Chore name |
| description | TEXT | Optional description |
| chore_type | TEXT | `"regular"` or `"meta"` |
| tags | TEXT | JSON array of tag strings (e.g. `["bonus"]`) |
| pick_from_tags | TEXT | JSON array — for meta-chores, which tags to offer in picker |

### Assignments

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER PK | Auto-increment |
| chore_id | INTEGER FK | References chores(id) ON DELETE CASCADE |
| person_id | INTEGER FK | References people(id) ON DELETE CASCADE |
| week_of | TEXT | Monday date string (e.g. `"2026-03-16"`) |
| day_of_week | INTEGER | 0=Monday through 6=Sunday |
| picked_chore_id | INTEGER FK | Nullable — references chores(id), set when meta-chore pick is made |
| completed | INTEGER | 0 or 1 |

**Note:** `day_of_week` uses 0=Monday (unlike the old schema which used 0=Sunday). This is more natural for a week grid that starts on Monday.

## API Endpoints

All under `/api/chores/` (integration prefix).

### People

| Method | Path | Description |
|--------|------|-------------|
| GET | `/people` | List all people (with avatar as base64 data URL) |
| POST | `/people` | Create person (multipart/form-data: name, color, avatar file) |
| PUT | `/people/{id}` | Update person (multipart/form-data) |
| DELETE | `/people/{id}` | Delete person (cascades assignments) |

### Chores

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chores` | List all chores |
| POST | `/chores` | Create chore |
| PUT | `/chores/{id}` | Update chore |
| DELETE | `/chores/{id}` | Delete chore (cascades assignments) |
| GET | `/chores/by-tags?tags=bonus,outdoor` | Get chores matching any of the comma-separated tags |

### Assignments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/assignments?week=2026-03-16` | Get all assignments for a week (see response shape below) |
| POST | `/assignments` | Create assignment (chore_id, person_id, week_of, day_of_week) |
| DELETE | `/assignments/{id}` | Remove assignment |
| POST | `/assignments/{id}/complete` | Set completed = true |
| POST | `/assignments/{id}/uncomplete` | Set completed = false |
| POST | `/assignments/{id}/pick` | Set picked_chore_id (body: `{ chore_id }`) |
| POST | `/assignments/{id}/clear-pick` | Clear picked_chore_id |

### Week Management

| Method | Path | Description |
|--------|------|-------------|
| POST | `/weeks/copy` | Copy assignments from one week to another (body: `{ from_week, to_week }`) — copies chore_id, person_id, day_of_week; resets completed and picked_chore_id |
| POST | `/weeks/rotate` | Rotate person assignments for a week (body: `{ week }`) — shifts each person's assignments to the next person, ordered by person ID. E.g. if Emma (id=1) has A,B and Jake (id=2) has C,D, after rotate Emma gets C,D and Jake gets A,B. With 3+ people, assignments cycle: person 1 → person 2 → person 3 → person 1. |

### Today (for dashboard widget)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/today` | Get today's assignments grouped by person (see response shape below) |

### Response Shapes

**GET /assignments?week=** returns a flat array:
```json
[
  {
    "id": 1,
    "chore": { "id": 1, "name": "Dishes", "chore_type": "regular", "tags": ["daily"] },
    "person": { "id": 1, "name": "Emma", "color": "#e88a6a", "avatar": null },
    "week_of": "2026-03-16",
    "day_of_week": 0,
    "picked_chore": null,
    "completed": false
  }
]
```

**GET /today** returns grouped by person:
```json
{
  "persons": [
    {
      "person": { "id": 1, "name": "Emma", "color": "#e88a6a", "avatar": "data:image/png;base64,..." },
      "assignments": [
        {
          "id": 1,
          "chore": { "id": 1, "name": "Dishes", "chore_type": "regular" },
          "picked_chore": null,
          "completed": false
        }
      ]
    }
  ],
  "completed_count": 3,
  "total_count": 7
}
```

**Day-of-week mapping:** The backend converts today's date to 0=Monday convention using `date.weekday()` (0=Mon through 6=Sun). The `/today` endpoint filters assignments where `week_of` matches the current week's Monday and `day_of_week` matches today.

## Admin UI

Three-tab interface within the chores admin page:

### Tab 1: Weekly Assignments (default)

- **Week selector** at top — left/right arrows to navigate weeks, shows "Week of March 16, 2026"
- **Action buttons** — "Copy from Last Week" and "Rotate"
- **Assignment grid:**
  - Rows = people (avatar + name on left)
  - Columns = days of week (Mon–Sun)
  - Cells contain chore chips (name + remove button)
  - Meta-chore chips styled differently (dashed blue border)
  - Today's column highlighted
- **Chore pool** below the grid — all available chores as draggable chips
  - Chores stay in pool when assigned (reusable)
  - Touch/drag a chip to a grid cell to assign
  - Meta-chores shown with distinct styling

### Tab 2: Manage Chores

- List of all chores with name, tags, type badge
- Add chore button → form with: name, description, tags (comma-separated or chips), type (regular/meta), pick_from_tags (if meta)
- Edit/delete per chore

### Tab 3: People

- List of people with avatar (image or color+initial), name
- Add person button → form with: name, color picker (preset palette + custom), optional avatar upload
- Edit/delete per person
- **Color picker:** row of 8-10 preset color circles, plus a color wheel/picker button for custom colors
- **Avatar upload:** tap to select image, preview shown, stored as blob in DB

## Dashboard Widget

Shows on the Home Board as a card with `category="chores"`.

**Compact view (card):**
- Grouped by person (avatar + name header per section)
- Each assignment shows:
  - Regular chore: checkbox + chore name
  - Meta-chore (unpicked): "Pick a chore" button (tappable)
  - Meta-chore (picked): checkbox + picked chore name + small "change" link
- Badge shows progress: "3 of 7 done"

**Meta-chore picker (overlay/bottom sheet):**
- Opens when tapping "Pick a chore" on a meta-chore assignment
- Shows available chores matching the meta-chore's `pick_from_tags`
- Tap one to select → assignment updates to show that chore name
- "Clear" option to go back to unpicked state

**Detail view:** Deferred — the card view with checkboxes is sufficient for now. Can add a week overview bottom sheet later.

## Assignment States

```
Regular chore:     [ ] Not done  →  [✓] Done
                   [✓] Done      →  [ ] Not done (uncomplete)

Meta-chore:        [Pick a chore]  →  (picker opens)
                   (pick selected) →  [ ] Chore Name (completable)
                                       + "change" link (clears pick, returns to picker)
                   [ ] Chore Name  →  [✓] Chore Name (done)
                   [✓] Chore Name  →  [ ] Chore Name (uncomplete)
```

## Migration

- New migration (`004_chore_manager.sql`) drops old tables (`chores`, `chore_assignments`, `chore_completions`) and creates new ones (`people`, `chores` with new schema, `assignments`)
- Replace all files in `backend/src/integrations/chores/` and `frontend/src/integrations/chores/`
- Replace `frontend/src/admin/ChoreAdmin.tsx`
- No data migration needed (current chore data is empty)
