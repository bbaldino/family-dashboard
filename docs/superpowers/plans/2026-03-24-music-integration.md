# Music Assistant Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Music Assistant into the dashboard with a proxied REST+SSE backend, a persistent mini player bar, and a full Media tab with quick dials, search, and player picker.

**Architecture:** The dashboard backend proxies all MA communication — REST commands and a WebSocket→SSE relay for real-time state. The frontend uses a shared React context for music state (via SSE) and commands (via REST), consumed by both the mini player bar (global) and the Media tab.

**Tech Stack:** Rust (Axum, tokio-tungstenite, reqwest), React, TypeScript, TanStack Query, EventSource

**Spec:** `docs/superpowers/specs/2026-03-24-music-integration-design.md`

---

## File Structure

### Backend (`backend/src/integrations/music/`)

| File | Responsibility |
|------|---------------|
| `mod.rs` | Module declarations, `INTEGRATION_ID`, router with all routes |
| `routes.rs` | REST proxy handlers (play, pause, resume, stop, next, previous, volume, players, search, recent, queue) |
| `proxy.rs` | Shared helper for calling MA's `POST /api` with command + args |
| `sse.rs` | WebSocket→SSE relay: connects to MA WebSocket, transforms events, streams to clients via SSE |
| `types.rs` | Rust types for SSE events, MA responses, and API request/response shapes |

### Frontend (`frontend/src/integrations/music/`)

| File | Responsibility |
|------|---------------|
| `config.ts` | `defineIntegration` with service_url, api_token (secret), default_player |
| `types.ts` | TypeScript types: MusicState, QueueState, TrackInfo, Player, SearchResults |
| `MusicProvider.tsx` | React context provider — SSE connection, state management, command functions |
| `useMusic.ts` | Hook that reads from the MusicContext |
| `MiniPlayer.tsx` | Compact strip above TabBar — cover art, track info, controls, volume, player pill |
| `index.ts` | Barrel exports |

### Frontend (`frontend/src/boards/`)

| File | Responsibility |
|------|---------------|
| `MediaBoard.tsx` | Two-column layout: left (search + quick dials), right (now playing panel) |
| `media/QuickDials.tsx` | Grid of recently played items, tappable to play |
| `media/NowPlaying.tsx` | Full now-playing panel with large cover art, progress, controls |
| `media/SearchResults.tsx` | Inline search results grouped by type |
| `media/PlayerPicker.tsx` | Modal listing all players with volume controls |
| `media/FullscreenNowPlaying.tsx` | Fullscreen overlay with large cover art |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Add `pub mod music;` and nest router |
| `frontend/src/integrations/registry.ts` | Register `musicIntegration` |
| `frontend/src/app/AppShell.tsx` | Add `MusicProvider` and `MiniPlayer` |
| `backend/Cargo.toml` | Add `tokio-tungstenite`, `futures` dependencies |

---

## Chunk 1: Backend — MA Proxy + SSE Relay

### Task 1: Add dependencies

**Files:**
- Modify: `backend/Cargo.toml`

- [ ] **Step 1: Add tokio-tungstenite and futures**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo add tokio-tungstenite --features native-tls
cargo add futures
cargo add uuid --features v4  # if not already present — check Cargo.toml first
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo check
```

- [ ] **Step 3: Commit**

```bash
git add backend/Cargo.toml backend/Cargo.lock
git commit -m "feat(music): add tokio-tungstenite and futures dependencies"
```

---

### Task 2: Types and MA proxy helper

**Files:**
- Create: `backend/src/integrations/music/types.rs`
- Create: `backend/src/integrations/music/proxy.rs`

- [ ] **Step 1: Create types**

Create `backend/src/integrations/music/types.rs` with:

- `MaCommand` — request body for MA's `POST /api` (`message_id`, `command`, `args`)
- `PlayRequest` — `{ uri: String, queue_id: Option<String>, radio: Option<bool> }`
- `QueueCommand` — `{ queue_id: Option<String> }`
- `VolumeRequest` — `{ player_id: String, level: i32 }`
- `SearchQuery` — query params for `GET /search?q=...`
- `QueueState` — simplified queue state for SSE events:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueState {
    pub queue_id: String,
    pub display_name: String,
    pub state: String, // "playing", "paused", "idle"
    pub current_item: Option<TrackInfo>,
    pub volume_level: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub name: String,
    pub artist: String,
    pub album: Option<String>,
    pub image_url: Option<String>,
    pub duration: Option<i64>,
    pub elapsed: Option<i64>,
}
```

