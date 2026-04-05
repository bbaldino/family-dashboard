# Filler Widgets: Word of the Day, Daily Quote, Trivia

## Goal

Add three new ambient/filler widgets for the dashboard — Word of the Day, Daily Quote, and Trivia. These fill empty slots when higher-priority widgets have nothing to display.

## Architecture

Each widget is an independent integration following the existing pattern:
- Backend integration with a single endpoint, external API fetch, 24-hour cache
- Frontend widget with `useWidgetMeta` (always visible, priority 0), data hook, and component
- Standard size only — no expanded or compact variants needed
- Each gets its own settings entry in the admin panel

## Word of the Day

**Data source:** Wordnik API — free API key, dedicated Word of the Day endpoint.

**Backend:** `GET /api/word-of-the-day/today`
- Fetches from `https://api.wordnik.com/v4/words.json/wordOfTheDay?api_key={key}`
- Caches for 24 hours
- Returns `{ word, partOfSpeech, definition, example }`
- Settings: `api_key` (required, configured in admin)

**Frontend display:**
- Word displayed large and bold
- Part of speech in small italic (e.g., *noun*)
- Definition below
- Example sentence at bottom in muted text

## Daily Quote

**Data source:** ZenQuotes API — free, no API key.

**Backend:** `GET /api/daily-quote/today`
- Fetches from `https://zenquotes.io/api/today` (returns `[{"q": "...", "a": "..."}]`)
- Caches for 24 hours
- Returns `{ quote, author }`

**Frontend display:**
- Quote text in larger italic
- Author name right-aligned with em dash prefix (— Author Name)

## Trivia

**Data source:** Open Trivia DB — free, no API key.

**Backend:** `GET /api/trivia/question`
- Fetches from `https://opentdb.com/api.php?amount=1&difficulty=easy&type=multiple`
- Caches for 24 hours (one question per day)
- Returns `{ question, choices, correctIndex, category }`
- HTML entities in the API response are decoded server-side

**Frontend display:**
- Category label (small, uppercase)
- Question text
- Four answer buttons (A/B/C/D) in a 2x2 grid
- Tap the card to reveal: correct answer highlights green, others dim
- Tap again to reset (hide answer)
- New question each day

## Files

### New files — Word of the Day

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/word_of_the_day/mod.rs` | Module registration, router |
| `backend/src/integrations/word_of_the_day/routes.rs` | GET handler, Wordnik fetch, cache |
| `frontend/src/integrations/word-of-the-day/config.ts` | Integration definition with api_key field |
| `frontend/src/integrations/word-of-the-day/useWordOfTheDay.ts` | Data hook |
| `frontend/src/integrations/word-of-the-day/WordOfTheDayWidget.tsx` | Widget component |
| `frontend/src/integrations/word-of-the-day/useWidgetMeta.ts` | Always visible, priority 0 |

### New files — Daily Quote

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/daily_quote/mod.rs` | Module registration, router |
| `backend/src/integrations/daily_quote/routes.rs` | GET handler, ZenQuotes fetch, cache |
| `frontend/src/integrations/daily-quote/config.ts` | Integration definition |
| `frontend/src/integrations/daily-quote/useDailyQuote.ts` | Data hook |
| `frontend/src/integrations/daily-quote/DailyQuoteWidget.tsx` | Widget component |
| `frontend/src/integrations/daily-quote/useWidgetMeta.ts` | Always visible, priority 0 |

### New files — Trivia

| File | Responsibility |
|------|---------------|
| `backend/src/integrations/trivia/mod.rs` | Module registration, router |
| `backend/src/integrations/trivia/routes.rs` | GET handler, Open Trivia DB fetch, cache |
| `frontend/src/integrations/trivia/config.ts` | Integration definition |
| `frontend/src/integrations/trivia/useTrivia.ts` | Data hook |
| `frontend/src/integrations/trivia/TriviaWidget.tsx` | Widget component |
| `frontend/src/integrations/trivia/useWidgetMeta.ts` | Always visible, priority 0 |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/mod.rs` | Register all three new modules and routes |
| `frontend/src/integrations/registry.ts` | Register all three new integrations |
| `frontend/src/boards/HomeBoard.tsx` | Add all three widgets + meta hooks to Widgets component |
