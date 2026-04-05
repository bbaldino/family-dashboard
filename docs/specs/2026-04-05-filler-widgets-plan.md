# Filler Widgets Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three filler widgets — Word of the Day, Daily Quote, and Trivia — as independent integrations that fill empty dashboard slots.

**Architecture:** Each widget follows the same pattern: backend Rust integration (fetch external API, cache 24h, serve endpoint) + frontend React integration (data hook, widget component, meta hook). All three are registered in the integration registry and wired into HomeBoard as priority-0 filler widgets.

**Tech Stack:** Rust/Axum (backend), React/TypeScript (frontend), Wordnik API, ZenQuotes API, Open Trivia DB

**Spec:** `docs/specs/2026-04-05-filler-widgets-design.md`

---

## File Structure

### Word of the Day

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/word_of_the_day/mod.rs` | Module, router |
| `backend/src/integrations/word_of_the_day/routes.rs` | Handler, Wordnik fetch, cache |
| `frontend/src/integrations/word-of-the-day/config.ts` | Integration definition |
| `frontend/src/integrations/word-of-the-day/useWordOfTheDay.ts` | Data hook |
| `frontend/src/integrations/word-of-the-day/WordOfTheDayWidget.tsx` | Widget component |
| `frontend/src/integrations/word-of-the-day/useWidgetMeta.ts` | Always visible, priority 0 |

### Daily Quote

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/daily_quote/mod.rs` | Module, router |
| `backend/src/integrations/daily_quote/routes.rs` | Handler, ZenQuotes fetch, cache |
| `frontend/src/integrations/daily-quote/config.ts` | Integration definition |
| `frontend/src/integrations/daily-quote/useDailyQuote.ts` | Data hook |
| `frontend/src/integrations/daily-quote/DailyQuoteWidget.tsx` | Widget component |
| `frontend/src/integrations/daily-quote/useWidgetMeta.ts` | Always visible, priority 0 |

### Trivia

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/trivia/mod.rs` | Module, router |
| `backend/src/integrations/trivia/routes.rs` | Handler, Open Trivia DB fetch, cache |
| `frontend/src/integrations/trivia/config.ts` | Integration definition |
| `frontend/src/integrations/trivia/useTrivia.ts` | Data hook |
| `frontend/src/integrations/trivia/TriviaWidget.tsx` | Widget component |
| `frontend/src/integrations/trivia/useWidgetMeta.ts` | Always visible, priority 0 |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Register all three modules and routes |
| `frontend/src/integrations/registry.ts` | Register all three integrations |
| `frontend/src/boards/HomeBoard.tsx` | Add widgets + meta hooks |

---

## Chunk 1: Word of the Day

### Task 1: Backend — Word of the Day

**Files:**
- Create: `backend/src/integrations/word_of_the_day/routes.rs`
- Create: `backend/src/integrations/word_of_the_day/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create routes.rs**

```rust
use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;
use crate::integrations::IntegrationConfig;

use super::INTEGRATION_ID;

#[derive(Clone)]
pub struct WordState {
    pub pool: sqlx::SqlitePool,
    pub client: reqwest::Client,
    pub cache: Arc<WordCache>,
}

pub struct WordCache {
    entry: RwLock<Option<CacheEntry>>,
}

struct CacheEntry {
    response: WordResponse,
    fetched_at: Instant,
}

impl WordCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    pub async fn get(&self) -> Option<WordResponse> {
        let entry = self.entry.read().await;
        let entry = entry.as_ref()?;
        if entry.fetched_at.elapsed().as_secs() > 24 * 3600 {
            return None;
        }
        Some(entry.response.clone())
    }

    pub async fn set(&self, response: WordResponse) {
        let mut entry = self.entry.write().await;
        *entry = Some(CacheEntry {
            response,
            fetched_at: Instant::now(),
        });
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordResponse {
    pub word: String,
    pub part_of_speech: Option<String>,
    pub definition: String,
    pub example: Option<String>,
}

pub async fn get_today(State(state): State<WordState>) -> Result<Json<WordResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    let config = IntegrationConfig::new(&state.pool, INTEGRATION_ID);
    let api_key = config.get("api_key").await?;

    let url = format!(
        "https://api.wordnik.com/v4/words.json/wordOfTheDay?api_key={}",
        api_key
    );

    let resp = state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Wordnik request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Wordnik error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Wordnik parse failed: {}", e)))?;

    let word = data["word"].as_str().unwrap_or("").to_string();

    let definition = data["definitions"]
        .as_array()
        .and_then(|d| d.first())
        .and_then(|d| d["text"].as_str())
        .unwrap_or("")
        .to_string();

    let part_of_speech = data["definitions"]
        .as_array()
        .and_then(|d| d.first())
        .and_then(|d| d["partOfSpeech"].as_str())
        .map(|s| s.to_string());

    let example = data["examples"]
        .as_array()
        .and_then(|e| e.first())
        .and_then(|e| e["text"].as_str())
        .map(|s| s.to_string());

    let response = WordResponse {
        word,
        part_of_speech,
        definition,
        example,
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}
```