- `SseEvent` — enum for SSE output:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SseEvent {
    State { queues: Vec<QueueState> },
    QueueUpdated { queue: QueueState },
}
```

- [ ] **Step 2: Create MA proxy helper**

Create `backend/src/integrations/music/proxy.rs`:

- `MaClient` struct holding `base_url: String`, `token: String`, `client: reqwest::Client`
- `MaClient::from_config(pool: &SqlitePool) -> Result<Self, AppError>` — reads `music.service_url` and `music.api_token` from `IntegrationConfig`
- `MaClient::command<T: DeserializeOwned>(&self, command: &str, args: serde_json::Value) -> Result<T, AppError>` — sends `POST {base_url}/api` with bearer token, message body `{ message_id: uuid, command, args }`, returns parsed result
- `MaClient::command_void(&self, command: &str, args: serde_json::Value) -> Result<(), AppError>` — same but for commands that return null

Use `uuid::Uuid::new_v4().to_string()` for message_id. Handle MA returning error responses by converting to `AppError`.

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/integrations/music/
git commit -m "feat(music): add types and MA proxy helper"
```

---

### Task 3: REST proxy routes

**Files:**
- Create: `backend/src/integrations/music/routes.rs`
- Create: `backend/src/integrations/music/mod.rs`
- Modify: `backend/src/integrations/mod.rs`

- [ ] **Step 1: Create routes**

Create `backend/src/integrations/music/routes.rs` with handlers:

- `play` — `POST /play` — reads `PlayRequest` from body, calls `player_queues/play_media` with `{ queue_id, media: uri }`. If `radio` is true, pass `radio_mode: true` in the MA args. `queue_id` defaults to `music.default_player` config if not provided.
- `pause` — `POST /pause` — calls `player_queues/pause`
- `resume` — `POST /resume` — calls `player_queues/resume`
- `stop` — `POST /stop` — calls `player_queues/stop`
- `next` — `POST /next` — calls `player_queues/next`
- `previous` — `POST /previous` — calls `player_queues/previous`
- `set_volume` — `POST /volume` — calls `players/cmd/volume_set`
- `get_players` — `GET /players` — calls `players/all`, returns simplified player list
- `search` — `GET /search?q=...` — calls `music/search` with `search_query` and `media_types: ["artist","album","playlist","track"]`, `limit: 5`
- `get_recent` — `GET /recent` — calls `music/recently_played_items`
- `get_queue` — `GET /queue/:id` — calls `player_queues/items` with `queue_id`

All handlers create an `MaClient::from_config(&pool)` and use it to proxy. State is just `SqlitePool`.

For commands that take an optional `queue_id`, read the default from `music.default_player` config when not provided.

- [ ] **Step 2: Create mod.rs and register**

Create `backend/src/integrations/music/mod.rs`:
```rust
pub mod proxy;
pub mod routes;
pub mod types;

use axum::Router;
use sqlx::SqlitePool;

pub const INTEGRATION_ID: &str = "music";

pub fn router(pool: SqlitePool) -> Router {
    Router::new()
        .route("/play", axum::routing::post(routes::play))
        .route("/pause", axum::routing::post(routes::pause))
        .route("/resume", axum::routing::post(routes::resume))
        .route("/stop", axum::routing::post(routes::stop))
        .route("/next", axum::routing::post(routes::next))
        .route("/previous", axum::routing::post(routes::previous))
        .route("/volume", axum::routing::post(routes::set_volume))
        .route("/players", axum::routing::get(routes::get_players))
        .route("/search", axum::routing::get(routes::search))
        .route("/recent", axum::routing::get(routes::get_recent))
        .route("/queue/{queue_id}", axum::routing::get(routes::get_queue))
        .with_state(pool)
}
```

Note: SSE endpoint will be added in Task 4.

Add to `backend/src/integrations/mod.rs`:
- `pub mod music;`
- `.nest("/music", music::router(pool.clone()))`

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Test REST endpoints with curl**

```bash
cd /home/bbaldino/work/dashboard/backend
# Make sure music.service_url and music.api_token are configured
# Then test:
curl -s http://localhost:3042/api/music/players | python3 -m json.tool | head -20
curl -s "http://localhost:3042/api/music/search?q=beach+house" | python3 -m json.tool | head -30
curl -s http://localhost:3042/api/music/recent | python3 -m json.tool | head -20
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/music/ backend/src/integrations/mod.rs
git commit -m "feat(music): add REST proxy routes for MA commands"
```

