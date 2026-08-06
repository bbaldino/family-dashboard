import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ActionErrorNotice } from './ActionErrorNotice'

const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useMusic }))

const dismissError = vi.fn()

describe('ActionErrorNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissError.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when no action has failed', () => {
    useMusic.mockReturnValue({ actionError: null, dismissError })
    const { container } = render(<ActionErrorNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the action that failed', () => {
    useMusic.mockReturnValue({
      actionError: { message: 'Couldn’t play “Go”', at: 1 },
      dismissError,
    })
    render(<ActionErrorNotice />)
    expect(screen.getByText(/Couldn’t play “Go”\./)).toBeInTheDocument()
    expect(screen.getByText('STOP PRESS')).toBeInTheDocument()
  })

  it('clears itself so a stale failure does not sit on the wall all evening', () => {
    useMusic.mockReturnValue({ actionError: { message: "Couldn't pause", at: 1 }, dismissError })
    render(<ActionErrorNotice />)
    expect(dismissError).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(dismissError).toHaveBeenCalled()
  })

  it('dismisses on tap without waiting out the timer', () => {
    useMusic.mockReturnValue({ actionError: { message: "Couldn't pause", at: 1 }, dismissError })
    render(<ActionErrorNotice />)
    fireEvent.click(screen.getByText('STOP PRESS'))
    expect(dismissError).toHaveBeenCalled()
  })

  it('leaves the footer uncovered', () => {
    // The footer carries the nav and the now-playing line; reporting a failure
    // by covering the way out of the screen would trade one problem for another.
    useMusic.mockReturnValue({ actionError: { message: "Couldn't stop", at: 1 }, dismissError })
    const { container } = render(<ActionErrorNotice />)
    expect((container.firstElementChild as HTMLElement).style.bottom).toBe('64px')
  })
})
