import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayPendingNotice } from './PlayPendingNotice'

const useMusic = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/music', () => ({ useMusic }))

describe('PlayPendingNotice', () => {
  it('renders nothing when no play is in flight', () => {
    useMusic.mockReturnValue({ playPending: null })
    const { container } = render(<PlayPendingNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the item being cued, in the paper’s voice', () => {
    useMusic.mockReturnValue({ playPending: { label: '“Go”', at: 1 } })
    render(<PlayPendingNotice />)
    expect(screen.getByText('CUEING')).toBeInTheDocument()
    expect(screen.getByText('“Go”…')).toBeInTheDocument()
  })

  it('leaves the footer uncovered', () => {
    // Same slot as the error notice: sit on the footer, never over it, so the
    // nav and now-playing line stay readable while a pick is cueing.
    useMusic.mockReturnValue({ playPending: { label: '“Go”', at: 1 } })
    const { container } = render(<PlayPendingNotice />)
    expect((container.firstElementChild as HTMLElement).style.bottom).toBe('64px')
  })
})
