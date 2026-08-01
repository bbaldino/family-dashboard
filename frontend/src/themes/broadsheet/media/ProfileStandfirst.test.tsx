import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileStandfirst } from './ProfileStandfirst'

describe('ProfileStandfirst', () => {
  it('renders the kicker and the given text', () => {
    render(<ProfileStandfirst text="Breakbeat, big beat, electronic — 9 albums in the library." />)
    expect(screen.getByText('↘ on the artist')).toBeInTheDocument()
    expect(screen.getByText('Breakbeat, big beat, electronic — 9 albums in the library.')).toBeInTheDocument()
  })
})
