import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ForYouShelf } from './ForYouShelf'

const useForYou = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
const getImageUrl = vi.hoisted(() => vi.fn(() => null))
vi.mock('@/data/music', () => ({ useForYou, useMusic, getImageUrl }))

const play = vi.fn()

describe('ForYouShelf', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ play })
  })

  it('shows a written line when there are no curated playlists', () => {
    useForYou.mockReturnValue({ data: [] })
    render(<ForYouShelf />)
    expect(screen.getByText(/no curated playlists/i)).toBeInTheDocument()
  })

  it('survives a cold cache where the hook returns undefined', () => {
    useForYou.mockReturnValue({ data: undefined })
    expect(() => render(<ForYouShelf />)).not.toThrow()
  })

  it('renders playlists and plays one on tap', () => {
    useForYou.mockReturnValue({
      data: [{ name: 'Late Night Drive', description: 'Discover Weekly', uri: 'p1', image: null }],
    })
    render(<ForYouShelf />)
    expect(screen.getByText('For you')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Late Night Drive'))
    expect(play).toHaveBeenCalledWith('p1', expect.objectContaining({ mediaType: 'playlist', radio: false }))
  })
})
