import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HouseholdColumn } from './HouseholdColumn'

const useCountdowns = vi.hoisted(() => vi.fn())
const useChores = vi.hoisted(() => vi.fn())
const useLunchMenu = vi.hoisted(() => vi.fn())
const useNow = vi.hoisted(() => vi.fn())
const completeAssignment = vi.hoisted(() => vi.fn())
const uncompleteAssignment = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/countdowns', () => ({ useCountdowns }))
vi.mock('@/integrations/chores', () => ({ useChores }))
vi.mock('@/integrations/nutrislice', () => ({ useLunchMenu }))
vi.mock('@/themes/broadsheet/home/useNow', () => ({ useNow }))

describe('HouseholdColumn', () => {
  beforeEach(() => {
    // completeAssignment/uncompleteAssignment are shared spies reused across
    // every mockReturnValue call in this file (see useChores.test.tsx for the
    // same pattern) — clear their call history so one test's toggle doesn't
    // leak into the next.
    vi.clearAllMocks()
    // A morning by default, so the lunch panel reads "today" (it flips to
    // tomorrow's menu from noon on — see lunch-preview.ts).
    useNow.mockReturnValue(new Date(2026, 7, 17, 9, 0))
    // useCountdowns: PollResult<CountdownItem[]> — data is the array
    // directly (or null), not { items: [...] }.
    useCountdowns.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    // useChores: data is TodayResponse | null (persons/completed_count/total_count).
    useChores.mockReturnValue({
      data: null,
      isLoading: false,
      completeAssignment,
      uncompleteAssignment,
    })
    // useLunchMenu: PollResult<LunchMenuData>; data.today is a LunchMenuDay | null.
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

  it('stacks sections lunch, chores, coming up in that order', () => {
    // Kicker text changed to match the design mock (`broadsheet-v2.jsx:229`)
    // — "Cafeteria · today" rather than the old bare "Lunch" — so this
    // asserts on the new label, not just the old regex.
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza', withItems: [] }], extras: [] } },
      isLoading: false,
    })
    useChores.mockReturnValue({
      data: { completed_count: 1, total_count: 3, persons: [] },
      isLoading: false,
    })
    useCountdowns.mockReturnValue({
      data: [{ id: '1', name: 'Hawaii', date: new Date('2026-08-17'), daysUntil: 18 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<HouseholdColumn />)
    // `On this day` stays in the alternation deliberately. It is not dead: it
    // is what makes this a regression guard rather than a tautology — if that
    // section ever came back to this column, the `toEqual` below would catch
    // it. Drop the alternative and a returning section would slip past
    // unnoticed.
    const labels = screen
      .getAllByText(/^(Cafeteria · today|Chores today|Coming up|On this day)$/)
      .map((el) => el.textContent)
    expect(labels).toEqual(['Cafeteria · today', 'Chores today', 'Coming up'])
  })

  it('previews tomorrow’s menu, labelled so, from noon on', () => {
    // The point of the tweak: once today's lunch is behind us, look ahead.
    useNow.mockReturnValue(new Date(2026, 7, 17, 14, 0))
    useLunchMenu.mockReturnValue({
      data: {
        today: { entries: [{ name: 'Pizza', withItems: [] }], extras: [] },
        tomorrow: { entries: [{ name: 'Tacos', withItems: [] }], extras: [] },
      },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    expect(screen.getByText('Cafeteria · tomorrow')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.queryByText('Pizza')).not.toBeInTheDocument()
  })

  it('does not render a now-playing section — that moved to the footer', () => {
    useLunchMenu.mockReturnValue({
      data: { today: { entries: [{ name: 'Pizza' }], extras: [] } },
      isLoading: false,
    })
    render(<HouseholdColumn />)
    expect(screen.queryByText(/now playing/i)).toBeNull()
  })

  it('renders every section fully populated without throwing (the column at its fullest)', () => {
    // This state — lunch, chores past both the per-person and per-column
    // visible caps, and coming up at its cap — has never been rendered
    // against real data at once. Not a layout
    // assertion (jsdom can't measure overflow); this exists so the fullest
    // realistic combination is at least known not to crash, and the
    // "+more" caps are honoured together rather than only individually.
    useLunchMenu.mockReturnValue({
      data: {
        today: {
          entries: [{ name: 'Chicken tenders', withItems: ['Mashed potatoes'] }],
          extras: [],
        },
      },
      isLoading: false,
    })
    useChores.mockReturnValue({
      data: {
        completed_count: 2,
        total_count: 10,
        persons: [
          {
            // 8 assignments — past MAX_TASKS_PER_PERSON (6), so this
            // person's own group shows a "+2 more" line.
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: Array.from({ length: 8 }, (_, i) => ({
              id: i,
              chore: { id: i, name: `Chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: i < 2,
            })),
          },
          {
            // 3 assignments — inside the per-person cap of 6, so this group
            // shows every task and no "+more" line at all.
            person: { id: 2, name: 'Mia', color: '#000', avatar: null },
            assignments: Array.from({ length: 3 }, (_, i) => ({
              id: 20 + i,
              chore: { id: 20 + i, name: `Mia chore ${i}`, chore_type: 'regular', tags: [] },
              picked_chore: null,
              completed: false,
            })),
          },
          {
            // 3rd, 4th, 5th people — the cap is 4, so Zoe and Sam are shown
            // and only Ana falls behind the column-level "+1 more" line.
            person: { id: 3, name: 'Zoe', color: '#000', avatar: null },
            assignments: [
              {
                id: 30,
                chore: { id: 30, name: 'Set the table', chore_type: 'regular', tags: [] },
                picked_chore: null,
                completed: false,
              },
            ],
          },
          {
            person: { id: 4, name: 'Sam', color: '#000', avatar: null },
            assignments: [
              {
                id: 40,
                chore: { id: 40, name: 'Take out trash', chore_type: 'regular', tags: [] },
                picked_chore: null,
                completed: false,
              },
            ],
          },
          {
            person: { id: 5, name: 'Ana', color: '#000', avatar: null },
            assignments: [
              {
                id: 50,
                chore: { id: 50, name: 'Water plants', chore_type: 'regular', tags: [] },
                picked_chore: null,
                completed: false,
              },
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
    expect(() => render(<HouseholdColumn />)).not.toThrow()
    // Section header sums across every person, uncapped.
    expect(screen.getByText('2/10')).toBeInTheDocument()
    // Ben's own heading count is also uncapped...
    expect(screen.getByText('2/8')).toBeInTheDocument()
    // ...but only 2 of his 6 tasks render, with the rest folded into a
    // per-person "+more" line that names whose tasks are hidden — the
    // column-level people overflow below uses different wording, so the two
    // can't be mistaken for each other.
    expect(screen.getByText('+2 more for Ben')).toBeInTheDocument()
    expect(screen.queryByText('Chore 6')).not.toBeInTheDocument()
    expect(screen.getByText('Chore 5')).toBeInTheDocument()
    // Mia is also past the per-person cap — same treatment, her own
    // "+more" line with a different count.
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.queryByText(/more for Mia/)).not.toBeInTheDocument()
    expect(screen.getByText('Mia chore 0')).toBeInTheDocument()
    expect(screen.getByText('Mia chore 2')).toBeInTheDocument()
    // Zoe, Sam, and Ana are the 3rd–5th people, past MAX_VISIBLE_PEOPLE —
    // none of their groups render at all, folded into a column-level
    // "+3 more" line instead.
    expect(screen.getByText('Zoe')).toBeInTheDocument()
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText('+1 person not shown')).toBeInTheDocument()
  })

  it('distinguishes hidden tasks from hidden people', () => {
    // Both overflows can render at once, and the people line sits directly
    // beneath the last person's task list — so identical wording reads as
    // "more of that person's tasks". One names the person, the other says
    // what it is counting.
    //
    // Sized against the caps (4 people, 6 tasks each): Ben carries seven tasks
    // and there are five people, so each overflow is exactly one over and both
    // lines render together.
    useChores.mockReturnValue({
      data: {
        completed_count: 0,
        total_count: 11,
        persons: [
          {
            person: { id: 1, name: 'Ben', color: '#000', avatar: null },
            assignments: [0, 1, 2, 3, 4, 5, 6].map((i) => ({
              id: i,
              completed: false,
              chore: { name: `Ben chore ${i}` },
              picked_chore: null,
            })),
          },
          ...['Joey', 'Sam', 'Zoe', 'Ana'].map((name, n) => ({
            person: { id: 2 + n, name, color: '#000', avatar: null },
            assignments: [
              {
                id: 10 + n,
                completed: false,
                chore: { name: `${name} chore` },
                picked_chore: null,
              },
            ],
          })),
        ],
      },
      isLoading: false,
    })

    render(<HouseholdColumn />)
    expect(screen.getByText('+1 more for Ben')).toBeInTheDocument()
    expect(screen.getByText('+1 person not shown')).toBeInTheDocument()
    // The bare wording that made the two indistinguishable is gone.
    expect(screen.queryByText('+1 more')).not.toBeInTheDocument()
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
              {
                id: 1,
                chore: { id: 1, name: 'Feed the cat', chore_type: 'regular', tags: [] },
                picked_chore: null,
                completed: true,
              },
              {
                id: 2,
                chore: { id: 2, name: 'Walk the dog', chore_type: 'regular', tags: [] },
                picked_chore: null,
                completed: false,
              },
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
                picked_chore: {
                  id: 2,
                  name: 'Vacuum living room',
                  chore_type: 'regular',
                  tags: [],
                },
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

  describe('chore toggling', () => {
    function withChores() {
      useChores.mockReturnValue({
        data: {
          completed_count: 1,
          total_count: 2,
          persons: [
            {
              person: { id: 1, name: 'Ben', color: '#000', avatar: null },
              assignments: [
                {
                  id: 10,
                  chore: { id: 100, name: 'Dishes', chore_type: 'regular', tags: [] },
                  picked_chore: null,
                  completed: false,
                },
                {
                  id: 11,
                  chore: { id: 101, name: 'Trash', chore_type: 'regular', tags: [] },
                  picked_chore: null,
                  completed: true,
                },
              ],
            },
          ],
        },
        isLoading: false,
        completeAssignment,
        uncompleteAssignment,
      })
    }

    it('renders each chore as a button carrying its completed state', () => {
      withChores()
      render(<HouseholdColumn />)
      expect(screen.getByRole('button', { name: /Dishes/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(screen.getByRole('button', { name: /Trash/ })).toHaveAttribute('aria-pressed', 'true')
    })

    it('unchecks a completed chore', () => {
      withChores()
      render(<HouseholdColumn />)
      fireEvent.click(screen.getByRole('button', { name: /Trash/ }))
      expect(uncompleteAssignment).toHaveBeenCalledWith(11)
      expect(completeAssignment).not.toHaveBeenCalled()
    })

    it('checks an incomplete chore', () => {
      withChores()
      render(<HouseholdColumn />)
      fireEvent.click(screen.getByRole('button', { name: /Dishes/ }))
      expect(completeAssignment).toHaveBeenCalledWith(10)
      expect(uncompleteAssignment).not.toHaveBeenCalled()
    })
  })
})
