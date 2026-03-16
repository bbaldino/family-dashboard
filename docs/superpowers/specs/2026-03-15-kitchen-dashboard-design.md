# Kitchen Dashboard Design Spec

## Overview

A custom kitchen dashboard running on a wall-mounted Android tablet (Apolosign 21", 1920x1080), replacing the current Home Assistant Lovelace UI. The dashboard is its own application — not an HA frontend. HA is one data provider among many.

The system consists of three parts:
1. **Dashboard SPA** — React app displayed on the tablet via Fully Kiosk Browser
2. **Dashboard API** — Rust backend for custom widget data (chores, grocery list, etc.)
3. **Management UI** — admin interface for managing widget data (used from phone/laptop)

## Goals

- Clean, modular architecture with strong separation of concerns
- Rich touch interaction (not just a display — full CRUD for chores, grocery lists, etc.)
- Light, warm aesthetic — rounded corners, soft shadows, warm neutrals. Details to be iterated on the actual hardware.
- Easy to add new widgets without touching unrelated code
- Maximum logic reuse — shared hooks and UI primitives, widgets stay thin

## Non-Goals

- General-purpose dashboard framework (this is one dashboard, built well)
- Config-driven layout engine (boards are hand-composed in JSX for full flexibility)
- WASM sandboxing, speaker recognition, or Music Assistant deep integration (deferred)

## System Architecture

### Frontend (Dashboard SPA)

**Tech stack:**
- React + TypeScript
- Vite (build tool)
- Tailwind CSS v4 + CSS custom properties for theming
- shadcn/ui (cherry-picked components)
- React Router (board navigation)
- HAKit (`@hakit/core`) — opt-in per widget, not app-level

**App shell:**
- Bottom tab bar (60px+ height, large touch targets)
- React Router manages board switching
- No HA dependency at the shell level
- Light theme primary, dark/auto-schedule as a future option

**Boards:**
- Each board is a React component composing widgets with CSS Grid / Flexbox
- Full layout flexibility — no shared layout engine
- Initial boards: Home, Media, Cameras
- Home is the default route and primary daily-use screen

**Widget detail views:**
- Tapping a widget opens an expanded overlay as a bottom sheet (slides up from bottom, can be partial or full height)
- Not separate routes — board state is preserved underneath
- Each widget opts into expansion or not

### Data Integration Model

The dashboard is not an HA frontend. Each widget owns its data and chooses the best integration:

- **HA as a service:** React context + hooks (`useHaEntity`, `useHaService`) wrapping HAKit. Only widgets that need HA import these hooks.
- **Direct API integrations:** widgets can talk to any API directly (Google Calendar, Frigate, etc.)
- **Dashboard API:** custom Rust backend for data that doesn't belong in HA (chores, grocery list, countdowns, lunch menu)
- **Shared utilities:** reusable hooks for common patterns (`usePolling`, etc.) not tied to any specific data source

### Backend (Dashboard API)

**Tech stack:**
- Rust with Axum web framework
- SQLite via sqlx
- Runs on home server alongside HA
- REST API (JSON)

**Responsibilities:**
- Chores: available chores, assignments per child, completion tracking
- Grocery list: items with checked state
- Countdowns: events and target dates
- Lunch menu: menu data (migrated from current HA-based implementation)
- Serves static assets for the dashboard SPA
- Google Calendar OAuth token storage and refresh (see Authentication below)

**API Resources:**

| Resource | Endpoints | Notes |
|----------|----------|-------|
| Chores | `GET /api/chores`, `POST /api/chores`, `PUT /api/chores/:id`, `DELETE /api/chores/:id` | Admin CRUD |
| Chore assignments | `GET /api/chores/assignments?date=`, `PUT /api/chores/:id/assignments`, `POST /api/chores/assignments/:id/complete` | Admin sets assignment schedule per chore; dashboard reads today's and marks done |
| Grocery list | `GET /api/grocery`, `POST /api/grocery`, `PUT /api/grocery/:id`, `DELETE /api/grocery/:id` | Wave 2 |
| Countdowns | `GET /api/countdowns`, `POST /api/countdowns`, `PUT /api/countdowns/:id`, `DELETE /api/countdowns/:id` | Wave 2 |
| Lunch menu | `GET /api/lunch-menu?week=`, `PUT /api/lunch-menu/:week` | Upsert by week — creates if missing, updates if exists |
| Google Calendar OAuth | `GET /api/google/auth` (initiate), `GET /api/google/callback` (OAuth redirect) | One-time setup via admin UI |
| Google Calendar | `GET /api/google/calendars`, `GET /api/google/events?calendar=&start=&end=` | Proxied through backend to handle OAuth |

**API conventions:**
- All endpoints under `/api`
- Error responses: `{ "error": "human-readable message" }` with appropriate HTTP status codes (400, 404, 500)
- Success responses: resource JSON directly (no wrapper)

**Deployment:** The API and SPA share the same origin — the Rust server serves the SPA's static assets and the API under `/api`. No CORS configuration needed.

**Camera integration:** The doorbell and other camera widgets connect directly to go2rtc (bundled in Frigate) via WebRTC or MSE. The go2rtc base URL is configured in the dashboard's environment config (e.g. `VITE_GO2RTC_URL=http://frigate:1984`). Stream names match Frigate camera names.

### Management UI

Admin routes within the same React app, behind a `/admin` path. Not a separate build — this keeps the codebase simpler and lets admin pages reuse the same API client, UI primitives, and type definitions. The admin routes are accessed from phone or laptop; they don't appear in the tablet's tab bar.

Admin pages needed:
- Chore management: define available chores, assign to children, set schedules
- Lunch menu management: enter/edit weekly menus
- Countdown management: add/edit/remove events
- Grocery list management (Wave 2): same CRUD as dashboard but may have bulk-edit features

## Widget Architecture

### Component Contract

Widgets are React components with conventions, not a rigid interface:

- **`<WidgetCard>`** — shared wrapper providing consistent card styling (background, radius, padding, shadow). All widgets render inside it.
- **Expansion** — widgets that support a detail view export a companion component (e.g. `CalendarWidget` + `CalendarDetail`). `WidgetCard` handles the tap-to-expand gesture.
- **Sizing** — widgets don't know their own size. The board layout controls sizing; widgets are responsive to their container.

### Widget File Structure

Each widget is self-contained:

```
src/widgets/calendar/
  CalendarWidget.tsx    -- compact card view
  CalendarDetail.tsx    -- expanded view
  useGoogleCalendar.ts  -- data hook
  index.ts
```

### Reuse Principles

- **Data hooks are the reuse layer.** Multiple widgets needing the same data share a hook. The hook owns fetching, caching, and refresh.
- **UI primitives are shared.** Touch-friendly buttons, loading/error states, list components live in a shared `ui/` layer.
- **Widgets stay thin.** A widget should be: call a data hook, render with shared UI primitives. If it's getting long, logic belongs in a hook or shared component.
- **Rule of thumb:** if it's not specific to this one widget's visual layout, it belongs somewhere shared.

### Widget Inventory

#### Day 1

| Widget | Data Source | Interaction |
|--------|-----------|-------------|
| Calendar | Google Calendar API (direct) | Navigate days/weeks, view event details |
| Chores | Dashboard API | Mark done; full CRUD via management UI |
| Lunch Menu | Dashboard API (migrated from HA) | Display only |
| Doorbell Camera | Frigate (WebRTC via go2rtc) | View live feed; two-way audio is Wave 2 (see below) |
| Weather | HA weather entity (via `useHaEntity`) | Tap for forecast detail |
| Clock | Browser (local time) | Display only |

#### Wave 2

| Widget | Data Source | Interaction |
|--------|-----------|-------------|
| Sports Scores | HA (ESPN integration) | Tap for game detail |
| Grocery List | Dashboard API | Full CRUD from dashboard |
| Countdowns | Dashboard API | Display; manage via management UI |
| Media Player | HA media_player entities | Playback controls |
| Other Cameras | Frigate (MSE/MJPEG) | View live feeds |
| Doorbell Two-Way Audio | Frigate (WebRTC audio channels) | Talk via tablet mic, hear via tablet speakers |

**Note on doorbell two-way audio:** Day 1 doorbell shows the live video feed only. Two-way audio requires WebRTC audio track negotiation with go2rtc, `getUserMedia` for the tablet microphone, and testing on Fully Kiosk's WebRTC support. This is a distinct feature that moves to Wave 2.

## Authentication

**Google Calendar:** OAuth 2.0 with a Google Cloud project. The Rust backend handles the OAuth flow — it stores refresh tokens in SQLite and proxies calendar requests, so the browser SPA never handles tokens directly. Initial OAuth consent is done once via the management UI.

**Home Assistant:** HAKit handles HA authentication (long-lived access token or HA's OAuth flow). Configured once and stored in the browser.

**Dashboard API:** No authentication for now — the API is only accessible on the local network. Can add token-based auth later if needed.

## Theming

- CSS custom properties for design tokens (colors, radii, spacing, shadows)
- Tailwind configured to reference these variables
- Light theme primary
- Warm direction: rounded corners, soft shadows, warm neutral backgrounds, warm accent color
- Touch considerations: minimum 48x48px touch targets (larger for frequent controls), visual press feedback, no hover-dependent interactions
- Information density tuned for 1920x1080 at 21.5" viewed at 2-4 feet — readable but space-efficient

## Project Structure

```
src/
  app/
    AppShell.tsx          -- tab bar + routing
    routes.tsx            -- board route definitions
  boards/
    HomeBoard.tsx
    MediaBoard.tsx
    CamerasBoard.tsx
  widgets/
    calendar/
      CalendarWidget.tsx
      CalendarDetail.tsx
      useGoogleCalendar.ts
      index.ts
    chores/
    weather/
    doorbell/
    ...
  hooks/
    useHaEntity.ts        -- HA entity subscription
    useHaService.ts       -- HA service calls
    usePolling.ts         -- generic polling hook
  ui/
    WidgetCard.tsx         -- shared card wrapper + expansion
    TabBar.tsx
    BottomSheet.tsx        -- detail view overlay
    Button.tsx
    ...shared UI primitives
  theme/
    variables.css          -- CSS custom properties
  lib/
    ha-client.ts           -- HAKit setup, connection management
    google-calendar.ts     -- Google Calendar API client
    dashboard-api.ts       -- Rust backend API client
  admin/
    AdminLayout.tsx        -- admin page layout (no tab bar)
    ChoreAdmin.tsx
    LunchMenuAdmin.tsx
    CountdownAdmin.tsx
```

**Key boundaries:**
- `widgets/` — self-contained (component + data hook + detail view)
- `hooks/` — shared data hooks not specific to one widget
- `ui/` — shared presentational components, no data fetching
- `lib/` — API clients and external service setup
- `boards/` — layout composition only, minimal logic
- `admin/` — management UI pages, shares `ui/` and `lib/` with dashboard

## Hardware Context

- **Tablet:** Apolosign 21" Android tablet, 1920x1080
- **Kiosk software:** Fully Kiosk Browser (fullscreen, auto-launch, remote management)
- **Mic:** ReSpeaker XVF3800 (4-mic array, mounts above screen) — voice integration deferred
- **Cameras:** Frigate-managed, go2rtc for WebRTC streaming

## What's Deferred

- Dark theme / auto-schedule theme switching
- Voice integration (wake word, STT, TTS pipeline)
- Music Assistant deep integration (WebSocket API)
- Speaker recognition / voice identification
- WASM sandboxing