---

### Task 4: WebSocket→SSE relay

**Files:**
- Create: `backend/src/integrations/music/sse.rs`
- Modify: `backend/src/integrations/music/mod.rs`

This is the most complex backend task. The handler:

1. Reads MA URL + token from config
2. Connects to MA's WebSocket at `ws://{host}:{port}/ws`
3. Authenticates by sending `{"command":"auth","args":{"token":"..."}}`
4. Subscribes to events by sending `{"command":"subscribe_events"}`
5. Receives player/queue state events from MA
6. Transforms them into simplified `SseEvent` JSON
7. Streams to the client as SSE

- [ ] **Step 1: Implement SSE handler**

Create `backend/src/integrations/music/sse.rs`:

The handler function signature:
```rust
pub async fn events(
    State(pool): State<SqlitePool>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError>
```

Use `tokio-tungstenite::connect_async` to open the WebSocket. After auth + subscribe, enter a loop reading WebSocket messages. For each relevant MA event (`player_updated`, `queue_updated`, `queue_time_updated`), fetch the current state via the proxy helper (`players/all` + `player_queues/all`) and emit an SSE `state` event with the full queue snapshot.

On initial connection, immediately fetch and send a `state` snapshot so the client has data right away.

Use `tokio::sync::broadcast` or a channel to bridge the async WebSocket read loop into the SSE stream. The SSE stream yields `Event::default().data(json)` items.

If the WebSocket disconnects, send an SSE comment as a keepalive and attempt reconnection. The SSE connection itself stays open.

Each SSE client gets its own WebSocket to MA (per spec — shared connection is a v2 optimization). On WebSocket disconnect, reconnect with exponential backoff starting at 1s, max 30s.

- [ ] **Step 2: Register SSE route**

Add to `mod.rs` router:
```rust
.route("/events", axum::routing::get(sse::events))
```

Add `pub mod sse;` to mod.rs.

- [ ] **Step 3: Format and verify**

```bash
cd /home/bbaldino/work/dashboard/backend
cargo +nightly fmt && cargo check
```

- [ ] **Step 4: Test SSE endpoint**

```bash
# In one terminal:
curl -N http://localhost:3042/api/music/events

# Should see an initial state event, then live updates when music plays/pauses
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/music/
git commit -m "feat(music): add WebSocket→SSE relay for real-time MA events"
```

---

## Chunk 2: Frontend Core — Music Context + Mini Player

### Task 5: Frontend integration config + types

**Files:**
- Create: `frontend/src/integrations/music/config.ts`
- Create: `frontend/src/integrations/music/types.ts`
- Create: `frontend/src/integrations/music/index.ts`
- Modify: `frontend/src/integrations/registry.ts`

- [ ] **Step 1: Create config**

Create `frontend/src/integrations/music/config.ts`:
```typescript
import { z } from 'zod'
import { defineIntegration } from '../define-integration'

export const musicIntegration = defineIntegration({
  id: 'music',
  name: 'Music',
  schema: z.object({
    service_url: z.string().optional(),
    api_token: z.string().optional(),
    default_player: z.string().optional(),
  }),
  fields: {
    service_url: { label: 'Music Assistant URL', description: 'e.g. http://192.168.1.42:8095' },
    api_token: { label: 'API Token', type: 'secret' },
    default_player: { label: 'Default Player ID', description: 'Player ID for default playback target' },
  },
})
```

- [ ] **Step 2: Create types**

Create `frontend/src/integrations/music/types.ts` with TypeScript interfaces:

```typescript
export interface TrackInfo {
  name: string
  artist: string
  album: string | null
  imageUrl: string | null
  duration: number | null  // seconds
  elapsed: number | null   // seconds
}

export interface QueueState {
  queueId: string
  displayName: string
  state: 'playing' | 'paused' | 'idle'
  currentItem: TrackInfo | null
  volumeLevel: number | null
}

export interface MusicState {
  queues: QueueState[]
  activeQueue: QueueState | null  // the queue that's playing or was most recently active
}

export interface Player {
  playerId: string
  displayName: string
  state: string
  available: boolean
  volumeLevel: number | null
}

export interface SearchResults {
  artists: SearchItem[]
  albums: SearchItem[]
  tracks: SearchItem[]
  playlists: SearchItem[]
}

export interface SearchItem {
  name: string
  uri: string
  imageUrl: string | null
  artist?: string    // for tracks/albums
  mediaType: string
}

export interface RecentItem {
  name: string
  uri: string
  imageUrl: string | null
  mediaType: string  // "playlist", "track", "album", "artist"
  artist?: string
}
```

