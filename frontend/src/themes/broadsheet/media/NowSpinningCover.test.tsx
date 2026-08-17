import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NowSpinningCover } from './NowSpinningCover'

describe('NowSpinningCover', () => {
  it('renders the cover without a vinyl-disc overlay on top of the art', () => {
    const { container } = render(
      <NowSpinningCover imageUrl="https://example.invalid/a.jpg" name="Black Steel" />,
    )
    // Real art renders as a single <img>; the disc used to add a decorative
    // overlay covering a third of it, which is gone.
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    // The disc was an absolutely-positioned element overlapping the cover's
    // right edge — no element should be so positioned now.
    const positioned = [...container.querySelectorAll('div')].filter(
      (d) => d.style.position === 'absolute',
    )
    expect(positioned).toHaveLength(0)
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
