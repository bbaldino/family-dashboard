import { describe, it, expect } from 'vitest'
import { doorbellVarsForBroadsheet, buildDoorbellCss, DOORBELL_VARS } from './theming'

describe('doorbellVarsForBroadsheet', () => {
  /** Broadsheet's palette lives in `broadsheet.css`, not in a JS object, so
   *  the map reads it back through a resolver rather than duplicating the
   *  hexes here — a second copy would drift the first time the theme is
   *  retuned. */
  const stub = (vars: Record<string, string>) => (name: string) => vars[name] ?? ''

  it("reads broadsheet's paper as the doorbell page background", () => {
    const vars = doorbellVarsForBroadsheet(stub({ '--paper': '#f6f1e7' }))

    expect(vars['--doorbell-bg']).toBe('#f6f1e7')
  })

  it('emits every variable in the contract', () => {
    const vars = doorbellVarsForBroadsheet(stub({}))

    expect(Object.keys(vars).sort()).toEqual([...DOORBELL_VARS].sort())
  })

  /** An unresolved custom property comes back as the empty string, and
   *  `--doorbell-bg: ;` is a parse error that drops the whole declaration —
   *  the page would keep its grey. Never send an empty value. */
  it('never emits an empty value when a custom property is unresolvable', () => {
    const vars = doorbellVarsForBroadsheet(stub({}))

    for (const [name, value] of Object.entries(vars)) {
      expect(value, `${name} resolved to an empty value`).not.toBe('')
    }
  })
})

describe('buildDoorbellCss', () => {
  const vars = { '--doorbell-bg': '#f6f1e7', '--doorbell-text': '#191512' }

  it('declares the variables on :root', () => {
    const css = buildDoorbellCss({ vars, origin: 'https://dashboard.baldino.me' })

    expect(css).toMatch(/:root\s*\{[^}]*--doorbell-bg:\s*#f6f1e7/)
    expect(css).toContain('--doorbell-text: #191512')
  })

  /** The payload is parsed by the *doorbell* page, so a relative `/fonts/...`
   *  URL resolves against cast.baldino.me — not us — and 404s silently into a
   *  fallback face. Every font URL has to carry our origin. */
  it('makes font URLs absolute against our own origin', () => {
    const css = buildDoorbellCss({ vars, origin: 'https://dashboard.baldino.me' })

    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''))

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url, 'font URL is not absolute').toMatch(/^https:\/\/dashboard\.baldino\.me\//)
    }
  })

  it('appends the embed-specific layout CSS after the variables', () => {
    const css = buildDoorbellCss({
      vars,
      origin: 'https://dashboard.baldino.me',
      layoutCss: '[data-doorbell="layout"]{flex-direction:column}',
    })

    expect(css.indexOf('flex-direction:column')).toBeGreaterThan(css.indexOf('--doorbell-bg'))
  })
})