- [ ] **Step 3: Create barrel export and register**

Create `frontend/src/integrations/music/index.ts` — start with just the config export. Other exports will be added as components are created in later tasks:
```typescript
export { musicIntegration } from './config'
```

Register in `frontend/src/integrations/registry.ts`: add `import { musicIntegration } from './music/config'` and add to array.

- [ ] **Step 4: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/integrations/music/ frontend/src/integrations/registry.ts
git commit -m "feat(music): add frontend integration config and types"
```

---

### Task 6: MusicProvider context + useMusic hook

**Files:**
- Create: `frontend/src/integrations/music/MusicProvider.tsx`
- Create: `frontend/src/integrations/music/useMusic.ts`

- [ ] **Step 1: Create MusicProvider**

Create `frontend/src/integrations/music/MusicProvider.tsx`:

This is the core of the frontend integration. It:

1. Reads config via `useIntegrationConfig(musicIntegration)` to check if `service_url` is configured
2. If not configured, provides a null/empty context (no SSE connection)
3. If configured, connects to `GET /api/music/events` via `EventSource`
4. Handles `state` and `queue_updated` events to maintain `MusicState`
5. Runs a `setInterval` every second to increment `elapsed` on the active queue's current item (client-side tick for smooth progress bar)
6. Provides command functions that call the REST endpoints:
   - `play(uri: string, radio?: boolean)` → `POST /api/music/play`
   - `pause()` → `POST /api/music/pause`
   - `resume()` → `POST /api/music/resume`
   - `stop()` → `POST /api/music/stop`
   - `next()` → `POST /api/music/next`
   - `previous()` → `POST /api/music/previous`
   - `setVolume(playerId: string, level: number)` → `POST /api/music/volume`
7. Exports `MusicContext` and `MusicProvider`

The context value type:
```typescript
interface MusicContextValue {
  state: MusicState
  isConnected: boolean
  play: (uri: string, radio?: boolean) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  setVolume: (playerId: string, level: number) => Promise<void>
  switchPlayer: (playerId: string) => void  // updates default player in config + state
}
```

- [ ] **Step 2: Create useMusic hook**

Create `frontend/src/integrations/music/useMusic.ts`:
```typescript
import { useContext } from 'react'
import { MusicContext } from './MusicProvider'

export function useMusic() {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic must be used within MusicProvider')
  return ctx
}
```

- [ ] **Step 3: Update barrel export**

Add to `frontend/src/integrations/music/index.ts`:
```typescript
export { MusicProvider } from './MusicProvider'
export { useMusic } from './useMusic'
```

- [ ] **Step 4: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/integrations/music/
git commit -m "feat(music): add MusicProvider context with SSE + REST commands"
```

---

### Task 7: MiniPlayer bar + AppShell integration

**Files:**
- Create: `frontend/src/integrations/music/MiniPlayer.tsx`
- Modify: `frontend/src/app/AppShell.tsx`

- [ ] **Step 1: Create MiniPlayer**

Create `frontend/src/integrations/music/MiniPlayer.tsx`:

Compact strip layout (option A from design):
- Returns `null` when no active queue is playing or paused
- Cover art thumbnail (44px, rounded) — uses `activeQueue.currentItem.imageUrl`, fallback to a music note icon
- Track name + artist (200px fixed width, truncated)
- Playback controls: previous, play/pause (larger, accent color), next — circular buttons
- Volume slider (180px) with speaker icon
- Player name pill showing `activeQueue.displayName`, tappable (opens PlayerPicker — wired in Task 11)
- Tapping cover art or track name navigates to `/media` via `useNavigate`

Uses `useMusic()` hook for all state and commands.

Style: `flex items-center gap-4 px-6 py-2 bg-bg-card border-t border-border`

- [ ] **Step 2: Update barrel export**

Add to `frontend/src/integrations/music/index.ts`:
```typescript
export { MiniPlayer } from './MiniPlayer'
```

- [ ] **Step 3: Add MusicProvider and MiniPlayer to AppShell**