- [ ] **Step 2: Create mod.rs**

```rust
pub mod routes;

use std::sync::Arc;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "word_of_the_day";

pub fn router(pool: SqlitePool) -> Router {
    let state = routes::WordState {
        pool,
        client: reqwest::Client::new(),
        cache: Arc::new(routes::WordCache::new()),
    };

    Router::new()
        .route("/today", axum::routing::get(routes::get_today))
        .with_state(state)
}
```

- [ ] **Step 3: Register in integrations mod.rs**

Add `pub mod word_of_the_day;` to the module declarations and `.nest("/word-of-the-day", word_of_the_day::router(pool.clone()))` to the router.

- [ ] **Step 4: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/word_of_the_day/ backend/src/integrations/mod.rs
git commit -m "feat: add Word of the Day backend integration with Wordnik API"
```

---

### Task 2: Frontend — Word of the Day

**Files:**
- Create: `frontend/src/integrations/word-of-the-day/config.ts`
- Create: `frontend/src/integrations/word-of-the-day/useWordOfTheDay.ts`
- Create: `frontend/src/integrations/word-of-the-day/WordOfTheDayWidget.tsx`
- Create: `frontend/src/integrations/word-of-the-day/useWidgetMeta.ts`

- [ ] **Step 1: Create config.ts**

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const wordOfTheDayIntegration = defineIntegration({
  id: 'word-of-the-day',
  name: 'Word of the Day',
  schema: z.object({
    api_key: z.string().min(1, 'Wordnik API key is required'),
  }),
  fields: {
    api_key: { label: 'Wordnik API Key', type: 'secret', description: 'Free key from developer.wordnik.com' },
  },
})
```

- [ ] **Step 2: Create useWordOfTheDay.ts**

```typescript
import { useQuery } from '@tanstack/react-query'
import { wordOfTheDayIntegration } from './config'

export interface WordOfTheDayData {
  word: string
  partOfSpeech: string | null
  definition: string
  example: string | null
}

export function useWordOfTheDay() {
  return useQuery({
    queryKey: ['word-of-the-day'],
    queryFn: () => wordOfTheDayIntegration.api.get<WordOfTheDayData>('/today'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
```

- [ ] **Step 3: Create WordOfTheDayWidget.tsx**

```typescript
import { WidgetCard } from '@/ui/WidgetCard'
import { useWordOfTheDay } from './useWordOfTheDay'

export function WordOfTheDayWidget() {
  const { data, isLoading, error } = useWordOfTheDay()

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Word of the Day" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Word of the Day" category="info">
      <div className="flex flex-col gap-1.5 h-full">
        <div>
          <span className="text-2xl font-bold text-palette-3">{data.word}</span>
          {data.partOfSpeech && (
            <span className="text-xs text-text-muted italic ml-2">{data.partOfSpeech}</span>
          )}
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{data.definition}</p>
        {data.example && (
          <p className="text-xs text-text-muted italic mt-auto leading-relaxed">
            "{data.example}"
          </p>
        )}
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 4: Create useWidgetMeta.ts**

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useWordOfTheDayWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
```

- [ ] **Step 5: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/integrations/word-of-the-day/
git commit -m "feat: add Word of the Day frontend widget"
```

---

## Chunk 2: Daily Quote

### Task 3: Backend — Daily Quote

**Files:**
- Create: `backend/src/integrations/daily_quote/routes.rs`
- Create: `backend/src/integrations/daily_quote/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create routes.rs**

