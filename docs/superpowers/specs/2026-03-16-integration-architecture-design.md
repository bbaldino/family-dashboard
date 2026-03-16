# Dashboard Integration Architecture Design Spec

## Overview

Define a consistent pattern for how new features (integrations + widgets) are built, configured, and added to the dashboard. Replaces the current ad hoc approach where each feature has its own conventions for config, routing, and data access.

## Goals

- Consistent structure for adding new features — no inventing patterns each time
- Scoped isolation — integrations don't see each other's config, routes, or concerns
- Config entirely in the database — changeable at runtime via admin UI, no env vars or restarts
- Auto-generated admin settings forms for simple config, customizable for complex config
- Keep boards hand-coded (bespoke layout, not config-driven)

## Non-Goals

- Full plugin system with runtime discovery/loading
- Config-driven widget placement or layout engine
- Trait-based integration interface (deferred — convention-based first, extract trait later when patterns are proven)
- Cross-integration entity model (like HA's entity system)

## Integration Categories

Integrations fall into three types, all following the same structural conventions:

1. **External data** — fetches from an external service (API, LAN service, stream). Backend may proxy for CORS or credential management. Examples: weather, calendar, lunch menu, doorbell camera.
2. **Internal data** — dashboard owns the data with CRUD routes + database tables. Examples: chores, grocery list, countdowns.
3. **HA-connected** — reads/writes Home Assistant entities via HAKit. Examples: light controls, sensor displays.

Any integration can also be an **event source** (pushes overlays via the event bus). Event source behavior is orthogonal to the integration type — any integration can push overlays by importing the event bus hook. The event bus itself is shared infrastructure, not part of any integration.

**Frontend-only widgets** (like clock) that have no backend, no config, and no external data source stay in `ui/` as shared components — they aren't integrations. The `defineIntegration` pattern is for features that have a backend, config, or external data dependency. A simple clock is just a React component.

## Directory Structure

### Backend

```
backend/src/
  main.rs                          -- loads .env (for DB path only), starts server
  lib.rs
  db.rs
  error.rs
  integrations/
    mod.rs                         -- registers all integrations, nests routes
    config/                        -- config system (the config table itself)
      mod.rs
      routes.rs
    config_helpers.rs              -- IntegrationConfig scoped DB reader
    weather/
      mod.rs                       -- INTEGRATION_ID, router()
      routes.rs                    -- endpoint handlers
    google_calendar/
      mod.rs
      routes.rs
      models.rs
      auth.rs                      -- OAuth flow
    nutrislice/
      mod.rs
      routes.rs
    chores/
      mod.rs
      routes.rs
      models.rs
  models/                          -- shared models (if any)
```

### Frontend

```
frontend/src/
  main.tsx
  App.tsx
  app/
    AppShell.tsx
  boards/
    HomeBoard.tsx
    MediaBoard.tsx
    CamerasBoard.tsx
  integrations/
    registry.ts                    -- list of all integrations for admin settings
    define-integration.ts          -- defineIntegration() helper
    weather/
      WeatherWidget.tsx
      WeatherDetail.tsx
      useWeather.ts
      config.ts                    -- defineIntegration() call with schema + fields
      index.ts
    google-calendar/
      CalendarWidget.tsx
      CalendarDetail.tsx
      useCalendar.ts
      config.ts
      index.ts
    nutrislice/
      LunchMenuWidget.tsx
      useLunchMenu.ts
      config.ts
      index.ts
    chores/
      ChoresWidget.tsx
      ChoresDetail.tsx
      useChores.ts
      config.ts
      index.ts
  hooks/                           -- shared hooks (usePolling, useHaEntity, etc.)
  ui/                              -- shared UI (WidgetCard, BottomSheet, etc.)
  lib/                             -- shared utilities
  admin/
    AdminLayout.tsx
    ChoreAdmin.tsx
    SettingsAdmin.tsx               -- generic, renders forms from integration configs
```

## Backend Conventions

### Integration module structure

Each integration exports:

```rust
// integrations/weather/mod.rs
pub mod routes;

pub const INTEGRATION_ID: &str = "weather";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/current", get(routes::get_current))
        .route("/forecast", get(routes::get_forecast))
        .with_state(pool)
}
```

Routes are defined without the integration prefix. The registry nests them:

```rust
// integrations/mod.rs
pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .nest("/weather", weather::router(pool.clone()))
        .nest("/google-calendar", google_calendar::router(pool.clone()))
        .nest("/nutrislice", nutrislice::router(pool.clone()))
        .nest("/chores", chores::router(pool.clone()))
        .nest("/config", config::router(pool.clone()))
}
```

All integration routers take `SqlitePool` (for config access). Integration-specific state (like Google OAuth credentials) is internal to the module.

### Scoped config access

```rust
// integrations/config_helpers.rs
pub struct IntegrationConfig<'a> {
    pool: &'a SqlitePool,
    prefix: &'a str,
}

impl<'a> IntegrationConfig<'a> {
    pub fn new(pool: &'a SqlitePool, prefix: &'a str) -> Self {
        Self { pool, prefix }
    }

    pub async fn get(&self, key: &str) -> Result<String, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
            .bind(&full_key)
            .fetch_optional(self.pool)
            .await?
            .ok_or_else(|| AppError::BadRequest(
                format!("Config '{}.{}' not set. Configure in admin settings.", self.prefix, key)
            ))
    }

    pub async fn get_or(&self, key: &str, default: &str) -> Result<String, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        Ok(sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
            .bind(&full_key)
            .fetch_optional(self.pool)
            .await?
            .unwrap_or_else(|| default.to_string()))
    }
}
```

Usage in a route handler:

```rust
async fn get_current(State(pool): State<SqlitePool>) -> Result<Json<...>, AppError> {
    let config = IntegrationConfig::new(&pool, "weather");
    let api_key = config.get("api_key").await?;
    let lat = config.get_or("lat", "37.2504").await?;
    // ...
}
```

The integration never writes scoped keys — it just uses `"api_key"` and the helper prefixes with `"weather."`.

## Frontend Conventions

### defineIntegration helper

```typescript
// integrations/define-integration.ts
import { z } from 'zod'

interface FieldMeta {
  label: string
  type?: 'text' | 'secret' | 'boolean'  // default: 'text'. Determines input rendering.
  description?: string
}

interface IntegrationDef<T extends z.ZodObject<any>> {
  id: string
  name: string
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
  settingsComponent?: React.ComponentType
}

function defineIntegration<T extends z.ZodObject<any>>(def: IntegrationDef<T>) {
  return {
    ...def,
    api: {
      get: async <R>(path: string): Promise<R> => {
        const resp = await fetch(`/api/${def.id}${path}`)
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `${resp.status}`)
        }
        return resp.json()
      },
      post: async <R>(path: string, body: any): Promise<R> => {
        const resp = await fetch(`/api/${def.id}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `${resp.status}`)
        }
        return resp.json()
      },
      put: async <R>(path: string, body: any): Promise<R> => {
        const resp = await fetch(`/api/${def.id}${path}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `${resp.status}`)
        }
        return resp.json()
      },
      del: async (path: string): Promise<void> => {
        const resp = await fetch(`/api/${def.id}${path}`, { method: 'DELETE' })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `${resp.status}`)
        }
      },
    },
  }
}
```

### Integration config declaration

```typescript
// integrations/weather/config.ts
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const weatherIntegration = defineIntegration({
  id: 'weather',
  name: 'Weather',
  schema: z.object({
    api_key: z.string().min(1, 'API key is required'),
    lat: z.string().min(1),
    lon: z.string().min(1),
  }),
  fields: {
    api_key: { label: 'OpenWeatherMap API Key', type: 'secret' },
    lat: { label: 'Latitude' },
    lon: { label: 'Longitude' },
  },
})
```

### Integration data hook

```typescript
// integrations/weather/useWeather.ts
import { usePolling } from '@/hooks/usePolling'
import { weatherIntegration } from './config'

export function useWeather() {
  return usePolling({
    fetcher: () => weatherIntegration.api.get('/current'),
    intervalMs: 15 * 60 * 1000,
  })
}
```

### Integration config hook

```typescript
// Shared hook for reading scoped config for an integration
function useIntegrationConfig<T extends z.ZodObject<any>>(
  integration: ReturnType<typeof defineIntegration<T>>
): z.infer<T> | null {
  const [config, setConfig] = useState<z.infer<T> | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((allConfig: Record<string, string>) => {
        // Filter to keys with this integration's prefix, strip prefix
        const prefix = integration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(allConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        // Parse through Zod schema (returns null if validation fails)
        const result = integration.schema.safeParse(scoped)
        setConfig(result.success ? result.data : null)
      })
      .catch(() => setConfig(null))
  }, [integration.id, integration.schema])

  return config
}
```

Returns the typed config object or `null` if config is missing/incomplete. Fetches once on mount. For integrations that need reactive config updates, the hook could accept a polling interval, but for now static fetch is sufficient since config changes rarely.

### Integration registry

```typescript
// integrations/registry.ts
import { weatherIntegration } from './weather/config'
import { googleCalendarIntegration } from './google-calendar/config'
import { nutrisliceIntegration } from './nutrislice/config'
import { choresIntegration } from './chores/config'

export const integrations = [
  weatherIntegration,
  googleCalendarIntegration,
  nutrisliceIntegration,
  choresIntegration,
]
```

The admin settings page imports this registry and renders forms for each.

## Admin Settings Page

The settings page is generic — it iterates over the integration registry and renders a config section for each:

1. For each integration, check if it has a `settingsComponent`. If so, render it.
2. Otherwise, auto-generate a form from `fields` metadata:
   - `secret: true` → password input
   - Default → text input
   - Boolean fields → toggle
3. Validate with Zod schema on save.
4. Save via config API with scoped keys (`{integration.id}.{field_key}`).

Complex integrations (like Google Calendar's calendar picker) provide a custom `settingsComponent` that handles their own UI but still uses the scoped config API to persist values.

## Board Integration

Boards remain hand-coded JSX. They import widgets from `@/integrations/<name>/`:

```tsx
import { CalendarWidget, useCalendar } from '@/integrations/google-calendar'
import { LunchMenuWidget } from '@/integrations/nutrislice'
import { WeatherWidget, useHeroWeather } from '@/integrations/weather'
```

No widget registry or automatic placement. The board author decides layout, which widgets appear, and how data flows between them.

## Migration from current structure

**Strategy:** Migrate one integration at a time. The old `routes/` and `integrations/` patterns coexist during migration. The backend `main.rs` merges routes from both until all integrations are moved. Frontend imports update as each integration moves.

**Order:** First, build the shared infrastructure (`defineIntegration`, `IntegrationConfig`, generic settings page). Then migrate one integration at a time, starting with the simplest (nutrislice — just a proxy, minimal config) to validate the pattern, then weather, google-calendar, chores, doorbell.

**Backend:**
- `backend/src/routes/<name>.rs` → `backend/src/integrations/<name>/` (split into `mod.rs` + `routes.rs`)
- `backend/src/models/<name>.rs` → moved into respective integration directories
- `backend/src/routes/mod.rs` → gradually empties as integrations move to `integrations/mod.rs`
- `backend/src/routes/config.rs` → `backend/src/integrations/config/`
- Remove `backend/.env` config values as each integration moves to the config table. Keep `DATABASE_URL` and `PORT` as env vars (server-level config, not integration config).
- `HA_URL` and `HA_TOKEN` move to the config table under an `ha` prefix (`ha.url`, `ha.token`). HA is treated as an integration that other HA-connected integrations depend on.

**Frontend:**
- `frontend/src/widgets/<name>/` → `frontend/src/integrations/<name>/`
- `frontend/src/widgets/clock/` → `frontend/src/ui/ClockWidget.tsx` (frontend-only, not an integration)
- `frontend/src/widgets/doorbell/` → `frontend/src/integrations/doorbell/`
- `backend/src/routes/google_auth.rs` + `backend/src/routes/google_calendar.rs` → merged into `backend/src/integrations/google-calendar/` (auth.rs + routes.rs)
- `frontend/src/lib/dashboard-api.ts` → per-integration scoped API clients replace the monolithic typed API objects. The `request()` helper and shared types stay in `lib/`.
- `frontend/src/components/ui/button.tsx` (shadcn generated) → stays as-is, separate from our `ui/` directory
- `frontend/src/hooks/`, `frontend/src/ui/`, `frontend/src/lib/` → stay as shared infrastructure

## What stays shared (not in integrations)

- `ui/` — WidgetCard, BottomSheet, HeroStrip, TabBar, Button, LoadingSpinner, ErrorDisplay, ErrorBoundary
- `hooks/` — usePolling, useHaEntity, useHaService
- `lib/` — core request utilities, event-bus
- `integrations/define-integration.ts` — the defineIntegration helper (lives with the integrations it serves)
- `integrations/registry.ts` — list of all integrations for admin settings
- `admin/` — AdminLayout, SettingsAdmin (generic), integration-specific admin pages (like ChoreAdmin) stay here
- `boards/` — HomeBoard, MediaBoard, CamerasBoard
- `theme/` — CSS variables
