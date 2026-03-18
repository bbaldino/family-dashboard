# Packages Integration Design

## Goal

Add a packages widget to the dashboard that shows active shipments and recently delivered packages, with tap-to-expand tracking detail via a centered modal.

## Data Source

External packages service running at a configurable URL (default: `http://localhost:4000/api/ext/packages`).

**Endpoints used:**
- `GET /shipments` — list all shipments with status, carrier, expected delivery, event count
- `GET /shipments/:id/events` — tracking event timeline for a specific shipment

No authentication required (local network service).

**Expected response shapes (from `packages-API.md`):**

Shipment:
```typescript
interface Shipment {
  id: string
  name: string
  carrier: string
  trackingNumber: string
  status: string // see valid statuses below
  expectedDelivery: string | null
  trackingUrl: string | null
  orderUrl: string | null
  notes: string
  createdAt: string
  updatedAt: string
  eventCount: number
}
```

Tracking event:
```typescript
interface TrackingEvent {
  id: string
  shipmentId: string
  status: string
  location: string | null
  description: string
  occurredAt: string
  source: string
  createdAt: string
}
```

Valid statuses: `unknown`, `label_created`, `shipped`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `returned`, `cancelled`.

## Architecture

### Backend

**Integration ID:** `packages`

The backend proxies requests to the external packages service. This keeps the frontend calling `/api/packages/*` consistently and avoids CORS issues. The backend normalizes the service URL (strips trailing slash) before appending paths.

**Routes:**
- `GET /api/packages/shipments` — proxy to packages service `/shipments`, returns the response as-is
- `GET /api/packages/shipments/:id/events` — proxy to packages service `/shipments/:id/events`

**Config:**
- `packages.service_url` — base URL of the packages service (default: `http://localhost:4000/api/ext/packages`)

**No caching needed** — the external service handles its own data, and we're on the same machine. The frontend polls at a reasonable interval.

**Error handling:** If the packages service is unreachable, return a 502 with `{"error": "Packages service unavailable"}`. The frontend handles this like any other widget error (shows error state).

### Frontend

**Widget component:** `PackagesWidget`
- Renders inside `<WidgetCard title="Packages" category="grocery">` (reuses the purple/grocery color)
- Uses TanStack Query to fetch `/api/packages/shipments` with 5-minute refetch interval
- Badge shows active shipment count (statuses other than `delivered`, `cancelled`, `returned`)
- `cancelled` and `returned` shipments are filtered out of the widget list entirely
- Empty state: "No packages"
- Error state: "Unable to load packages" (standard widget error pattern)

**Detail modal:** `PackageDetailModal`
- New `Modal` UI component (centered overlay, not the existing `BottomSheet`)
- The widget manages modal state itself (selected shipment ID) — does not use `WidgetCard`'s `detail` prop
- Opens on tap of any shipment row
- Shows shipment name, carrier, tracking number, status
- Tracking event timeline: vertical list of events ordered newest-first, each with timestamp, location, description
- Approximately 400-500px wide, auto-height with max-height and scroll
- Close button (X) and click-outside-to-close

**Settings:** Simple config form with service URL input. Uses the standard auto-generated fields from `defineIntegration`.

### Grid layout change

Current HomeBoard grid (4 columns, 3 rows):
- Col 1: Calendar (rows 2-3)
- Col 2: Chores (rows 2-3)
- Col 3: Countdowns (row 2), Lunch (row 3)
- Col 4: Sports (row 2), Grocery placeholder (row 3)

New layout — only col 2 changes:
- Col 2: Packages (row 2), Chores (row 3) — chores loses one row but doesn't need the space
- All other columns remain unchanged (including Grocery placeholder in col 4, row 3)

## Widget Visual Design

**Sort order (canonical):** out_for_delivery → in_transit → shipped → label_created → exception → unknown → delivered (by delivery date desc)

Shipments are displayed in two sections:

**Active shipments** (everything except `delivered`, `cancelled`, `returned`):
- Emoji icon + name (truncated) + carrier/status meta below + ETA on right
- "Out for delivery" items: green ETA text
- "Today" in green, "Tomorrow" in orange, future dates in gray

**Recently delivered** (status = `delivered`):
- "Recently delivered" divider label
- Same row layout but dimmed (muted text color)
- The frontend displays whatever delivered shipments the service returns (the service handles its own pruning via `pruneDeliveredAfterDays`)

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

## Modal Design

New shared `Modal` UI component — centered overlay with backdrop. Reusable for future features (e.g. weather could migrate from BottomSheet to Modal later).

**Props:** `isOpen`, `onClose`, `title?`, `children`

**Styling:** centered on screen, ~400-500px wide, auto-height with `max-height: 80vh` and overflow scroll, rounded corners matching `--radius-card`, backdrop click to close, X button in top-right.

**Package detail modal contents:**
- Header: shipment name, carrier, tracking number (if present)
- Status badge with icon
- Expected delivery date
- Tracking timeline: vertical list with timestamp on left, description + location on right
- Close button (X) and click-outside-to-close

## Polling

- Widget: 5-minute refetch interval via TanStack Query
- Detail modal: fetches events on open, no auto-refresh (modal is short-lived)

## Deferred

- Hide widget when empty (cross-cutting feature for all widgets)
- Grocery list integration (separate widget, keeps its slot)
