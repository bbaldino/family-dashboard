import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SportsColumn } from './SportsColumn'
import type { GamesResponse, GameState } from '@/integrations/sports'

const useSportsPreview = vi.hoisted(() => vi.fn())
const useSportsFinalRecap = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', async () => {
  // `scoreboardIsDown`/`formatUnavailableLeagues` are pure and have no
  // transport behind them, so the real ones come through rather than being
  // stubbed into agreeing with whatever the test expects. `formatFinalDate`
  // is pure for the same reason — and `FinalReport` calls it, so leaving it
  // out of this factory breaks every test in the file the moment the strip
  // renders, not just the ones that assert on a date.
  const degraded = await vi.importActual<typeof import('@/integrations/sports/degraded')>(
    '@/integrations/sports/degraded',
  )
  const formatTime = await vi.importActual<typeof import('@/integrations/sports/formatTime')>(
    '@/integrations/sports/formatTime',
  )
  return {
    useSportsPreview,
    useSportsFinalRecap,
    formatUpcomingTime: (s: string) => s,
    formatFinalDate: formatTime.formatFinalDate,
    ...degraded,
  }
})

const team = (abbreviation: string, score: number | null) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  logo: '',
  record: '31-19',
  score,
  winner: null,
  color: '005A9C',
  altColor: 'ffffff',
  hits: 7,
  errors: 0,
})

// Real GameState values are 'live' | 'final' | 'upcoming' | 'postponed' — the
// task brief's mock used 'pre'/'in', which don't exist on the wire. Corrected
// here (see src/integrations/sports/types.ts).
const game = (state: GameState, extra: Record<string, unknown> = {}) => ({
  id: 'g1',
  league: 'MLB',
  state,
  name: 'LAD @ MIL',
  startTime: '2026-05-22T16:40:00-07:00',
  venue: null,
  broadcast: 'MLB.TV',
  playoffRound: null,
  home: team('MIL', state === 'upcoming' ? null : 3),
  away: team('LAD', state === 'upcoming' ? null : 4),
  clock: null,
  period: 7,
  periodLabel: 'BOT 7',
  leaders: [],
  allLeaders: [],
  situation: null,
  lastPlay: null,
  headline: null,
  linescores: [],
  athletes: [],
  espnUrl: null,
  liveDetail: null,
  ...extra,
})

/**
 * jsdom lays nothing out — every height reads 0 — so the fit is driven by
 * stubbed heights, keyed on the attributes `SportsColumn` measures by: the
 * column's own `data-testid`, each summary's `data-summary-id`, and the
 * strip's slot. Anything unlisted reads 0, as jsdom would.
 */
function stubLayout({
  column,
  blocks,
  strip = 40,
}: {
  column: number
  blocks: Record<string, number>
  strip?: number
}) {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.testid === 'sports-column' ? column : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    const id = this.dataset.summaryId
    if (id !== undefined) return blocks[id] ?? 0
    return this.dataset.stripSlot !== undefined ? strip : 0
  })
}

