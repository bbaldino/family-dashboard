import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordSleeve } from './RecordSleeve'
import type { AlbumDetail } from '@/data/music'

const album: AlbumDetail = {
  name: 'Push The Button',
  artist: 'The Chemical Brothers',
  artist_uri: 'fixture://artist/1',
  image_url: null,
  year: 2005,
  label: 'Virgin Records',
  description: null,
  tracks: [
    { uri: 't1', name: 'Galvanize', artist: 'x', artist_uri: null, artists: [], album: null, album_uri: null, image_url: null, duration: 393 },
    { uri: 't2', name: 'The Boxer', artist: 'x', artist_uri: null, artists: [], album: null, album_uri: null, image_url: null, duration: 263 },
  ],
}

describe('RecordSleeve', () => {
  it('shows the artist, the credits dl, and the generated note when description is null', () => {
    render(<RecordSleeve album={album} onQueue={vi.fn()} onRadio={vi.fn()} />)
    expect(screen.getByText('The Chemical Brothers')).toBeInTheDocument()
    expect(screen.getByText('Released')).toBeInTheDocument()
    expect(screen.getByText('2005')).toBeInTheDocument()
    expect(screen.getByText('Label')).toBeInTheDocument()
    expect(screen.getByText('Virgin Records')).toBeInTheDocument()
    expect(screen.getByText('Length')).toBeInTheDocument()
    expect(screen.getByText('2 tracks · 11 min')).toBeInTheDocument()
    expect(screen.getByText('Released 2005 on Virgin Records — 2 tracks, running 11 min.')).toBeInTheDocument()
  })

  it('renders the real description verbatim when present', () => {
    render(<RecordSleeve album={{ ...album, description: 'Cut between Kensal Rise and a rented barn.' }} onQueue={vi.fn()} onRadio={vi.fn()} />)
    expect(screen.getByText('Cut between Kensal Rise and a rented barn.')).toBeInTheDocument()
  })

  it('falls back to a dash for a missing label', () => {
    render(<RecordSleeve album={{ ...album, label: null }} onQueue={vi.fn()} onRadio={vi.fn()} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders only Queue and Radio — no Shuffle, which the backend does not support', () => {
    render(<RecordSleeve album={album} onQueue={vi.fn()} onRadio={vi.fn()} />)
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('Radio')).toBeInTheDocument()
    expect(screen.queryByText('Shuffle')).not.toBeInTheDocument()
  })

  it('wires Queue and Radio to their own callbacks', () => {
    const onQueue = vi.fn()
    const onRadio = vi.fn()
    render(<RecordSleeve album={album} onQueue={onQueue} onRadio={onRadio} />)
    fireEvent.click(screen.getByText('Queue'))
    fireEvent.click(screen.getByText('Radio'))
    expect(onQueue).toHaveBeenCalledTimes(1)
    expect(onRadio).toHaveBeenCalledTimes(1)
  })
})
