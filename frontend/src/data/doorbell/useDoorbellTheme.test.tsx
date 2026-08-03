import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDoorbellTheme } from './useDoorbellTheme'

/** A stand-in for the cross-origin iframe: the hook only ever touches
 *  `contentWindow.postMessage`, so the fake records what it was sent and with
 *  which target origin. jsdom won't give us a real cross-origin frame, and
 *  faking the whole `HTMLIFrameElement` would test the fake rather than the
 *  hook. */
function fakeIframe() {
  const sent: Array<{ message: unknown; targetOrigin: string }> = []
  // A real element, so the hook's `load` listener attaches to a real
  // EventTarget rather than to a hand-rolled one that might accept anything.
  // Only `contentWindow` is stubbed — jsdom won't give us a cross-origin frame,
  // and `postMessage` is the entire surface the hook touches.
  const el = document.createElement('iframe')
  Object.defineProperty(el, 'contentWindow', {
    value: {
      postMessage: (message: unknown, targetOrigin: string) => {
        sent.push({ message, targetOrigin })
      },
    },
  })
  return { ref: { current: el }, sent }
}

const CAMERA_URL = 'http://192.168.1.21:8899/webrtc-doorbell.html'
const DOORBELL_ORIGIN = 'http://192.168.1.21:8899'

function postReady(origin = DOORBELL_ORIGIN, contract = 1) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'doorbell:ready', contract }, origin }),
    )
  })
}

describe('useDoorbellTheme', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('sends the payload when the page announces it is ready', async () => {
    const { ref, sent } = fakeIframe()
    renderHook(() => useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }))

    postReady()

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].message).toEqual({ type: 'doorbell:style', css: 'body{}' })
    expect(sent[0].targetOrigin).toBe(DOORBELL_ORIGIN)
  })

  /** The ring popup mounts a fresh iframe on every doorbell press, so a
   *  once-only send comes back unthemed on the second ring. */
  it('sends again on every ready, not just the first', async () => {
    const { ref, sent } = fakeIframe()
    renderHook(() => useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }))

    postReady()
    postReady()

    await waitFor(() => expect(sent).toHaveLength(2))
  })

  it('ignores messages that did not come from the doorbell page', async () => {
    const { ref, sent } = fakeIframe()
    renderHook(() => useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }))

    postReady('https://evil.example.com')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(sent).toHaveLength(0)
  })

  it('keeps the frame hidden until the payload has gone out', () => {
    const { ref } = fakeIframe()
    const { result } = renderHook(() =>
      useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }),
    )

    expect(result.current.revealed).toBe(false)
  })

  it('reveals the frame once the payload has gone out', async () => {
    const { ref } = fakeIframe()
    const { result } = renderHook(() =>
      useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }),
    )

    postReady()

    await waitFor(() => expect(result.current.revealed).toBe(true))
  })

  /** A rejected origin looks exactly like a broken page from out here: the
   *  console.warn explaining it is inside a cross-origin frame we cannot read.
   *  So the deadline is the only thing standing between "not themed" and "no
   *  video at all" — an unthemed doorbell beats an invisible one. */
  it('reveals the frame anyway when ready never arrives', async () => {
    const { ref } = fakeIframe()
    const { result } = renderHook(() =>
      useDoorbellTheme({ iframeRef: ref, cameraUrl: CAMERA_URL, css: 'body{}' }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(result.current.revealed).toBe(true)
  })

  /** Variables degrade gracefully across a restructure; layout CSS written
   *  against a tree that moved does not. */
  it('drops the layout CSS when the page reports an unrecognised contract', async () => {
    const { ref, sent } = fakeIframe()
    renderHook(() =>
      useDoorbellTheme({
        iframeRef: ref,
        cameraUrl: CAMERA_URL,
        css: ':root{--doorbell-bg:#fff}',
        layoutCss: '[data-doorbell="layout"]{flex-direction:column}',
      }),
    )

    postReady(DOORBELL_ORIGIN, 99)

    await waitFor(() => expect(sent).toHaveLength(1))
    const { css } = sent[0].message as { css: string }
    expect(css).toContain('--doorbell-bg')
    expect(css).not.toContain('flex-direction')
  })
})
