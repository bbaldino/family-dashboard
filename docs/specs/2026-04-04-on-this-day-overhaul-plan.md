# On This Day Widget Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend-only On This Day widget with a backend-powered version that filters inappropriate content via Ollama, mixes in notable births and holidays, and auto-cycles through events.

**Architecture:** New `on_this_day` backend integration fetches Wikipedia's On This Day API, filters events through Ollama for family-friendliness, selects notable births, and caches for 24 hours. Frontend rewrites the widget to consume the backend, auto-cycle events every 30s, and display births in a compact footer section.

**Tech Stack:** Rust/Axum (backend), React/TypeScript (frontend), Ollama API, Wikipedia REST API

**Spec:** `docs/specs/2026-04-04-on-this-day-overhaul-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/on_this_day/mod.rs` | Module registration, router, INTEGRATION_ID |
| `backend/src/integrations/on_this_day/routes.rs` | GET handler, Wikipedia fetch, Ollama filter, cache |
| `backend/src/integrations/on_this_day/types.rs` | Response types, Wikipedia API types |
| `frontend/src/integrations/on-this-day/config.ts` | Integration definition for API access |
| `frontend/src/integrations/on-this-day/useOnThisDay.ts` | Data hook calling backend |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Register on_this_day module and route |
| `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx` | Rewrite: backend data, auto-cycle, mixed format |
| `frontend/src/integrations/on-this-day/useWidgetMeta.ts` | Update to use backend data hook |

---

## Chunk 1: Backend Integration

### Task 1: Create backend types

**Files:**
- Create: `backend/src/integrations/on_this_day/types.rs`

- [ ] **Step 1: Create the types file**

```rust
use serde::{Deserialize, Serialize};

// Wikipedia API response types
#[derive(Debug, Deserialize)]
pub struct WikiEvent {
    pub text: String,
    pub year: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirthPage {
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirth {
    pub text: String,
    pub year: Option<i32>,
    pub pages: Option<Vec<WikiBirthPage>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiHoliday {
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct WikiSelectedResponse {
    pub selected: Option<Vec<WikiEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiBirthsResponse {
    pub births: Option<Vec<WikiBirth>>,
}

#[derive(Debug, Deserialize)]
pub struct WikiHolidaysResponse {
    pub holidays: Option<Vec<WikiHoliday>>,
}

// API response types
#[derive(Debug, Clone, Serialize)]
pub struct OnThisDayEvent {
    pub year: Option<i32>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OnThisDayBirth {
    pub year: i32,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OnThisDayResponse {
    pub events: Vec<OnThisDayEvent>,
    pub births: Vec<OnThisDayBirth>,
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

Will fail — module not registered yet. That's expected.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/on_this_day/types.rs
git commit -m "feat(on-this-day): add backend types for Wikipedia API and response"
```

---

### Task 2: Create backend routes with Wikipedia fetch, Ollama filter, and cache

**Files:**
- Create: `backend/src/integrations/on_this_day/routes.rs`

- [ ] **Step 1: Create the routes file**

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use tokio::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::types::*;
use super::INTEGRATION_ID;

#[derive(Clone)]
pub struct OnThisDayState {
    pub pool: sqlx::SqlitePool,
    pub client: reqwest::Client,
    pub cache: Arc<OnThisDayCache>,
}

pub struct OnThisDayCache {
    entry: RwLock<Option<CacheEntry>>,
}

struct CacheEntry {
    response: OnThisDayResponse,
    date_key: String,
    fetched_at: Instant,
}

impl OnThisDayCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    pub async fn get(&self, date_key: &str) -> Option<OnThisDayResponse> {
        let entry = self.entry.read().await;
        let entry = entry.as_ref()?;
        if entry.date_key != date_key {
            return None;
        }
        // Cache for 6 hours (re-filter a few times per day in case Ollama results vary)
        if entry.fetched_at.elapsed().as_secs() > 6 * 3600 {
            return None;
        }
        Some(entry.response.clone())
    }

    pub async fn set(&self, date_key: &str, response: OnThisDayResponse) {
        let mut entry = self.entry.write().await;
        *entry = Some(CacheEntry {
            response,
            date_key: date_key.to_string(),
            fetched_at: Instant::now(),
        });
    }
}

