import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackActionsTrigger } from './TrackActionsTrigger'

const groups = [{ label: 'Play', items: [{ label: 'Play just this track', onSelect: vi.fn() }] }]

describe('TrackActionsTrigger', () => {
  it('renders the ⋮ glyph and no menu when closed', () => {
    render(
      <TrackActionsTrigger
        isOpen={false}
        onToggle={vi.fn()}
        kicker="Track 01"
        title="Galvanize"
        groups={groups}
      />,
    )
    expect(screen.getByLabelText('Track actions')).toBeInTheDocument()
    expect(screen.queryByText('Play just this track')).not.toBeInTheDocument()
  })

  it('renders the menu when open', () => {
    render(
      <TrackActionsTrigger
        isOpen
        onToggle={vi.fn()}
        kicker="Track 01"
        title="Galvanize"
        groups={groups}
      />,
    )
    expect(screen.getByText('Play just this track')).toBeInTheDocument()
  })

  it('calls onToggle, not the menu items, when the trigger itself is tapped', () => {
    const onToggle = vi.fn()
    render(
      <TrackActionsTrigger
        isOpen={false}
        onToggle={onToggle}
        kicker="Track 01"
        title="Galvanize"
        groups={groups}
      />,
    )
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('does not bubble the trigger tap up to an ancestor row click handler', () => {
    const onToggle = vi.fn()
    const onRowClick = vi.fn()
    render(
      <div onClick={onRowClick}>
        <TrackActionsTrigger
          isOpen={false}
          onToggle={onToggle}
          kicker="Track 01"
          title="Galvanize"
          groups={groups}
        />
      </div>,
    )
    fireEvent.click(screen.getByLabelText('Track actions'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
