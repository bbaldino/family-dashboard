import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** The contract version this code was written against — see cam-proxy's
 *  `docs/theming.md`. The version arrives in the `doorbell:ready` *message*,
 *  never from the DOM: the embed is cross-origin, so the page's mirrored
 *  `data-doorbell-contract` attribute is unreadable from here. */
const KNOWN_CONTRACT = 1

/** How long to wait for `doorbell:ready` before showing the frame unthemed.
 *  This is not just a guard against a broken page: if our origin ever falls off
 *  the doorbell's allowlist, the page loads and streams perfectly while `ready`
 *  never reaches us, and the `console.warn` that would explain it is inside a
 *  frame we cannot read. From out here "themed" and "rejected" are
 *  indistinguishable except by this deadline — so it has to fire, and an
 *  unthemed doorbell has to beat an invisible one. */
const REVEAL_DEADLINE_MS = 1500

export interface DoorbellThemeOptions {
  iframeRef: { current: HTMLIFrameElement | null }
  /** The configured camera page URL; its origin is both the `postMessage`
   *  target and the only origin we accept `doorbell:ready` from. */
  cameraUrl: string
  /** Variables and font faces — safe across a restructure of the page. */
  css: string
  /** Rules written against the page's containment tree. Dropped if the page
   *  reports a contract version we don't know: variables degrade gracefully,
   *  layout aimed at a tree that moved does not. */
  layoutCss?: string
}

function originOf(url: string): string | null {
  try {
    return new URL(url, window.location.href).origin
  } catch {
    return null
  }
}

/**
 * Drives the theming handshake for one embedded doorbell page.
 *
 * The page posts `{type:'doorbell:ready', contract:1}` on *every*
 * initialisation, and we answer every one of them — the ring popup mounts a
 * fresh iframe on each press, so a once-only send would come back unthemed
 * from the second ring onward. We also send on the iframe's own `load` event,
 * because `ready` fires once synchronously in page script and is not replayed
 * for a listener that attached late.
 *
 * `revealed` exists because `postMessage` cannot beat first paint: the page
 * paints its own grey defaults before any message can land, which against a
 * themed frame reads as a flash of the wrong page. Callers keep the frame
 * hidden until this flips — and it flips on a deadline regardless, so a page
 * that never handshakes is still seen.
 */
export function useDoorbellTheme({ iframeRef, cameraUrl, css, layoutCss }: DoorbellThemeOptions): {
  revealed: boolean
} {
  const [sent, setSent] = useState(false)
  const doorbellOrigin = useMemo(() => originOf(cameraUrl), [cameraUrl])

  // Held in a ref so the message listener doesn't have to be torn down and
  // rebuilt every time a theme edit changes the payload — the listener reads
  // whatever is current at the moment a `ready` arrives. Written in an effect
  // rather than during render: a `ready` can only arrive after mount, so the
  // effect always lands first.
  const payloadRef = useRef({ css, layoutCss })
  useEffect(() => {
    payloadRef.current = { css, layoutCss }
  }, [css, layoutCss])

  const send = useCallback(
    (contract: number | undefined, targetOrigin: string) => {
      const frame = iframeRef.current?.contentWindow
      if (!frame) return

      const { css, layoutCss } = payloadRef.current
      const known = contract === undefined || contract === KNOWN_CONTRACT
      const payload = known && layoutCss ? `${css}\n\n${layoutCss}` : css

      frame.postMessage({ type: 'doorbell:style', css: payload }, targetOrigin)
      setSent(true)
    },
    [iframeRef],
  )

  useEffect(() => {
    // No URL to theme (or an unparseable one) — nothing to wait for, and
    // `revealed` already reads true below.
    if (!doorbellOrigin) return

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== doorbellOrigin) return
      if (event.data?.type !== 'doorbell:ready') return
      send(event.data.contract, doorbellOrigin)
    }

    window.addEventListener('message', onMessage)

    // Belt-and-braces for the startup race: if this listener attached after the
    // page's script already ran, `ready` is gone and only `load` is left.
    const frame = iframeRef.current
    const onLoad = () => send(undefined, doorbellOrigin)
    frame?.addEventListener('load', onLoad)

    const deadline = window.setTimeout(() => setSent(true), REVEAL_DEADLINE_MS)

    return () => {
      window.removeEventListener('message', onMessage)
      frame?.removeEventListener('load', onLoad)
      window.clearTimeout(deadline)
    }
  }, [doorbellOrigin, iframeRef, send])

  // Derived rather than stored: with no doorbell origin there is nothing to
  // hide the frame for, and setting that in an effect would flash a hidden
  // frame for one paint first.
  return { revealed: sent || !doorbellOrigin }
}
