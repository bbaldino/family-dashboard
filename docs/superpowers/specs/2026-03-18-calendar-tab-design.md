# Calendar Tab Design

## Goal

Add a full-page monthly calendar view as a new tab in the bottom navigation, showing events directly in grid cells with a modal for day detail on busy days.

## Architecture

### No backend changes needed

The existing Google Calendar backend (`GET /api/google-calendar/events?calendar={id}&start={iso}&end={iso}`) already supports arbitrary date ranges. The calendar tab just requests a month's worth of events instead of a week. No new fields or endpoints are needed — all required data (title, time, location) is already in the response.

### Frontend

**New route:** `/calendar` → `CalendarBoard`

**New tab:** "Calendar" added to the bottom TabBar between Home and Media. Final tab order: Home, Calendar, Media, Cameras. The tab bar may need minor spacing adjustment for 4 tabs (currently uses `gap-[60px]` for 3).

**Components:**

- `CalendarBoard` — full-page board component (like HomeBoard, MediaBoard). Contains the month grid and manages selected month/day state. Handles loading and error states (spinner while loading, error message if Google Calendar is disconnected).
- `MonthGrid` — the 7-column calendar grid. Renders day cells with event pills. Handles month navigation (prev/next arrows, "Today" button).
- `DayCell` — individual day cell. Shows day number and up to 2 event pills (truncated text). Shows "+N more" when events overflow. Tappable to open day detail modal.
- `DayDetailModal` — uses the shared `Modal` component. Shows full event list for the selected day with times, titles, locations.

**Data fetching:**
- New `useMonthCalendar(year, month)` hook
- Fetches events for the full month plus padding days (to fill partial first/last weeks)
- Reads `calendar_ids` from config (same as the existing week view)
- Uses the existing `usePolling` hook for consistency with the week view calendar hook
- Groups events by date string (YYYY-MM-DD), same pattern as existing `useGoogleCalendar`

### Month grid layout

The grid fills the available screen space (full height minus TabBar). Each row represents a week. The grid always shows complete weeks (typically 5-6 rows depending on the month).

**Header:** Month name + year on the left, navigation arrows on the right, "Today" button to jump to current month.

**Weekday headers:** Sun, Mon, Tue, Wed, Thu, Fri, Sat

**Day cells:**
- Day number in top-left (current day highlighted with the calendar orange circle)
- Event pills below the number, each showing truncated event title
- All event pills use `--color-calendar` with a semi-transparent background (single color for v1, per-calendar colors deferred)
- All-day events shown first (no time prefix), then timed events (with compact time prefix like "5p")
- Fixed maximum of 2 visible pills per cell, then "+N more" text for any remaining
- Days from adjacent months shown with muted styling
- The day whose modal is currently open gets a subtle background tint (no persistent selected state)

**Responsive sizing:** Day cells use `flex-1` height within the grid so they stretch to fill available vertical space. Event pills use small text (9-10px) to fit.

### Multi-day events (v1 behavior)

Multi-day event spanning across cells is deferred. In v1, multi-day events appear in every day cell they cover — each day shows the event as an all-day pill. This means a 3-day vacation will show as an all-day event on each of the 3 days individually.

### Day detail modal

Opens when any day cell is tapped. Uses the existing shared `Modal` component.

**Contents:**
- Header: formatted day name (e.g. "Wednesday, March 18")
- Event list: vertical list with colored dot, time, title, and location for each event
- All-day events listed first, then timed events sorted by start time
- Close via X button, backdrop click, or Escape

### Navigation

**Month navigation:**
- Left/right arrow buttons to go to previous/next month
- "Today" button to jump back to the current month (only shown when not viewing current month)
- Swipe gestures deferred for v1

**Tab bar:**
- Calendar tab icon: a calendar icon from lucide-react (`CalendarDays`)
- Position: between Home and Media tabs

### Loading and error states

- **Loading:** Centered spinner while events are being fetched. The grid structure (header, weekday labels, day numbers) renders immediately — only event pills wait for data.
- **Error:** If Google Calendar is not configured or auth has expired, show a message in the grid area: "Connect Google Calendar in Settings"

## Visual design

Follows the existing dashboard aesthetic:
- Background: `--color-bg-primary` (#f3efe9)
- Grid card: white background with `--radius-card` corners and `--shadow-card`
- Event pills: small rounded rectangles with `color-mix(in srgb, var(--color-calendar) 15%, transparent)` background, `--color-calendar` text
- Today: day number in `--color-calendar` circle with white text
- Tapped day: subtle `--color-calendar` tinted background while modal is open
- Adjacent month days: muted text color for day number, no event pills shown
- Borders between cells: subtle `--color-border` lines

## Deferred

- Week view toggle
- Swipe to navigate months
- Drag-to-create events
- Multi-day event spanning across cells (visual bar spanning multiple days)
- Per-calendar color coding
