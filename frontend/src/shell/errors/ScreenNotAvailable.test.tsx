import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ScreenNotAvailable } from './ScreenNotAvailable'

describe('ScreenNotAvailable', () => {
  it('names the missing screen and links home', () => {
    render(
      <MemoryRouter>
        <ScreenNotAvailable screenKey="media.artist" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/media\.artist/i)).toBeInTheDocument()
    const home = screen.getByRole('link', { name: /home/i })
    expect(home).toHaveAttribute('href', '/')
  })
})
