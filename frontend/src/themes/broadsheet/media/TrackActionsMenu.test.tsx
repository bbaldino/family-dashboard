import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackActionsMenu } from './TrackActionsMenu'

function groups(overrides?: { playItems?: string[]; navItems?: string[] }) {
  const playLabels = overrides?.playItems ?? ['Play just this track', 'Play radio from this', 'Play next', 'Add to queue']
  const navLabels = overrides?.navItems ?? ['Go to artist', 'Go to album']
  return [
    { label: 'Play', items: playLabels.map((label) => ({ label, onSelect: vi.fn() })) },
    { label: 'Go to', items: navLabels.map((label) => ({ label, onSelect: vi.fn() })) },
  ]
}

describe('TrackActionsMenu', () => {
  it('renders the header kicker and track title', () => {
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />)
    expect(screen.getByText('Track 01')).toBeInTheDocument()
    expect(screen.getByText('Galvanize')).toBeInTheDocument()
  })

  it('renders all six actions across both groups', () => {
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />)
    for (const label of ['Play just this track', 'Play radio from this', 'Play next', 'Add to queue', 'Go to artist', 'Go to album']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('invokes the right callback and only that one', () => {
    const onPlayNext = vi.fn()
    const menuGroups = groups()
    menuGroups[0].items[2] = { label: 'Play next', onSelect: onPlayNext }
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={menuGroups} />)
    fireEvent.click(screen.getByText('Play next'))
    expect(onPlayNext).toHaveBeenCalledTimes(1)
  })

  it('omits a group entirely when it has no items — e.g. "Go to" with no URIs to navigate to', () => {
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups({ navItems: [] })} />)
    expect(screen.queryByText('Go to')).not.toBeInTheDocument()
    expect(screen.queryByText('Go to artist')).not.toBeInTheDocument()
  })

  it('renders nothing when every group is empty', () => {
    const { container } = render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('highlights only the first item of the first non-empty group as the default action', () => {
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />)
    const first = screen.getByText('Play just this track')
    const second = screen.getByText('Play radio from this')
    expect(first.style.color).toBe('var(--rust)')
    expect(first.style.fontWeight).toBe('600')
    expect(second.style.color).toBe('var(--ink)')
  })
})
