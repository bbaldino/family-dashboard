import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaMasthead } from './MediaMasthead'

describe('MediaMasthead', () => {
  /**
   * The suite's masthead rule: the centre names the page, and no ear is a
   * second name. This masthead once carried "Section IV / The Listening Room"
   * in the left ear; the absences are asserted alongside the presence so that
   * naming the page can't pass with a retired label still beside it.
   */
  it('names the page in the centre, with no page-name ear', () => {
    render(<MediaMasthead />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Media')
    expect(screen.queryByText('The Listening Room')).not.toBeInTheDocument()
    expect(screen.queryByText(/Section IV/)).not.toBeInTheDocument()
  })

  it('renders both ears empty — no room list, and no invented library counts', () => {
    // The room picker moved to the Centre Spread (it stretched the bar here);
    // the right ear's tracks/albums/playlists totals have no route to report.
    render(<MediaMasthead />)
    expect(screen.queryByText('Rooms')).not.toBeInTheDocument()
    expect(screen.queryByText(/tracks|albums|playlists/i)).not.toBeInTheDocument()
  })
})
