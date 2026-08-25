import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SportsLead } from './SportsLead'
import type { SportsTrack } from '@/integrations/sports'

const track = (over: Partial<SportsTrack> = {}): SportsTrack => ({
  league: 'MLB',
  team: 'Colorado Rockies',
  seasonType: 'Regular Season',
  record: '0-0',
  standing: '',
  home: '0-0',
  away: '0-0',
  next: '',
  headline: 'Rockies rally late',
  dek: '',
  caption: 'Rockies at the plate.',
  more: [],
  table: { title: '', sub: '', rows: [] },
  scoresLabel: '',
  scores: [],
  leaders: [],
  hot: [],
  cold: [],
  ...over,
})

describe('SportsLead', () => {
  it('renders the lead-art image with the encoded league, team, and headline', () => {
    const { container } = render(
      <SportsLead track={track()} primary={true} split={false} showMore={false} />,
    )
    const img = container.querySelector('img')
    const src = img?.getAttribute('src') ?? ''
    expect(src).toContain('/api/sports/lead-art?')
    expect(src).toContain('league=MLB')
    expect(src).toContain('team=Colorado+Rockies')
    expect(src).toContain('headline=Rockies+rally+late')
  })

  it('renders the caption', () => {
    render(<SportsLead track={track()} primary={true} split={false} showMore={false} />)
    expect(screen.getByText('Rockies at the plate.')).toBeInTheDocument()
  })

  it('renders no image when not primary (plate is primary-only)', () => {
    const { container } = render(
      <SportsLead track={track()} primary={false} split={false} showMore={false} />,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
