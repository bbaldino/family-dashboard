import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CentreSpreadMasthead } from './CentreSpreadMasthead'

const useRoomPills = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useRoomPills }))

const anchorPill = {
  player: {
    playerId: 'kitchen',
    displayName: 'Kitchen',
    state: 'playing',
    available: true,
    volumeLevel: 45,
    groupMembers: ['kitchen'],
    syncedTo: null,
    canGroupWith: [],
    groupVolume: null,
  },
  isAnchor: true,
  joined: true,
  pending: false,
}

function renderMasthead(over: Record<string, unknown> = {}) {
  useRoomPills.mockReturnValue({ pills: [anchorPill], toggle: vi.fn() })
  const onClose = vi.fn()
  const utils = render(
    <CentreSpreadMasthead trackTitle="Amber Hours" trackNumber={4} onClose={onClose} {...over} />,
  )
  return { ...utils, onClose }
}

describe('CentreSpreadMasthead', () => {
  it('states what is playing in the centre, with "Side A · Track {n}"', () => {
    renderMasthead()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Amber Hours')
    expect(screen.getByText('Side A · Track 4')).toBeInTheDocument()
  })

  it('drops the "Track {n}" clause — never "of {m}" — when there is no track number', () => {
    renderMasthead({ trackNumber: null })
    expect(screen.getByText('Side A')).toBeInTheDocument()
    expect(screen.queryByText(/Track/)).not.toBeInTheDocument()
    expect(screen.queryByText(/of \d/)).not.toBeInTheDocument()
  })

  /**
   * The suite's masthead rule. This ear read "The Centre Spread" over a
   * playback phrase naming the room ("Now playing in the Kitchen") — a second
   * name for the page above something the room ear now says per room. The
   * centre still states what the screen is *for* (the track), which the rule
   * allows: it states the page rather than naming it.
   */
  it('carries the room picker in the ear, not a second page name', () => {
    renderMasthead()
    expect(screen.getByText('Rooms')).toBeInTheDocument()
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.queryByText('The Centre Spread')).not.toBeInTheDocument()
    expect(screen.queryByText(/Now playing in/)).not.toBeInTheDocument()
  })

  it('calls onClose when Close is tapped', () => {
    const { onClose } = renderMasthead()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