Modify `frontend/src/app/AppShell.tsx`:

```typescript
import { MusicProvider } from '@/integrations/music'
import { MiniPlayer } from '@/integrations/music'

export function AppShell() {
  return (
    <EventBusProvider>
      <MusicProvider>
        <div className="flex flex-col h-screen bg-bg-primary">
          <main className="flex-1 overflow-auto p-[var(--spacing-grid-gap)]">
            <Outlet />
          </main>
          <MiniPlayer />
          <TabBar />
        </div>
        <EventOverlay />
      </MusicProvider>
    </EventBusProvider>
  )
}
```

- [ ] **Step 4: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 5: Test**

Start backend and frontend. Configure music integration in Settings (MA URL + token). Play something in MA from another device. Verify:
- Mini player appears above the tab bar
- Shows correct track info + cover art
- Play/pause/skip controls work
- Volume slider works
- Navigating between tabs keeps mini player visible

- [ ] **Step 6: Commit**

```bash
git add frontend/src/integrations/music/ frontend/src/app/AppShell.tsx
git commit -m "feat(music): add MiniPlayer bar with global playback controls"
```

---

## Chunk 3: Media Tab — Quick Dials, Now Playing, Search, Player Picker

### Task 8: Quick dials component

**Files:**
- Create: `frontend/src/boards/media/QuickDials.tsx`

- [ ] **Step 1: Create QuickDials**

Create `frontend/src/boards/media/QuickDials.tsx`:

- Fetches `GET /api/music/recent` via `useQuery` with 5 min refetch interval
- Renders a 3-column grid of recently played items
- Each item: cover art (48px), name, type label (Playlist/Radio/Album/Track)
- On tap: calls `play(item.uri)` from `useMusic()`. For tracks, calls `play(item.uri, true)` to start radio mode.
- Loading state: skeleton placeholders
- Empty state: "Play something to build your quick dials"

- [ ] **Step 2: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/boards/media/
git commit -m "feat(music): add QuickDials component"
```

---

### Task 9: Now playing panel

**Files:**
- Create: `frontend/src/boards/media/NowPlaying.tsx`

- [ ] **Step 1: Create NowPlaying**

Create `frontend/src/boards/media/NowPlaying.tsx`:

Right column panel (380px) with centered layout.

Props:
```typescript
interface NowPlayingProps {
  onOpenFullscreen: () => void
  onOpenPlayerPicker: () => void
}
```

- Large cover art (200px, rounded, shadow) — tappable to call `onOpenFullscreen()`
- Track name (20px font, bold)
- Artist + album name
- Progress bar with elapsed/total time (uses `activeQueue.currentItem.elapsed` and `duration`)
- Full playback controls: shuffle, previous, play/pause (52px), next, repeat
- Volume slider
- Player picker pill

Uses `useMusic()` for state and commands.

When nothing is playing, show placeholder: music note icon + "Nothing playing" + "Pick something from the left"

- [ ] **Step 2: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/boards/media/
git commit -m "feat(music): add NowPlaying panel component"
```

---

### Task 10: Search results component

**Files:**
- Create: `frontend/src/boards/media/SearchResults.tsx`

- [ ] **Step 1: Create SearchResults**

Create `frontend/src/boards/media/SearchResults.tsx`:

- Takes `query: string` prop
- Fetches `GET /api/music/search?q={query}` via `useQuery` (enabled when `query.length >= 2`)
- Renders results grouped by type: Tracks, Artists, Albums, Playlists
- Each group: section heading + up to 5 items
- Track item: cover art thumbnail, name, artist. Tap → `play(uri, true)` (radio mode)
- Artist item: thumbnail, name. Tap → expand top tracks inline (v2, for now just play artist radio)
- Album item: cover art, name, artist. Tap → `play(uri)` (play full album)
- Playlist item: cover art, name. Tap → `play(uri)`
- Empty state: "No results for '{query}'"
- Loading state: spinner

