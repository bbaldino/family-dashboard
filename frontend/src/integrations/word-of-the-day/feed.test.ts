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
 * `pubDate` is stamped US Eastern (`-0400`); this suite runs with `TZ`
 * pinned to `America/Los_Angeles` (see `vitest.config.ts`), three hours
 * behind. A 01:00:01 Eastern post is therefore still the *previous*
 * calendar day in Pacific local time — e.g. `mitigate`'s "Mon, 03 Aug
 * 2026 01:00:01 -0400" is 2026-08-02 22:00 Pacific, so it's "today" for a
 * `now` of 2026-08-02 Pacific, not 08-03. The dates below are chosen with
 * that shift already applied, which is exactly the local-date bucketing
 * the parser is supposed to do — the point of pinning `TZ` at all.
 */

describe('parseWordOfTheDay', () => {
  it('parses all four fields from a captured feed, for the item matching the given date', () => {
    // torpor's Eastern pubDate (Aug 6, 01:00:01 -0400) is Pacific-local
    // Aug 5 — an exact local-date match, not the newest-item fallback.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-05T12:00:00'))

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
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-05T12:00:00'))
    expect(data.pronunciation).toBe('TOR-per')
  })

  it('picks the item whose feed date matches the given local date', () => {
    // mitigate's Eastern pubDate (Aug 3) is Pacific-local Aug 2.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-02T08:00:00'))
    expect(data.word).toBe('mitigate')
  })

  it('falls back to the newest item when nothing matches the given date', () => {
    // 2026-08-20 is after every item in the fixture — nothing matches, so
    // the newest (torpor) is used rather than erroring.
    const data = parseWordOfTheDay(feedXml, new Date('2026-08-20T12:00:00'))
    expect(data.word).toBe('torpor')
  })

  it('takes the first "// " example when an item has more than one', () => {
    // inveigle's Eastern pubDate (Jul 29) is Pacific-local Jul 28, the one
    // item in the fixture with two example paragraphs back to back.
    const data = parseWordOfTheDay(feedXml, new Date('2026-07-28T08:00:00'))
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