```rust
use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;

#[derive(Clone)]
pub struct QuoteState {
    pub client: reqwest::Client,
    pub cache: Arc<QuoteCache>,
}

pub struct QuoteCache {
    entry: RwLock<Option<CacheEntry>>,
}

struct CacheEntry {
    response: QuoteResponse,
    fetched_at: Instant,
}

impl QuoteCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    pub async fn get(&self) -> Option<QuoteResponse> {
        let entry = self.entry.read().await;
        let entry = entry.as_ref()?;
        if entry.fetched_at.elapsed().as_secs() > 24 * 3600 {
            return None;
        }
        Some(entry.response.clone())
    }

    pub async fn set(&self, response: QuoteResponse) {
        let mut entry = self.entry.write().await;
        *entry = Some(CacheEntry {
            response,
            fetched_at: Instant::now(),
        });
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QuoteResponse {
    pub quote: String,
    pub author: String,
}

pub async fn get_today(State(state): State<QuoteState>) -> Result<Json<QuoteResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    let resp = state
        .client
        .get("https://zenquotes.io/api/today")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ZenQuotes request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("ZenQuotes error: {}", body)));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("ZenQuotes parse failed: {}", e)))?;

    let first = data
        .as_array()
        .and_then(|a| a.first())
        .ok_or_else(|| AppError::Internal("ZenQuotes returned empty array".to_string()))?;

    let response = QuoteResponse {
        quote: first["q"].as_str().unwrap_or("").to_string(),
        author: first["a"].as_str().unwrap_or("Unknown").to_string(),
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}
```

- [ ] **Step 2: Create mod.rs**

```rust
pub mod routes;

use std::sync::Arc;

use axum::Router;

pub fn router() -> Router {
    let state = routes::QuoteState {
        client: reqwest::Client::new(),
        cache: Arc::new(routes::QuoteCache::new()),
    };

    Router::new()
        .route("/today", axum::routing::get(routes::get_today))
        .with_state(state)
}
```

Note: no `pool` needed — ZenQuotes has no API key or config.

- [ ] **Step 3: Register in integrations mod.rs**

Add `pub mod daily_quote;` and `.nest("/daily-quote", daily_quote::router())` — note no `pool.clone()` argument since this integration doesn't need the database.

- [ ] **Step 4: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/daily_quote/ backend/src/integrations/mod.rs
git commit -m "feat: add Daily Quote backend integration with ZenQuotes API"
```

---

### Task 4: Frontend — Daily Quote

**Files:**
- Create: `frontend/src/integrations/daily-quote/config.ts`
- Create: `frontend/src/integrations/daily-quote/useDailyQuote.ts`
- Create: `frontend/src/integrations/daily-quote/DailyQuoteWidget.tsx`
- Create: `frontend/src/integrations/daily-quote/useWidgetMeta.ts`

- [ ] **Step 1: Create config.ts**

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const dailyQuoteIntegration = defineIntegration({
  id: 'daily-quote',
  name: 'Daily Quote',
  schema: z.object({}),
  fields: {},
})
```

- [ ] **Step 2: Create useDailyQuote.ts**

```typescript
import { useQuery } from '@tanstack/react-query'
import { dailyQuoteIntegration } from './config'

export interface DailyQuoteData {
  quote: string
  author: string
}

export function useDailyQuote() {
  return useQuery({
    queryKey: ['daily-quote'],
    queryFn: () => dailyQuoteIntegration.api.get<DailyQuoteData>('/today'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
```

- [ ] **Step 3: Create DailyQuoteWidget.tsx**

```typescript
import { WidgetCard } from '@/ui/WidgetCard'
import { useDailyQuote } from './useDailyQuote'

export function DailyQuoteWidget() {
  const { data, isLoading, error } = useDailyQuote()

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Daily Quote" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Daily Quote" category="info">
      <div className="flex flex-col gap-2 h-full">
        <p className="text-sm text-text-primary italic leading-relaxed flex-1">
          "{data.quote}"
        </p>
        <p className="text-xs text-text-muted text-right">
          — {data.author}
        </p>
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 4: Create useWidgetMeta.ts**

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useDailyQuoteWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
```

- [ ] **Step 5: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/integrations/daily-quote/
git commit -m "feat: add Daily Quote frontend widget"
```

---

## Chunk 3: Trivia

### Task 5: Backend — Trivia

**Files:**
- Create: `backend/src/integrations/trivia/routes.rs`
- Create: `backend/src/integrations/trivia/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create routes.rs**

