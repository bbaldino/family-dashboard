# Driving Time & Google Cloud Refactor Design

## Goal

Add driving time estimates to calendar events using the Google Routes API, showing "Leave in X min" tags in both the hero strip and calendar widget. Also refactor Google credentials into a shared "Google Cloud" integration.

## Part 1: Google Cloud Integration (Settings Refactor)

### New "Google Cloud" integration

A `hasBackend: false` integration that holds all Google Cloud project credentials in one place:

- `google-cloud.client_id` — OAuth Client ID
- `google-cloud.client_secret` — OAuth Client Secret
- `google-cloud.redirect_uri` — OAuth Redirect URI
- `google-cloud.api_key` — API Key (for Routes API, etc.)

Custom settings component with labeled fields for each.

**Dependency note:** Google Calendar and Driving Time both depend on Google Cloud being configured. If credentials are missing, those features show appropriate "Configure Google Cloud in Settings" messages.

### Google Calendar simplification

Remove OAuth fields from Google Calendar integration. Keep only `calendar_ids` (which calendars to display).

The Google Calendar backend auth routes (`/api/google-calendar/auth`, `/api/google-calendar/callback`) read credentials from `google-cloud.*` config keys using `IntegrationConfig::new(&pool, "google-cloud")`.

### Migration

No backward compatibility needed. Just rename the config key prefix. User re-enters credentials in the new Google Cloud settings page.

## Part 2: Driving Time Feature

### Backend

**Integration ID:** `driving-time`

**Route:** `GET /api/driving-time?destination={address}&event_start={iso_timestamp}`

- Reads `google-cloud.api_key` from config (via `IntegrationConfig::new(&pool, "google-cloud")`)
- Reads `driving-time.home_address` from config for the origin
- Reads `driving-time.buffer_minutes` from config (default: 5)
- Calls Google Routes API: `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- Returns `{ durationSeconds: number, durationText: string, bufferMinutes: number }` or `{ durationSeconds: null }` on failure

**Google Routes API request:**
```json
{
  "origin": { "address": "123 Main St, San Jose, CA" },
  "destination": { "address": "3001 Ross Ave, San Jose, CA" },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE"
}
```

Header: `X-Goog-Api-Key: {api_key}`, `X-Goog-FieldMask: routes.duration`

**Response parsing:** `routes[0].duration` is a string like `"1080s"` — parse to seconds.

**Caching:** In-memory cache keyed by destination address (normalized to lowercase, trimmed).

The backend computes the cache TTL based on `event_start` (passed as a query param):

| Time before event | Cache TTL |
|-------------------|-----------|
| > 2 hours | 30 minutes |
| 1–2 hours | 15 minutes |
| 30 min – 1 hour | 10 minutes |
| < 30 min | 5 minutes |

When multiple events share the same destination with different start times, the cache uses the **shortest** TTL (earliest event determines freshness).

**Null result caching:** If the Routes API returns an error (non-geocodable address like "Zoom", "TBD", etc.), the null result is cached for 1 hour to avoid re-hitting the API repeatedly for the same bad address.

**Error handling:** If the Routes API fails, the API key is missing, or the home address isn't configured, return `{ durationSeconds: null }`. The frontend hides the drive tag for that event.

### Frontend

**`useDrivingTime` hook:**
- Takes a list of events (from the calendar data)
- Filters to events within the next 24 hours that have a `location` field
- Deduplicates by destination address — only one API call per unique destination
- Fetches driving time for each unique destination from `/api/driving-time`, passing the earliest `event_start` for that destination
- Requests are serialized (one at a time) to avoid hitting Routes API rate limits on initial page load
- Returns a map of `eventId → { durationSeconds, leaveByTime, urgency }`
- Recalculates urgency every minute (since "leave in X min" counts down)
- Refetches driving times at intervals matching the cache TTL (polls more frequently as events approach)

**Urgency calculation:**
- `leaveByTime = eventStartTime - durationSeconds - bufferMinutes`
- `minutesUntilLeave = leaveByTime - now`
- Green (`ok`): > 30 min until leave-by
- Orange (`soon`): 5–30 min until leave-by
- Red (`urgent`): < 5 min or past leave-by time

**Display text:**
- Green: "X min drive" (just informational)
- Orange: "Leave in X min"
- Red: "Leave now!"

**Calendar Widget (`CalendarWidget`):**
- For events with driving time data, show a colored drive tag below the event location
- Only for events within the next 24 hours

**Hero Strip (`HeroStrip`):**
- The next upcoming event with a location and driving time shows the drive tag
- Passed down from `HomeBoard` alongside the existing hero events

### Settings

**Driving Time integration** (`hasBackend: true`):
- `driving-time.home_address` — origin address (e.g. "123 Main St, San Jose, CA")
- `driving-time.buffer_minutes` — extra time to add before leave-by (default: 5)

API key comes from `google-cloud.api_key` — no duplication.

## Deferred

- Multiple origin addresses (e.g. "from work" vs "from home")
- Transit/walking mode options
- Driving time on the monthly calendar tab
- Route preview / map display
- API key validation / "Test Connection" button in Google Cloud settings