const summary = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-summary-id="${id}"]`) as HTMLElement

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SportsColumn', () => {
  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('shows the off-day block when there is no game', () => {
    const data: GamesResponse = { games: [], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/no game|off day|dark/i)).toBeInTheDocument()
  })

  it('shows the pregame block for a scheduled game', () => {
    const data: GamesResponse = {
      games: [game('upcoming')],
      hasLive: false,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    // The fixture's team() helper sets `name === abbreviation`, so "LAD"
    // legitimately appears more than once (the team cap and the full-name
    // label render separately) — real ESPN data never collides like this.
    expect(screen.getAllByText('LAD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MIL').length).toBeGreaterThan(0)
  })

  it('shows the score for a live game', () => {
    const data: GamesResponse = { games: [game('live')], hasLive: true, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders a live game with no situation or liveDetail', () => {
    const data: GamesResponse = {
      games: [game('live', { situation: null, liveDetail: null })],
      hasLive: true,
      unavailableLeagues: [],
    }
    expect(() => render(<SportsColumn data={data} isLoading={false} />)).not.toThrow()
  })

  it('renders while sports data is loading', () => {
    expect(() => render(<SportsColumn data={undefined} isLoading={true} />)).not.toThrow()
  })
})

describe('the prior-game final report', () => {
  const finished = game('final', { id: 'yesterday', startTime: '2026-08-09T20:10:00Z' })

  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('appears beneath a scheduled game', () => {
    const data: GamesResponse = {
      games: [game('upcoming'), finished],
      hasLive: false,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/Final ·/)).toBeInTheDocument()
    // …and the pregame block still leads.
    expect(screen.getAllByText('MIL').length).toBeGreaterThan(0)
  })

  // A live game leads, and the full report follows it when there is room —
  // when there isn't, its score carries on as a line in the "Also today"
  // strip instead. No timer, no clock arithmetic.
  it('follows a live game when it fits beneath it', () => {
    stubLayout({ column: 800, blocks: { g1: 500, yesterday: 120 } })
    const data: GamesResponse = {
      games: [game('live'), finished],
      hasLive: true,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)
    expect(summary(container, 'yesterday')).toBeVisible()
    expect(screen.queryByTestId('also-today')).toBeNull()
  })

  it('drops to the strip beneath a live game that leaves no room for it', () => {
    stubLayout({ column: 800, blocks: { g1: 760, yesterday: 120 } })
    const data: GamesResponse = {
      games: [game('live'), finished],
      hasLive: true,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)
    expect(summary(container, 'yesterday')).not.toBeVisible()
    expect(screen.getByTestId('also-today')).toHaveTextContent('LAD 4 · MIL 3')
  })

  // Why the lead order gained a rung: with only a finished game, the column
  // used to report "No game today." with the contradicting evidence sitting
  // directly beneath it.
  it('leads the column when there is nothing live or upcoming', () => {
    const data: GamesResponse = { games: [finished], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/Final ·/)).toBeInTheDocument()
    expect(screen.queryByText(/no game today/i)).toBeNull()
  })

  it('still shows the off-day block when there is no game in either direction', () => {
    const data: GamesResponse = { games: [], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/no game|off day|dark/i)).toBeInTheDocument()
    expect(screen.queryByText(/Final ·/)).toBeNull()
  })
})

/** A live game used to take the column whole, so a second live game — or one
 *  that had just finished — vanished from Home entirely: a 49ers kickoff hid
 *  a Dodgers–Giants game still in progress, then hid its final score. */
describe('the "Also today" strip', () => {
  const featured = game('live', { id: 'featured' })
  const otherLive = game('live', {
    id: 'other-live',
    league: 'nfl',
    home: team('SF', 29),
    away: team('ARI', 20),
    periodLabel: '8:06 - 4th',
  })
  const finalGame = (id: string, away: string, home: string, startTime: string) =>
    game('final', {
      id,
      startTime,
      home: team(home, 1),
      away: team(away, 5),
      periodLabel: 'Final/10',
    })

  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
    // The lead fills the column, so every other game falls to the strip.
    stubLayout({
      column: 800,
      blocks: { featured: 790, 'other-live': 200, f1: 120, f2: 120 },
    })
  })

  it('lists another live game and a final beneath the live game, but not the live game itself', () => {
    const data: GamesResponse = {
      games: [featured, otherLive, finalGame('f1', 'NYY', 'BOS', '2026-05-22T12:05:00-07:00')],
      hasLive: true,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)

    const strip = screen.getByTestId('also-today')
    expect(strip).toHaveTextContent('Also today')
    expect(strip).toHaveTextContent('ARI 20 · SF 29 · 8:06 - 4th')
    expect(strip).toHaveTextContent('Final/10 · NYY 5 · BOS 1')
    // The featured game (LAD @ MIL) leads above; it isn't repeated here.
    expect(strip).not.toHaveTextContent('LAD')
  })

  it('caps at two games and names the rest', () => {
    const data: GamesResponse = {
      games: [
        featured,
        otherLive,
        finalGame('f1', 'NYY', 'BOS', '2026-05-22T12:05:00-07:00'),
        finalGame('f2', 'CHC', 'STL', '2026-05-22T10:05:00-07:00'),
      ],
      hasLive: true,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)

    const strip = screen.getByTestId('also-today')
    expect(strip).toHaveTextContent('ARI 20')
    expect(strip).toHaveTextContent('NYY 5')
    expect(strip).not.toHaveTextContent('CHC')
    expect(strip).toHaveTextContent('+1 more')
  })

  it('lists a game still to come that has no room, but never a postponed one', () => {
    stubLayout({ column: 400, blocks: { featured: 380, later: 300 } })
    const data: GamesResponse = {
      games: [
        featured,
        game('upcoming', {
          id: 'later',
          startTime: '2026-10-05T00:00:00Z',
          home: team('LAD', null),
          away: team('ATL', null),
        }),
        game('postponed', { id: 'pp' }),
      ],
      hasLive: true,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    const strip = screen.getByTestId('also-today')
    expect(strip).toHaveTextContent('ATL @ LAD')
    // formatUpcomingTime is mocked to pass its input through (see above).
    expect(strip).toHaveTextContent('2026-10-05T00:00:00Z')
    expect(strip).not.toHaveTextContent('+1 more')
  })

  it('is absent when nothing else is on', () => {
    const data: GamesResponse = { games: [featured], hasLive: true, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.queryByTestId('also-today')).toBeNull()
  })
})

/** The column used to show one summary however much room it had: with two
 *  finals and nothing else on, the 49ers' result led and the Dodgers–Giants
 *  final beside it was nowhere on Home. It now stacks as many whole
 *  summaries as measure to fit, and only the rest drop to the strip. */
describe('fitting summaries to the column', () => {
  const finalGame = (id: string, away: string, home: string, startTime: string) =>
    game('final', { id, startTime, home: team(home, 1), away: team(away, 5) })
  const nfl = finalGame('nfl', 'ARI', 'SF', '2026-09-27T20:05:00Z')
  const mlb = finalGame('mlb', 'LAD', 'SFG', '2026-09-27T19:05:00Z')
  const older = finalGame('older', 'NYY', 'BOS', '2026-09-27T17:05:00Z')

  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('stacks two finals when both fit, newest first, with no strip', () => {
    stubLayout({ column: 800, blocks: { nfl: 150, mlb: 150 } })
    const data: GamesResponse = { games: [mlb, nfl], hasLive: false, unavailableLeagues: [] }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)

    expect(summary(container, 'nfl')).toBeVisible()
    expect(summary(container, 'mlb')).toBeVisible()
    const shown = [...container.querySelectorAll('[data-summary-id]')].map(
      (el) => (el as HTMLElement).dataset.summaryId,
    )
    expect(shown).toEqual(['nfl', 'mlb'])
    expect(screen.queryByTestId('also-today')).toBeNull()
  })

  it('follows a pregame preview with as many finals as fit, and lists the rest', () => {
    stubLayout({ column: 600, blocks: { g1: 380, nfl: 150, mlb: 150 } })
    const data: GamesResponse = {
      games: [game('upcoming'), mlb, nfl],
      hasLive: false,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)

    expect(summary(container, 'g1')).toBeVisible()
    expect(summary(container, 'nfl')).toBeVisible()
    expect(summary(container, 'mlb')).not.toBeVisible()
    const strip = screen.getByTestId('also-today')
    expect(strip).toHaveTextContent('LAD 5 · SFG 1')
    expect(strip).not.toHaveTextContent('ARI')
  })

  /** Prod on 2026-10-04, with the preview height measured at 1920×1080
   *  (303px) in a 595px column: the 49ers preview leads, tonight's Dodgers
   *  game — which had no slot at all — follows as a strip line, and
   *  yesterday's Dodgers final is gone, superseded by tonight's game. */
  it("previews the next game, lists tonight's other game, and drops that team's old final", () => {
    stubLayout({ column: 595, blocks: { 'nfl-today': 303, 'mlb-tonight': 303 } })
    const data: GamesResponse = {
      games: [
        game('final', {
          id: 'mlb-yesterday',
          startTime: '2026-10-03T20:00:00Z',
          home: team('LAD', 5),
          away: team('ATL', 2),
        }),
        game('upcoming', {
          id: 'nfl-today',
          league: 'NFL',
          startTime: '2026-10-04T20:25:00Z',
          home: team('SF', null),
          away: team('DEN', null),
        }),
        game('upcoming', {
          id: 'mlb-tonight',
          startTime: '2026-10-05T00:00:00Z',
          home: team('LAD', null),
          away: team('ATL', null),
        }),
      ],
      hasLive: false,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)

    expect(summary(container, 'nfl-today')).toBeVisible()
    expect(summary(container, 'mlb-tonight')).not.toBeVisible()
    expect(summary(container, 'mlb-yesterday')).toBeNull()
    const strip = screen.getByTestId('also-today')
    expect(strip).toHaveTextContent('ATL @ LAD')
    expect(strip).not.toHaveTextContent('ATL 2')
  })

  it('spaces a preview that follows another summary, as a following live game is', () => {
    stubLayout({ column: 800, blocks: { first: 230, second: 322 } })
    const data: GamesResponse = {
      games: [
        game('upcoming', { id: 'first', startTime: '2026-10-04T20:25:00Z' }),
        game('upcoming', { id: 'second', startTime: '2026-10-05T00:00:00Z' }),
      ],
      hasLive: false,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)
    const gap = (id: string) =>
      (summary(container, id).firstElementChild as HTMLElement).style.paddingTop
    expect(gap('first')).toBe('')
    expect(gap('second')).toBe('24px')
  })

  it('stacks a second live game beneath the first, and lists the final that no longer fits', () => {
    const second = game('live', { id: 'second', home: team('SF', 29), away: team('ARI', 20) })
    stubLayout({ column: 900, blocks: { g1: 420, second: 400, older: 150 } })
    const data: GamesResponse = {
      games: [game('live'), second, older],
      hasLive: true,
      unavailableLeagues: [],
    }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)

    expect(summary(container, 'g1')).toBeVisible()
    expect(summary(container, 'second')).toBeVisible()
    expect(summary(container, 'older')).not.toBeVisible()
    expect(screen.getByTestId('also-today')).toHaveTextContent('NYY 5 · BOS 1')
  })

  // Hidden summaries stay mounted so they can be measured, but must be
  // invisible to assistive tech as well as to the eye.
  it('hides a summary that does not fit from assistive tech too', () => {
    stubLayout({ column: 300, blocks: { nfl: 280, mlb: 150 } })
    const data: GamesResponse = { games: [mlb, nfl], hasLive: false, unavailableLeagues: [] }
    const { container } = render(<SportsColumn data={data} isLoading={false} />)

    expect(summary(container, 'mlb')).toHaveAttribute('aria-hidden', 'true')
    expect(summary(container, 'nfl')).not.toHaveAttribute('aria-hidden')
  })
})
