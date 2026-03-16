# Integration Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the dashboard into a consistent integration-based architecture with scoped config, scoped routes, and a standard pattern for adding new features.

**Architecture:** Each integration lives in its own directory on both backend and frontend. Backend integrations define routes without URL prefixes (the registry nests them). Frontend integrations use `defineIntegration()` for scoped API access and config. All integration config moves from env vars to the SQLite config table, configurable via a generic admin settings page.

**Tech Stack:** Rust/Axum, React/TypeScript, Zod, SQLite, Tailwind

**Spec:** `docs/superpowers/specs/2026-03-16-integration-architecture-design.md`

---

## File Structure (target state)

### Backend

```
backend/src/
  main.rs
  lib.rs
  db.rs
  error.rs
  integrations/
    mod.rs                         -- registers all integrations, nests routes
    config_helpers.rs              -- IntegrationConfig scoped DB reader
    config/
      mod.rs
      routes.rs
    nutrislice/
      mod.rs
      routes.rs
    weather/
      mod.rs
      routes.rs
    google_calendar/
      mod.rs
      routes.rs
      models.rs
      auth.rs
    chores/
      mod.rs
      routes.rs
      models.rs
```

### Frontend

```
frontend/src/
  integrations/
    define-integration.ts
    registry.ts
    use-integration-config.ts
    nutrislice/
      LunchMenuWidget.tsx
      useLunchMenu.ts
      config.ts
      index.ts
    weather/
      WeatherWidget.tsx
      WeatherDetail.tsx
      useWeather.ts
      config.ts
      index.ts
    google-calendar/
      CalendarWidget.tsx
      CalendarDetail.tsx
      useCalendar.ts
      config.ts
      index.ts
    chores/
      ChoresWidget.tsx
      ChoresDetail.tsx
      useChores.ts
      config.ts
      index.ts
    doorbell/
      DoorbellWidget.tsx
      useWebRtcStream.ts
      config.ts
      index.ts
  ui/
    ClockWidget.tsx                 -- moved from widgets/clock/
    ... existing shared UI
  hooks/                           -- unchanged
  lib/                             -- dashboard-api.ts shrinks as integrations move
  boards/                          -- imports change to @/integrations/
  admin/
    SettingsAdmin.tsx               -- rewritten to be generic
```

---

## Chunk 1: Shared Infrastructure

Build the foundation that all integrations will use.

### Task 1: Install Zod and create defineIntegration helper

**Files:**
- Create: `frontend/src/integrations/define-integration.ts`

- [ ] **Step 1: Install Zod**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm install zod
```

- [ ] **Step 2: Create defineIntegration helper**

```typescript
// frontend/src/integrations/define-integration.ts
import { z } from 'zod'

export interface FieldMeta {
  label: string
  type?: 'text' | 'secret' | 'boolean'
  description?: string
}

export interface IntegrationDef<T extends z.ZodObject<z.ZodRawShape>> {
  id: string
  name: string
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
  settingsComponent?: React.ComponentType
}

export interface Integration<T extends z.ZodObject<z.ZodRawShape>> extends IntegrationDef<T> {
  api: {
    get: <R>(path: string) => Promise<R>
    post: <R>(path: string, body: unknown) => Promise<R>
    put: <R>(path: string, body: unknown) => Promise<R>
    del: (path: string) => Promise<void>
  }
}

