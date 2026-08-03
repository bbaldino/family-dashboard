import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OffdayBlock } from './OffdayBlock'

vi.mock('@/data/sports', () => ({ formatUpcomingTime: (s: string) => s }))

describe('OffdayBlock', () => {
  it('shows a loading-aware headline instead of "No game today." while data is still loading', () => {
    // Regression: the headline used to be unconditional while the prose
    // beneath it was loading-aware, so the block would flatly assert "No
    // game today." during a cold-cache load even though a game might still
    // turn up once the fetch resolves.
    render(<OffdayBlock data={undefined} isLoading={true} />)
    expect(screen.queryByText('No game today.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /checking the schedule/i })).toBeInTheDocument()
  })

  it('shows "No game today." once loading has finished with no featured game', () => {
    render(<OffdayBlock data={{ games: [], hasLive: false }} isLoading={false} />)
    expect(screen.getByRole('heading', { name: 'No game today.' })).toBeInTheDocument()
  })
})

/** The dashboard should report the world, not narrate its own layout. Copy
 *  like "the column rests until the next first pitch… it flexes back in here"
 *  explains the interface to itself — true of the CSS, useless to someone
 *  glancing at a wall display, and it survived from the design mock where it
 *  read as an annotation rather than as page copy. */
describe('OffdayBlock copy', () => {
  it('does not explain what the layout will do', () => {
    render(<OffdayBlock data={{ games: [], hasLive: false }} isLoading={false} />)

    expect(screen.queryByText(/flexes back in here/i)).toBeNull()
    expect(screen.queryByText(/column rests/i)).toBeNull()
  })

  it('still says plainly that there is no game', () => {
    render(<OffdayBlock data={{ games: [], hasLive: false }} isLoading={false} />)

    expect(screen.getByRole('heading', { name: 'No game today.' })).toBeInTheDocument()
  })
})