const WIKI_BASE: &str = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday";

async fn fetch_selected(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiEvent> {
    let url = format!("{}/selected/{:02}/{:02}", WIKI_BASE, month, day);
    client
        .get(&url)
        .send()
        .await
        .ok()
        .and_then(|r| if r.status().is_success() { Some(r) } else { None })
        .and_then(|r| futures::executor::block_on(r.json::<WikiSelectedResponse>()).ok())
        .and_then(|r| r.selected)
        .unwrap_or_default()
}

async fn fetch_births(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiBirth> {
    let url = format!("{}/births/{:02}/{:02}", WIKI_BASE, month, day);
    client
        .get(&url)
        .send()
        .await
        .ok()
        .and_then(|r| if r.status().is_success() { Some(r) } else { None })
        .and_then(|r| futures::executor::block_on(r.json::<WikiBirthsResponse>()).ok())
        .and_then(|r| r.births)
        .unwrap_or_default()
}

async fn fetch_holidays(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiHoliday> {
    let url = format!("{}/holidays/{:02}/{:02}", WIKI_BASE, month, day);
    client
        .get(&url)
        .send()
        .await
        .ok()
        .and_then(|r| if r.status().is_success() { Some(r) } else { None })
        .and_then(|r| futures::executor::block_on(r.json::<WikiHolidaysResponse>()).ok())
        .and_then(|r| r.holidays)
        .unwrap_or_default()
}

async fn is_family_friendly(
    client: &reqwest::Client,
    ollama_url: &str,
    text: &str,
) -> bool {
    let prompt = format!(
        "Is this historical event appropriate for a family kitchen dashboard seen by young children? \
         Only say yes if the content is free of violence, crime, disasters, and death. \
         Answer only 'yes' or 'no'.\n\nEvent: {}",
        text
    );

    let resp = client
        .post(format!("{}/api/generate", ollama_url.trim_end_matches('/')))
        .json(&serde_json::json!({
            "model": "llama3.2",
            "prompt": prompt,
            "stream": false,
        }))
        .send()
        .await;

    let resp = match resp {
        Ok(r) if r.status().is_success() => r,
        _ => return false,
    };

    let data: serde_json::Value = match resp.json().await {
        Ok(d) => d,
        Err(_) => return false,
    };

    let answer = data["response"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_lowercase();

    answer.starts_with("yes")
}

fn pick_births(wiki_births: &[WikiBirth]) -> Vec<OnThisDayBirth> {
    wiki_births
        .iter()
        .filter_map(|b| {
            let year = b.year?;
            let description = b
                .pages
                .as_ref()
                .and_then(|pages| pages.first())
                .and_then(|p| p.description.clone())
                .unwrap_or_default();
            if description.is_empty() {
                return None;
            }
            // Extract name from text — Wikipedia format is "Name, description"
            let name = b.text.split(',').next().unwrap_or(&b.text).trim().to_string();
            Some(OnThisDayBirth {
                year,
                name,
                role: description,
            })
        })
        .take(3)
        .collect()
}

pub async fn get_events(
    State(state): State<OnThisDayState>,
) -> Result<Json<OnThisDayResponse>, AppError> {
    let now = chrono::Local::now();
    let month = now.month();
    let day = now.day();
    let date_key = format!("{:02}_{:02}", month, day);

    // Check cache
    if let Some(cached) = state.cache.get(&date_key).await {
        return Ok(Json(cached));
    }

    // Fetch all three endpoints in parallel
    let (selected, births, holidays) = tokio::join!(
        fetch_selected(&state.client, month, day),
        fetch_births(&state.client, month, day),
        fetch_holidays(&state.client, month, day),
    );

    // Filter events through Ollama
    let config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);
    let ollama_url = config.get_or("ollama_url", "http://localhost:11434").await?;

    let mut filtered_events: Vec<OnThisDayEvent> = Vec::new();

    for event in &selected {
        if is_family_friendly(&state.client, &ollama_url, &event.text).await {
            filtered_events.push(OnThisDayEvent {
                year: event.year,
                text: event.text.clone(),
            });
        }
    }

    // Add holidays as events (always appropriate)
    for holiday in &holidays {
        filtered_events.push(OnThisDayEvent {
            year: None,
            text: holiday.text.clone(),
        });
    }

    // Pick notable births
    let picked_births = pick_births(&births);

    let response = OnThisDayResponse {
        events: filtered_events,
        births: picked_births,
    };

    // Cache
    state.cache.set(&date_key, response.clone()).await;

    Ok(Json(response))
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

Will still fail — module not registered yet.

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/on_this_day/routes.rs
git commit -m "feat(on-this-day): add backend routes with Wikipedia fetch, Ollama filter, and cache"
```

---

### Task 3: Create module and register integration

**Files:**
- Create: `backend/src/integrations/on_this_day/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create the module file**

```rust
pub mod routes;
pub mod types;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "on_this_day";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::OnThisDayState {
        pool,
        client: reqwest::Client::new(),
        cache: Arc::new(routes::OnThisDayCache::new()),
    };

    Router::new()
        .route("/events", axum::routing::get(routes::get_events))
        .with_state(state)
}
```

- [ ] **Step 2: Register in integrations mod.rs**

Add `pub mod on_this_day;` to the module declarations and `.nest("/on-this-day", on_this_day::router(pool.clone()))` to the router function.

- [ ] **Step 3: Fix the async fetch functions**

The `fetch_selected`, `fetch_births`, and `fetch_holidays` functions in `routes.rs` use `futures::executor::block_on` which is wrong in an async context. Replace each with proper async — the `.json()` call is already async, so just `.await` it directly. Replace each fetch function body pattern from:

```rust
        .and_then(|r| futures::executor::block_on(r.json::<WikiSelectedResponse>()).ok())
```

To use a proper async approach. Rewrite each fetch function to use match/if-let instead of chaining:

Replace `fetch_selected`:

```rust
async fn fetch_selected(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiEvent> {
    let url = format!("{}/selected/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };
    resp.json::<WikiSelectedResponse>()
        .await
        .ok()
        .and_then(|r| r.selected)
        .unwrap_or_default()
}
```

Replace `fetch_births`:

```rust
async fn fetch_births(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiBirth> {
    let url = format!("{}/births/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };
    resp.json::<WikiBirthsResponse>()
        .await
        .ok()
        .and_then(|r| r.births)
        .unwrap_or_default()
}
```

Replace `fetch_holidays`:

```rust
async fn fetch_holidays(client: &reqwest::Client, month: u32, day: u32) -> Vec<WikiHoliday> {
    let url = format!("{}/holidays/{:02}/{:02}", WIKI_BASE, month, day);
    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };
    resp.json::<WikiHolidaysResponse>()
        .await
        .ok()
        .and_then(|r| r.holidays)
        .unwrap_or_default()
}
```

- [ ] **Step 4: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

Should compile now.

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/on_this_day/ backend/src/integrations/mod.rs
git commit -m "feat(on-this-day): register backend integration with router"
```

---

## Chunk 2: Frontend Integration

### Task 4: Create frontend integration config and data hook

**Files:**
- Create: `frontend/src/integrations/on-this-day/config.ts`
- Create: `frontend/src/integrations/on-this-day/useOnThisDay.ts`

- [ ] **Step 1: Create the integration config**

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const onThisDayIntegration = defineIntegration({
  id: 'on-this-day',
  name: 'On This Day',
  schema: z.object({
    ollama_url: z.string().optional().default('http://localhost:11434'),
  }),
  fields: {
    ollama_url: { label: 'Ollama URL', description: 'URL for Ollama API (for content filtering)' },
  },
})
```

- [ ] **Step 2: Create the data hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { onThisDayIntegration } from './config'

export interface OnThisDayEvent {
  year: number | null
  text: string
}

export interface OnThisDayBirth {
  year: number
  name: string
  role: string
}

export interface OnThisDayData {
  events: OnThisDayEvent[]
  births: OnThisDayBirth[]
}

export function useOnThisDay() {
  return useQuery({
    queryKey: ['on-this-day', 'events'],
    queryFn: () => onThisDayIntegration.api.get<OnThisDayData>('/events'),
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 60 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/integrations/on-this-day/config.ts frontend/src/integrations/on-this-day/useOnThisDay.ts
git commit -m "feat(on-this-day): add frontend integration config and data hook"
```

---

### Task 5: Rewrite OnThisDayWidget

**Files:**
- Modify: `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx`

- [ ] **Step 1: Rewrite the widget**

Replace the entire file:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { WidgetCard } from '@/ui/WidgetCard'
import type { WidgetSize } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'
import type { OnThisDayBirth } from './useOnThisDay'

interface OnThisDayWidgetProps {
  size?: WidgetSize
}

const CYCLE_INTERVAL_MS = 30_000

function BirthsFooter({ births }: { births: OnThisDayBirth[] }) {
  if (births.length === 0) return null

  return (
    <div className="mt-auto pt-2 border-t border-border">
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-1">
        Also Born Today
      </div>
      <div className="flex flex-col gap-0.5">
        {births.map((b, i) => (
          <div key={i} className="flex justify-between text-[12px]">
            <span className="text-text-primary truncate mr-2">{b.name}</span>
            <span className="text-text-muted whitespace-nowrap">{b.year} · {b.role}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OnThisDayWidget({ size = 'standard' }: OnThisDayWidgetProps) {
  const { data, isLoading } = useOnThisDay()
  const [index, setIndex] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)

  const events = data?.events ?? []
  const births = data?.births ?? []

  // Auto-cycle timer — resets when cycleKey changes (manual advance)
  useEffect(() => {
    if (events.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length)
    }, CYCLE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [events.length, cycleKey])

  const advance = useCallback(() => {
    if (events.length > 0) {
      setIndex((prev) => (prev + 1) % events.length)
      setCycleKey((prev) => prev + 1) // Reset auto-cycle timer
    }
  }, [events.length])

  if (isLoading || events.length === 0) {
    return (
      <WidgetCard title="On This Day" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'No events today'}
        </div>
      </WidgetCard>
    )
  }

  const event = events[index % events.length]

  if (size === 'compact') {
    return (
      <WidgetCard
        title="On This Day"
        category="info"
        detail={
          <div className="flex flex-col gap-2">
            {event.year && (
              <div className="text-4xl font-extrabold text-palette-3 leading-none tracking-tight">
                {event.year}
              </div>
            )}
            <p className="text-text-primary text-sm leading-relaxed">{event.text}</p>
            <BirthsFooter births={births} />
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          {event.year && (
            <div className="text-xl font-extrabold text-palette-3 leading-none">{event.year}</div>
          )}
          <p className="text-text-primary text-xs leading-snug line-clamp-2">{event.text}</p>
        </div>
      </WidgetCard>
    )
  }

  // Standard
  return (
    <WidgetCard title="On This Day" category="info">
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {event.year && (
              <div className="text-4xl font-extrabold text-palette-3 leading-none tracking-tight">
                {event.year}
              </div>
            )}
            <p className="text-text-primary text-sm leading-relaxed mt-2">
              {event.text}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              advance()
            }}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors flex-shrink-0"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <BirthsFooter births={births} />
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/on-this-day/OnThisDayWidget.tsx
git commit -m "feat(on-this-day): rewrite widget with backend data, auto-cycle, births footer"
```

---

### Task 6: Update useWidgetMeta to use backend data

**Files:**
- Modify: `frontend/src/integrations/on-this-day/useWidgetMeta.ts`

- [ ] **Step 1: Update the hook**

Replace the entire file:

```typescript
import type { WidgetMeta } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  const { data } = useOnThisDay()
  const events = data?.events ?? []

  if (events.length === 0) {
    return { visible: true, preferredSize: 'standard', priority: 0 }
  }

  return { visible: true, preferredSize: 'standard', priority: 0 }
}
```

Note: On This Day stays always visible (priority 0) — it's the filler widget. If the backend returns no events (Ollama filtered everything or Wikipedia is down), it still shows with "No events today" rather than disappearing, so the widget meta always returns visible. The widget itself handles the empty state.

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/integrations/on-this-day/useWidgetMeta.ts
git commit -m "feat(on-this-day): update useWidgetMeta to use backend data hook"
```
