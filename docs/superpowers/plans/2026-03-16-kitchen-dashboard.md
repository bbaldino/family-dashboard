# Kitchen Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a kitchen dashboard SPA with Rust backend, deploying to a wall-mounted Android tablet running Fully Kiosk Browser.

**Architecture:** React SPA served by an Axum/Rust backend. The backend provides REST APIs for custom data (chores, lunch menus) and proxies Google Calendar OAuth. The frontend uses HAKit for HA integration (opt-in per widget), direct WebRTC for camera feeds, and the Dashboard API for everything else. Admin routes live in the same SPA under `/admin`.

**Tech Stack:** React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui, Rust + Axum + SQLite (sqlx), HAKit, React Router

**Spec:** `docs/superpowers/specs/2026-03-15-kitchen-dashboard-design.md`
**Design reference:** `docs/design-reference.html`

**Deferred to Wave 2:** Grocery list CRUD, countdown CRUD, sports scores, media player, other cameras, doorbell two-way audio, grocery admin page, countdown admin page. The Home Board includes placeholder cards for countdowns and sports — these show static content until Wave 2 APIs exist.

**Environment variables needed:**
- Backend: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Frontend: `VITE_HA_URL`, `VITE_GO2RTC_URL`

---

## File Structure

### Backend (`backend/`)

```
backend/
  Cargo.toml
  src/
    main.rs                    -- Axum server setup, router, static file serving
    lib.rs                     -- public module re-exports for tests
    db.rs                      -- SQLite pool setup, migrations
    error.rs                   -- AppError type, IntoResponse impl
    routes/
      mod.rs                   -- router assembly
      chores.rs                -- chore CRUD + assignment endpoints
      lunch_menu.rs            -- lunch menu get/upsert endpoints
      google_auth.rs           -- OAuth initiate + callback
      google_calendar.rs       -- calendar list + events proxy
    models/
      mod.rs
      chore.rs                 -- Chore, ChoreAssignment structs
      lunch_menu.rs            -- LunchMenu, LunchDay structs
      google.rs                -- OAuthToken, CalendarEvent structs
  migrations/
    001_initial.sql            -- chores, chore_assignments, lunch_menus, google_tokens tables
  tests/
    api/
      mod.rs
      chores_test.rs
      lunch_menu_test.rs
    helpers.rs                 -- test app setup, test database
```

### Frontend (`frontend/`)

```
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx                   -- React entry point
    App.tsx                    -- Router setup
    app/
      AppShell.tsx             -- tab bar + Outlet
    boards/
      HomeBoard.tsx            -- main dashboard layout (4-column grid)
      MediaBoard.tsx           -- placeholder
      CamerasBoard.tsx         -- placeholder
    widgets/
      clock/
        ClockWidget.tsx
        index.ts
      weather/
        WeatherWidget.tsx
        WeatherDetail.tsx
        index.ts
      calendar/
        CalendarWidget.tsx
        CalendarDetail.tsx
        useGoogleCalendar.ts
        index.ts
      chores/
        ChoresWidget.tsx
        ChoresDetail.tsx
        useChores.ts
        index.ts
      lunch-menu/
        LunchMenuWidget.tsx
        useLunchMenu.ts
        index.ts
      doorbell/
        DoorbellWidget.tsx
        useWebRtcStream.ts
        index.ts
    hooks/
      useHaEntity.ts
      useHaService.ts
      usePolling.ts
    ui/
      WidgetCard.tsx           -- card wrapper with colored header + badge
      HeroStrip.tsx            -- top bar: clock, next events, weather
      BottomSheet.tsx          -- detail view overlay
      EventOverlay.tsx         -- event-triggered overlay (e.g. doorbell)
      TabBar.tsx
      Button.tsx
      LoadingSpinner.tsx
      ErrorDisplay.tsx
    lib/
      dashboard-api.ts         -- typed fetch wrapper for backend API
      ha-client.ts             -- HAKit setup
      event-bus.ts             -- event overlay context + hooks
    admin/
      AdminLayout.tsx
      ChoreAdmin.tsx
      LunchMenuAdmin.tsx
    theme/
      variables.css            -- CSS custom properties
```

---

## Phase 1: Skeleton On The Screen

Goal: The dashboard loads on the tablet, looks like the design mockup, with static/placeholder data.

### Task 1: Initialize backend project

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/src/lib.rs`
- Create: `backend/src/db.rs`
- Create: `backend/src/error.rs`
- Create: `backend/src/routes/mod.rs`
- Create: `backend/src/models/mod.rs`
- Create: `backend/migrations/001_initial.sql`

- [ ] **Step 1: Create Cargo project and add dependencies**

```bash
cd /home/bbaldino/work/dashboard
cargo init backend
cd backend
cargo add axum --features json
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add sqlx --features runtime-tokio,sqlite
cargo add tower-http --features fs,cors
cargo add tracing
cargo add tracing-subscriber
cargo add thiserror
cargo add chrono --features serde
cargo add reqwest --features json
cargo add urlencoding
```

- [ ] **Step 2: Write lib.rs**

```rust
// backend/src/lib.rs
pub mod db;
pub mod error;
pub mod models;
pub mod routes;
```

- [ ] **Step 3: Write main.rs**

```rust
// backend/src/main.rs
use dashboard_backend::{db, routes};
use std::net::SocketAddr;
use tower_http::services::ServeDir;

#[tokio::main]
async fn main() {
    tracing_subscriber::init();

    let pool = db::init_pool().await;

    let google_config = routes::GoogleOAuthConfig {
        client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        client_secret: std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default(),
        redirect_uri: std::env::var("GOOGLE_REDIRECT_URI")
            .unwrap_or_else(|_| "http://localhost:3000/api/google/callback".to_string()),
    };

    let api_routes = routes::router(pool.clone(), google_config);

    let app = axum::Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("static"));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

- [ ] **Step 4: Write db.rs**

```rust
// backend/src/db.rs
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

pub async fn init_pool() -> SqlitePool {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:dashboard.db?mode=rwc".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}
```

