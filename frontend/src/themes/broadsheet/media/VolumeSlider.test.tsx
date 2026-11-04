import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { HOLD_MS, VolumeSlider } from './VolumeSlider'

/** jsdom has no layout: the inline bar is 100px wide, so a clientX is a
 *  percentage, and the zoom panel's track is 800px — 8px per point. */
const ZOOM_TRACK_PX = 800

function mockRect(width: number) {
  return {
    left: 0,
    width,
    top: 0,
    right: width,
    bottom: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
  }
}

const bar = () => screen.getByLabelText('Volume')
const zoom = () => screen.queryByRole('dialog', { name: 'Fine volume' })

const hold = () =>
  act(() => {
    vi.advanceTimersByTime(HOLD_MS)
  })

describe('VolumeSlider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return mockRect(this.dataset.testid === 'volume-zoom-track' ? ZOOM_TRACK_PX : 100)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('exposes slider aria attributes carrying the current value', () => {
    render(<VolumeSlider volume={42} onChange={vi.fn()} />)
    expect(bar()).toHaveAttribute('role', 'slider')
    expect(bar()).toHaveAttribute('aria-valuemin', '0')
    expect(bar()).toHaveAttribute('aria-valuemax', '100')
    expect(bar()).toHaveAttribute('aria-valuenow', '42')
  })

  it('fills the rule in proportion to the volume, clamped to the rule', () => {
    const { rerender } = render(<VolumeSlider volume={35} onChange={vi.fn()} />)
    const fill = () => bar().querySelector('div[style*="position: absolute"]') as HTMLElement
    expect(fill().style.width).toBe('35%')
    rerender(<VolumeSlider volume={140} onChange={vi.fn()} />)
    expect(fill().style.width).toBe('100%')
    rerender(<VolumeSlider volume={-10} onChange={vi.fn()} />)
    expect(fill().style.width).toBe('0%')
  })

  it('gives the bar a real hit target well beyond the hairline rule it wraps', () => {
    render(<VolumeSlider volume={0} onChange={vi.fn()} />)
    expect(bar().style.height).toBe('40px')
  })

  describe('a quick tap or swipe on the bar', () => {
    it('sets the level where a tap lands', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={0} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 30 })
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.pointerUp(bar(), { clientX: 30 })
      expect(onChange).toHaveBeenCalledWith(30)
      expect(zoom()).not.toBeInTheDocument()
    })

    it('follows a finger swiped along the bar straight away', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={0} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 10 })
      fireEvent.pointerMove(bar(), { clientX: 60, buttons: 1 })
      expect(onChange).toHaveBeenLastCalledWith(60)
      // A swipe already under way never turns into the zoom.
      hold()
      expect(zoom()).not.toBeInTheDocument()
      fireEvent.pointerUp(bar(), { clientX: 60 })
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('clamps to 0/100 for positions off either end', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={0} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: -20 })
      fireEvent.pointerUp(bar(), { clientX: -20 })
      expect(onChange).toHaveBeenLastCalledWith(0)
      fireEvent.pointerDown(bar(), { clientX: 500 })
      fireEvent.pointerUp(bar(), { clientX: 500 })
      expect(onChange).toHaveBeenLastCalledWith(100)
    })

    it('ignores pointer moves with no press under way (hover, not a drag)', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={0} onChange={onChange} />)
      fireEvent.pointerMove(bar(), { clientX: 60, buttons: 0 })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('press and hold', () => {
    it('opens the zoom without changing the volume', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={40} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      expect(zoom()).not.toBeInTheDocument()
      hold()
      expect(zoom()).toBeInTheDocument()
      expect(zoom()).toHaveTextContent('40')
      expect(onChange).not.toHaveBeenCalled()
    })

    it('tolerates a finger that wobbles a little while it is held', () => {
      render(<VolumeSlider volume={40} onChange={vi.fn()} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      fireEvent.pointerMove(bar(), { clientX: 73, buttons: 1 })
      hold()
      expect(zoom()).toBeInTheDocument()
    })

    it('then moves the level by the finger travel along the zoom track, not the bar', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={40} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      hold()

      // 80px right along an 800px track is 10 points, from where it was.
      fireEvent.pointerMove(bar(), { clientX: 150, buttons: 1 })
      expect(onChange).toHaveBeenLastCalledWith(50)
      fireEvent.pointerMove(bar(), { clientX: 54, buttons: 1 })
      expect(onChange).toHaveBeenLastCalledWith(38)
      expect(zoom()).toHaveTextContent('38')
    })

    it('only sends whole levels it has not just sent', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={40} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      hold()
      // Under half a point either way of where it started: nothing to send.
      fireEvent.pointerMove(bar(), { clientX: 72, buttons: 1 })
      fireEvent.pointerMove(bar(), { clientX: 73, buttons: 1 })
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.pointerMove(bar(), { clientX: 78, buttons: 1 })
      fireEvent.pointerMove(bar(), { clientX: 80, buttons: 1 })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(41)
    })

    it('stops at 0 and 100', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={95} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 50 })
      hold()
      fireEvent.pointerMove(bar(), { clientX: 50 + 8 * 30, buttons: 1 })
      expect(onChange).toHaveBeenLastCalledWith(100)
      fireEvent.pointerMove(bar(), { clientX: 50 - 8 * 200, buttons: 1 })
      expect(onChange).toHaveBeenLastCalledWith(0)
    })

    it('closes when the finger lifts, leaving the level where the drag put it', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={40} onChange={onChange} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      hold()
      fireEvent.pointerMove(bar(), { clientX: 86, buttons: 1 })
      fireEvent.pointerUp(bar(), { clientX: 86 })
      expect(zoom()).not.toBeInTheDocument()
      // Lifting is not a tap: no jump to where the finger is on the small bar.
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(42)
    })

    it('closes if the browser takes the gesture away', () => {
      render(<VolumeSlider volume={40} onChange={vi.fn()} />)
      fireEvent.pointerDown(bar(), { clientX: 70 })
      hold()
      fireEvent.pointerCancel(bar())
      expect(zoom()).not.toBeInTheDocument()
    })
  })

  describe('the − and + buttons', () => {
    it('step the volume by 2', () => {
      const onChange = vi.fn()
      render(<VolumeSlider volume={40} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Volume up' }))
      expect(onChange).toHaveBeenLastCalledWith(42)
      fireEvent.click(screen.getByRole('button', { name: 'Volume down' }))
      expect(onChange).toHaveBeenLastCalledWith(38)
    })

    it('stop at 0 and 100', () => {
      const onChange = vi.fn()
      const { rerender } = render(<VolumeSlider volume={1} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Volume down' }))
      expect(onChange).toHaveBeenLastCalledWith(0)
      rerender(<VolumeSlider volume={99} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Volume up' }))
      expect(onChange).toHaveBeenLastCalledWith(100)
    })
  })
})
