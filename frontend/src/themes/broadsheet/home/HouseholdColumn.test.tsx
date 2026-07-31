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
    // This state — lunch, chores past both the per-person and per-column
    // visible caps, coming up at its cap, and a long on-this-day blurb —
    // has never been rendered against real data at once. Not a layout
    // assertion (jsdom can't measure overflow); this exists so the fullest
    // realistic combination is at least known not to crash, and the
    // "+more" caps are honoured together rather than only individually.
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Chicken tenders', withItems: ['Mashed potatoes'] }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({
      data: {
        completed_count: 2,
        total_count: 10,
        persons: [
          {
            // 6 assignments — past MAX_TASKS_PER_PERSON (2), so this
            // person's own group shows a "+4 more" line.
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: Array.from({ length: 6 }, (_, i) => ({
              id: i,
              chore: { id: i, name: `Chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: i < 2,
            })),
          },
          {
            // 3 assignments — also past the per-person cap, so this group
            // gets its own "+1 more" line too.
            person: { id: 2, name: 'Mia', color: '#000', avatar: null },
            assignments: Array.from({ length: 3 }, (_, i) => ({
              id: 20 + i,
              chore: { id: 20 + i, name: `Mia chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: false,
            })),
          },
          {
            // 3rd, 4th, 5th people — past MAX_VISIBLE_PEOPLE (2), so all
            // three groups are hidden behind a column-level "+3 more" line.
            person: { id: 3, name: 'Zoe', color: '#000', avatar: null },
            assignments: [
              { id: 30, chore: { id: 30, name: 'Set the table', chore_type: 'regular', tags: [] }, picked_chore: null, completed: false },
            ],
          },
          {
            person: { id: 4, name: 'Sam', color: '#000', avatar: null },
            assignments: [
              { id: 40, chore: { id: 40, name: 'Take out trash', chore_type: 'regular', tags: [] }, picked_chore: null, completed: false },
            ],
          },
          {
            person: { id: 5, name: 'Ana', color: '#000', avatar: null },
            assignments: [
              { id: 50, chore: { id: 50, name: 'Water plants', chore_type: 'regular', tags: [] }, picked_chore: null, completed: false },
            ],
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
    // Section header sums across every person, uncapped.
    expect(screen.getByText('2/10')).toBeInTheDocument()
    // Ben's own heading count is also uncapped...
    expect(screen.getByText('2/6')).toBeInTheDocument()
    // ...but only 2 of his 6 tasks render, with the rest folded into a
    // per-person "+more" line.
    expect(screen.getByText('+4 more')).toBeInTheDocument()
    expect(screen.queryByText('Chore 2')).not.toBeInTheDocument()
    expect(screen.getByText('Chore 1')).toBeInTheDocument()
    // Mia is also past the per-person cap — same treatment, her own
    // "+more" line with a different count.
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    expect(screen.getByText('Mia chore 0')).toBeInTheDocument()
    expect(screen.queryByText('Mia chore 2')).not.toBeInTheDocument()
    // Zoe, Sam, and Ana are the 3rd–5th people, past MAX_VISIBLE_PEOPLE —
    // none of their groups render at all, folded into a column-level
    // "+3 more" line instead.
    expect(screen.queryByText('Zoe')).not.toBeInTheDocument()
    expect(screen.queryByText('Sam')).not.toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText('+3 more')).toBeInTheDocument()
  })

  it('groups chores under a person heading rather than a flat list with per-row assignees', () => {
    useChores.mockReturnValue({
      data: {
        completed_count: 1,
        total_count: 2,
        persons: [
          {
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: [
              { id: 1, chore: { id: 1, name: 'Feed the cat', chore_type: 'regular', tags: [] }, picked_chore: null, completed: true },
              { id: 2, chore: { id: 2, name: 'Walk the dog', chore_type: 'regular', tags: [] }, picked_chore: null, completed: false },
            ],
          },
        ],
      },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    // The person's name appears once, as the group heading, and their own
    // done/total sits beside it — matching the section header's overall
    // count here since there's only one person.
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.getAllByText('1/2')).toHaveLength(2)
    expect(screen.getByText('Feed the cat')).toBeInTheDocument()
    expect(screen.getByText('Walk the dog')).toBeInTheDocument()
  })

  it('honours picked_chore over the base chore name for meta-chores', () => {
    useChores.mockReturnValue({
      data: {
        completed_count: 0,
        total_count: 1,
        persons: [
          {
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: [
              {
                id: 1,
                chore: { id: 1, name: 'Pick a chore', chore_type: 'meta', tags: [] },
                picked_chore: { id: 2, name: 'Vacuum living room', chore_type: 'regular', tags: [] },
                completed: false,
              },
            ],
          },
        ],
      },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    expect(screen.getByText('Vacuum living room')).toBeInTheDocument()
    expect(screen.queryByText('Pick a chore')).not.toBeInTheDocument()
  })
})