- [ ] **Step 5: Write error.rs**

```rust
// backend/src/error.rs
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
```

- [ ] **Step 6: Write placeholder routes and models**

```rust
// backend/src/routes/mod.rs
use axum::Router;
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

pub fn router(pool: SqlitePool, _google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .with_state(pool)
}
```

```rust
// backend/src/models/mod.rs
```

- [ ] **Step 7: Write migration**

```sql
-- backend/migrations/001_initial.sql
CREATE TABLE IF NOT EXISTS chores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chore_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
    child_name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    UNIQUE(chore_id, child_name, day_of_week)
);

CREATE TABLE IF NOT EXISTS chore_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES chore_assignments(id) ON DELETE CASCADE,
    completed_date TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(assignment_id, completed_date)
);

CREATE TABLE IF NOT EXISTS lunch_menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_of TEXT NOT NULL UNIQUE,
    menu_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
```

- [ ] **Step 8: Verify it compiles**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo build
```
Expected: builds successfully

- [ ] **Step 9: Create .gitignore and commit**

```
# frontend
frontend/node_modules/
frontend/dist/

# backend
backend/target/
backend/dashboard.db

# superpowers
.superpowers/
```

```bash
git add .gitignore backend/
git commit -m "feat: scaffold Rust backend with Axum, SQLite, and initial schema"
```

---

### Task 2: Initialize frontend project

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`

- [ ] **Step 1: Create Vite project and install dependencies**

```bash
cd /home/bbaldino/work/dashboard
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router-dom lucide-react @hakit/core
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx shadcn@latest init
```
Follow prompts: TypeScript, default style, base color neutral.

- [ ] **Step 3: Configure Vite**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 4: Set up index.html for kiosk**

```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <title>Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify dev server runs**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run dev
```
Expected: Vite dev server starts

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, TypeScript, Tailwind, shadcn/ui"
```

---

### Task 3: Theme variables and shared UI

**Files:**
- Create: `frontend/src/theme/variables.css`
- Create: `frontend/src/ui/WidgetCard.tsx`
- Create: `frontend/src/ui/BottomSheet.tsx`
- Create: `frontend/src/ui/TabBar.tsx`
- Create: `frontend/src/ui/HeroStrip.tsx`
- Create: `frontend/src/ui/Button.tsx`
- Create: `frontend/src/ui/LoadingSpinner.tsx`
- Create: `frontend/src/ui/ErrorDisplay.tsx`

- [ ] **Step 1: Create theme variables matching the design reference**

```css
/* frontend/src/theme/variables.css */
@import "tailwindcss";

