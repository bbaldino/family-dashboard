# Music Integration Design Spec

Dashboard integration with Music Assistant for music playback control, browsing, and discovery via a custom UI.

## Goals

- Control Music Assistant from the dashboard with a polished, kitchen-friendly UI
- Mini player bar visible on all pages for quick play/pause/skip/volume
- Full Media tab for discovering and starting music (quick dials, search)
- Real-time now-playing updates via SSE
- All communication proxied through the dashboard backend (avoids mixed content, keeps MA token server-side)

## Architecture

### Integration Pattern

**Integration ID:** `music`

The dashboard backend acts as a proxy between the frontend and Music Assistant:

```
Browser ←SSE── Dashboard Backend ←WebSocket── Music Assistant
Browser ──REST→ Dashboard Backend ──POST /api→ Music Assistant
```

- **Backend** maintains a persistent WebSocket connection to MA for real-time state events (player state changes, queue updates, track changes)
- **Backend** exposes an SSE endpoint that forwards relevant MA events to connected dashboard clients
- **Backend** proxies playback commands and queries as REST endpoints that translate to MA's `POST /api` command format
- **MA token** stays server-side in dashboard config; frontend never sees it

### Config Fields

| Key | Type | Description |
|-----|------|-------------|
| `music.service_url` | text | MA server URL (e.g., `http://192.168.1.42:8095`) |
| `music.api_token` | secret | MA bearer token |
| `music.default_player` | text | Default player ID for playback |

---

## Backend API

### SSE Endpoint

```
GET /api/music/events
```

Streams real-time state as JSON events. The backend maintains a single WebSocket to MA and fans out to all SSE clients.

**Event types:**

- `state` — Full snapshot of all player queues with current track info. Sent on initial connection and whenever player/queue state changes.

```json
{
  "type": "state",
  "queues": [
    {
      "queueId": "0a91587e-...",
      "displayName": "Master Bedroom speaker",
      "state": "playing",
      "currentItem": {
        "name": "Wildflower",
        "artist": "Beach House",
        "album": "7",
        "imageUrl": "https://i.scdn.co/image/...",
        "duration": 244,
        "elapsed": 84
      },
      "volumeLevel": 40
    }
  ]
}
```

- `queue_updated` — Single queue changed (track change, play/pause, volume, elapsed time). Same shape as one entry in the `state` event, sent as a delta. MA's `queue_time_updated` events (which fire frequently during playback with updated elapsed time) are mapped to this event type.

```json
{
  "type": "queue_updated",
  "queue": { ... }
}
```

### REST Endpoints

**Playback commands:**
```
POST /api/music/play          { uri: string, queueId?: string, radio?: boolean }
POST /api/music/pause         { queueId?: string }
POST /api/music/resume        { queueId?: string }
POST /api/music/stop          { queueId?: string }
POST /api/music/next          { queueId?: string }
POST /api/music/previous      { queueId?: string }
POST /api/music/volume        { playerId: string, level: number }
```

All `queueId` parameters default to the configured `music.default_player` if omitted.

**Queries:**
```
GET /api/music/players                    — list all players with state and volume
GET /api/music/search?q={query}           — search tracks/artists/albums/playlists
GET /api/music/recent                     — recently played items (feeds quick dials)
GET /api/music/queue/{queueId}            — queue contents for a player
```

Each endpoint translates to the corresponding MA `POST /api` command:

| Dashboard Endpoint | MA Command |
|-------------------|------------|
| `POST /play` | `player_queues/play_media` |
| `POST /pause` | `player_queues/pause` |
| `POST /resume` | `player_queues/resume` |
| `POST /stop` | `player_queues/stop` |
| `POST /next` | `player_queues/next` |
| `POST /previous` | `player_queues/previous` |
| `POST /volume` | `players/cmd/volume_set` |
| `GET /players` | `players/all` |
| `GET /search` | `music/search` |
| `GET /recent` | `music/recently_played_items` |
| `GET /queue/:id` | `player_queues/items` |

### Backend WebSocket Connection to MA

