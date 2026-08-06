import { describe, expect, it } from 'vitest'
import feedXml from './fixtures/wotd-feed.xml?raw'
import { parseWordOfTheDay } from './feed'

/**
 * `fixtures/wotd-feed.xml` is a real response captured from
 * `https://www.merriam-webster.com/wotd/feed/rss2` with the same
 * `User-Agent` header the hook sends. Ten items, newest first:
 * torpor (2026-08-06) down to kludge (2026-07-28). `inveigle`
 * (2026-07-29) is the one item with two "// " example paragraphs in a
 * row, which is why it's used below to pin the "first one wins" rule.
 *
 * MW stamps `pubDate` at 01:00 US Eastern (`-0400` here) on the word's own
 * nominal date, so each item's date is exactly the one in its `<link>` slug
 * — `torpor` is the word *for* 2026-08-06. The parser recovers that by
 * reading `pubDate` back in `America/New_York`, then matches it against the
 * viewer's own local date, so MW's word for date D is on screen on date D
 * locally and flips at local midnight.
 *
 * This suite runs with `TZ` pinned to `America/Los_Angeles` (see
 * `vite.config.ts`), three hours behind Eastern. That gap is what the
 * 23:30 boundary case below exists to pin: reading `pubDate` in Pacific
 * instead would bucket every item a day early, which is the bug this
 * replaced. Every `now` below is therefore a Pacific wall-clock time, and
 * every expected word is MW's word for that Pacific calendar date.
 */

describe('parseWordOfTheDay', () => {
  it('parses all four fields from a captured feed, for the item matching the given date', () => {
    // torpor is MW's word for Aug 6 — an exact date match, not the
    // newest-item fallback.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-06T12:00:00'))

    expect(data.word).toBe('torpor')
    expect(data.partOfSpeech).toBe('noun')
    expect(data.definition).toBe(
      'Torpor is a formal word for a state of inactivity and sluggishness. It can also be used, especially in the context of hibernating and estivating animals, to refer to a state of lowered physiological activity.',
    )
    expect(data.example).toBe(
      'The magazine offers lots of ideas for activities designed to shake off the torpor of a rainy day.',
    )
  })

  it('carries the pronunciation as an optional extra field', () => {
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-06T12:00:00'))
    expect(data.pronunciation).toBe('TOR-per')
  })

  it("picks the item MW published for the viewer's local date", () => {
    expect(parseWordOfTheDay(feedXml, new Date('2026-08-02T08:00:00')).word).toBe('highfalutin')
    expect(parseWordOfTheDay(feedXml, new Date('2026-08-03T08:00:00')).word).toBe('mitigate')
  })

  it("does not jump to tomorrow's word late on the previous evening", () => {
    // 23:30 Pacific on Aug 5 is already 02:30 Eastern on Aug 6, so torpor
    // (MW's word for Aug 6) has published and is the newest item — and it
    // is present in this static fixture regardless of the `now` passed,
    // which is what makes the assertion meaningful. It is still Aug 5 for
    // the viewer, so colloquial is the right answer; the word must flip at
    // local midnight, not at 21:00 when the next item appears.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-05T23:30:00'))
    expect(data.word).toBe('colloquial')
  })

  it('falls back to the newest item when nothing matches the given date', () => {
    // 2026-08-20 is after every item in the fixture — nothing matches, so
    // the newest (torpor) is used rather than erroring.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-20T12:00:00'))
    expect(data.word).toBe('torpor')
  })

  it('takes the first "// " example when an item has more than one', () => {
    // inveigle is MW's word for Jul 29, the one item in the fixture with
    // two example paragraphs back to back.
    const data = parseWordOfTheDay(feedXml, new Date('2026-07-29T08:00:00'))
    expect(data.word).toBe('inveigle')
    expect(data.example).toBe(
      'According to rumors, the company inveigled employees into signing the agreement.',
    )
  })

  it('throws rather than returning a blank word when the feed has no items', () => {
    const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Empty</title></channel></rss>`
    expect(() => parseWordOfTheDay(emptyFeed, new Date('2026-08-06T12:00:00'))).toThrow()
  })

  it('throws on XML that does not parse at all', () => {
    expect(() => parseWordOfTheDay('<rss><channel><item>', new Date())).toThrow()
  })
})
