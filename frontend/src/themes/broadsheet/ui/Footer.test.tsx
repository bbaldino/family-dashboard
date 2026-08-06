import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from './Footer'

const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useMusic }))

describe('Footer', () => {
  beforeEach(() => {
    useMusic.mockReturnValue({ state: { queues: [], activeQueue: null } })
  })

  it('renders every nav link, including screens broadsheet has not built yet', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    for (const label of ['Home', 'Calendar', 'Media', 'Cameras', 'Health']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('writes a line instead of leaving an empty slot when nothing is playing', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByText(/quiet in the kitchen/i)).toBeInTheDocument()
  })

  it('shows the current track and artist when something is playing', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen',
          state: 'playing',
          currentItem: {
            name: 'Dreams',
            artist: 'Fleetwood Mac',
            album: null,
            imageUrl: null,
            duration: 257,
            elapsed: 90,
            uri: null,
          },
          volumeLevel: 50,
        },
      },
    })
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Dreams/)).toBeInTheDocument()
    expect(screen.getByText(/Fleetwood Mac/)).toBeInTheDocument()
  })

  it('falls back to the queue name when the queue has no current item', () => {
    useMusic.mockReturnValue({
      state: {
        queues: [],
        activeQueue: {
          queueId: 'kitchen',
          displayName: 'Kitchen Radio',
          state: 'idle',
          currentItem: null,
          volumeLevel: 50,
        },
      },
    })
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Kitchen Radio/)).toBeInTheDocument()
  })

  /** The admin page had no route into it from broadsheet at all — the only way
   *  in was typing the URL, which is no use on a wall-mounted tablet. The mock
   *  (`shared.jsx:286`) sets it apart from the destinations rather than making
   *  it a sixth nav entry: settings is not a screen you browse to. */
  it('offers a way into settings', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    const settings = screen.getByRole('link', { name: /settings/i })
    expect(settings.getAttribute('href')).toBe('/admin')
  })

  it('keeps settings out of the screen destinations', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )

    const nav = screen.getByRole('navigation')
    expect(within(nav).queryByRole('link', { name: /settings/i })).toBeNull()
  })
})
