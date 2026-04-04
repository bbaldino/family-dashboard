# On This Day Widget Overhaul

## Goal

Replace the current frontend-only On This Day widget with a backend-powered version that filters out inappropriate content via Ollama, mixes in notable births and holidays, and auto-cycles through events.

## Problem

The Wikipedia "On This Day" selected events feed includes violence, mass shootings, disasters, and other content inappropriate for a family kitchen dashboard. There's no way to filter by topic on the API side.

## Backend: on-this-day integration

New integration at `/api/on-this-day/events`.

### Data flow

1. Fetch three Wikipedia endpoints for today's date:
   - `/onthisday/selected/{MM}/{DD}` — curated historical events (~20)
   - `/onthisday/births/{MM}/{DD}` — notable births (~260)
   - `/onthisday/holidays/{MM}/{DD}` — holidays/observances (~7)

2. Filter selected events through Ollama:
   - Prompt per event: "Is this appropriate for a family kitchen dashboard seen by young children? Only say yes if the content is free of violence, crime, disasters, and death. Answer only 'yes' or 'no'."
   - Keep only events that pass
   - Holidays are included as events without filtering (they're inherently appropriate)

3. Pick 2-3 notable births:
   - No Ollama filtering needed (birth dates are neutral facts)
   - Select births that have a non-empty `description` field from the Wikipedia API
   - Take the first 3 (Wikipedia sorts by notability)

4. Cache the filtered result for 24 hours.

### Response format

```json
{
  "events": [
    { "year": 1984, "text": "Aboard Soyuz T-11, Rakesh Sharma became..." }
  ],
  "births": [
    { "year": 1924, "name": "Marlon Brando", "role": "American actor" }
  ]
}
```

Holidays are mixed into the `events` array (they have a `text` field but no `year` — use current year or omit).

## Frontend: widget rewrite

### Data hook

New `useOnThisDay` hook calls `/api/on-this-day/events` via the integration API pattern, replacing the current inline Wikipedia fetch.

### Display — mixed format

- **Featured event:** large year + description text. Auto-cycles every 30 seconds through events. Manual skip button (existing RefreshCw icon) advances to next event.
- **"Also Born Today" footer:** 2-3 compact rows below the featured event. Each row: name, birth year, role description. Static (does not cycle).

### Auto-cycling

- `useEffect` timer advances the featured event index every 30 seconds
- Manual click resets the timer (so the new event shows for a full 30s)
- Cycles back to the beginning after reaching the end

### Size variants

- **Standard:** featured event + births footer (as described above)
- **Compact:** featured event only (year + truncated text), no births footer. Existing compact implementation adapted to new data format.

## Files

### New files

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/on_this_day/mod.rs` | Module registration, router |
| `backend/src/integrations/on_this_day/routes.rs` | GET handler, Wikipedia fetch, Ollama filter, caching |
| `backend/src/integrations/on_this_day/types.rs` | Response types |
| `frontend/src/integrations/on-this-day/useOnThisDay.ts` | Data hook calling backend |
| `frontend/src/integrations/on-this-day/config.ts` | Integration definition |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Register on_this_day integration |
| `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx` | Rewrite: use backend data, auto-cycle, mixed format display |
| `frontend/src/integrations/on-this-day/useWidgetMeta.ts` | Update visibility based on backend data availability |
