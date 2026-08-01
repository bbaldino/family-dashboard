import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VolumeSlider } from './VolumeSlider'

function mockRect(target: HTMLElement) {
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width: 100,
    top: 0,
    right: 100,
    bottom: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => {},
  })
}

describe('VolumeSlider', () => {
  it('exposes slider aria attributes carrying the current value', () => {
    render(<VolumeSlider volume={42} onChange={vi.fn()} />)
    const slider = screen.getByLabelText('Volume')
    expect(slider).toHaveAttribute('role', 'slider')
    expect(slider).toHaveAttribute('aria-valuemin', '0')
    expect(slider).toHaveAttribute('aria-valuemax', '100')
    expect(slider).toHaveAttribute('aria-valuenow', '42')
  })

  it('gives the slider a real hit target well beyond the hairline rule it wraps', () => {
    render(<VolumeSlider volume={0} onChange={vi.fn()} />)
    const slider = screen.getByLabelText('Volume')
    expect(slider.style.height).toBe('40px')
  })

  it('sets a level from a tap (click) position, the original click-to-set behaviour', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.click(slider, { clientX: 30 })
    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('sets a level immediately on pointerdown, the same as a tap', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.pointerDown(slider, { clientX: 75 })
    expect(onChange).toHaveBeenCalledWith(75)
  })

  it('drags: pointer moves with the primary button held update the level', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.pointerDown(slider, { clientX: 10 })
    fireEvent.pointerMove(slider, { clientX: 60, buttons: 1 })
    expect(onChange).toHaveBeenLastCalledWith(60)
  })

  it('ignores pointer moves when no button is held (hover, not a drag)', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.pointerMove(slider, { clientX: 60, buttons: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dedupes same-level moves during a drag so gliding does not spam onChange', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.pointerDown(slider, { clientX: 40 })
    onChange.mockClear()
    // Two moves that both round to the same 41% level — only the first should notify.
    fireEvent.pointerMove(slider, { clientX: 41, buttons: 1 })
    fireEvent.pointerMove(slider, { clientX: 41.4, buttons: 1 })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(41)
  })

  it('always fires on a fresh pointerdown even if it matches the last dragged-to level', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.pointerDown(slider, { clientX: 50 })
    fireEvent.pointerMove(slider, { clientX: 50, buttons: 1 })
    onChange.mockClear()
    // A later, separate tap landing on the exact same level a drag last sent
    // must still notify — it may reflect a real (e.g. SSE-driven) change.
    fireEvent.pointerDown(slider, { clientX: 50 })
    expect(onChange).toHaveBeenCalledWith(50)
  })

  it('clamps to 0/100 for out-of-bounds positions', () => {
    const onChange = vi.fn()
    render(<VolumeSlider volume={0} onChange={onChange} />)
    const slider = screen.getByLabelText('Volume')
    mockRect(slider)
    fireEvent.click(slider, { clientX: -20 })
    expect(onChange).toHaveBeenCalledWith(0)
    fireEvent.click(slider, { clientX: 500 })
    expect(onChange).toHaveBeenCalledWith(100)
  })
})
