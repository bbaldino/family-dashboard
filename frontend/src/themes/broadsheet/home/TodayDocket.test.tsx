import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { CalendarEvent } from '@/providers/google-calendar'
import { TodayDocket } from './TodayDocket'

const at = (summary: string, startHour: number, endHour: number): CalendarEvent => ({
  id: summary,
  summary,
  start: { dateTime: `2026-10-31T${String(startHour).padStart(2, '0')}:00:00-07:00` },
  end: { dateTime: `2026-10-31T${String(endHour).padStart(2, '0')}:00:00-07:00` },
})

const parade = at('Parade', 9, 10)
const bakeSale = at('Bake sale', 10, 11)
const carving = at('Pumpkin carving', 16, 17)
const trickOrTreat = at('Trick-or-treat', 17, 19)

const NOW = new Date('2026-10-31T16:20:00-07:00')

/** jsdom has no layout, so give the NOW rule a position to scroll to and the
 *  list a height to scroll through. */
const RULE_OFFSET = 300

let scrollTo: ReturnType<typeof vi.fn>

const docket = () => screen.getByTestId('today-docket')

/** A finger drag: touch the list, then move it to `top`. */
const dragTo = (top: number) => {
  fireEvent.pointerDown(docket())
  docket().scrollTop = top
  fireEvent.scroll(docket())
}

describe('TodayDocket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    scrollTo = vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(function (
      this: Element,
      ...args: unknown[]
    ) {
      this.scrollTop = (args[0] as ScrollToOptions).top ?? 0
      this.dispatchEvent(new Event('scroll'))
    }) as unknown as ReturnType<typeof vi.fn>
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === 'now-rule' ? RULE_OFFSET : 0
    })
    // Room to scroll past the rule, so scrolling to it is never clamped.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderDocket = (earlier: CalendarEvent[], ahead: CalendarEvent[]) =>
    render(<TodayDocket earlier={earlier} ahead={ahead} now={NOW} driveInfo={{}} />)

  it('lists every event today, the finished ones above a NOW rule', () => {
    renderDocket([parade, bakeSale], [carving, trickOrTreat])

    const rows = screen.getAllByTestId('today-event').map((row) => row.textContent)
    expect(rows).toEqual([
      expect.stringContaining('Parade'),
      expect.stringContaining('Bake sale'),
      expect.stringContaining('Pumpkin carving'),
      expect.stringContaining('Trick-or-treat'),
    ])
    expect(screen.getByTestId('now-rule')).toHaveTextContent('NOW · 4:20 PM')
    expect(screen.getByText('Parade').closest('[data-testid="today-event"]')).toHaveAttribute(
      'data-past',
    )
    expect(
      screen.getByText('Trick-or-treat').closest('[data-testid="today-event"]'),
    ).not.toHaveAttribute('data-past')
  })

  it('tags an event already under way as on now, and only that one', () => {
    renderDocket([parade], [carving, trickOrTreat])

    const tags = screen.getAllByText('On now')
    expect(tags).toHaveLength(1)
    expect(tags[0].closest('[data-testid="today-event"]')).toHaveTextContent('Pumpkin carving')
  })

  it('opens scrolled to now, with the last finished row peeking above', () => {
    renderDocket([parade, bakeSale], [carving, trickOrTreat])

    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: RULE_OFFSET - 50 }))
    expect(screen.queryByRole('button', { name: /back to now/i })).not.toBeInTheDocument()
  })

  it('has no NOW rule and stays at the top before anything has finished', () => {
    renderDocket([], [carving, trickOrTreat])

    expect(screen.queryByTestId('now-rule')).not.toBeInTheDocument()
    expect(docket().scrollTop).toBe(0)
  })

  it('offers a way back to now once the list is scrolled away', () => {
    renderDocket([parade, bakeSale], [carving, trickOrTreat])
    dragTo(0)

    const back = screen.getByRole('button', { name: /back to now/i })
    fireEvent.click(back)

    expect(docket().scrollTop).toBe(RULE_OFFSET - 50)
    expect(screen.queryByRole('button', { name: /back to now/i })).not.toBeInTheDocument()
  })

  it('snaps back to now after a minute without a touch', () => {
    renderDocket([parade, bakeSale], [carving, trickOrTreat])
    dragTo(0)

    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(docket().scrollTop).toBe(0)

    // Touching again restarts the minute.
    dragTo(10)
    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(docket().scrollTop).toBe(10)

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(docket().scrollTop).toBe(RULE_OFFSET - 50)
  })

  it('follows the clock when an event ends, unless someone is reading the list', () => {
    const { rerender } = renderDocket([parade], [bakeSale, carving])
    dragTo(0)

    // Bake sale ends while someone is scrolled up: leave them where they are.
    rerender(
      <TodayDocket earlier={[parade, bakeSale]} ahead={[carving]} now={NOW} driveInfo={{}} />,
    )
    expect(docket().scrollTop).toBe(0)

    // Untouched for a minute, it catches up.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(docket().scrollTop).toBe(RULE_OFFSET - 50)

    // And with nobody touching it, the next ending scrolls straight away.
    scrollTo.mockClear()
    rerender(
      <TodayDocket earlier={[parade, bakeSale, carving]} ahead={[]} now={NOW} driveInfo={{}} />,
    )
    expect(scrollTo).toHaveBeenCalled()
  })

  it('returns to now when the rows change height, unless someone is reading', () => {
    let resized = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    renderDocket([parade, bakeSale], [carving, trickOrTreat])

    // Someone scrolled up, then the fonts arrived: leave them be.
    dragTo(0)
    act(() => resized())
    expect(docket().scrollTop).toBe(0)

    // A minute later, a drive time loads in: back to now.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    docket().scrollTop = 0
    act(() => resized())
    expect(docket().scrollTop).toBe(RULE_OFFSET - 50)
    vi.unstubAllGlobals()
  })

  it('says the rest of the day is clear once everything has finished', () => {
    renderDocket([parade, bakeSale], [])

    expect(screen.getByText('— the rest of the day is clear —')).toBeInTheDocument()
  })
})
