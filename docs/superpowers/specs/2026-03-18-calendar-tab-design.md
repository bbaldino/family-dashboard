# Calendar Tab Design

## Goal

Add a full-page monthly calendar view as a new tab in the bottom navigation, showing events directly in grid cells with a modal for day detail on busy days.

## Architecture

### No backend changes needed

The existing Google Calendar backend (`GET /api/google-calendar/events?calendar={id}&start={iso}&end={iso}`) already supports arbitrary date ranges. The calendar tab just requests a month's worth of events instead of a week.

### Frontend

**New route:** `/calendar` → `CalendarBoard`

**New tab:** "Calendar" added to the bottom TabBar between Home and Media.

**Components:**

- `CalendarBoard` — full-page board component (like HomeBoard, MediaBoard). Contains the month grid and manages selected month state.
- `MonthGrid` — the 7-column calendar grid. Renders day cells with event pills. Handles month navigation (prev/next arrows, "Today" button).
- `DayCell` — individual day cell. Shows day number and up to 2-3 event pills (colored, truncated text). Shows "+N more" when events overflow. Tappable to open day detail modal.
- `DayDetailModal` — uses the shared `Modal` component. Shows full event list for the selected day with times, titles, locations.

**Data fetching:**
- New `useMonthCalendar(year, month)` hook
- Fetches events for the full month plus padding days (to fill partial first/last weeks)
- Reads `calendar_ids` from config (same as the existing week view)
- Uses TanStack Query with 5-minute refetch interval
- Groups events by date string (YYYY-MM-DD), same pattern as existing `useGoogleCalendar`

### Month grid layout

The grid fills the available screen space (full height minus TabBar). Each row represents a week. The grid always shows complete weeks (typically 5-6 rows depending on the month).

**Header:** Month name + year on the left, navigation arrows on the right, "Today" button to jump to current month.

**Weekday headers:** Sun, Mon, Tue, Wed, Thu, Fri, Sat

**Day cells:**
- Day number in top-left (current day highlighted with the calendar orange circle)
- Event pills below the number, each showing truncated event title
- Pills colored by calendar source (using calendar color from Google API if available, falling back to the calendar theme orange)
- All-day events shown first (no time prefix), then timed events (with time prefix like "5p")
- Maximum 2-3 visible pills per cell depending on available height, then "+N more" text
- Days from adjacent months shown with muted styling
- Days with the selected state get a subtle background tint

**Responsive sizing:** Day cells use `flex-1` height within the grid so they stretch to fill available vertical space. Event pills use small text (9-10px) to fit.

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
- Calendar tab icon: a calendar icon from lucide-react
- Position: between Home and Media tabs

## Visual design

Follows the existing dashboard aesthetic:
- Background: `--color-bg-primary` (#f3efe9)
- Grid card: white background with `--radius-card` corners and `--shadow-card`
- Event pills: small rounded rectangles with semi-transparent calendar color background
- Today: day number in orange circle (matching the existing CalendarWidget style)
- Selected day: subtle background tint
- Adjacent month days: muted text color
- Borders between cells: subtle `--color-border` lines

## Deferred

- Week view toggle
- Swipe to navigate months
- Drag-to-create events
- Multi-day event spanning across cells
- Calendar color per source (use single color for v1, can add per-calendar colors later)