- [ ] **Step 2: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/boards/media/
git commit -m "feat(music): add SearchResults component"
```

---

### Task 11: Player picker modal

**Files:**
- Create: `frontend/src/boards/media/PlayerPicker.tsx`

- [ ] **Step 1: Create PlayerPicker**

Create `frontend/src/boards/media/PlayerPicker.tsx`:

Modal/panel component:
- Takes `isOpen: boolean`, `onClose: () => void` props
- Fetches `GET /api/music/players` via `useQuery`
- Lists all available players
- Each player row: name, state indicator (playing/idle dot), volume slider
- Currently active player highlighted with accent color
- Tap a player → calls `switchPlayer(playerId)` from `useMusic()`, which saves the player ID as the new default via `PUT /api/config/music.default_player` and updates local state. Future commands will target this player.
- Volume slider per player → calls `setVolume(playerId, level)`
- Uses the existing `Modal` component from `@/ui/Modal`

- [ ] **Step 2: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/boards/media/
git commit -m "feat(music): add PlayerPicker modal"
```

---

### Task 12: Fullscreen now playing overlay

**Files:**
- Create: `frontend/src/boards/media/FullscreenNowPlaying.tsx`

- [ ] **Step 1: Create FullscreenNowPlaying**

Create `frontend/src/boards/media/FullscreenNowPlaying.tsx`:

Full-viewport overlay:
- Takes `isOpen: boolean`, `onClose: () => void` props
- Fixed position, covers entire screen with semi-transparent dark background
- Centered large cover art (fills most of the vertical space, e.g., 60vh)
- Track name + artist below
- Minimal controls: previous, play/pause, next
- Tap anywhere outside controls or tap X button to dismiss
- Uses `useMusic()` for state and commands

- [ ] **Step 2: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/boards/media/
git commit -m "feat(music): add FullscreenNowPlaying overlay"
```

---

### Task 13: MediaBoard — wire everything together

**Files:**
- Modify: `frontend/src/boards/MediaBoard.tsx`

- [ ] **Step 1: Implement MediaBoard**

Replace the stub `MediaBoard.tsx` with the full two-column layout:

```typescript
import { useState } from 'react'
import { useMusic } from '@/integrations/music'
import { QuickDials } from './media/QuickDials'
import { NowPlaying } from './media/NowPlaying'
import { SearchResults } from './media/SearchResults'
import { PlayerPicker } from './media/PlayerPicker'
import { FullscreenNowPlaying } from './media/FullscreenNowPlaying'
```

Layout:
- Two-column flex: left (flex-1) + right (w-[380px])
- Left column:
  - Search input at top (controlled, debounced 300ms)
  - When searching: `<SearchResults query={debouncedQuery} />`
  - When not searching: `<QuickDials />`
- Right column:
  - `<NowPlaying onOpenFullscreen={() => setFullscreen(true)} onOpenPlayerPicker={() => setPickerOpen(true)} />`
- Overlays:
  - `<PlayerPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />`
  - `<FullscreenNowPlaying isOpen={fullscreen} onClose={() => setFullscreen(false)} />`

- [ ] **Step 2: Verify**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
```

- [ ] **Step 3: End-to-end test**

Start backend and frontend. Configure music integration. Test:
1. Media tab shows quick dials (may be empty initially)
2. Search works — type "beach house", see results grouped by type
3. Tap a search result — music starts on default player
4. Now playing panel updates with track info + cover art
5. Mini player appears on all tabs
6. Player picker shows all MA players with volume
7. Fullscreen view opens when tapping cover art
8. Controls (play/pause/skip/volume) all work

- [ ] **Step 4: Commit**

```bash
git add frontend/src/boards/
git commit -m "feat(music): implement MediaBoard with quick dials, search, now playing"
```

---

### Task 14: Settings page — player picker for default player

**Files:**
- Create: `frontend/src/integrations/music/MusicSettings.tsx`
- Modify: `frontend/src/integrations/music/config.ts`

- [ ] **Step 1: Create custom settings component**

Create `frontend/src/integrations/music/MusicSettings.tsx`:

Custom settings component that:
- Shows text inputs for MA URL and API token (standard fields)
- Fetches `GET /api/music/players` (when URL + token are saved) and shows a dropdown/list for selecting the default player (instead of requiring the user to paste a player ID)
- Save button writes all three config keys

- [ ] **Step 2: Register settings component**

Update `config.ts` to add `settingsComponent: MusicSettings` to the integration definition. This is an existing pattern — see `timersIntegration` in `frontend/src/integrations/timers/config.ts` or `sportsIntegration` for examples of custom settings components.

- [ ] **Step 3: Verify and commit**

```bash
cd /home/bbaldino/work/dashboard/frontend
npx tsc --noEmit
git add frontend/src/integrations/music/
git commit -m "feat(music): add custom settings with player picker for default player"
```
