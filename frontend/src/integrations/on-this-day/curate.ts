/**
 * Turns Wikipedia's two "on this day" feeds into the handful of events the
 * kitchen dashboard shows: merge, dedupe, keyword-filter, ask an LLM to pick
 * the best five, resolve its answer back to events.
 *
 * A verbatim port of `backend/src/integrations/on_this_day/routes.rs`. Every
 * function here is pure — the fetching and the LLM call live in the hook — so
 * the parts of that Rust that do *not* translate literally into JavaScript
 * can be pinned in isolation. There are four of them:
 *
 *   1. `cleanEventText` — `str::replace` is global, `String.replace` with a
 *      string pattern is not (`replaceAll` below).
 *   2. `preFilter` — the `"war "` keyword's trailing space.
 *   3. `parsePicks` — `parse::<usize>()` rejects what `parseInt` accepts.
 *   4. `mergeFeeds` — dedupes against `selected` only.
 *
 * Behaviour is preserved exactly, including the dedupe asymmetry in (4),
 * which looks like a bug. Fixing it is not this module's job.
 */

export interface WikiThumbnail {
  source?: string | null
}

export interface WikiPage {
  thumbnail?: WikiThumbnail | null
}

/** One entry from either Wikipedia feed. */
export interface WikiEvent {
  text: string
  year: number | null
  pages?: WikiPage[] | null
}

/** What the widget renders. */
export interface OnThisDayEvent {
  year: number | null
  text: string
  imageUrl: string | null
}

/**
 * Merges the `selected` and `events` feeds into one pool, skipping general
 * events whose text already appeared in `selected` — the two feeds overlap.
 *
 * The seen-set is built once, from `selected`, and is *not* extended as the
 * general feed is walked, so two identical general events both survive. That
 * mirrors the Rust exactly; it is preserved deliberately rather than tidied
 * up in passing.
 */
export function mergeFeeds(selected: WikiEvent[], events: WikiEvent[]): WikiEvent[] {
  const merged = [...selected]
  const seenTexts = new Set(selected.map((e) => e.text))
  for (const event of events) {
    if (!seenTexts.has(event.text)) {
      merged.push(event)
    }
  }
  return merged
}

/**
 * Copied verbatim from the Rust. Note `'war '` with a trailing space: it
 * drops "the war ended" while leaving "warehouse" and "warm" alone. Several
 * other entries are deliberate prefixes in the same spirit — `'capsiz'`
 * covers capsize/capsized, `'assassin'` covers assassinate/assassination.
 */
const BAD_KEYWORDS = [
  'kill',
  'killed',
  'kills',
  'murder',
  'murdered',
  'massacre',
  'shooting',
  'shot dead',
  'assassin',
  'death',
  'dead',
  'died',
  'dies',
  'fatal',
  'bomb',
  'bombed',
  'bombing',
  'attack',
  'attacked',
  'terrorist',
  'war ',
  'warfare',
  'battle of',
  'invasion',
  'invaded',
  'earthquake',
  'tsunami',
  'hurricane',
  'flood',
  'famine',
  'crash',
  'crashed',
  'derail',
  'sank',
  'sinking',
  'capsiz',
  'riot',
  'riots',
  'protest',
  'coup',
  'rebellion',
  'revolt',
  'genocide',
  'ethnic cleansing',
  'concentration camp',
  'collapse',
  'collapsed',
  'explosion',
  'exploded',
  'suicide',
  'execution',
  'executed',
  'hanged',
  'kidnap',
  'hostage',
  'hijack',
  'immigration',
  'deportation',
  'controversial',
  'scandal',
] as const

/**
 * Drops obviously unsuitable events before the LLM ever sees them, so the
 * model has less chance to pick something bad out of a long list. An event
 * goes if its lowercased text contains any keyword.
 */
export function preFilter(events: WikiEvent[]): WikiEvent[] {
  return events.filter((event) => {
    const lower = event.text.toLowerCase()
    return !BAD_KEYWORDS.some((keyword) => lower.includes(keyword))
  })
}

/**
 * Strips Wikipedia's "(pictured)" annotations, which refer to an image the
 * dashboard is not showing.
 *
 * `replaceAll`, not `replace`: the Rust `str::replace` these came from
 * replaces every occurrence, and one event text can carry two of them.
 */
export function cleanEventText(text: string): string {
  return text
    .replaceAll(' (pictured)', '')
    .replaceAll('(pictured) ', '')
    .replaceAll(' (Pictured)', '')
    .replaceAll('(Pictured) ', '')
    .replaceAll(' (replica pictured)', '')
    .replaceAll('(replica pictured) ', '')
    .replaceAll(' (shown)', '')
    .replaceAll('(shown) ', '')
}

/** The first page's thumbnail, or null at any missing link in the chain. */
function eventImageUrl(event: WikiEvent): string | null {
  return event.pages?.[0]?.thumbnail?.source ?? null
}

/** Reshapes a feed entry into what the widget renders. */
export function toEvent(event: WikiEvent): OnThisDayEvent {
  return {
    year: event.year,
    text: cleanEventText(event.text),
    imageUrl: eventImageUrl(event),
  }
}

/**
 * Builds the curation prompt: a preamble, then the pool numbered from 1.
 *
 * The preamble is a content-safety filter for a display young children look
 * at, and is copied verbatim from `routes.rs` — rewording it changes what
 * reaches the wall. A missing year renders as an empty string, so the line
 * reads `3. [] Something happened`; that too is the Rust's behaviour
 * (`Option::map(…).unwrap_or_default()`).
 */
export function buildPrompt(events: WikiEvent[]): string {
  const eventList = events
    .map((event, i) => `${i + 1}. [${event.year ?? ''}] ${event.text}`)
    .join('\n')

  return (
    'You are curating content for a family kitchen dashboard seen by young children. ' +
    'From the following historical events that happened on this day, pick the 5 most interesting and fun ones. ' +
    'Strongly prefer: pop culture, science, technology, space, sports, music, entertainment, inventions, and achievements. ' +
    'Strictly avoid: violence, war, crime, disasters, death, controversial politics, immigration, protests, and anything divisive or upsetting. ' +
    "Only pick events that would make someone smile or say 'that's cool!' " +
    'Respond with ONLY the numbers of your picks, separated by commas. Nothing else.\n\n' +
    eventList
  )
}

/**
 * Resolves the model's answer back into events.
 *
 * The prompt asks for bare comma-separated numbers, but splitting on space
 * and period too (exactly the three characters the Rust's `split([',', ' ',
 * '.'])` used — not all whitespace) means a chatty model answering "Sure! I
 * picked 2 and 4." still parses.
 *
 * The `/^\d+$/` test is what makes that tolerance safe: `parseInt('5abc')`
 * returns 5, so parsing leniently would turn a stray word into a pick. Rust's
 * `parse::<usize>()` rejects it, and so does this.
 *
 * Indices are 1-based; 0 and anything past the end are skipped (the Rust's
 * `checked_sub(1)` underflowed to `None`). Repeats are not collapsed.
 */
export function parsePicks(answer: string, events: WikiEvent[]): OnThisDayEvent[] {
  const picked: OnThisDayEvent[] = []
  for (const token of answer.split(/[, .]/)) {
    const trimmed = token.trim()
    if (!/^\d+$/.test(trimmed)) continue
    const event = events[Number(trimmed) - 1]
    if (event) picked.push(toEvent(event))
  }
  return picked
}
