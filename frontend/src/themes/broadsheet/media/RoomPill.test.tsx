import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
