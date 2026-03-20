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

### Google Calendar simplification

Remove OAuth fields from Google Calendar integration. Keep only `calendar_ids` (which calendars to display).

The Google Calendar backend auth routes (`/api/google-calendar/auth`, `/api/google-calendar/callback`) read credentials from `google-cloud.*` config keys instead of `google-calendar.*`.

### Migration

No backward compatibility needed. Just rename the config key prefix. User re-enters credentials in the new Google Cloud settings page.

## Part 2: Driving Time Feature

### Backend

**Integration ID:** `driving-time`

**Route:** `GET /api/driving-time?destination={address}`

- Reads `google-cloud.api_key` from config for the Routes API key
- Reads `driving-time.home_address` from config for the origin
- Calls Google Routes API: `POST https://routes.googleapis.com/directions/v2:computeRoutes`
- Returns `{ durationSeconds: number, durationText: string }` (e.g. `{ durationSeconds: 1080, durationText: "18 mins" }`)

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

**Caching:** In-memory cache keyed by destination address (normalized to lowercase, trimmed). TTL varies by time until event:

| Time before event | Cache TTL |
|-------------------|-----------|
| > 2 hours | 30 minutes |
| 1–2 hours | 15 minutes |
| 30 min – 1 hour | 10 minutes |
| < 30 min | 5 minutes |

The cache TTL is determined by the frontend when making the request — it passes a `ttl` query param: `GET /api/driving-time?destination=...&ttl=300`. The backend uses this to decide if the cached value is still fresh.

**Error handling:** If the Routes API fails or the destination can't be resolved, return `null` duration. The frontend hides the drive tag for that event.

### Frontend

**`useDrivingTime` hook:**
- Takes a list of events (from the calendar data)
- Filters to events within the next 24 hours that have a `location` field
- Fetches driving time for each unique destination from `/api/driving-time`
- Computes appropriate cache TTL based on time until event
- Returns a map of `eventId → { durationSeconds, leaveByTime, urgency }`
- Recalculates urgency every minute (since "leave in X min" counts down)

**Urgency calculation:**
- `leaveByTime = eventStartTime - durationSeconds - bufferMinutes` (buffer: 5 min by default)
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
