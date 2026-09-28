import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostseasonSeries } from './PostseasonSeries'
import type { PostseasonView, SeriesRow } from '@/integrations/sports'

const row = (over: Partial<SeriesRow>): SeriesRow => ({
  a: 'LAD',
  aWins: 0,
  b: 'PHI',
  bWins: 0,
  detail: 'G1',
  live: false,
  done: false,
  mine: false,
  nextStartsAt: null,
  singleGame: false,
  ...over,
})

const oneRound = (...series: SeriesRow[]): PostseasonView => ({
  current: [{ round: 'NLDS', bestOf: 5, series }],
  completed: [],
  upcoming: [],
})

const bold = (container: HTMLElement) =>
  [...container.querySelectorAll('b')].map((b) => b.textContent)

const view: PostseasonView = {
  current: [
    {
      round: 'NLDS',
      bestOf: 5,
      series: [
        {
          a: 'LAD',
          aWins: 1,
          b: 'PHI',
          bWins: 0,
          detail: 'G2',
          live: false,
          done: false,
          mine: true,
          nextStartsAt: '2026-10-05T01:08Z',
          singleGame: false,
        },
        {
          a: 'SD',
          aWins: 1,
          b: 'MIL',
          bWins: 1,
          detail: 'Top 4th',
          live: true,
          done: false,
          mine: false,
          nextStartsAt: null,
          singleGame: false,
        },
      ],
    },
  ],
  completed: [{ round: 'NLWC', summary: 'PHI def ATL 2–1 · SD def CHC 2–0' }],
  upcoming: [{ round: 'NLCS', bestOf: 7, startsAt: '2026-10-12T00:00Z' }],
}

describe('PostseasonSeries', () => {
  it('lists the current round with best-of, live marker and next game', () => {
    render(<PostseasonSeries view={view} maxSeries={8} />)
    expect(screen.getByText('NLDS · best of 5')).toBeInTheDocument()
    expect(screen.getByText(/LAD 1/)).toBeInTheDocument()
    expect(screen.getByText(/Top 4th/)).toBeInTheDocument()
    expect(screen.getByText(/G2/)).toBeInTheDocument()
  })
  it('folds finished rounds and lists what is still to come', () => {
    render(<PostseasonSeries view={view} maxSeries={8} />)
    expect(screen.getByText(/PHI def ATL 2–1/)).toBeInTheDocument()
    expect(screen.getByText(/NLCS · best of 7/)).toBeInTheDocument()
  })
  it('bolds only the side that leads the series', () => {
    const { container } = render(
      <PostseasonSeries
        view={oneRound(
          row({ a: 'LAD', aWins: 2, b: 'PHI', bWins: 1 }),
          row({ a: 'SD', aWins: 0, b: 'MIL', bWins: 1 }),
        )}
        maxSeries={8}
      />,
    )
    expect(bold(container)).toEqual(['LAD 2', 'MIL 1'])
  })
  it('bolds neither side of a tied or unopened series', () => {
    const { container } = render(
      <PostseasonSeries
        view={oneRound(row({ a: 'SD', aWins: 1, b: 'MIL', bWins: 1 }), row({ a: 'CHC', b: 'SD' }))}
        maxSeries={8}
      />,
    )
    expect(bold(container)).toEqual([])
    expect(screen.getByText(/SD 1 · MIL 1/)).toBeInTheDocument()
  })
  it('reads a single game as its matchup before kickoff and its score after', () => {
    const { container } = render(
      <PostseasonSeries
        view={oneRound(
          row({ a: 'SF', b: 'SEA', singleGame: true, detail: 'Next' }),
          row({ a: 'LAR', aWins: 34, b: 'CAR', bWins: 31, singleGame: true, done: true }),
        )}
        maxSeries={8}
      />,
    )
    expect(screen.getByText('SF at SEA')).toBeInTheDocument()
    expect(bold(container)).toEqual(['LAR 34'])
  })
  it('caps series rows with +N more', () => {
    render(<PostseasonSeries view={view} maxSeries={1} />)
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  it('clamps a finished round summary to two lines', () => {
    // A four-series round's summary is free text that can wrap; clamping it
    // keeps the postseason block's height bounded for the caps.
    render(<PostseasonSeries view={view} maxSeries={8} />)
    const done = screen.getByText(/PHI def ATL/)
    expect(done.style.webkitLineClamp).toBe('2')
    expect(done.style.overflow).toBe('hidden')
  })
})
