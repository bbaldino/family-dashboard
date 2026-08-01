import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { NowSpinningCover } from './NowSpinningCover'

describe('NowSpinningCover', () => {
  it('renders the 280px cover plus the disc overlay without throwing', () => {
    const { container } = render(<NowSpinningCover imageUrl={null} name="Black Steel" />)
    // Root + cover + disc.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(2)
  })
})