@theme {
  /* Background */
  --color-bg-primary: #f3efe9;
  --color-bg-card: #ffffff;
  --color-bg-card-hover: #f5f3ef;
  --color-bg-overlay: rgba(0, 0, 0, 0.3);

  /* Text */
  --color-text-primary: #2a2520;
  --color-text-secondary: #7a6a5a;
  --color-text-muted: #b0a89e;

  /* Category accent colors */
  --color-calendar: #c06830;
  --color-chores: #4a8a4a;
  --color-info: #4a7a9a;
  --color-food: #9a7a30;
  --color-grocery: #8a5a9a;

  /* Status */
  --color-success: #4caf50;
  --color-error: #e53935;

  /* Borders & Shadows */
  --color-border: #f0ece6;
  --color-separator: rgba(0, 0, 0, 0.08);
  --radius-card: 14px;
  --radius-button: 10px;
  --shadow-card: 0 1px 4px rgba(0, 0, 0, 0.05);

  /* Spacing */
  --spacing-card-padding: 12px 14px;
  --spacing-grid-gap: 8px;

  /* Tab bar */
  --height-tab-bar: 52px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

- [ ] **Step 2: Create WidgetCard with colored header**

Reference the design mockup — cards have a header row with colored uppercase title and optional badge, separated by a 2px border from the content.

```tsx
// frontend/src/ui/WidgetCard.tsx
import { ReactNode, useState, useCallback } from 'react'
import { BottomSheet } from './BottomSheet'

type CardCategory = 'calendar' | 'chores' | 'info' | 'food' | 'grocery'

const categoryColors: Record<CardCategory, string> = {
  calendar: 'var(--color-calendar)',
  chores: 'var(--color-chores)',
  info: 'var(--color-info)',
  food: 'var(--color-food)',
  grocery: 'var(--color-grocery)',
}

interface WidgetCardProps {
  title: string
  category: CardCategory
  badge?: string
  detail?: ReactNode
  children: ReactNode
  visible?: boolean
  className?: string
}

export function WidgetCard({
  title,
  category,
  badge,
  detail,
  children,
  visible = true,
  className = '',
}: WidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const color = categoryColors[category]

  const handleTap = useCallback(() => {
    if (detail) setIsExpanded(true)
  }, [detail])

  if (!visible) return null

  return (
    <>
      <div
        className={`bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-[12px_14px] overflow-hidden flex flex-col ${
          detail ? 'cursor-pointer active:bg-bg-card-hover transition-colors' : ''
        } ${className}`}
        onClick={handleTap}
      >
        <div
          className="flex items-center justify-between mb-[6px] pb-[6px]"
          style={{ borderBottom: '2px solid var(--color-border)' }}
        >
          <span
            className="text-[13px] font-bold uppercase tracking-[0.6px]"
            style={{ color }}
          >
            {title}
          </span>
          {badge && (
            <span
              className="text-[11px] font-semibold px-2 py-[2px] rounded-lg"
              style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex-1">{children}</div>
      </div>
      {detail && (
        <BottomSheet isOpen={isExpanded} onClose={() => setIsExpanded(false)}>
          {detail}
        </BottomSheet>
      )}
    </>
  )
}
```

- [ ] **Step 3: Create BottomSheet**

```tsx
// frontend/src/ui/BottomSheet.tsx
import { ReactNode, useEffect, useRef } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  height?: 'partial' | 'full'
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  height = 'partial',
}: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const heightClass = height === 'full' ? 'h-full' : 'h-[85vh]'

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-bg-overlay animate-[fadeIn_200ms_ease-out]" />
      <div
        className={`absolute bottom-0 left-0 right-0 ${heightClass} bg-bg-card rounded-t-[24px] shadow-lg animate-[slideUp_300ms_ease-out] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-bg-card">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create TabBar**

```tsx
// frontend/src/ui/TabBar.tsx
import { NavLink } from 'react-router-dom'
import { Home, Music, Camera, type LucideIcon } from 'lucide-react'

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/media', label: 'Media', icon: Music },
  { to: '/cameras', label: 'Cameras', icon: Camera },
]

export function TabBar() {
  return (
    <nav
      className="flex items-center justify-center gap-[60px] bg-bg-card border-t border-border"
      style={{ height: 'var(--height-tab-bar)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-[2px] px-[14px] py-1 rounded-[var(--radius-button)] transition-colors ${
                isActive
                  ? 'text-calendar bg-calendar/10'
                  : 'text-text-muted'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 5: Create HeroStrip**

This is the top bar with clock, "Next Up"/"Right Now" events, and weather. For Phase 1 it uses static data.

```tsx
// frontend/src/ui/HeroStrip.tsx
import { useState, useEffect } from 'react'

interface HeroEvent {
  name: string
  time: string
  detail?: string
}

interface HeroStripProps {
  events?: HeroEvent[]
  weatherTemp?: string
  weatherCondition?: string
  weatherIcon?: string
}

export function HeroStrip({
  events = [],
  weatherTemp,
  weatherCondition,
  weatherIcon = '☁',
}: HeroStripProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const hasEvents = events.length > 0
  const label = hasEvents ? 'Right Now' : 'Next Up'

  return (
    <div className="bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] flex items-center gap-5 px-7 py-3">
      {/* Clock */}
      <div>
        <div className="text-[52px] font-extralight tracking-[-2px] leading-none text-text-primary">
          {time}
        </div>
        <div className="text-[15px] text-text-secondary mt-[2px]">{date}</div>
      </div>

      {/* Separator */}
      <div className="w-px h-12 bg-separator flex-shrink-0" />

      {/* Next events */}
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-calendar mb-1">
          {label}
        </div>
        {events.length === 0 ? (
          <div className="text-[14px] text-text-muted">No upcoming events</div>
        ) : (
          <div className="flex gap-3">
            {events.slice(0, 2).map((event, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 ${
                  i > 0 ? 'pl-3 border-l border-separator' : ''
                }`}
              >
                <div>
                  <div className="text-[16px] font-medium text-text-primary">{event.name}</div>
                  {event.detail && (
                    <div className="text-[11px] text-text-muted">{event.detail}</div>
                  )}
                </div>
                <div className="text-[13px] font-semibold text-calendar whitespace-nowrap">
                  {event.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-12 bg-separator flex-shrink-0" />

      {/* Weather */}
      <div className="flex items-center gap-[10px]">
        <span className="text-[30px]">{weatherIcon}</span>
        <div>
          <div className="text-[30px] font-light leading-none text-text-primary">
            {weatherTemp || '--'}°
          </div>
          <div className="text-[12px] text-text-secondary">{weatherCondition || ''}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create Button, LoadingSpinner, ErrorDisplay**

```tsx
// frontend/src/ui/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-[var(--radius-button)] transition-all active:scale-95 disabled:opacity-50'

  const variants = {
    primary: 'bg-calendar text-white hover:opacity-90',
    secondary: 'bg-bg-card-hover text-text-primary border border-border',
    ghost: 'text-text-secondary hover:bg-bg-card-hover',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[48px]',
    lg: 'px-6 py-3 text-lg min-h-[56px]',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

```tsx
// frontend/src/ui/LoadingSpinner.tsx
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="w-6 h-6 border-2 border-border border-t-calendar rounded-full animate-spin" />
    </div>
  )
}
```

```tsx
// frontend/src/ui/ErrorDisplay.tsx
import { Button } from './Button'

interface ErrorDisplayProps {
  message: string
  onRetry?: () => void
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-error text-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Verify compilation**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/theme/ frontend/src/ui/
git commit -m "feat: add theme variables and shared UI components matching design reference"
```

---

### Task 4: App shell, routing, and Home Board with placeholder data

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/app/AppShell.tsx`
- Create: `frontend/src/boards/HomeBoard.tsx`
- Create: `frontend/src/boards/MediaBoard.tsx`
- Create: `frontend/src/boards/CamerasBoard.tsx`

- [ ] **Step 1: Create main entry point**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './theme/variables.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Create App with routes**

```tsx
// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { HomeBoard } from './boards/HomeBoard'
import { MediaBoard } from './boards/MediaBoard'
import { CamerasBoard } from './boards/CamerasBoard'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeBoard />} />
        <Route path="media" element={<MediaBoard />} />
        <Route path="cameras" element={<CamerasBoard />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 3: Create AppShell**

```tsx
// frontend/src/app/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { TabBar } from '../ui/TabBar'

export function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
```

- [ ] **Step 4: Create HomeBoard with placeholder widgets**

This is the 4-column grid layout from the design reference, using HeroStrip and WidgetCards with static content.

```tsx
// frontend/src/boards/HomeBoard.tsx
import { HeroStrip } from '../ui/HeroStrip'
import { WidgetCard } from '../ui/WidgetCard'

const placeholderEvents = [
  { name: 'Morning standup', time: '8:00 AM', detail: 'Zoom' },
  { name: 'Dentist - Emma', time: '9:30 AM', detail: 'Dr. Chen' },
]

export function HomeBoard() {
  return (
    <div
      className="grid gap-[var(--spacing-grid-gap)] h-full"
      style={{
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: 'auto 1fr 1fr',
      }}
    >
      {/* Hero strip — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <HeroStrip
          events={placeholderEvents}
          weatherTemp="52"
          weatherCondition="Partly Cloudy"
        />
      </div>

      {/* Calendar — col 1, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <WidgetCard title="Today's Schedule" category="calendar" badge="7 events" className="h-full">
          <div className="text-text-muted text-sm">Calendar widget placeholder</div>
        </WidgetCard>
      </div>

      {/* Chores — col 2, spans 2 rows */}
      <div style={{ gridRow: '2 / 4' }}>
        <WidgetCard title="Chores" category="chores" badge="0 of 0 done" className="h-full">
          <div className="text-text-muted text-sm">Chores widget placeholder</div>
        </WidgetCard>
      </div>

      {/* Countdowns — col 3, row 1 */}
      <WidgetCard title="Coming Up" category="info">
        <div className="text-text-muted text-sm">Countdowns placeholder</div>
      </WidgetCard>

      {/* Sports — col 4, row 1 */}
      <WidgetCard title="Sports" category="info">
        <div className="text-text-muted text-sm">Sports placeholder</div>
      </WidgetCard>

      {/* Lunch Menu — col 3, row 2 */}
      <WidgetCard title="Lunch Menu" category="food">
        <div className="text-text-muted text-sm">Lunch menu placeholder</div>
      </WidgetCard>

      {/* Grocery List — col 4, row 2 */}
      <WidgetCard title="Grocery List" category="grocery" badge="0 items">
        <div className="text-text-muted text-sm">Grocery list placeholder</div>
      </WidgetCard>
    </div>
  )
}
```

- [ ] **Step 5: Create placeholder boards**

```tsx
// frontend/src/boards/MediaBoard.tsx
export function MediaBoard() {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Media Board
    </div>
  )
}
```

```tsx
// frontend/src/boards/CamerasBoard.tsx
export function CamerasBoard() {
  return (
    <div className="h-full flex items-center justify-center text-text-secondary">
      Cameras Board
    </div>
  )
}
```

- [ ] **Step 6: Verify it runs**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run dev
```
Expected: Dashboard loads with hero strip, tab bar, and placeholder widget cards in a 4-column grid

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add app shell, routing, and Home Board with placeholder widgets"
```

---

## Phase 2: Real Data, Read-Only

Goal: The dashboard shows actual calendar, weather, chores, and lunch menus.

### Task 5: Backend test infrastructure

**Files:**
- Create: `backend/tests/helpers.rs`
- Create: `backend/tests/api/mod.rs`

- [ ] **Step 1: Add test dependency**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo add axum-test --dev
```

- [ ] **Step 2: Write test helper**

First, move `GoogleOAuthConfig` from `routes/mod.rs` into `models/google.rs`:

```rust
// backend/src/models/google.rs
#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}
```

Update `models/mod.rs`: add `pub mod google;`
Update `routes/mod.rs`: replace the inline struct with `use crate::models::google::GoogleOAuthConfig;`
Update `main.rs`: change to `use dashboard_backend::models::google::GoogleOAuthConfig;`

Then write the test helper:

```rust
// backend/tests/helpers.rs
use axum::Router;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;
use dashboard_backend::models::google::GoogleOAuthConfig;

pub async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to create test database");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

pub async fn test_app() -> (Router, SqlitePool) {
    let pool = test_pool().await;
    let google_config = GoogleOAuthConfig {
        client_id: String::new(),
        client_secret: String::new(),
        redirect_uri: String::new(),
    };
    let app = dashboard_backend::routes::router(pool.clone(), google_config);
    (app, pool)
}
```

- [ ] **Step 3: Verify tests compile**

```bash
cargo test
```
Expected: 0 tests, no compilation errors

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: add backend test infrastructure"
```

---

### Task 6: Chore CRUD API

**Files:**
- Create: `backend/src/models/chore.rs`
- Modify: `backend/src/routes/mod.rs`
- Create: `backend/src/routes/chores.rs`
- Create: `backend/tests/api/chores_test.rs`

- [ ] **Step 1: Write chore models**

```rust
// backend/src/models/chore.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Chore {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateChore {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChore {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChoreAssignment {
    pub id: i64,
    pub chore_id: i64,
    pub child_name: String,
    pub day_of_week: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssignmentWithStatus {
    pub id: i64,
    pub chore_id: i64,
    pub chore_name: String,
    pub child_name: String,
    pub day_of_week: i32,
    pub completed: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetAssignments {
    pub assignments: Vec<AssignmentEntry>,
}

#[derive(Debug, Deserialize)]
pub struct AssignmentEntry {
    pub child_name: String,
    pub day_of_week: i32,
}

#[derive(Debug, Deserialize)]
pub struct CompleteRequest {
    pub date: String,
}
```

Add to `models/mod.rs`: `pub mod chore;`

- [ ] **Step 2: Write chore tests**

```rust
// backend/tests/api/chores_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "../helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_create_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/chores")
        .json(&json!({"name": "Take out trash", "description": "Both bins"}))
        .await;

    response.assert_status(StatusCode::CREATED);
    let body: serde_json::Value = response.json();
    assert_eq!(body["name"], "Take out trash");
    assert!(body["id"].is_number());
}

#[tokio::test]
async fn test_list_chores() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    server.post("/chores").json(&json!({"name": "A"})).await;
    server.post("/chores").json(&json!({"name": "B"})).await;

    let response = server.get("/chores").await;
    response.assert_status_ok();
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 2);
}

#[tokio::test]
async fn test_update_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let resp = server.post("/chores").json(&json!({"name": "Old"})).await;
    let id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    let response = server.put(&format!("/chores/{}", id)).json(&json!({"name": "New"})).await;
    response.assert_status_ok();
    assert_eq!(response.json::<serde_json::Value>()["name"], "New");
}

#[tokio::test]
async fn test_delete_chore() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let resp = server.post("/chores").json(&json!({"name": "Delete me"})).await;
    let id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    server.delete(&format!("/chores/{}", id)).await.assert_status(StatusCode::NO_CONTENT);
    let list: Vec<serde_json::Value> = server.get("/chores").await.json();
    assert_eq!(list.len(), 0);
}

#[tokio::test]
async fn test_assignments_and_completion() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    let resp = server.post("/chores").json(&json!({"name": "Dishes"})).await;
    let chore_id = resp.json::<serde_json::Value>()["id"].as_i64().unwrap();

    // Set assignments (Monday = 1)
    server.put(&format!("/chores/{}/assignments", chore_id))
        .json(&json!({"assignments": [{"child_name": "Alice", "day_of_week": 1}]}))
        .await.assert_status_ok();

    // Get assignments for a Monday (2026-03-16 is Monday)
    let resp = server.get("/chores/assignments?date=2026-03-16").await;
    resp.assert_status_ok();
    let assignments: Vec<serde_json::Value> = resp.json();
    assert_eq!(assignments.len(), 1);
    assert_eq!(assignments[0]["completed"], false);

    // Complete it
    let assignment_id = assignments[0]["id"].as_i64().unwrap();
    server.post(&format!("/chores/assignments/{}/complete", assignment_id))
        .json(&json!({"date": "2026-03-16"}))
        .await.assert_status_ok();

    // Verify completed
    let resp = server.get("/chores/assignments?date=2026-03-16").await;
    let assignments: Vec<serde_json::Value> = resp.json();
    assert_eq!(assignments[0]["completed"], true);
}
```

```rust
// backend/tests/api/mod.rs
mod chores_test;
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cargo test
```
Expected: compilation errors (routes not implemented)

- [ ] **Step 4: Implement chore routes**

```rust
// backend/src/routes/chores.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post, put, delete},
    Json, Router,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::chore::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/chores", get(list_chores).post(create_chore))
        .route("/chores/{id}", put(update_chore).delete(delete_chore))
        .route("/chores/{id}/assignments", put(set_assignments))
        .route("/chores/assignments", get(get_assignments))
        .route("/chores/assignments/{id}/complete", post(complete_assignment))
        .with_state(pool)
}

async fn list_chores(State(pool): State<SqlitePool>) -> Result<Json<Vec<Chore>>, AppError> {
    let chores = sqlx::query_as::<_, Chore>("SELECT * FROM chores ORDER BY name")
        .fetch_all(&pool).await?;
    Ok(Json(chores))
}

async fn create_chore(
    State(pool): State<SqlitePool>,
    Json(input): Json<CreateChore>,
) -> Result<(StatusCode, Json<Chore>), AppError> {
    let chore = sqlx::query_as::<_, Chore>(
        "INSERT INTO chores (name, description) VALUES (?, ?) RETURNING *"
    ).bind(&input.name).bind(&input.description).fetch_one(&pool).await?;
    Ok((StatusCode::CREATED, Json(chore)))
}

async fn update_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<UpdateChore>,
) -> Result<Json<Chore>, AppError> {
    let existing = sqlx::query_as::<_, Chore>("SELECT * FROM chores WHERE id = ?")
        .bind(id).fetch_optional(&pool).await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", id)))?;

    let name = input.name.unwrap_or(existing.name);
    let description = if input.description.is_some() { input.description } else { existing.description };

    let chore = sqlx::query_as::<_, Chore>(
        "UPDATE chores SET name = ?, description = ? WHERE id = ? RETURNING *"
    ).bind(&name).bind(&description).bind(id).fetch_one(&pool).await?;
    Ok(Json(chore))
}

async fn delete_chore(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM chores WHERE id = ?")
        .bind(id).execute(&pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Chore {} not found", id)));
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn set_assignments(
    State(pool): State<SqlitePool>,
    Path(chore_id): Path<i64>,
    Json(input): Json<SetAssignments>,
) -> Result<Json<Vec<ChoreAssignment>>, AppError> {
    sqlx::query("SELECT id FROM chores WHERE id = ?")
        .bind(chore_id).fetch_optional(&pool).await?
        .ok_or_else(|| AppError::NotFound(format!("Chore {} not found", chore_id)))?;

    sqlx::query("DELETE FROM chore_assignments WHERE chore_id = ?")
        .bind(chore_id).execute(&pool).await?;

    for entry in &input.assignments {
        sqlx::query("INSERT INTO chore_assignments (chore_id, child_name, day_of_week) VALUES (?, ?, ?)")
            .bind(chore_id).bind(&entry.child_name).bind(entry.day_of_week)
            .execute(&pool).await?;
    }

    let assignments = sqlx::query_as::<_, ChoreAssignment>(
        "SELECT * FROM chore_assignments WHERE chore_id = ?"
    ).bind(chore_id).fetch_all(&pool).await?;
    Ok(Json(assignments))
}

async fn get_assignments(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<AssignmentWithStatus>>, AppError> {
    let date = params.get("date")
        .ok_or_else(|| AppError::BadRequest("date parameter required".to_string()))?;

    let parsed = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid date format, use YYYY-MM-DD".to_string()))?;
    let day_of_week = parsed.format("%w").to_string().parse::<i32>().unwrap();

    let assignments = sqlx::query_as::<_, AssignmentWithStatus>(
        "SELECT ca.id, ca.chore_id, c.name as chore_name, ca.child_name, ca.day_of_week,
         CASE WHEN cc.id IS NOT NULL THEN 1 ELSE 0 END as completed
         FROM chore_assignments ca
         JOIN chores c ON c.id = ca.chore_id
         LEFT JOIN chore_completions cc ON cc.assignment_id = ca.id AND cc.completed_date = ?1
         WHERE ca.day_of_week = ?2
         ORDER BY c.name, ca.child_name"
    ).bind(date).bind(day_of_week).fetch_all(&pool).await?;
    Ok(Json(assignments))
}

async fn complete_assignment(
    State(pool): State<SqlitePool>,
    Path(id): Path<i64>,
    Json(input): Json<CompleteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("SELECT id FROM chore_assignments WHERE id = ?")
        .bind(id).fetch_optional(&pool).await?
        .ok_or_else(|| AppError::NotFound(format!("Assignment {} not found", id)))?;

    sqlx::query("INSERT OR IGNORE INTO chore_completions (assignment_id, completed_date) VALUES (?, ?)")
        .bind(id).bind(&input.date).execute(&pool).await?;

    Ok(Json(serde_json::json!({"status": "completed"})))
}
```

Wire into `routes/mod.rs`:
```rust
pub mod chores;

pub fn router(pool: SqlitePool, _google_config: GoogleOAuthConfig) -> Router {
    Router::new()
        .merge(chores::router(pool.clone()))
}
```

Each child router (chores, lunch_menu, etc.) calls `.with_state(pool)` on its own routes. The parent router just merges them — no `.with_state()` needed at the parent level.

- [ ] **Step 5: Run tests — verify they pass**

```bash
cargo test
```
Expected: all chore tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement chore CRUD and assignment API with tests"
```

---

### Task 7: Lunch Menu API

**Files:**
- Create: `backend/src/models/lunch_menu.rs`
- Create: `backend/src/routes/lunch_menu.rs`
- Create: `backend/tests/api/lunch_menu_test.rs`

- [ ] **Step 1: Write models**

```rust
// backend/src/models/lunch_menu.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct LunchMenu {
    pub id: i64,
    pub week_of: String,
    pub menu_data: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchMenuResponse {
    pub week_of: String,
    pub days: Vec<LunchDay>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LunchDay {
    pub day: String,
    pub items: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertLunchMenu {
    pub days: Vec<LunchDay>,
}
```

Add to `models/mod.rs`: `pub mod lunch_menu;`

- [ ] **Step 2: Write tests**

```rust
// backend/tests/api/lunch_menu_test.rs
use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::json;

#[path = "../helpers.rs"]
mod helpers;
use helpers::test_app;

#[tokio::test]
async fn test_upsert_and_get_lunch_menu() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    server.put("/lunch-menu/2026-03-16")
        .json(&json!({"days": [{"day": "Monday", "items": ["Pizza", "Salad"]}]}))
        .await.assert_status_ok();

    let resp = server.get("/lunch-menu?week=2026-03-16").await;
    resp.assert_status_ok();
    let body: serde_json::Value = resp.json();
    assert_eq!(body["days"][0]["items"][0], "Pizza");
}

#[tokio::test]
async fn test_missing_menu_returns_404() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();
    server.get("/lunch-menu?week=2026-01-01").await.assert_status(StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_upsert_replaces_existing() {
    let (app, _pool) = test_app().await;
    let server = TestServer::new(app).unwrap();

    server.put("/lunch-menu/2026-03-16")
        .json(&json!({"days": [{"day": "Monday", "items": ["Pizza"]}]})).await;
    server.put("/lunch-menu/2026-03-16")
        .json(&json!({"days": [{"day": "Monday", "items": ["Burgers"]}]})).await;

    let body: serde_json::Value = server.get("/lunch-menu?week=2026-03-16").await.json();
    assert_eq!(body["days"][0]["items"][0], "Burgers");
}
```

Add to `tests/api/mod.rs`: `mod lunch_menu_test;`

- [ ] **Step 3: Run tests — verify they fail**

```bash
cargo test lunch_menu
```

- [ ] **Step 4: Implement lunch menu routes**

```rust
// backend/src/routes/lunch_menu.rs
use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Json, Router,
};
use sqlx::SqlitePool;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::lunch_menu::*;

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/lunch-menu", get(get_lunch_menu))
        .route("/lunch-menu/{week}", put(upsert_lunch_menu))
        .with_state(pool)
}

async fn get_lunch_menu(
    State(pool): State<SqlitePool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let week = params.get("week")
        .ok_or_else(|| AppError::BadRequest("week parameter required".to_string()))?;

    let menu = sqlx::query_as::<_, LunchMenu>("SELECT * FROM lunch_menus WHERE week_of = ?")
        .bind(week).fetch_optional(&pool).await?
        .ok_or_else(|| AppError::NotFound(format!("No menu for week {}", week)))?;

    Ok(Json(LunchMenuResponse {
        week_of: menu.week_of,
        days: serde_json::from_str(&menu.menu_data)
            .map_err(|e| AppError::Internal(format!("Invalid menu data: {}", e)))?,
    }))
}

async fn upsert_lunch_menu(
    State(pool): State<SqlitePool>,
    Path(week): Path<String>,
    Json(input): Json<UpsertLunchMenu>,
) -> Result<Json<LunchMenuResponse>, AppError> {
    let menu_json = serde_json::to_string(&input.days)
        .map_err(|e| AppError::Internal(format!("Failed to serialize: {}", e)))?;

    sqlx::query(
        "INSERT INTO lunch_menus (week_of, menu_data) VALUES (?, ?)
         ON CONFLICT(week_of) DO UPDATE SET menu_data = excluded.menu_data"
    ).bind(&week).bind(&menu_json).execute(&pool).await?;

    Ok(Json(LunchMenuResponse { week_of: week, days: input.days }))
}
```

Wire into `routes/mod.rs`: add `pub mod lunch_menu;` and `.merge(lunch_menu::router(pool.clone()))`.

- [ ] **Step 5: Run tests — verify they pass**

```bash
cargo test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement lunch menu API with upsert support and tests"
```

---

### Task 8: Google Calendar OAuth & proxy API

**Files:**
- Modify: `backend/src/models/google.rs`
- Create: `backend/src/routes/google_auth.rs`
- Create: `backend/src/routes/google_calendar.rs`

This task follows the same patterns as the previous API tasks but talks to external Google APIs. Tests are deferred since they require mocking HTTP clients — add integration tests with `wiremock` when iterating on the calendar widget.

- [ ] **Step 1: Add Google-specific models to models/google.rs**

```rust
// Add to backend/src/models/google.rs (after GoogleOAuthConfig)
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct GoogleToken {
    pub id: i64,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarListEntry {
    pub id: String,
    pub summary: String,
    pub primary: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarListResponse {
    pub items: Vec<CalendarListEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: Option<String>,
    pub start: EventDateTime,
    pub end: EventDateTime,
    pub description: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventDateTime {
    #[serde(rename = "dateTime")]
    pub date_time: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EventsListResponse {
    pub items: Option<Vec<CalendarEvent>>,
}
```

- [ ] **Step 2: Implement OAuth routes**

Create `backend/src/routes/google_auth.rs`:
- `GET /google/auth` — builds Google OAuth URL with `calendar.readonly` scope, `access_type=offline`, `prompt=consent`. URL-encode both `client_id` and `redirect_uri`. Returns `Redirect::temporary`.
- `GET /google/callback` — receives `code` query param, exchanges it via `POST https://oauth2.googleapis.com/token` with `grant_type=authorization_code`. Stores `access_token`, `refresh_token`, and computed `expires_at` in `google_tokens` table (upsert with `id=1`). Returns `{"status": "authenticated"}`.

Both handlers share a `GoogleAuthState { pool, config }` state.

- [ ] **Step 3: Implement calendar proxy routes**

Create `backend/src/routes/google_calendar.rs`:
- `get_valid_token(state)` helper — reads token from DB, checks if `expires_at` is within 5 minutes of now, and if so refreshes via `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`. Updates DB with new `access_token` and `expires_at`. Returns valid access token string.
- `GET /google/calendars` — calls `https://www.googleapis.com/calendar/v3/users/me/calendarList` with bearer token. Returns `Vec<CalendarListEntry>`.
- `GET /google/events?calendar=&start=&end=` — calls `https://www.googleapis.com/calendar/v3/calendars/{id}/events` with `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`. URL-encode the calendar ID. Returns `Vec<CalendarEvent>`.

- [ ] **Step 4: Wire into router**

Add `pub mod google_auth;` and `pub mod google_calendar;` to `routes/mod.rs`. Pass `google_config` to both routers.

- [ ] **Step 5: Verify compilation**

```bash
cargo build
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: implement Google Calendar OAuth and proxy API"
```

---

### Task 9: Frontend shared hooks and API client

**Files:**
- Create: `frontend/src/hooks/usePolling.ts`
- Create: `frontend/src/hooks/useHaEntity.ts`
- Create: `frontend/src/hooks/useHaService.ts`
- Create: `frontend/src/lib/dashboard-api.ts`
- Create: `frontend/src/lib/ha-client.ts`

- [ ] **Step 1: Create usePolling hook**

```typescript
// frontend/src/hooks/usePolling.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>
  intervalMs: number
  enabled?: boolean
}

export interface UsePollingResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  refetch: () => Promise<void>
}

export function usePolling<T>({
  fetcher,
  intervalMs,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    refetch()
    const interval = setInterval(refetch, intervalMs)
    return () => clearInterval(interval)
  }, [enabled, intervalMs, refetch])

  return { data, error, isLoading, refetch }
}
```

- [ ] **Step 2: Create Dashboard API client**

Create `frontend/src/lib/dashboard-api.ts`:

```typescript
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> }
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`/api${path}`, { ...options, headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(response.status, body.error || 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
```

Then define typed interfaces and API objects:
- `choresApi`: `list()`, `create()`, `update()`, `delete()`, `getAssignments(date)`, `setAssignments(choreId, assignments)`, `completeAssignment(id, date)`
- `lunchMenuApi`: `get(week)`, `upsert(week, data)`
- `googleCalendarApi`: `listCalendars()`, `listEvents(calendar, start, end)`

Each method calls `request()` with the appropriate path, method, and body. Types match the backend models (`Chore`, `ChoreAssignment`, `LunchMenu`, `CalendarEvent`, etc.).

- [ ] **Step 3: Create HA hooks**

```typescript
// frontend/src/lib/ha-client.ts
export const HA_URL = import.meta.env.VITE_HA_URL || 'http://homeassistant.local:8123'
```

```typescript
// frontend/src/hooks/useHaEntity.ts
import { useEntity } from '@hakit/core'

export function useHaEntity(entityId: string) {
  return useEntity(entityId)
}
```

```typescript
// frontend/src/hooks/useHaService.ts
import { useHass } from '@hakit/core'

export function useHaService() {
  const { callService } = useHass()
  return { callService }
}
```

Add `<HassConnect>` wrapper to `AppShell.tsx`:
```tsx
import { HassConnect } from '@hakit/core'
import { HA_URL } from '../lib/ha-client'
// Wrap the shell content in <HassConnect hassUrl={HA_URL}>
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/ frontend/src/lib/ frontend/src/app/AppShell.tsx
git commit -m "feat: add usePolling hook, Dashboard API client, and HA integration hooks"
```

---

### Task 10: Wire up widgets with real data

**Files:**
- Create: `frontend/src/widgets/clock/ClockWidget.tsx`
- Create: `frontend/src/widgets/weather/WeatherWidget.tsx`, `WeatherDetail.tsx`
- Create: `frontend/src/widgets/calendar/CalendarWidget.tsx`, `CalendarDetail.tsx`, `useGoogleCalendar.ts`
- Create: `frontend/src/widgets/chores/ChoresWidget.tsx`, `ChoresDetail.tsx`, `useChores.ts`
- Create: `frontend/src/widgets/lunch-menu/LunchMenuWidget.tsx`, `useLunchMenu.ts`
- Modify: `frontend/src/boards/HomeBoard.tsx`

Each widget follows the same pattern: data hook + compact card view + optional detail view. Key implementation notes:

- [ ] **Step 1: Create ClockWidget** — uses `useState`/`setInterval`, no external data. Already part of HeroStrip, so this is just the standalone version if needed elsewhere.

- [ ] **Step 2: Create weather widget** — uses `useHaEntity('weather.home')`, maps HA weather condition to display. Detail view shows forecast from `entity.attributes.forecast`.

- [ ] **Step 3: Create calendar widget** — `useGoogleCalendar` hook uses `usePolling` with `googleCalendarApi`. Recomputes `today` inside the fetcher on each poll (avoids stale date across midnight). CalendarWidget shows today's events. CalendarDetail shows the week. Both receive data from the parent via props (no duplicate polling).

- [ ] **Step 4: Create chores widget** — `useChores` hook polls `choresApi.getAssignments(today)` every minute, recomputing today inside fetcher. Groups by child. ChoresWidget shows compact list with checkboxes. ChoresDetail receives data via props.

- [ ] **Step 5: Create lunch menu widget** — `useLunchMenu` polls `lunchMenuApi.get(currentWeekMonday())` hourly. Shows today's menu (hidden on weekends via `visible` prop on WidgetCard). Recomputes week inside fetcher.

- [ ] **Step 6: Update HomeBoard** — replace placeholder content with real widgets. Pass data from hooks to both compact and detail views (no duplicate polling). Wire conditional visibility for lunch menu (hide on weekends).

- [ ] **Step 7: Verify it compiles and renders**

```bash
npx tsc --noEmit
npm run dev
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/widgets/ frontend/src/boards/HomeBoard.tsx
git commit -m "feat: wire up all Day 1 widgets with real data"
```

---

## Phase 3: Interactive

Goal: Chore completion, detail views, and event-triggered overlays. Replaces Lovelace.

### Task 11: Chore completion interaction

Already partially implemented in Task 10 (the `completeChore` callback in `useChores`). This task ensures the touch interaction is polished:

- [ ] **Step 1: Verify tap-to-complete works** — tap a checkbox, it calls the API and refetches. Visual feedback: checkbox fills green, name gets strikethrough.

- [ ] **Step 2: Add optimistic update** — update local state immediately on tap, revert if API call fails. This makes the interaction feel instant.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/chores/
git commit -m "feat: add optimistic chore completion with error recovery"
```

---

### Task 12: Event overlay system

**Files:**
- Create: `frontend/src/lib/event-bus.ts`
- Create: `frontend/src/ui/EventOverlay.tsx`
- Modify: `frontend/src/app/AppShell.tsx`

- [ ] **Step 1: Create event bus context**

```typescript
// frontend/src/lib/event-bus.ts
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface OverlayEvent {
  id: string
  content: ReactNode
  autoDismissMs?: number
  priority?: number
}

interface EventBusContext {
  currentOverlay: OverlayEvent | null
  pushOverlay: (event: OverlayEvent) => void
  dismissOverlay: () => void
}

const EventBusCtx = createContext<EventBusContext | null>(null)

export function EventBusProvider({ children }: { children: ReactNode }) {
  const [currentOverlay, setCurrentOverlay] = useState<OverlayEvent | null>(null)

  const pushOverlay = useCallback((event: OverlayEvent) => {
    setCurrentOverlay((current) => {
      if (current && (current.priority ?? 0) > (event.priority ?? 0)) return current
      return event
    })
  }, [])

  const dismissOverlay = useCallback(() => setCurrentOverlay(null), [])

  return (
    <EventBusCtx.Provider value={{ currentOverlay, pushOverlay, dismissOverlay }}>
      {children}
    </EventBusCtx.Provider>
  )
}

export function useEventBus() {
  const ctx = useContext(EventBusCtx)
  if (!ctx) throw new Error('useEventBus must be used within EventBusProvider')
  return ctx
}
```

- [ ] **Step 2: Create EventOverlay component**

Renders above everything. Auto-dismisses after configured duration. Tap to dismiss.

- [ ] **Step 3: Wire into AppShell** — wrap in `<EventBusProvider>`, render `<EventOverlay>` above `<Outlet>`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/event-bus.ts frontend/src/ui/EventOverlay.tsx frontend/src/app/AppShell.tsx
git commit -m "feat: add event overlay system for push notifications"
```

---

### Task 13: Doorbell camera widget

**Files:**
- Create: `frontend/src/widgets/doorbell/useWebRtcStream.ts`
- Create: `frontend/src/widgets/doorbell/DoorbellWidget.tsx`

- [ ] **Step 1: Create useWebRtcStream hook** — connects to go2rtc via WebRTC SDP exchange. Video-only for Day 1 (no audio track). Handles connection lifecycle and reconnection.

- [ ] **Step 2: Create DoorbellWidget** — shows snapshot/placeholder by default. When person is detected (HA entity state change), uses the event bus to push a fullscreen overlay with live WebRTC feed that auto-dismisses after 30 seconds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/widgets/doorbell/
git commit -m "feat: add doorbell camera widget with WebRTC and event-triggered overlay"
```

---

## Phase 4: Admin & Polish

Goal: Fully self-contained. No need to edit config files.

### Task 14: Admin layout and chore management

**Files:**
- Create: `frontend/src/admin/AdminLayout.tsx`
- Create: `frontend/src/admin/ChoreAdmin.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create AdminLayout** — simple header with nav links, no tab bar. Responsive for phone/laptop.

- [ ] **Step 2: Create ChoreAdmin** — list chores, add/delete chores, set assignments per chore per day/child. Uses `choresApi` from the shared API client.

- [ ] **Step 3: Add admin routes to App.tsx** — add imports and `<Route path="admin">` with chore and lunch menu sub-routes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/admin/ frontend/src/App.tsx
git commit -m "feat: add admin layout and chore management page"
```

---

### Task 15: Lunch menu admin

**Files:**
- Create: `frontend/src/admin/LunchMenuAdmin.tsx`

- [ ] **Step 1: Create LunchMenuAdmin** — select week, enter menu items per day, save. Uses `lunchMenuApi`.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/admin/LunchMenuAdmin.tsx
git commit -m "feat: add lunch menu admin page"
```

---

### Task 16: Hardware testing and density polish

- [ ] **Step 1: Build and deploy to tablet**

```bash
cd /home/bbaldino/work/dashboard/frontend
npm run build
# Copy dist/ to backend/static/
cp -r dist/* ../backend/static/
# Run backend
cd ../backend
cargo run
```

- [ ] **Step 2: Load on tablet via Fully Kiosk** — set URL to `http://<server-ip>:3000`

- [ ] **Step 3: Iterate on spacing/sizing** — adjust CSS variables in `variables.css` based on real-screen feel. Commit each adjustment.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: polish spacing and density for tablet hardware"
```
