# Sports Integration Design

## Goal

Add a sports widget card to the dashboard that shows live scores, final results, and upcoming games for the user's tracked teams, powered by ESPN's free public API.

## Data Source

ESPN public scoreboard API — no authentication required.

**Endpoint pattern:**
```
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
```

**Supported leagues (v1):**
| League | Sport path | League path |
|--------|-----------|-------------|
| NBA | basketball | nba |
| NFL | football | nfl |
| MLB | baseball | mlb |
| NHL | hockey | nhl |

**Key fields from ESPN response:**
- `events[].competitions[].competitors[]` — teams with `team.logo`, `team.abbreviation`, `team.displayName`, `records[0].summary` (win-loss)
- `events[].competitions[].status` — game clock, period, state (pre/in/post)
- `events[].competitions[].leaders[]` — stat leaders per category (points, rebounds, passing yards, etc.)
- `events[].competitions[].broadcasts[]` — TV network info
- `events[].competitions[].venue` — stadium/arena
- `events[].competitions[].odds[]` — spread/over-under (not used in v1)
- `events[].season.type` — 1=preseason, 2=regular, 3=postseason
- `events[].competitions[].notes[].headline` — playoff round name (e.g. "Super Bowl LX")

## Architecture

### Backend

**Integration ID:** `sports`

**Routes:**
- `GET /api/sports/games` — returns all tracked games within the configured time window, sorted by state (live > final > upcoming), then by start time
- `GET /api/sports/teams?league={league}` — returns list of all teams for a given league (for the team picker settings UI); proxied from ESPN's teams endpoint
- `GET /api/sports/teams/search?q={query}` — search teams across all leagues

**Response shape for `/api/sports/teams`:**
```json
{
  "teams": [
    {
      "id": "9",
      "name": "Warriors",
      "displayName": "Golden State Warriors",
      "abbreviation": "GSW",
      "logo": "https://a.espncdn.com/i/teamlogos/nba/500/gs.png",
      "league": "nba"
    }
  ]
}
```
The search endpoint returns the same shape but searches across all leagues.

**Polling strategy:**
- Backend caches ESPN responses per league
- Two configurable intervals stored in config:
  - `sports.poll_interval_live` — polling interval when any tracked game is live (default: 30s)
  - `sports.poll_interval_idle` — polling interval when no live games (default: 15min)
- On each `/api/sports/games` request, the backend checks if the cached data is stale based on the current interval, and re-fetches from ESPN if needed
- Polls only leagues that have tracked teams configured
- If ESPN returns an error (429, 5xx, network), serve the last cached response and log the error. No retry loop — the next poll interval will try again naturally

**Response shape for `/api/sports/games`:**
```json
{
  "games": [
    {
      "id": "401584668",
      "league": "nba",
      "state": "live",
      "name": "Golden State Warriors at Los Angeles Lakers",
      "startTime": "2026-03-16T02:00:00Z",
      "venue": "Crypto.com Arena",
      "broadcast": "TNT",
      "playoffRound": null,
      "home": {
        "id": "13",
        "name": "Lakers",
        "abbreviation": "LAL",
        "logo": "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
        "record": "35-25",
        "score": 91,
        "winner": false
      },
      "away": {
        "id": "9",
        "name": "Warriors",
        "abbreviation": "GSW",
        "logo": "https://a.espncdn.com/i/teamlogos/nba/500/gs.png",
        "record": "38-22",
        "score": 98,
        "winner": true
      },
      "clock": "4:22",
      "period": 3,
      "periodLabel": "Q3",
      "leaders": [
        { "team": "away", "name": "Curry", "stats": "28 pts, 6 ast, 4 reb" },
        { "team": "home", "name": "James", "stats": "24 pts, 8 reb, 5 ast" }
      ],
      "situation": null
    }
  ],
  "hasLive": true
}
```

**Game state mapping from ESPN `status.type.name`:**
- `STATUS_SCHEDULED` → `"upcoming"`
- `STATUS_POSTPONED` → `"postponed"` (rendered like upcoming but shows "Postponed" instead of a time)
- `STATUS_IN_PROGRESS` / `STATUS_HALFTIME` / `STATUS_END_PERIOD` → `"live"`
- `STATUS_FINAL` / `STATUS_FINAL_OT` → `"final"`

**Period labels by sport:**
- NBA: Q1-Q4, OT, 2OT...
- NFL: Q1-Q4, OT
- MLB: Top/Bot 1st-9th, Extra innings (ESPN provides `status.type.shortDetail` like "Bot 6th" directly — use that)
- NHL: P1-P3, OT, SO

