import { describe, expect, it } from 'vitest'
import {
  buildPrompt,
  cleanEventText,
  mergeFeeds,
  parsePicks,
  preFilter,
  toEvent,
  type WikiEvent,
} from './curate'

/**
 * These are a verbatim port of the curation logic that lived in
 * `backend/src/integrations/on_this_day/routes.rs`. Most of the assertions
 * below exist because the *literal* translation of that Rust into JavaScript
 * is silently wrong in four places, each of which is called out where it is
 * pinned:
 *
 *   1. `str::replace` is global; `String.replace(string, …)` is not.
 *   2. The `"war "` keyword's trailing space is load-bearing.
 *   3. `parse::<usize>()` rejects `"5abc"`; `parseInt` happily returns 5.
 *   4. `mergeFeeds` dedupes against `selected` only — an asymmetry that looks
 *      like a bug and is deliberately preserved.
 */

/** Terse event builder — most tests only care about `text`. */
function ev(text: string, year: number | null = 2000): WikiEvent {
  return { text, year }
}

describe('cleanEventText', () => {
  it('removes every occurrence, not just the first', () => {
    // HAZARD 1. Rust's `str::replace` replaces all matches. JavaScript's
    // `String.replace` with a *string* pattern replaces only the first, so a
    // literal port drops the second "(pictured)" on the floor.
    //
    // The second occurrence sits at the *end of the string* on purpose. With
    // it mid-sentence, the leftover " (pictured) " is followed by a space and
    // the next replacement in the chain — "(pictured) " — quietly mops it up,
    // so a non-global `replace` still produces the right answer and this test
    // pins nothing. Measured: "Alpha (pictured) meets Beta (pictured) at noon"
    // survives the mutation intact. At end-of-string there is no trailing
    // space, nothing rescues the leftover, and the mutation is caught.
    expect(cleanEventText('Alpha (pictured) meets Beta (pictured)')).toBe('Alpha meets Beta')
  })

  it('strips all eight picture references the Rust stripped', () => {
    expect(cleanEventText('A (pictured) thing')).toBe('A thing')
    expect(cleanEventText('(pictured) A thing')).toBe('A thing')
    expect(cleanEventText('A (Pictured) thing')).toBe('A thing')
    expect(cleanEventText('(Pictured) A thing')).toBe('A thing')
    expect(cleanEventText('A (replica pictured) thing')).toBe('A thing')
    expect(cleanEventText('(replica pictured) A thing')).toBe('A thing')
    expect(cleanEventText('A (shown) thing')).toBe('A thing')
    expect(cleanEventText('(shown) A thing')).toBe('A thing')
  })

  it('leaves text with no picture reference untouched', () => {
    expect(cleanEventText('Nothing to strip here')).toBe('Nothing to strip here')
  })
})

describe('preFilter', () => {
  it('drops "war " but keeps "warehouse"', () => {
    // HAZARD 2. The keyword is `"war "` with a trailing space, so it matches
    // the standalone word but not "warehouse" or "warm". Both events go
    // through a single call so the two outcomes can't drift apart.
    const kept = preFilter([ev('A warehouse opened in Leeds'), ev('The war ended in Europe')])

    expect(kept.map((e) => e.text)).toEqual(['A warehouse opened in Leeds'])
  })

  it('matches keywords case-insensitively', () => {
    expect(preFilter([ev('The Massacre at Glencoe')])).toEqual([])
  })

  it('keeps events that match no keyword', () => {
    const pool = [ev('Apollo 11 landed on the Moon'), ev('The first radio broadcast aired')]
    expect(preFilter(pool)).toEqual(pool)
  })

  it('matches a keyword anywhere in the text, not just at the start', () => {
    expect(preFilter([ev('A quiet day that ended in a scandal')])).toEqual([])
  })
})

describe('mergeFeeds', () => {
  it('drops a general event duplicating a selected one', () => {
    const merged = mergeFeeds([ev('Same text')], [ev('Same text'), ev('Different text')])
    expect(merged.map((e) => e.text)).toEqual(['Same text', 'Different text'])
  })

  it('keeps two identical general events', () => {
    // HAZARD 4. The Rust builds its seen-set once, from `selected`, *before*
    // the loop — so duplicates within the general feed both survive. This
    // looks like a bug; it is the behaviour being migrated, not fixed.
    const merged = mergeFeeds([], [ev('Twice over'), ev('Twice over')])
    expect(merged.map((e) => e.text)).toEqual(['Twice over', 'Twice over'])
  })

  it('puts selected events first', () => {
    const merged = mergeFeeds([ev('S1'), ev('S2')], [ev('G1')])
    expect(merged.map((e) => e.text)).toEqual(['S1', 'S2', 'G1'])
  })
})

