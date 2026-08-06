/**
 * Parses Merriam-Webster's Word of the Day RSS feed
 * (`https://www.merriam-webster.com/wotd/feed/rss2`) into `WordOfTheDayData`.
 *
 * Replaces `backend/src/integrations/word_of_the_day/routes.rs`, which
 * scraped `merriam-webster.com/word-of-the-day` — an HTML page now behind
 * Cloudflare bot scoring (measured 2/5 successes from a dev machine; prod
 * returned 500 consistently). The RSS feed is meant for machine consumption
 * and isn't challenged (5/5 successes with the same User-Agent header). See
 * `docs/superpowers/specs/2026-08-05-client-vs-service-integrations.md` §6
 * for the `expect: "text"` gap this migration needed closed first.
 *
 * A captured feed lives at `fixtures/wotd-feed.xml`, asserted against
 * directly in `feed.test.ts` — the structure below was reverse-engineered
 * from reading it, not guessed.
 */

export interface WordOfTheDayData {
  word: string
  partOfSpeech: string | null
  definition: string
  example: string | null
  /**
   * `\TOR-per\`-style pronunciation guide, when the feed's header line
   * parses cleanly. An optional extra — `WordOfTheDayWidget` does not
   * depend on it.
   */
  pronunciation: string | null
}

interface FeedItem {
  word: string
  pubDate: Date
  descriptionHtml: string
}

function parseFeedXml(xml: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Word of the Day feed did not parse as XML')
  }

  return Array.from(doc.getElementsByTagName('item')).map((item) => {
    const word = item.getElementsByTagName('title')[0]?.textContent?.trim() ?? ''
    const pubDateRaw = item.getElementsByTagName('pubDate')[0]?.textContent?.trim() ?? ''
    const descriptionHtml = item.getElementsByTagName('description')[0]?.textContent ?? ''
    return { word, pubDate: new Date(pubDateRaw), descriptionHtml }
  })
}

/** The viewer's own calendar date, `YYYY-MM-DD`. */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * `en-CA` formats as `YYYY-MM-DD` directly, so no part-reassembly is needed.
 * The named zone (rather than a fixed `-0400`/`-0500` offset) is what makes
 * this survive a DST transition.
 */
const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * The date an item is Merriam-Webster's word *for*. MW stamps `pubDate` at
 * 01:00 US Eastern on the word's own nominal date, so converting the instant
 * back to Eastern recovers that date — e.g. `torpor`, the word for August 6,
 * carries `Thu, 06 Aug 2026 01:00:01 -0400` and yields `2026-08-06`. Reading
 * the instant in the *viewer's* zone instead would put every item a day early
 * anywhere west of Eastern.
 */
function nominalDateKey(d: Date): string {
  return easternDate.format(d)
}

/**
 * The item whose nominal date is the viewer's own calendar date, falling back
 * to the newest item when today's has not published yet — MW posts at 01:00
 * Eastern, which is after local midnight for viewers west of Eastern, so
 * there is a morning window with no match. Matching a nominal date against a
 * local date is deliberate: MW's word for calendar date D should be on
 * screen on date D locally, and the word flips at local midnight.
 *
 * The fallback picks the max by `pubDate` rather than trusting the feed's
 * stated newest-first order, so a re-ordered feed can't make this return a
 * stale item silently.
 */
function pickTodaysItem(items: FeedItem[], now: Date): FeedItem {
  const todayKey = localDateKey(now)
  const todays = items.find((item) => nominalDateKey(item.pubDate) === todayKey)
  if (todays) return todays
  return items.reduce((newest, item) => (item.pubDate > newest.pubDate ? item : newest))
}

interface ParsedDescription {
  partOfSpeech: string | null
  definition: string
  example: string | null
  pronunciation: string | null
}

/**
 * Each item's `<description>` is fixed-structure HTML (confirmed against
 * all ten items in `fixtures/wotd-feed.xml`): a paragraph with the word, a
 * `\pronunciation\`, and the part of speech; then a definition paragraph;
 * then one or more `// example sentence` paragraphs; then a "See the entry
 * >" link; then unrelated "Examples:"/"Did you know?" sections we don't
 * want.
 *
 * The markup nests a `<p>` inside a `<p>` — invalid HTML, but standard
 * HTML5 parsing implicitly closes the outer one the moment it sees the
 * inner start tag, so this always flattens into one run of sibling `<p>`
 * elements once parsed. That's relied on below, not worked around with a
 * regex over the raw markup.
 */
function parseDescription(html: string): ParsedDescription {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const paragraphs = Array.from(doc.getElementsByTagName('p'))

  // Found structurally — the paragraph carrying a `\..\` pronunciation —
  // rather than by a fixed index, so a shifted or missing intro line
  // doesn't break this.
  const headerIndex = paragraphs.findIndex((p) => /\\[^\\]+\\/.test(p.textContent ?? ''))
  if (headerIndex === -1 || !paragraphs[headerIndex + 1]) {
    throw new Error('Word of the Day description did not match the expected feed structure')
  }

  const header = paragraphs[headerIndex]
  const pronunciationMatch = (header.textContent ?? '').match(/\\([^\\]+)\\/)
  const pronunciation = pronunciationMatch ? pronunciationMatch[1].trim() : null
  const partOfSpeech = header.querySelector('em')?.textContent?.trim() ?? null

  const definition = paragraphs[headerIndex + 1].textContent?.trim() ?? ''

  // Defensive, not fixture-driven: in all ten captured items the first
  // "// ..." example sits at exactly `headerIndex + 2`, so this scan and the
  // `<a>` break below are both currently unexercised — replacing either with
  // a fixed offset keeps every test green. They're kept because the feed is
  // hand-curated upstream and a shifted or absent example is a plausible
  // one-off; scanning degrades to a null example where a fixed offset would
  // silently return the wrong paragraph. Stopping at the "See the entry >"
  // link matters for that degraded case: everything past it is unrelated
  // prose ("Examples:", "Did you know?"), not the curated example.
  let example: string | null = null
  for (let i = headerIndex + 2; i < paragraphs.length; i++) {
    const text = paragraphs[i].textContent?.trim() ?? ''
    if (text.startsWith('//')) {
      example = text.replace(/^\/\/\s*/, '')
      break
    }
    if (paragraphs[i].querySelector('a')) break
  }

  return { partOfSpeech, definition, example, pronunciation }
}

/** Parses the raw feed XML into today's word. `now` is injectable for tests. */
export function parseWordOfTheDay(xml: string, now: Date = new Date()): WordOfTheDayData {
  const items = parseFeedXml(xml)
  if (items.length === 0) {
    throw new Error('Word of the Day feed contained no items')
  }
  const item = pickTodaysItem(items, now)
  const parsed = parseDescription(item.descriptionHtml)
  return { word: item.word, ...parsed }
}
