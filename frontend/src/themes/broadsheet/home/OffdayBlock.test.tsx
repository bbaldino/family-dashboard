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