describe('toEvent', () => {
  it('carries the year, the cleaned text and the first page thumbnail', () => {
    const event = toEvent({
      text: 'Something (pictured) happened',
      year: 1969,
      pages: [{ thumbnail: { source: 'https://example.test/a.jpg' } }],
    })

    expect(event).toEqual({
      year: 1969,
      text: 'Something happened',
      imageUrl: 'https://example.test/a.jpg',
    })
  })

  it('yields imageUrl null at any missing link in the chain', () => {
    expect(toEvent({ text: 'x', year: 1 }).imageUrl).toBeNull()
    expect(toEvent({ text: 'x', year: 1, pages: null }).imageUrl).toBeNull()
    expect(toEvent({ text: 'x', year: 1, pages: [] }).imageUrl).toBeNull()
    expect(toEvent({ text: 'x', year: 1, pages: [{}] }).imageUrl).toBeNull()
    expect(toEvent({ text: 'x', year: 1, pages: [{ thumbnail: {} }] }).imageUrl).toBeNull()
  })

  it('preserves a null year', () => {
    expect(toEvent({ text: 'x', year: null }).year).toBeNull()
  })
})

describe('buildPrompt', () => {
  it('numbers events from 1 as "{n}. [{year}] {text}"', () => {
    const prompt = buildPrompt([ev('First thing', 1901), ev('Second thing', 1902)])
    expect(prompt).toContain('1. [1901] First thing')
    expect(prompt).toContain('2. [1902] Second thing')
  })

  it('renders a year-less event with empty brackets', () => {
    const prompt = buildPrompt([ev('A'), ev('B'), ev('Undated thing', null)])
    expect(prompt).toContain('3. [] Undated thing')
  })

  it('carries the content-safety preamble verbatim', () => {
    // The preamble is the filter standing between Wikipedia and a wall the
    // kids look at. Pinned literally so a reword can't slip through.
    expect(buildPrompt([ev('A')])).toBe(
      'You are curating content for a family kitchen dashboard seen by young children. ' +
        'From the following historical events that happened on this day, pick the 5 most interesting and fun ones. ' +
        'Strongly prefer: pop culture, science, technology, space, sports, music, entertainment, inventions, and achievements. ' +
        'Strictly avoid: violence, war, crime, disasters, death, controversial politics, immigration, protests, and anything divisive or upsetting. ' +
        "Only pick events that would make someone smile or say 'that's cool!' " +
        'Respond with ONLY the numbers of your picks, separated by commas. Nothing else.\n\n' +
        '1. [2000] A',
    )
  })
})

describe('parsePicks', () => {
  const pool = [ev('One'), ev('Two'), ev('Three'), ev('Four'), ev('Five')]

  it('resolves 1-based comma-separated indices', () => {
    expect(parsePicks('1, 3, 5', pool).map((e) => e.text)).toEqual(['One', 'Three', 'Five'])
  })

  it('finds the numbers when the model wraps them in prose', () => {
    // Why the split includes space and period as well as comma: a chatty
    // model answers in a sentence rather than the bare list it was asked for.
    expect(parsePicks('Sure! I picked 2 and 4.', pool).map((e) => e.text)).toEqual(['Two', 'Four'])
  })

  it('rejects a token that merely starts with digits', () => {
    // HAZARD 3. `parseInt('5abc')` is 5; Rust's `parse::<usize>()` is an
    // error. Without a strict `/^\d+$/` test this returns event 5.
    expect(parsePicks('5abc', pool)).toEqual([])
  })

  it('rejects negative and empty tokens', () => {
    expect(parsePicks('-1', pool)).toEqual([])
    expect(parsePicks('', pool)).toEqual([])
    expect(parsePicks('   ', pool)).toEqual([])
  })

  it('skips index 0 — indices are 1-based', () => {
    // Rust's `checked_sub(1)` underflows to None rather than wrapping.
    expect(parsePicks('0', pool)).toEqual([])
  })

  it('skips an index past the end of the list', () => {
    expect(parsePicks('99', pool)).toEqual([])
    expect(parsePicks('2, 99', pool).map((e) => e.text)).toEqual(['Two'])
  })

  it('maps each pick through toEvent', () => {
    const withImage: WikiEvent[] = [
      { text: 'Moon (pictured) landing', year: 1969, pages: [{ thumbnail: { source: 'm.jpg' } }] },
    ]
    expect(parsePicks('1', withImage)).toEqual([
      { year: 1969, text: 'Moon landing', imageUrl: 'm.jpg' },
    ])
  })

  it('keeps a repeated pick repeated', () => {
    // The Rust does not deduplicate the model's answer either.
    expect(parsePicks('1, 1', pool).map((e) => e.text)).toEqual(['One', 'One'])
  })
})
