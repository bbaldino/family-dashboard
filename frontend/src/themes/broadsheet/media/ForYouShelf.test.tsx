import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForYouShelf } from './ForYouShelf'

const useForYou = vi.hoisted(() => vi.fn())
const useMusic = vi.hoisted(() => vi.fn())
const getImageUrl = vi.hoisted(() => vi.fn(() => null))
vi.mock('@/integrations/music', () => ({ useForYou, useMusic, getImageUrl }))

const play = vi.fn()
const noopMenu = { openMenuUri: null, onToggleMenu: vi.fn(), onCloseMenu: vi.fn() }

function renderShelf(props: Partial<Parameters<typeof ForYouShelf>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ForYouShelf {...noopMenu} {...props} />
    </MemoryRouter>,
  )
}

describe('ForYouShelf', () => {
  beforeEach(() => {
    play.mockClear()
    useMusic.mockReturnValue({ play })
  })

  it('shows a written line when there are no curated playlists', () => {
    useForYou.mockReturnValue({ data: [] })
    renderShelf()
    expect(screen.getByText(/no curated playlists/i)).toBeInTheDocument()
  })

  it('survives a cold cache where the hook returns undefined', () => {
    useForYou.mockReturnValue({ data: undefined })
    expect(() => renderShelf()).not.toThrow()
  })

  it('renders playlists and plays one on tap', () => {
    useForYou.mockReturnValue({
      data: [{ name: 'Late Night Drive', description: 'Discover Weekly', uri: 'p1', image: null }],
    })
    renderShelf()
    expect(screen.getByText('For you')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Late Night Drive'))
    expect(play).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ mediaType: 'playlist', radio: false }),
    )
  })

  it('gives a playlist card a menu with no "Play just this" or "Go to" — only radio/next/queue', () => {
    useForYou.mockReturnValue({
      data: [{ name: 'Late Night Drive', description: 'Discover Weekly', uri: 'p1', image: null }],
    })
    renderShelf({ openMenuUri: 'p1' })
    expect(screen.getByText('Start radio')).toBeInTheDocument()
    expect(screen.getByText('Play next')).toBeInTheDocument()
    expect(screen.getByText('Add to queue')).toBeInTheDocument()
    expect(screen.queryByText('Play track')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Go to/)).not.toBeInTheDocument()
  })
})
