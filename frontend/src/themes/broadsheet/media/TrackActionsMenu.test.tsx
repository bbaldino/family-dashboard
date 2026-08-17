import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrackActionsMenu } from './TrackActionsMenu'

function groups(overrides?: { playItems?: string[]; navItems?: string[] }) {
  const playLabels = overrides?.playItems ?? [
    'Play track',
    'Start radio',
    'Play next',
    'Add to queue',
  ]
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
    for (const label of [
      'Play track',
      'Start radio',
      'Play next',
      'Add to queue',
      'Go to artist',
      'Go to album',
    ]) {
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
    render(
      <TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups({ navItems: [] })} />,
    )
    expect(screen.queryByText('Go to')).not.toBeInTheDocument()
    expect(screen.queryByText('Go to artist')).not.toBeInTheDocument()
  })

  it('renders nothing when every group is empty', () => {
    const { container } = render(
      <TrackActionsMenu kicker="Track 01" title="Galvanize" groups={[]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('highlights only the first item of the first non-empty group as the default action', () => {
    render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />)
    const first = screen.getByText('Play track')
    const second = screen.getByText('Start radio')
    expect(first.style.color).toBe('var(--rust)')
    expect(first.style.fontWeight).toBe('600')
    expect(second.style.color).toBe('var(--ink)')
  })

  describe('opening upward when it would not fit below', () => {
    const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

    afterEach(() => {
      HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect
    })

    /** Stubs every element's rect by its `data-testid`, so the mock is in
     *  place *before* the component's own `useLayoutEffect` runs on mount —
     *  patching a specific node's rect only after render is too late, since
     *  the flip decision is made at mount. */
    function stubRectsByTestId(byTestId: Record<string, { top: number; bottom: number }>) {
      HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
        const base = { left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {} }
        const id = this.dataset.testid
        const rect = id ? byTestId[id] : undefined
        return { ...base, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0 } as DOMRect
      }
    }

    it('opens downward (top: 100%) when nothing clips it', () => {
      render(<TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />)
      const menu = screen.getByTestId('broadsheet-track-actions-menu')
      expect(menu.style.top).toBe('100%')
      expect(menu.style.bottom).toBe('')
    })

    it('opens downward when the clipping ancestor has enough room below', () => {
      stubRectsByTestId({
        clipper: { top: 0, bottom: 900 },
        'broadsheet-track-actions-menu': { top: 100, bottom: 300 },
      })
      render(
        <div data-testid="clipper" style={{ overflow: 'hidden' }}>
          <TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />
        </div>,
      )
      const menu = screen.getByTestId('broadsheet-track-actions-menu')
      expect(menu.style.top).toBe('100%')
      expect(menu.style.bottom).toBe('')
    })

    it('flips to open upward (bottom: 100%) when the nearest clipping ancestor cuts it off', () => {
      // The same shape verified live: a shelf column clips at 300, but the
      // menu, opened downward, would extend to 500 — past it.
      stubRectsByTestId({
        clipper: { top: 0, bottom: 300 },
        'broadsheet-track-actions-menu': { top: 250, bottom: 500 },
      })
      render(
        <div data-testid="clipper" style={{ overflow: 'hidden' }}>
          <TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />
        </div>,
      )
      const menu = screen.getByTestId('broadsheet-track-actions-menu')
      expect(menu.style.bottom).toBe('100%')
      expect(menu.style.top).toBe('')
    })

    it('only counts an ancestor that actually clips — one with overflow: visible is skipped', () => {
      stubRectsByTestId({
        // A visible-overflow ancestor could still report a rect that would
        // "clip" the menu if it were (wrongly) counted — it must not be.
        passthrough: { top: 0, bottom: 260 },
        'broadsheet-track-actions-menu': { top: 250, bottom: 500 },
      })
      render(
        <div data-testid="passthrough" style={{ overflow: 'visible' }}>
          <TrackActionsMenu kicker="Track 01" title="Galvanize" groups={groups()} />
        </div>,
      )
      const menu = screen.getByTestId('broadsheet-track-actions-menu')
      expect(menu.style.top).toBe('100%')
      expect(menu.style.bottom).toBe('')
    })
  })
})
