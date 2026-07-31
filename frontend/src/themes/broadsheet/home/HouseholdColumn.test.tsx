import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HouseholdColumn } from './HouseholdColumn'

const useCountdowns = vi.hoisted(() => vi.fn())
const useOnThisDay = vi.hoisted(() => vi.fn())
const useChores = vi.hoisted(() => vi.fn())
const useLunchMenu = vi.hoisted(() => vi.fn())
vi.mock('@/data/countdowns', () => ({ useCountdowns }))
vi.mock('@/data/on-this-day', () => ({ useOnThisDay }))
vi.mock('@/data/chores', () => ({ useChores }))
vi.mock('@/data/nutrislice', () => ({ useLunchMenu }))

describe('HouseholdColumn', () => {
  beforeEach(() => {
    // useCountdowns: UsePollingResult<CountdownItem[]> — data is the array
    // directly (or null), not { items: [...] }.
    useCountdowns.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    // useOnThisDay: plain react-query result; data is OnThisDayData | undefined.
    useOnThisDay.mockReturnValue({ data: undefined, isLoading: false })
    // useChores: data is TodayResponse | null (persons/completed_count/total_count).
    useChores.mockReturnValue({ data: null, isLoading: false })
    // useLunchMenu: UsePollingResult<LunchMenuData>; data.today is a LunchMenuDay | null.
    useLunchMenu.mockReturnValue({ data: null, isLoading: false })
  })

  it('renders with every source empty', () => {
    expect(() => render(<HouseholdColumn />)).not.toThrow()
  })

  it('renders nothing when every source is empty, rather than an empty shell', () => {
    const { container } = render(<HouseholdColumn />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a countdown when there is one', () => {
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<HouseholdColumn />)
    expect(screen.getByText(/Hawaii/)).toBeInTheDocument()
  })

  it('stacks sections lunch, chores, coming up, on this day in that order', () => {
    // Kicker text changed to match the design mock (`broadsheet-v2.jsx:229`)
    // — "Cafeteria · today" rather than the old bare "Lunch" — so this
    // asserts on the new label, not just the old regex.
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza', withItems: [] }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({ data: { completed_count: 1, total_count: 3, persons: [] }, isLoading: false })
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useOnThisDay.mockReturnValue({
      data: { events: [{ year: 1980, text: 'Pac-Man begins location testing.' }] },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    const labels = screen
      .getAllByText(/^(Cafeteria · today|Chores today|Coming up|On this day)$/)
      .map((el) => el.textContent)
    expect(labels).toEqual(['Cafeteria · today', 'Chores today', 'Coming up', 'On this day'])
  })

  it('does not render a now-playing section — that moved to the footer', () => {
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza' }], extras: [] } },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    expect(screen.queryByText(/now playing/i)).toBeNull()
  })

  it('gives the on-this-day blurb the column\'s full width instead of squeezing it beside the year', () => {
    // Regression, found live: the mock puts the blurb inline beside the
    // 22px year, which read fine for the mock's one-line sample text but
    // wrapped to 4-5 cramped lines for the real feed's full-sentence
    // blurbs. Label and year now share one line; the blurb is a sibling
    // block beneath, not a flex child squeezed into what's left of that
    // row — this asserts the structural split, since jsdom can't measure
    // the wrap itself.
    useOnThisDay.mockReturnValue({
      data: { events: [{ year: 2012, text: 'Michael Phelps breaks the record.' }] },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    const year = screen.getByText('2012')
    const blurb = screen.getByText('Michael Phelps breaks the record.')
    // The year sits in the label row; the blurb is a sibling of that row,
    // not a flex child squeezed inside it alongside the year.
    expect(year.parentElement).not.toBe(blurb.parentElement)
    expect(blurb.parentElement).toBe(year.parentElement?.parentElement)
  })

  // The real feed has no length guarantee on this field (entries run 80–165
  // characters), and it's the column's bottom-pinned section — an unbounded
  // blurb could push its own top edge past what's visible. So it is always
  // clamped; how tightly depends on whether the sections above it are
  // occupying the column. jsdom can't measure the overflow, so these assert
  // the clamp that bounds it. See `blurbLineClamp`.
  const longEvent = {
    data: {
      events: [
        {
          year: 1969,
          text: 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon, an achievement watched live by an estimated 650 million people around the world.',
        },
      ],
    },
    isLoading: false,
  }

  it('clamps the on-this-day blurb tightly when lunch and chores fill the column', () => {
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza', withItems: [] }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({ data: { completed_count: 1, total_count: 3, persons: [] }, isLoading: false })
    useOnThisDay.mockReturnValue(longEvent)

    render(<HouseholdColumn />)
    expect(screen.getByText(/Apollo 11/).className).toContain('line-clamp-2')
  })

  it('lets the blurb run longer when the column is sparse', () => {
    // Summer: no school lunch, no chores assigned. The column has room, so
    // truncating to two lines would cut the text with empty space beneath.
    useOnThisDay.mockReturnValue(longEvent)

    render(<HouseholdColumn />)
    expect(screen.getByText(/Apollo 11/).className).toContain('line-clamp-4')
  })

  it('keeps the tight clamp on a no-school day that still has chores', () => {
    // `lunch.today` null is a confirmed no-school day — the heading renders
    // but no item list, so the column is not crowded by lunch alone.
    useLunchMenu.mockReturnValue({ data: { today: null }, isLoading: false })
    useChores.mockReturnValue({ data: { completed_count: 0, total_count: 2, persons: [] }, isLoading: false })
    useOnThisDay.mockReturnValue(longEvent)

    render(<HouseholdColumn />)
    expect(screen.getByText(/Apollo 11/).className).toContain('line-clamp-4')
  })

  it('renders every section fully populated without throwing (the column at its fullest)', () => {
    // This state — lunch, chores past the visible cap, coming up at its
    // cap, and a long on-this-day blurb — has never been rendered against
    // real data at once. Not a layout assertion (jsdom can't measure
    // overflow); this exists so the fullest realistic combination is at
    // least known not to crash, and the "+more" caps are honoured
    // together rather than only individually.
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Chicken tenders', withItems: ['Mashed potatoes'] }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({
      data: {
        completed_count: 2,
        total_count: 7,
        persons: [
          {
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: Array.from({ length: 4 }, (_, i) => ({
              id: i,
              chore: { id: i, name: `Chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: i === 0,
            })),
          },
          {
            person: { id: 2, name: 'Mia', color: '#000', avatar: null },
            assignments: Array.from({ length: 3 }, (_, i) => ({
              id: 10 + i,
              chore: { id: 10 + i, name: `Other chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: false,
            })),
          },
        ],
      },
      isLoading: false,
    })
    useCountdowns.mockReturnValue({
      data: [
        { id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 },
        { id: '2', name: 'Back to school', date: new Date('2026-08-25'), daysUntil: 26 },
        { id: '3', name: 'Concert', date: new Date('2026-11-01'), daysUntil: 94 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useOnThisDay.mockReturnValue({
      data: {
        events: [
          {
            year: 1969,
            text: 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin become the first humans to walk on the Moon, an achievement watched live by an estimated 650 million people around the world.',
          },
        ],
      },
      isLoading: false,
    })
    expect(() => render(<HouseholdColumn />)).not.toThrow()
    expect(screen.getByText('2/7')).toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })
})
