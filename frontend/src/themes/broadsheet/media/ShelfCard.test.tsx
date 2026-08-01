import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShelfCard } from './ShelfCard'

describe('ShelfCard', () => {
  it('renders the title and secondary line', () => {
    render(
      <ShelfCard
        item={{ key: 'u1', name: 'Amber Hours', secondary: 'The Night Shift', imageUrl: null, onTap: () => {} }}
      />,
    )
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
    expect(screen.getByText('The Night Shift')).toBeInTheDocument()
  })

  it('calls onTap when pressed', () => {
    const onTap = vi.fn()
    render(<ShelfCard item={{ key: 'u1', name: 'Amber Hours', secondary: 'The Night Shift', imageUrl: null, onTap }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })
})
