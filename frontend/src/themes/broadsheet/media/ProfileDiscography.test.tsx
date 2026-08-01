import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileDiscography } from './ProfileDiscography'
import { MAX_DISCOGRAPHY_ALBUMS } from './profile-capacity'

function album(i: number) {
  return { uri: `fixture://album/${i}`, name: `Album ${i}`, image_url: null, year: 2000 + i }
}

describe('ProfileDiscography', () => {
  it('renders every album under the cap', () => {
    const albums = [album(1), album(2)]
    render(<ProfileDiscography albums={albums} onOpenAlbum={vi.fn()} />)
    expect(screen.getByText('Album 1')).toBeInTheDocument()
    expect(screen.getByText('Album 2')).toBeInTheDocument()
  })

  it('caps a long discography at MAX_DISCOGRAPHY_ALBUMS', () => {
    const albums = Array.from({ length: 20 }, (_, i) => album(i + 1))
    render(<ProfileDiscography albums={albums} onOpenAlbum={vi.fn()} />)
    expect(screen.getByText(`Album ${MAX_DISCOGRAPHY_ALBUMS}`)).toBeInTheDocument()
    expect(screen.queryByText(`Album ${MAX_DISCOGRAPHY_ALBUMS + 1}`)).not.toBeInTheDocument()
  })

  it('still shows the true album count in the header even when the rail itself is capped', () => {
    const albums = Array.from({ length: 20 }, (_, i) => album(i + 1))
    render(<ProfileDiscography albums={albums} onOpenAlbum={vi.fn()} />)
    expect(screen.getByText('20 albums')).toBeInTheDocument()
  })

  it('tapping an album calls onOpenAlbum with its uri', () => {
    const onOpenAlbum = vi.fn()
    render(<ProfileDiscography albums={[album(1)]} onOpenAlbum={onOpenAlbum} />)
    fireEvent.click(screen.getByText('Album 1'))
    expect(onOpenAlbum).toHaveBeenCalledWith('fixture://album/1')
  })
})