```rust
use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::extract::State;
use serde::Serialize;
use tokio::sync::RwLock;

use crate::error::AppError;

#[derive(Clone)]
pub struct TriviaState {
    pub client: reqwest::Client,
    pub cache: Arc<TriviaCache>,
}

pub struct TriviaCache {
    entry: RwLock<Option<CacheEntry>>,
}

struct CacheEntry {
    response: TriviaResponse,
    fetched_at: Instant,
}

impl TriviaCache {
    pub fn new() -> Self {
        Self {
            entry: RwLock::new(None),
        }
    }

    pub async fn get(&self) -> Option<TriviaResponse> {
        let entry = self.entry.read().await;
        let entry = entry.as_ref()?;
        if entry.fetched_at.elapsed().as_secs() > 24 * 3600 {
            return None;
        }
        Some(entry.response.clone())
    }

    pub async fn set(&self, response: TriviaResponse) {
        let mut entry = self.entry.write().await;
        *entry = Some(CacheEntry {
            response,
            fetched_at: Instant::now(),
        });
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TriviaResponse {
    pub question: String,
    pub category: String,
    pub choices: Vec<String>,
    pub correct_index: usize,
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&apos;", "'")
        .replace("&oacute;", "ó")
        .replace("&eacute;", "é")
        .replace("&ntilde;", "ñ")
        .replace("&uuml;", "ü")
        .replace("&ouml;", "ö")
        .replace("&auml;", "ä")
        .replace("&iuml;", "ï")
        .replace("&lrm;", "")
        .replace("&shy;", "")
}

pub async fn get_question(
    State(state): State<TriviaState>,
) -> Result<Json<TriviaResponse>, AppError> {
    if let Some(cached) = state.cache.get().await {
        return Ok(Json(cached));
    }

    let resp = state
        .client
        .get("https://opentdb.com/api.php?amount=1&difficulty=easy&type=multiple")
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Open Trivia DB request failed: {}", e)))?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Open Trivia DB error: {}",
            body
        )));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Open Trivia DB parse failed: {}", e)))?;

    let result = data["results"]
        .as_array()
        .and_then(|r| r.first())
        .ok_or_else(|| AppError::Internal("Open Trivia DB returned no results".to_string()))?;

    let question = decode_html_entities(result["question"].as_str().unwrap_or(""));
    let category = decode_html_entities(result["category"].as_str().unwrap_or("General"));
    let correct = decode_html_entities(result["correct_answer"].as_str().unwrap_or(""));

    let incorrect: Vec<String> = result["incorrect_answers"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| decode_html_entities(s)))
                .collect()
        })
        .unwrap_or_default();

    // Shuffle correct answer into the choices at a deterministic position
    // Use the question length as a simple seed for placement
    let mut choices = incorrect;
    let insert_pos = question.len() % (choices.len() + 1);
    choices.insert(insert_pos, correct);

    let response = TriviaResponse {
        question,
        category,
        correct_index: insert_pos,
        choices,
    };

    state.cache.set(response.clone()).await;

    Ok(Json(response))
}
```

- [ ] **Step 2: Create mod.rs**

```rust
pub mod routes;

use std::sync::Arc;

use axum::Router;

pub fn router() -> Router {
    let state = routes::TriviaState {
        client: reqwest::Client::new(),
        cache: Arc::new(routes::TriviaCache::new()),
    };

    Router::new()
        .route("/question", axum::routing::get(routes::get_question))
        .with_state(state)
}
```

- [ ] **Step 3: Register in integrations mod.rs**

Add `pub mod trivia;` and `.nest("/trivia", trivia::router())`.

- [ ] **Step 4: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/trivia/ backend/src/integrations/mod.rs
git commit -m "feat: add Trivia backend integration with Open Trivia DB"
```

---

### Task 6: Frontend — Trivia

**Files:**
- Create: `frontend/src/integrations/trivia/config.ts`
- Create: `frontend/src/integrations/trivia/useTrivia.ts`
- Create: `frontend/src/integrations/trivia/TriviaWidget.tsx`
- Create: `frontend/src/integrations/trivia/useWidgetMeta.ts`

- [ ] **Step 1: Create config.ts**

```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const triviaIntegration = defineIntegration({
  id: 'trivia',
  name: 'Trivia',
  schema: z.object({}),
  fields: {},
})
```

- [ ] **Step 2: Create useTrivia.ts**

```typescript
import { useQuery } from '@tanstack/react-query'
import { triviaIntegration } from './config'

export interface TriviaData {
  question: string
  category: string
  choices: string[]
  correctIndex: number
}

