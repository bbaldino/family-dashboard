import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoomPill } from './RoomPill'

describe('RoomPill', () => {
  it('fills with ink and paper text when active', () => {
    render(<RoomPill label="Kitchen" active />)
    const pill = screen.getByText('Kitchen')
    expect(pill.style.background).toBe('var(--ink)')
    expect(pill.style.color).toBe('var(--paper)')
  })

  it('renders outlined and muted when inactive', () => {
    render(<RoomPill label="Living Room" active={false} />)
    const pill = screen.getByText('Living Room')
    expect(pill.style.background).toBe('')
    expect(pill.style.border).toBe('1px solid var(--rule)')
  })

  it('renders as a plain, untappable span without onToggle — the anchor pill', () => {
    render(<RoomPill label="Kitchen" active />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders as a tappable button when onToggle is given, and calls it on tap', () => {
    const onToggle = vi.fn()
    render(<RoomPill label="Living Room" active={false} onToggle={onToggle} />)
    const pill = screen.getByRole('button', { name: 'Living Room' })
    fireEvent.click(pill)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('keeps the same fill/outline styling whether or not it is tappable', () => {
    const onToggle = vi.fn()
    render(<RoomPill label="Bedroom" active onToggle={onToggle} />)
    const pill = screen.getByRole('button', { name: 'Bedroom' })
    expect(pill.style.background).toBe('var(--ink)')
    expect(pill.style.color).toBe('var(--paper)')
  })

  it('stays a button while pending — disabled and dimmed, not silently swapped for a span', () => {
    const onToggle = vi.fn()
    render(<RoomPill label="Living Room" active={false} pending onToggle={onToggle} />)
    const pill = screen.getByRole('button', { name: 'Living Room' })
    expect(pill).toBeDisabled()
    expect(pill.style.opacity).toBe('0.55')
    fireEvent.click(pill)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('does not change box dimensions between idle and pending — only opacity differs', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<RoomPill label="Living Room" active={false} pending={false} onToggle={onToggle} />)
    const idle = screen.getByRole('button', { name: 'Living Room' })
    // Captured before the rerender below — React reuses the same DOM node
    // for this update, so reading these live afterward would just compare
    // the pending style against itself.
    const idleBox = { padding: idle.style.padding, border: idle.style.border }
    const idleOpacity = idle.style.opacity

    rerender(<RoomPill label="Living Room" active={false} pending onToggle={onToggle} />)
    const pending = screen.getByRole('button', { name: 'Living Room' })
    expect({ padding: pending.style.padding, border: pending.style.border }).toEqual(idleBox)
    expect(pending.style.opacity).not.toBe(idleOpacity)
  })

  it('the anchor pill (no onToggle) ignores a pending prop — it was never tappable to begin with', () => {
    render(<RoomPill label="Kitchen" active pending />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Kitchen').tagName).toBe('SPAN')
  })
})
