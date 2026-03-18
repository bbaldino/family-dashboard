# Packages Integration Design

## Goal

Add a packages widget to the dashboard that shows active shipments and recently delivered packages, with tap-to-expand tracking detail via a modal.

## Data Source

External packages service running at a configurable URL (default: `http://localhost:4000/api/ext/packages/`).

**Endpoints used:**
- `GET /shipments` — list all shipments with status, carrier, expected delivery, event count
- `GET /shipments/:id/events` — tracking event timeline for a specific shipment

No authentication required (local network service).

## Architecture

### Backend

**Integration ID:** `packages`

The backend proxies requests to the external packages service. This keeps the frontend calling `/api/packages/*` consistently and avoids CORS issues.

**Routes:**
- `GET /api/packages/shipments` — proxy to packages service `/shipments`, returns the response as-is
- `GET /api/packages/shipments/:id/events` — proxy to packages service `/shipments/:id/events`

**Config:**
- `packages.service_url` — base URL of the packages service (default: `http://localhost:4000/api/ext/packages`)

**No caching needed** — the external service handles its own data, and we're on the same machine. The frontend polls at a reasonable interval.

### Frontend

**Widget component:** `PackagesWidget`
- Renders inside `<WidgetCard title="Packages" category="grocery">` (reuses the purple/grocery color)
- Uses TanStack Query to fetch `/api/packages/shipments` with 5-minute refetch interval
- Badge shows active shipment count (non-delivered, non-cancelled)
- Sorted: out_for_delivery first, then in_transit/shipped, then label_created, then recently delivered
- Empty state: "No packages"

**Shipment row (Option B style):**
- Left: status emoji icon (📦 shipped/in_transit, 🚚 out_for_delivery, ✅ delivered, ⚠️ exception, 📋 label_created)
- Middle: item name (truncated), carrier + status text below
- Right: expected delivery date formatted as relative ("Today", "Tomorrow", "Thu Mar 20")
- Delivered items: dimmed text, grouped under "Recently delivered" divider

**Detail modal:** `PackageDetailModal`
- Opens on tap of any shipment row
- Shows shipment name, carrier, tracking number, status
- Tracking event timeline: vertical list of events ordered newest-first, each with timestamp, location, description
- Compact centered modal (not full bottom sheet)

**Settings:** Simple config form with service URL input. Uses the standard auto-generated fields from `defineIntegration`.

### Grid layout change

Current HomeBoard grid (4 columns, 3 rows):
- Col 1: Calendar (rows 2-3)
- Col 2: Chores (rows 2-3)
- Col 3: Countdowns (row 2), Lunch (row 3)
- Col 4: Sports (row 2), Grocery placeholder (row 3)

New layout:
- Col 2: Packages (row 2), Chores (row 3) — chores loses one row but doesn't need the space

## Widget Visual Design

**Active shipments:**
- Emoji icon + name + carrier/status meta + ETA on right
- "Out for delivery" items highlighted with green ETA text
- "Today" in green, "Tomorrow" in orange, future dates in gray

**Delivered section:**
- "Recently delivered" divider label
- Same layout but dimmed (muted text color)
- Show deliveries from the past 14 days (the service's `pruneDeliveredAfterDays` setting controls this)

**Status icon mapping:**
| Status | Icon |
|--------|------|
| `label_created` | 📋 |
| `shipped` | 📦 |
| `in_transit` | 📦 |
| `out_for_delivery` | 🚚 |
| `delivered` | ✅ |
| `exception` | ⚠️ |
| `returned` | ↩️ |
| `cancelled` | ❌ |
| `unknown` | ❓ |

**Sort order:** out_for_delivery → in_transit → shipped → label_created → exception → unknown → delivered (by delivery date desc)

## Modal Design

Centered modal overlay (not bottom sheet). Approximately 400-500px wide, auto-height with max-height and scroll.

**Contents:**
- Header: shipment name, carrier, tracking number (if present)
- Status badge
- Expected delivery date
- Tracking timeline: vertical list with timestamp on left, description + location on right
- Close button (X) and click-outside-to-close

## Polling

- Widget: 5-minute refetch interval via TanStack Query
- Detail modal: fetches events on open, no auto-refresh (modal is short-lived)

## Deferred

- Hide widget when empty (cross-cutting feature for all widgets)
- Grocery list integration (separate widget, keeps its slot)
