import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShelfGrid } from './ShelfGrid'
import type { ShelfCardItem } from './ShelfCard'

function makeItems(count: number): ShelfCardItem[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `u${i}`,
    name: `Track ${i}`,
    secondary: 'Some Artist',
    imageUrl: null,
    onTap: () => {},
  }))
}

describe('ShelfGrid', () => {
  it('renders every item when there are fewer than the row cap allows', () => {
    render(<ShelfGrid items={makeItems(3)} maxRows={2} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('caps rendered cards to maxRows * 4, not the full item list', () => {
    render(<ShelfGrid items={makeItems(20)} maxRows={2} />)
    expect(screen.getAllByRole('button')).toHaveLength(8)
  })

  it('renders nothing for zero rows', () => {
    render(<ShelfGrid items={makeItems(4)} maxRows={0} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
