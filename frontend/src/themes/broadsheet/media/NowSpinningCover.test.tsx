import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NowSpinningCover } from './NowSpinningCover'

describe('NowSpinningCover', () => {
  it('renders the 280px cover plus the disc overlay without throwing', () => {
    const { container } = render(<NowSpinningCover imageUrl={null} name="Black Steel" />)
    // Root + cover + disc.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(2)
  })

  it('renders as plain, non-interactive markup when no onTap is given', () => {
    render(<NowSpinningCover imageUrl={null} name="Black Steel" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('wraps the cover in a real button and calls onTap when tapped', () => {
    const onTap = vi.fn()
    render(<NowSpinningCover imageUrl={null} name="Black Steel" onTap={onTap} />)
    fireEvent.click(screen.getByLabelText('Open now playing'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })
})
