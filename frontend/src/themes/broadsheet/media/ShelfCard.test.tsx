import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShelfCard } from './ShelfCard'

const groups = [{ label: 'Play', items: [{ label: 'Add to queue', onSelect: vi.fn() }] }]

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

  it('calls onTap when pressed, with no menu wired', () => {
    const onTap = vi.fn()
    render(<ShelfCard item={{ key: 'u1', name: 'Amber Hours', secondary: 'The Night Shift', imageUrl: null, onTap }} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('renders a track-actions trigger alongside the tap button when a menu is wired', () => {
    const onTap = vi.fn()
    render(
      <ShelfCard
        item={{
          key: 'u1',
          name: 'Amber Hours',
          secondary: 'The Night Shift',
          imageUrl: null,
          onTap,
          menu: { isOpen: false, onToggle: vi.fn(), kicker: 'Track', title: 'Amber Hours', groups },
        }}
      />,
    )
    // Two independent buttons — the card's own tap target, and the trigger —
    // never one button nested inside another.
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByLabelText('Track actions')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Amber Hours'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('opens the trigger without also triggering onTap', () => {
    const onTap = vi.fn()
    const onToggle = vi.fn()
    render(
      <ShelfCard
        item={{
          key: 'u1',
          name: 'Amber Hours',
          secondary: 'The Night Shift',
          imageUrl: null,
          onTap,
          menu: { isOpen: false, onToggle, kicker: 'Track', title: 'Amber Hours', groups },
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('shows the menu itself once open', () => {
    render(
      <ShelfCard
        item={{
          key: 'u1',
          name: 'Amber Hours',
          secondary: 'The Night Shift',
          imageUrl: null,
          onTap: () => {},
          menu: { isOpen: true, onToggle: vi.fn(), kicker: 'Track', title: 'Amber Hours', groups },
        }}
      />,
    )
    expect(screen.getByText('Add to queue')).toBeInTheDocument()
  })
})