export function useTrivia() {
  return useQuery({
    queryKey: ['trivia'],
    queryFn: () => triviaIntegration.api.get<TriviaData>('/question'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
```

- [ ] **Step 3: Create TriviaWidget.tsx**

```typescript
import { useState, useCallback } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { useTrivia } from './useTrivia'

const LETTERS = ['A', 'B', 'C', 'D']

export function TriviaWidget() {
  const { data, isLoading, error } = useTrivia()
  const [revealed, setRevealed] = useState(false)

  const handleTap = useCallback(() => {
    setRevealed((prev) => !prev)
  }, [])

  if (isLoading || error || !data) {
    return (
      <WidgetCard title="Trivia" category="info">
        <div className="text-text-muted text-sm">
          {isLoading ? 'Loading...' : 'Unable to load'}
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Trivia" category="info">
      <div className="flex flex-col gap-2 h-full cursor-pointer" onClick={handleTap}>
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px]">
          {data.category}
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{data.question}</p>
        <div className="grid grid-cols-2 gap-1.5 mt-auto">
          {data.choices.map((choice, i) => {
            const isCorrect = i === data.correctIndex
            let className =
              'text-xs px-2 py-1.5 rounded border text-left transition-colors '
            if (revealed) {
              className += isCorrect
                ? 'border-success bg-success/10 text-success font-medium'
                : 'border-border text-text-muted opacity-50'
            } else {
              className += 'border-border text-text-primary hover:bg-bg-card-hover'
            }
            return (
              <div key={i} className={className}>
                <span className="font-medium text-text-muted mr-1">{LETTERS[i]}.</span>
                {choice}
              </div>
            )
          })}
        </div>
        {!revealed && (
          <div className="text-[10px] text-text-muted text-center">Tap to reveal answer</div>
        )}
      </div>
    </WidgetCard>
  )
}
```

- [ ] **Step 4: Create useWidgetMeta.ts**

```typescript
import type { WidgetMeta } from '@/lib/widget-types'

export function useTriviaWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
```

- [ ] **Step 5: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/integrations/trivia/
git commit -m "feat: add Trivia frontend widget with tap-to-reveal"
```

---

## Chunk 4: Wire Everything Together

### Task 7: Register all widgets and wire into HomeBoard

**Files:**
- Modify: `frontend/src/integrations/registry.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`

- [ ] **Step 1: Register integrations in registry.ts**

Add imports:

```typescript
import { wordOfTheDayIntegration } from './word-of-the-day/config'
import { dailyQuoteIntegration } from './daily-quote/config'
import { triviaIntegration } from './trivia/config'
```

Add to the array:

```typescript
  wordOfTheDayIntegration,
  dailyQuoteIntegration,
  triviaIntegration,
```

- [ ] **Step 2: Wire into HomeBoard**

Add imports:

```typescript
import { WordOfTheDayWidget } from '@/integrations/word-of-the-day/WordOfTheDayWidget'
import { useWordOfTheDayWidgetMeta } from '@/integrations/word-of-the-day/useWidgetMeta'
import { DailyQuoteWidget } from '@/integrations/daily-quote/DailyQuoteWidget'
import { useDailyQuoteWidgetMeta } from '@/integrations/daily-quote/useWidgetMeta'
import { TriviaWidget } from '@/integrations/trivia/TriviaWidget'
import { useTriviaWidgetMeta } from '@/integrations/trivia/useWidgetMeta'
```

In the `Widgets` function, add the meta hooks:

```typescript
  const wordMeta = useWordOfTheDayWidgetMeta()
  const quoteMeta = useDailyQuoteWidgetMeta()
  const triviaMeta = useTriviaWidgetMeta()
```

Add to the `allWidgets` array:

```typescript
    { key: 'word-of-the-day', element: <WordOfTheDayWidget />, meta: wordMeta, maxSize: maxSizes['word-of-the-day'] },
    { key: 'daily-quote', element: <DailyQuoteWidget />, meta: quoteMeta, maxSize: maxSizes['daily-quote'] },
    { key: 'trivia', element: <TriviaWidget />, meta: triviaMeta, maxSize: maxSizes['trivia'] },
```

- [ ] **Step 3: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 4: Verify build**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/integrations/registry.ts frontend/src/boards/HomeBoard.tsx
git commit -m "feat: wire Word of the Day, Daily Quote, and Trivia into dashboard"
```
