import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DoorbellRingModal } from './DoorbellRingModal'

const CAMERA_URL = 'http://192.168.1.21:8899/webrtc-doorbell.html'

function renderModal(props: Partial<Parameters<typeof DoorbellRingModal>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <DoorbellRingModal isOpen cameraUrl={CAMERA_URL} onClose={onClose} {...props} />
    </MemoryRouter>,
  )
  return { onClose }
}

/** These cover the parts of the slip that only exist while it is genuinely
 *  open. A forced-open screenshot doesn't reach them — the `LIVE` marker and
 *  the "rang" foot note are both gated on `isOpen`, so a demo that bypasses
 *  that flag renders the slip without them and looks fine anyway. */
describe('DoorbellRingModal', () => {
  it('renders nothing when shut', () => {
    renderModal({ isOpen: false })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('announces the ring', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Someone.s at the door/)).toBeTruthy()
  })

  /** The marker is driven by the page's own `doorbell:video-playing`, not by
   *  the iframe merely having a `src` — an iframe pointed at a dead camera
   *  would otherwise claim to be live. */
  it('shows LIVE only once the feed reports a frame', () => {
    renderModal()

    expect(screen.queryByText('LIVE')).toBeNull()

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'doorbell:video-playing' },
          origin: 'http://192.168.1.21:8899',
        }),
      )
    })

    expect(screen.getByText('LIVE')).toBeTruthy()
  })

  it('ignores a video-playing claim from anywhere else', () => {
    renderModal()

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'doorbell:video-playing' },
          origin: 'https://evil.example.com',
        }),
      )
    })

    expect(screen.queryByText('LIVE')).toBeNull()
  })

  it('reports how long ago it rang', () => {
    renderModal()

    expect(screen.getByText(/RANG \d+s AGO/)).toBeTruthy()
  })

  it('closes on the dismiss button', () => {
    const { onClose } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /** A blanked `camera_url` is a real state — the settings field can be
   *  emptied — and the slip still has to say something rather than framing a
   *  hole. */
  it('says so when there is no camera configured', () => {
    renderModal({ cameraUrl: null })

    expect(screen.getByText(/No picture from the front step/)).toBeTruthy()
  })
})