**Clock and period field semantics:**
- `clock`: display string from ESPN's `status.displayClock` (e.g. "4:22", "0:00"). For MLB this is typically empty — the game state is captured in `periodLabel` instead.
- `period`: numeric period from ESPN (e.g. 3 for Q3 in NBA, 5 for Top 5th half-inning in MLB). Used for sorting, not display.
- `periodLabel`: human-readable string (e.g. "Q3 4:22", "Bot 6th", "2nd OT"). The backend constructs this from ESPN's `status.type.shortDetail` which already handles sport-specific formatting.
- `situation`: MLB-specific string for base/out state (e.g. "2 outs, Runner on 2nd"). Null for other sports.

**Leader stat formatting by sport:**
- NBA: pts, reb, ast
- NFL: passing yds, rushing yds, receiving yds
- MLB: batting line (H-AB, HR, RBI) or pitching (IP, K, ER)
- NHL: goals, assists, saves (goalie)

### Frontend

**Widget component:** `SportsWidget`
- Renders inside `<WidgetCard title="Sports" category="sports">`
- Uses TanStack Query with adaptive refetch interval based on `hasLive` from response
- Sorts games: live first (red tint, pulsing dot, stats), then final (green "Final"), then upcoming (orange time)
- When no tracked teams configured: shows "Select teams in Settings to get started"
- When tracked teams exist but no games in window: shows "No games today"
- Badge in card header: "N Live" when live games exist

**New category color:** `--color-sports` added to theme variables (suggest a red-ish tone like `#c04040` to match the live game energy, or slate blue `#4a7a9a` reusing info)

**Settings component:** `SportsSettings` (custom `settingsComponent`)
- Search bar at top — searches across all leagues, shows matching teams
- Below: expandable sections per league (NBA, NFL, MLB, NHL)
- Each section lists all teams with checkboxes + team logo
- Selected teams shown as a summary/pill list at top
- Polling interval inputs (live + idle) with sensible defaults
- Time window config (how far back/forward to show games)

**Config schema:**
```typescript
schema: z.object({
  tracked_teams: z.string().optional().default('[]'),     // JSON array of {league, teamId}
  poll_interval_live: z.string().optional().default('30'),  // seconds
  poll_interval_idle: z.string().optional().default('900'), // seconds
  window_hours: z.string().optional().default('24'),        // hours before/after now
})
```

`tracked_teams` stored as JSON string in the config table:
```json
[
  {"league": "nba", "teamId": "9"},
  {"league": "nfl", "teamId": "25"},
  {"league": "mlb", "teamId": "19"}
]
```

### Game time window logic

`window_hours` is symmetric — the same value applies in both directions. This keeps config simple; a 24-hour window means "show games from the past 24h and the next 24h."

The backend filters ESPN scoreboard events to only include:
1. Games involving a tracked team
2. Games that ended within the past `window_hours` (for final scores)
3. Games that start within the next `window_hours` (for upcoming)
4. All currently live games for tracked teams (always included regardless of window)

## Widget Card Visual Design

Matches the mockups created during brainstorming. Key visual elements:

**Card structure:**
- Standard `WidgetCard` with "Sports" title and optional "N Live" badge
- Games stacked vertically, separated by subtle dividers

**Per-game layout (matchup row):**
- Left: away team logo (36px) + name + record (conventional scoreboard layout: away on left)
- Center: score (live/final) or game time (upcoming)
- Right: home team logo + name + record

**Field nullability:**
- `score`: `number | null` — null for upcoming/postponed games (don't render "0-0")
- `winner`: `boolean | null` — null for upcoming/live games
- `leaders`: empty array for upcoming games; populated for live and final
- `clock`: null for upcoming games and MLB (where state is in `periodLabel`)
- `situation`: only populated for live MLB games, null otherwise

**State-specific styling:**
- **Live:** subtle red tint background, pulsing red dot + "LIVE" text, clock/period below score, 1-2 stat leader lines below. For MLB, also show `situation` line.
- **Final:** score with winner bold / loser dimmed, green "Final" text, relative time in league label ("NBA - Last night")
- **Upcoming:** game time in orange, TV network in small gray text below
- **Postponed:** same layout as upcoming but shows "Postponed" in red instead of a time

**Error states:**
- If ESPN API is unreachable, show stale cached data with a small "Last updated X ago" indicator
- If no cached data exists at all, show "Unable to load scores" with a retry button

**Sort order within card:** live → final (most recent first) → upcoming (soonest first)

## Deferred (v2+)

- "Big games" / marquee events (Super Bowl, World Series, NBA Finals, etc.)
- Tennis grand slams and individual sports
- Detail page with playoff brackets
- Play-by-play timeline
