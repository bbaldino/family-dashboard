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
})