The backend establishes a WebSocket connection to MA on startup (or on first request if MA is unavailable at boot). It subscribes to player and queue events. If the connection drops, it reconnects with backoff.

MA's WebSocket sends events like `player_updated`, `queue_updated`, `queue_time_updated`. The backend transforms these into the simplified SSE format above and broadcasts to all connected SSE clients.

---

## Frontend

### Shared State: `useMusic` Hook

A single hook provides music state and commands to all components (mini player, media tab, fullscreen view).

- Connects to `GET /api/music/events` via EventSource for real-time state
- Provides current state: active queue, current track, play state, volume, player info
- Provides command functions: `play(uri, radio?)`, `pause()`, `resume()`, `next()`, `previous()`, `setVolume(level)`, `switchPlayer(id)`
- Client-side elapsed time ticking: between SSE updates, a local `setInterval` increments elapsed time every second for smooth progress bar movement (same pattern as timers integration)
- State is shared across components via React context (provider in AppShell)
- The context provider gates on config presence — if `music.service_url` is not configured, no SSE connection is established and no mini player renders

### Mini Player Bar

Rendered in `AppShell`, positioned between the main content area and the `TabBar`. Only visible when a queue is actively playing or paused.

**Layout:** Compact horizontal strip (full width)
- Cover art thumbnail (44px, rounded)
- Track name + artist (fixed width, truncated)
- Playback controls: previous, play/pause, next (circular buttons with generous touch targets)
- Volume slider with speaker icon (180px wide)
- Player name pill (tappable to open player picker)

Tapping cover art or track name navigates to the Media tab.

### Media Tab (MediaBoard)

Full-page tab, two-column layout:

**Left column (flex: 1):**
- Search bar at top — inline, debounced at 300ms
- Quick dials grid below (3 columns) — auto-generated from MA's recently played items
- Each quick dial: cover art thumbnail (48px), name, type label (Playlist/Radio/Album). Tap to play on default player.

**Right column (380px fixed):**
- Now playing panel — centered layout
- Large cover art (200px, rounded, shadow)
- Track name, artist, album
- Progress bar with elapsed/total time
- Full playback controls: shuffle, previous, play/pause, next, repeat
- Volume slider
- Player picker pill

**When nothing is playing:** Right column shows placeholder ("Nothing playing — pick something from the left"). Quick dials and search are the full focus.

### Fullscreen Now Playing View

Triggered by tapping the album art in the Media tab's now playing panel. Overlays the entire screen.

- Large centered cover art (fills most of the viewport)
- Track name + artist below
- Minimal controls: previous, play/pause, next
- Tap anywhere or tap X button to dismiss

### Search Results

When typing in the search bar, results appear inline below the search field (replacing quick dials while searching). Results grouped by type:

- **Tracks** — cover art, name, artist. Tap to play (starts radio from track).
- **Artists** — thumbnail, name. Tap to expand top tracks inline.
- **Albums** — cover art, name, artist. Tap to play full album.
- **Playlists** — cover art, name. Tap to play.

Max 5 results per category. Clear search to return to quick dials.

### Player Picker

Modal/panel triggered by tapping the player name pill (in mini player or Media tab).

- Lists all available MA players with current state (playing/idle/unavailable)
- Volume slider per player
- Tap a player to switch playback to it (becomes the active target)
- Currently active player highlighted

---

## V1 Scope

**In scope:**
- Backend: MA WebSocket connection, SSE event stream, REST command proxy
- Mini player bar on all pages (compact strip, play/pause/skip/volume)
- Media tab with two-column layout (quick dials + search | now playing)
- Fullscreen now playing view
- Quick dials from recently played
- Search (tracks, artists, albums, playlists)
- Player picker (list players, switch target, per-player volume)
- Settings page (MA URL, token, default player)

**Deferred (V2+):**
- Speaker grouping/ungrouping (Sonos groups)
- Queue management (reorder, remove, add next)
- Browse by genre/mood/provider
- Album/artist detail pages
- Lyrics display
- Shuffle/repeat in mini player
- Crossfade/DSP settings
