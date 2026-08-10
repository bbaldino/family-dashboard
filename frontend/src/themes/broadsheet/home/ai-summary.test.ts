import { describe, expect, it } from 'vitest'
import { aiSummaryText } from './ai-summary'

const labels = { pending: 'Generating recap…', unavailable: 'Recap unavailable.' }

describe('aiSummaryText', () => {
  it('returns the summary once it has arrived', () => {
    expect(
      aiSummaryText(
        { data: { summary: 'Rodriguez was dialed in.' }, isLoading: false, error: null },
        labels,
      ),
    ).toBe('Rodriguez was dialed in.')
  })

  it('says it is being written while the query is in flight', () => {
    expect(aiSummaryText({ data: undefined, isLoading: true, error: null }, labels)).toBe(
      'Generating recap…',
    )
  })

  it('says so on failure rather than returning nothing', () => {
    expect(
      aiSummaryText({ data: undefined, isLoading: false, error: new Error('502') }, labels),
    ).toBe('Recap unavailable.')
  })

  // The distinction the whole helper exists for. A settled query with an empty
  // summary is finished and has nothing — calling that "pending" would leave
  // "Generating…" on a kitchen wall indefinitely.
  it('treats a settled empty summary as unavailable, not as still pending', () => {
    expect(aiSummaryText({ data: { summary: '' }, isLoading: false, error: null }, labels)).toBe(
      'Recap unavailable.',
    )
  })

  it('prefers the pending label while loading, even if an old error is still set', () => {
    expect(
      aiSummaryText({ data: undefined, isLoading: true, error: new Error('stale') }, labels),
    ).toBe('Generating recap…')
  })

  it('uses whichever labels it is given', () => {
    const preview = { pending: 'Generating preview…', unavailable: 'Preview unavailable.' }
    expect(aiSummaryText({ data: undefined, isLoading: true, error: null }, preview)).toBe(
      'Generating preview…',
    )
    expect(aiSummaryText({ data: undefined, isLoading: false, error: null }, preview)).toBe(
      'Preview unavailable.',
    )
  })
})