async function apiRequest<R>(baseUrl: string, path: string, options?: RequestInit): Promise<R> {
  const resp = await fetch(`${baseUrl}${path}`, options)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${resp.status}`)
  }
  if (resp.status === 204) return undefined as R
  return resp.json()
}

export function defineIntegration<T extends z.ZodObject<z.ZodRawShape>>(
  def: IntegrationDef<T>,
): Integration<T> {
  const baseUrl = `/api/${def.id}`
  return {
    ...def,
    api: {
      get: <R>(path: string) => apiRequest<R>(baseUrl, path),
      post: <R>(path: string, body: unknown) =>
        apiRequest<R>(baseUrl, path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      put: <R>(path: string, body: unknown) =>
        apiRequest<R>(baseUrl, path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      del: (path: string) =>
        apiRequest<void>(baseUrl, path, { method: 'DELETE' }),
    },
  }
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/define-integration.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: add defineIntegration helper with scoped API client and Zod schemas"
```

---

### Task 2: Create useIntegrationConfig hook

**Files:**
- Create: `frontend/src/integrations/use-integration-config.ts`

- [ ] **Step 1: Create the hook**

```typescript
// frontend/src/integrations/use-integration-config.ts
import { useState, useEffect } from 'react'
import { z } from 'zod'
import type { Integration } from './define-integration'

export function useIntegrationConfig<T extends z.ZodObject<z.ZodRawShape>>(
  integration: Integration<T>,
): z.infer<T> | null {
  const [config, setConfig] = useState<z.infer<T> | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((allConfig: Record<string, string>) => {
        const prefix = integration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(allConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        const result = integration.schema.safeParse(scoped)
        setConfig(result.success ? result.data : null)
      })
      .catch(() => setConfig(null))
  }, [integration.id, integration.schema])

  return config
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/use-integration-config.ts
git commit -m "feat: add useIntegrationConfig hook for scoped config access"
```

---

### Task 3: Create backend IntegrationConfig helper

**Files:**
- Create: `backend/src/integrations/mod.rs`
- Create: `backend/src/integrations/config_helpers.rs`
- Modify: `backend/src/lib.rs`
- Modify: `backend/src/main.rs`

- [ ] **Step 1: Create integrations directory with config_helpers**

```rust
// backend/src/integrations/config_helpers.rs
use sqlx::SqlitePool;
use crate::error::AppError;

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
            .ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Config '{}.{}' not set. Configure in admin settings.",
                    self.prefix, key
                ))
            })
    }

    pub async fn get_or(&self, key: &str, default: &str) -> Result<String, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        Ok(
            sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
                .bind(&full_key)
                .fetch_optional(self.pool)
                .await?
                .unwrap_or_else(|| default.to_string()),
        )
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<T, AppError> {
        let value = self.get(key).await?;
        serde_json::from_str(&value)
            .map_err(|e| AppError::Internal(format!("Failed to parse config '{}.{}': {}", self.prefix, key, e)))
    }

    pub async fn get_json_or<T: serde::de::DeserializeOwned>(&self, key: &str, default: T) -> Result<T, AppError> {
        let full_key = format!("{}.{}", self.prefix, key);
        match sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
            .bind(&full_key)
            .fetch_optional(self.pool)
            .await?
        {
            Some(value) => serde_json::from_str(&value)
                .map_err(|e| AppError::Internal(format!("Failed to parse config: {}", e))),
            None => Ok(default),
        }
    }
}
```

- [ ] **Step 2: Create integrations mod.rs**

This starts empty and will accumulate integrations as they migrate:

```rust
// backend/src/integrations/mod.rs
pub mod config_helpers;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(_pool: SqlitePool) -> Router {
    Router::new()
    // Integrations will be added here as they migrate
}
```

- [ ] **Step 3: Update lib.rs to export integrations**

Add `pub mod integrations;` to `backend/src/lib.rs`.

- [ ] **Step 4: Wire integrations router into main.rs**

In `main.rs`, merge the new integrations router alongside the existing routes router:

```rust
let api_routes = routes::router(pool.clone(), google_config)
    .merge(integrations::router(pool.clone()));
```

This allows old and new patterns to coexist during migration.

- [ ] **Step 5: Verify compilation**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo build
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/ backend/src/lib.rs backend/src/main.rs
git commit -m "feat: add IntegrationConfig helper and integrations module"
```

---

### Task 4: Rewrite generic settings admin page

**Files:**
- Create: `frontend/src/integrations/registry.ts`
- Rewrite: `frontend/src/admin/SettingsAdmin.tsx`

- [ ] **Step 1: Create empty integration registry**

```typescript
// frontend/src/integrations/registry.ts
import type { Integration } from './define-integration'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const integrations: Integration<any>[] = [
  // Integrations will be added here as they migrate
]
```

- [ ] **Step 2: Rewrite SettingsAdmin to be generic**

```tsx
// frontend/src/admin/SettingsAdmin.tsx
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { integrations } from '@/integrations/registry'

export function SettingsAdmin() {
  const [allConfig, setAllConfig] = useState<Record<string, string>>({})
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/config')
      const data = await resp.json()
      setAllConfig(data)
      setLocalConfig(data)
    } catch {
      setError('Failed to load settings')
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleChange = (fullKey: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [fullKey]: value }))
  }

  const handleSave = async () => {
    try {
      setError(null)

      // Validate each integration's config via its Zod schema
      for (const integration of integrations) {
        if (integration.settingsComponent) continue // custom components handle their own validation
        const prefix = integration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(localConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        const result = integration.schema.safeParse(scoped)
        if (!result.success) {
          const firstError = result.error.issues[0]
          setError(`${integration.name}: ${firstError.message}`)
          return
        }
      }

      // Save changed keys
      for (const [key, value] of Object.entries(localConfig)) {
        if (allConfig[key] !== value) {
          await fetch(`/api/config/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
        }
      }
      setAllConfig({ ...localConfig })
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>

      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {integrations.length === 0 && (
        <p className="text-text-muted text-sm">No integrations configured yet.</p>
      )}

      {integrations.map((integration) => {
        // If integration provides a custom settings component, use it
        if (integration.settingsComponent) {
          const CustomSettings = integration.settingsComponent
          return (
            <div key={integration.id} className="mb-8">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                {integration.name}
              </h3>
              <CustomSettings />
            </div>
          )
        }

        // Otherwise, auto-generate form from fields
        const fieldEntries = Object.entries(integration.fields) as [string, { label: string; type?: string; description?: string }][]

        return (
          <div
            key={integration.id}
            className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border mb-6"
          >
            <h3 className="text-sm font-semibold text-text-secondary mb-4">
              {integration.name}
            </h3>
            <div className="space-y-3">
              {fieldEntries.map(([key, meta]) => {
                const fullKey = `${integration.id}.${key}`
                const value = localConfig[fullKey] ?? ''

                if (meta.type === 'boolean') {
                  return (
                    <label key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={value === 'true'}
                        onChange={(e) => handleChange(fullKey, String(e.target.checked))}
                        className="w-5 h-5 rounded accent-calendar"
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">{meta.label}</div>
                        {meta.description && (
                          <div className="text-xs text-text-muted">{meta.description}</div>
                        )}
                      </div>
                    </label>
                  )
                }

                return (
                  <div key={key}>
                    <label className="text-xs text-text-muted block mb-1">{meta.label}</label>
                    <input
                      type={meta.type === 'secret' ? 'password' : 'text'}
                      value={value}
                      onChange={(e) => handleChange(fullKey, e.target.value)}
                      placeholder={meta.description}
                      className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/registry.ts frontend/src/admin/SettingsAdmin.tsx
git commit -m "feat: rewrite settings admin to auto-generate forms from integration registry"
```

---

## Chunk 2: Migrate NutriSlice (simplest integration)

### Task 5: Migrate NutriSlice backend

**Files:**
- Create: `backend/src/integrations/nutrislice/mod.rs`
- Create: `backend/src/integrations/nutrislice/routes.rs`
- Delete: `backend/src/routes/nutrislice.rs`
- Modify: `backend/src/routes/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create nutrislice integration directory**

```rust
// backend/src/integrations/nutrislice/mod.rs
pub mod routes;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "nutrislice";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/menu", axum::routing::get(routes::get_menu))
        .with_state(pool)
}
```

- [ ] **Step 2: Move route handler, update to use IntegrationConfig**

```rust
// backend/src/integrations/nutrislice/routes.rs
use axum::{extract::{Query, State}, Json};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

pub async fn get_menu(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let config = IntegrationConfig::new(&pool, INTEGRATION_ID);

    let date = params
        .get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required (YYYY/MM/DD)".to_string()))?;

    let school = config.get_or("school", "bagby-elementary-school").await?;
    let district = config.get_or("district", "cambriansd").await?;
    let menu_type = config.get_or("menu_type", "lunch").await?;

    let url = format!(
        "https://{}.api.nutrislice.com/menu/api/weeks/school/{}/menu-type/{}/{}?format=json",
        district, school, menu_type, date
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("NutriSlice request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "NutriSlice returned {}",
            resp.status()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("NutriSlice parse failed: {}", e)))?;

    Ok(Json(body))
}
```

Note: the school/district/menu_type are now read from config with defaults. The query param overrides are removed — config is the single source.

- [ ] **Step 3: Register in integrations/mod.rs**

```rust
// backend/src/integrations/mod.rs
pub mod config_helpers;
pub mod nutrislice;

pub use config_helpers::IntegrationConfig;

use axum::Router;
use sqlx::SqlitePool;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .nest("/nutrislice", nutrislice::router(pool.clone()))
}
```

- [ ] **Step 4: Remove from old routes/mod.rs**

Remove `pub mod nutrislice;` and `.merge(nutrislice::router())` from `backend/src/routes/mod.rs`. Delete `backend/src/routes/nutrislice.rs`.

- [ ] **Step 5: Verify compilation and tests**

```bash
cargo build && cargo test
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/integrations/ && git rm backend/src/routes/nutrislice.rs && git add backend/src/routes/mod.rs
git commit -m "refactor: migrate nutrislice to integrations pattern"
```

---

### Task 6: Migrate NutriSlice frontend

**Files:**
- Create: `frontend/src/integrations/nutrislice/config.ts`
- Move: `frontend/src/widgets/lunch-menu/*` → `frontend/src/integrations/nutrislice/`
- Modify: `frontend/src/integrations/registry.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`
- Delete: `frontend/src/widgets/lunch-menu/`

- [ ] **Step 1: Create nutrislice config**

```typescript
// frontend/src/integrations/nutrislice/config.ts
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const nutrisliceIntegration = defineIntegration({
  id: 'nutrislice',
  name: 'School Lunch Menu',
  schema: z.object({
    school: z.string().optional().default('bagby-elementary-school'),
    district: z.string().optional().default('cambriansd'),
    menu_type: z.string().optional().default('lunch'),
  }),
  fields: {
    school: { label: 'School slug', description: 'e.g. bagby-elementary-school' },
    district: { label: 'District slug', description: 'e.g. cambriansd' },
    menu_type: { label: 'Menu type', description: 'e.g. lunch' },
  },
})
```

- [ ] **Step 2: Move widget files**

Move `frontend/src/widgets/lunch-menu/LunchMenuWidget.tsx`, `useLunchMenu.ts`, `index.ts` to `frontend/src/integrations/nutrislice/`.

- [ ] **Step 3: Update useLunchMenu to use scoped API**

Update the `fetch` call in `useLunchMenu.ts` to use the integration's scoped API:

```typescript
// Change from:
const resp = await fetch(`/api/nutrislice/menu?date=${encodeURIComponent(dateStr)}`)

// To:
import { nutrisliceIntegration } from './config'
// ...
const data = await nutrisliceIntegration.api.get<NutriSliceResponse>(`/menu?date=${encodeURIComponent(dateStr)}`)
```

And remove the manual response handling since the scoped API handles errors.

- [ ] **Step 4: Update index.ts barrel**

```typescript
// frontend/src/integrations/nutrislice/index.ts
export { LunchMenuWidget } from './LunchMenuWidget'
export { nutrisliceIntegration } from './config'
```

- [ ] **Step 5: Add to registry**

```typescript
// frontend/src/integrations/registry.ts
import { nutrisliceIntegration } from './nutrislice/config'

export const integrations = [
  nutrisliceIntegration,
]
```

- [ ] **Step 6: Update HomeBoard import**

Change `import { LunchMenuWidget } from '@/widgets/lunch-menu'` to `import { LunchMenuWidget } from '@/integrations/nutrislice'`.

- [ ] **Step 7: Delete old widgets/lunch-menu directory**

- [ ] **Step 8: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/integrations/nutrislice/ frontend/src/integrations/registry.ts frontend/src/boards/HomeBoard.tsx
git rm -r frontend/src/widgets/lunch-menu/
git commit -m "refactor: migrate nutrislice frontend to integrations pattern"
```

---

## Chunk 3: Migrate Weather

Note: Chunks 3-6 follow the same pattern established by the NutriSlice migration (Tasks 5-6). Each migration consists of: create integration directory → move routes/handlers → update to use IntegrationConfig → register in integrations/mod.rs → remove from old routes. On the frontend: create config.ts → move widget files → update data hook to use scoped API → add to registry → update board imports → delete old directory. Steps that are identical to the NutriSlice pattern provide brief instructions; steps that differ from the pattern provide full detail.

### Task 7: Migrate Weather backend

**Files:**
- Create: `backend/src/integrations/weather/mod.rs`
- Create: `backend/src/integrations/weather/routes.rs`
- Delete: `backend/src/routes/weather.rs`
- Modify: `backend/src/routes/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

Same pattern as NutriSlice. Key changes:
- Routes `/current` and `/forecast` defined without prefix
- `get_config()` replaced with `IntegrationConfig::new(&pool, "weather")` reading `api_key`, `lat`, `lon` from config table
- `DayAccumulator` struct and aggregation logic move to `routes.rs`

- [ ] **Step 1: Create weather integration module**

Create `backend/src/integrations/weather/mod.rs` with `INTEGRATION_ID = "weather"` and router defining `/current` and `/forecast`.

- [ ] **Step 2: Move route handlers to weather/routes.rs**

Copy handlers from `backend/src/routes/weather.rs`, replace `std::env::var` calls with `IntegrationConfig` reads. Move `DayAccumulator` into the same file.

- [ ] **Step 3: Register in integrations/mod.rs**

Add `.nest("/weather", weather::router(pool.clone()))`.

- [ ] **Step 4: Remove from old routes, delete old file**

- [ ] **Step 5: Verify compilation and tests**

```bash
cargo build && cargo test
```

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor: migrate weather to integrations pattern"
```

---

### Task 8: Migrate Weather frontend

**Files:**
- Create: `frontend/src/integrations/weather/config.ts`
- Move: `frontend/src/widgets/weather/*` → `frontend/src/integrations/weather/`
- Modify: `frontend/src/integrations/registry.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`
- Delete: `frontend/src/widgets/weather/`

- [ ] **Step 1: Create weather config**

```typescript
export const weatherIntegration = defineIntegration({
  id: 'weather',
  name: 'Weather',
  schema: z.object({
    api_key: z.string().min(1, 'API key is required'),
    lat: z.string().min(1, 'Latitude is required'),
    lon: z.string().min(1, 'Longitude is required'),
  }),
  fields: {
    api_key: { label: 'OpenWeatherMap API Key', type: 'secret' },
    lat: { label: 'Latitude' },
    lon: { label: 'Longitude' },
  },
})
```

- [ ] **Step 2: Move widget files, update useWeather to use scoped API**

- [ ] **Step 3: Add to registry, update HomeBoard imports**

- [ ] **Step 4: Delete old widgets/weather directory**

- [ ] **Step 5: Verify, commit**

```bash
git commit -m "refactor: migrate weather frontend to integrations pattern"
```

---

## Chunk 4: Migrate Google Calendar

### Task 9: Migrate Google Calendar backend

**Files:**
- Create: `backend/src/integrations/google_calendar/mod.rs`
- Create: `backend/src/integrations/google_calendar/routes.rs`
- Create: `backend/src/integrations/google_calendar/auth.rs`
- Create: `backend/src/integrations/google_calendar/models.rs`
- Delete: `backend/src/routes/google_auth.rs`, `backend/src/routes/google_calendar.rs`
- Delete: `backend/src/models/google.rs`
- Modify: `backend/src/routes/mod.rs`, `backend/src/models/mod.rs`
- Modify: `backend/src/integrations/mod.rs`
- Modify: `backend/src/main.rs`

Key changes:
- `GoogleOAuthConfig` moves into `integrations/google_calendar/models.rs`
- Auth routes and calendar proxy routes merge under one integration
- OAuth credentials (`client_id`, `client_secret`, `redirect_uri`) read from config table instead of env vars
- `main.rs` no longer constructs `GoogleOAuthConfig` — the integration reads its own config
- The old `routes::router()` no longer takes `GoogleOAuthConfig` as a parameter

- [ ] **Step 1: Create google_calendar integration with models, auth, and routes**

- [ ] **Step 2: Update IntegrationConfig reads for OAuth credentials**

The auth handler reads `config.get("client_id")`, `config.get("client_secret")`, `config.get("redirect_uri")` from the config table.

- [ ] **Step 3: Register in integrations/mod.rs, remove from old routes**

- [ ] **Step 4: Update main.rs — remove GoogleOAuthConfig construction**

The `routes::router()` function no longer needs `google_config` parameter since it's been moved to the integration.

- [ ] **Step 5: Verify compilation and tests**

- [ ] **Step 6: Commit**

```bash
git commit -m "refactor: migrate google calendar to integrations pattern"
```

---

### Task 10: Migrate Google Calendar frontend

**Files:**
- Create: `frontend/src/integrations/google-calendar/config.ts`
- Move: `frontend/src/widgets/calendar/*` → `frontend/src/integrations/google-calendar/`
- Modify: `frontend/src/integrations/registry.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`
- Delete: `frontend/src/widgets/calendar/`

The Google Calendar integration has a custom settings component (the calendar picker with checkboxes). The existing `SettingsAdmin.tsx` calendar picker logic moves into a `settingsComponent` on the integration definition.

- [ ] **Step 1: Create google-calendar config with custom settingsComponent**

- [ ] **Step 2: Move widget files, update useCalendar to use scoped API**

The `useGoogleCalendar` hook currently calls `googleCalendarApi` and `configApi` from `dashboard-api.ts`. Replace with the integration's scoped API.

- [ ] **Step 3: Add to registry, update HomeBoard imports**

- [ ] **Step 4: Delete old widgets/calendar directory**

- [ ] **Step 5: Verify, commit**

```bash
git commit -m "refactor: migrate google calendar frontend to integrations pattern"
```

---

## Chunk 5: Migrate Chores

### Task 11: Migrate Chores backend

**Files:**
- Create: `backend/src/integrations/chores/mod.rs`
- Create: `backend/src/integrations/chores/routes.rs`
- Create: `backend/src/integrations/chores/models.rs`
- Delete: `backend/src/routes/chores.rs`, `backend/src/models/chore.rs`
- Modify: `backend/src/routes/mod.rs`, `backend/src/models/mod.rs`
- Modify: `backend/src/integrations/mod.rs`
- Modify: `backend/tests/chores_test.rs` (update import paths)

- [ ] **Step 1: Create chores integration module**

Routes stay the same (no env vars to migrate for chores). The main change is directory structure and nesting under `/chores`.

- [ ] **Step 2: Update test imports**

Tests reference `dashboard_backend::routes::router` — update to account for the new nesting.

- [ ] **Step 3: Verify tests pass**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: migrate chores to integrations pattern"
```

---

### Task 12: Migrate Chores frontend

**Files:**
- Create: `frontend/src/integrations/chores/config.ts`
- Move: `frontend/src/widgets/chores/*` → `frontend/src/integrations/chores/`
- Modify: `frontend/src/integrations/registry.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`
- Modify: `frontend/src/admin/ChoreAdmin.tsx` (update API imports)
- Delete: `frontend/src/widgets/chores/`

- [ ] **Step 1: Create chores config**

Chores has no config keys currently (no API keys, no external services). The integration definition has an empty schema but still provides the scoped API client.

- [ ] **Step 2: Move widget files, update useChores to use scoped API**

Replace `choresApi` from `dashboard-api.ts` with `choresIntegration.api`.

- [ ] **Step 3: Update ChoreAdmin to use scoped API**

- [ ] **Step 4: Add to registry, update HomeBoard imports**

- [ ] **Step 5: Delete old widgets/chores directory**

- [ ] **Step 6: Verify, commit**

```bash
git commit -m "refactor: migrate chores frontend to integrations pattern"
```

---

## Chunk 6: Migrate Config + Doorbell + Cleanup

### Task 13: Migrate config routes to integrations

**Files:**
- Create: `backend/src/integrations/config/mod.rs`
- Create: `backend/src/integrations/config/routes.rs`
- Delete: `backend/src/routes/config.rs`
- Modify: `backend/src/integrations/mod.rs`

The config system isn't really an "integration" but it follows the same directory pattern. Routes move from `routes/config.rs` to `integrations/config/`.

- [ ] **Step 1: Move config routes**

- [ ] **Step 2: Register in integrations/mod.rs as `.nest("/config", config::router(pool.clone()))`**

- [ ] **Step 3: Remove old routes/config.rs**

- [ ] **Step 4: Verify, commit**

```bash
git commit -m "refactor: migrate config routes to integrations directory"
```

---

### Task 14: Migrate doorbell frontend + move clock to ui/

**Files:**
- Create: `frontend/src/integrations/doorbell/config.ts`
- Move: `frontend/src/widgets/doorbell/*` → `frontend/src/integrations/doorbell/`
- Move: `frontend/src/widgets/clock/ClockWidget.tsx` → `frontend/src/ui/ClockWidget.tsx`
- Delete: `frontend/src/widgets/` (entire directory now empty)

- [ ] **Step 1: Create doorbell config**

```typescript
export const doorbellIntegration = defineIntegration({
  id: 'doorbell',
  name: 'Doorbell Camera',
  schema: z.object({
    go2rtc_url: z.string().min(1, 'go2rtc URL is required'),
    stream_name: z.string().min(1, 'Stream name is required'),
  }),
  fields: {
    go2rtc_url: { label: 'go2rtc URL', description: 'e.g. http://frigate:1984' },
    stream_name: { label: 'Stream name', description: 'e.g. doorbell' },
  },
})
```

- [ ] **Step 2: Move doorbell files, update useWebRtcStream to read go2rtc URL from config**

Replace `import.meta.env.VITE_GO2RTC_URL` with `useIntegrationConfig(doorbellIntegration)`.

- [ ] **Step 3: Move clock to ui/ClockWidget.tsx, delete widgets/ directory**

- [ ] **Step 4: Verify, commit**

```bash
git commit -m "refactor: migrate doorbell to integrations, move clock to ui, remove widgets/"
```

---

### Task 15: Final cleanup

**Files:**
- Delete: `backend/src/routes/` (should be empty)
- Delete: `backend/src/models/` (should be empty)
- Modify: `backend/src/lib.rs` (remove `pub mod routes; pub mod models;`)
- Modify: `backend/src/main.rs` (remove old routes reference)
- Modify: `frontend/src/lib/dashboard-api.ts` (remove migrated API objects, keep shared types if any remain)
- Modify: `backend/.env` (remove integration config, keep only DATABASE_URL and PORT)
- Modify: `frontend/.env` (remove VITE_GO2RTC_URL, keep VITE_HA_URL and VITE_HA_TOKEN)

- [ ] **Step 1: Remove empty backend directories**

Verify `routes/` only has `mod.rs` with nothing in it, `models/` is empty. Remove them and update `lib.rs`.

- [ ] **Step 2: Clean main.rs**

Remove the `routes::router()` call (all routes now come from `integrations::router()`). Remove `GoogleOAuthConfig` construction.

```rust
let api_routes = integrations::router(pool.clone());

let app = axum::Router::new()
    .nest("/api", api_routes)
    .fallback_service(spa_service);
```

- [ ] **Step 3: Clean dashboard-api.ts**

Remove `choresApi`, `googleCalendarApi`, `configApi` objects and their types — they've been replaced by scoped API clients in each integration. Keep the `request()` helper if anything still uses it, otherwise remove the file.

- [ ] **Step 4: Clean .env files**

Backend `.env`: keep `DATABASE_URL`, `PORT`. Remove all integration-specific vars (they're in the config table now).

Frontend `.env`: keep `VITE_HA_URL`, `VITE_HA_TOKEN` for now. Remove `VITE_GO2RTC_URL`. (HA config migration to the config table is deferred — it requires changes to how AppShell initializes HassConnect, which is a separate task.)

- [ ] **Step 5: Seed default config values**

Create a migration or startup script that seeds default config values for existing integrations so the dashboard works without manual config setup:

```sql
-- backend/migrations/003_seed_config.sql
INSERT OR IGNORE INTO config (key, value) VALUES
  ('nutrislice.school', 'bagby-elementary-school'),
  ('nutrislice.district', 'cambriansd'),
  ('nutrislice.menu_type', 'lunch'),
  ('weather.lat', '37.2504'),
  ('weather.lon', '-121.9000');
```

API keys and secrets are NOT seeded — they must be entered via admin UI.

- [ ] **Step 6: Verify everything builds, tests pass, dashboard loads**

```bash
cd backend && cargo build && cargo test
cd ../frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor: complete integration architecture migration, clean up old patterns"
```
