/**
 * The twelve custom properties `webrtc-doorbell.html` publishes, verbatim from
 * the contract table in that repo's `docs/theming.md`. A variable we leave out
 * isn't an error the page reports — it silently keeps that page's own default
 * (`#d0d0d0` and friends), so a partial map shows up as a stray patch of the
 * unthemed look rather than as a failure. `theming.test.ts` asserts every
 * builder covers the whole list for exactly that reason.
 */
export const DOORBELL_VARS = [
  '--doorbell-bg',
  '--doorbell-surface',
  '--doorbell-text',
  '--doorbell-text-muted',
  '--doorbell-accent',
  '--doorbell-accent-text',
  '--doorbell-danger',
  '--doorbell-success',
  '--doorbell-border',
  '--doorbell-font-body',
  '--doorbell-font-display',
  '--doorbell-font-mono',
] as const

/** Resolves one CSS custom property to its current value, or `''` if it isn't
 *  set. In the app this closes over `getComputedStyle`; tests pass a stub. */
export type CssVarResolver = (name: string) => string

/** The faces served from `public/fonts/`, latin subsets only. These ride in the
 *  payload as `@font-face` rules because the doorbell page is a different
 *  origin and inherits none of our `@fontsource` imports. Filenames are fixed
 *  rather than Vite-hashed for exactly this reason — a content hash would
 *  change the URL on every build and there's nobody on the other side to tell.
 *  Serving them cross-origin needs CORS headers; see the backend's static
 *  route. */
const FONT_FACES = [
  { family: 'Geist Variable', file: 'geist-latin-wght-normal.woff2', style: 'normal' },
  { family: 'Geist Mono Variable', file: 'geist-mono-latin-wght-normal.woff2', style: 'normal' },
  { family: 'Newsreader Variable', file: 'newsreader-latin-wght-normal.woff2', style: 'normal' },
  { family: 'Newsreader Variable', file: 'newsreader-latin-wght-italic.woff2', style: 'italic' },
] as const

export interface DoorbellCssOptions {
  vars: Record<string, string>
  /** Absolute origin the font files are served from — `window.location.origin`
   *  in the app. A relative URL in the payload would resolve against the
   *  *doorbell* page's origin and 404 into a fallback face, silently. */
  origin: string
  /** Per-embed layout rules, written against the containment tree. Optional:
   *  an embed that only recolours sends none. */
  layoutCss?: string
}

/** Assembles one `doorbell:style` payload: font faces, then the variables, then
 *  whatever layout the embed wants. Order matters only for readability — the
 *  page replaces the whole sheet on every message — but variables come before
 *  layout so layout rules can read them. */
export function buildDoorbellCss({ vars, origin, layoutCss }: DoorbellCssOptions): string {
  const faces = FONT_FACES.map(
    ({ family, file, style }) => `@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: 100 900;
  font-display: swap;
  src: url('${origin}/fonts/${file}') format('woff2');
}`,
  ).join('\n')

  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  return [faces, `:root {\n${declarations}\n}`, layoutCss ?? ''].filter(Boolean).join('\n\n')
}

/** Broadsheet's palette lives in `themes/broadsheet/broadsheet.css` as plain
 *  custom properties rather than in a `ThemeColors` object, so this reads them
 *  back off the document instead of restating the hexes — a second copy would
 *  drift the first time the theme is retuned.
 *
 *  The fallbacks are not a second copy of the palette: they're the doorbell
 *  page's *own* published defaults. If a property can't be resolved, handing
 *  back the value the page already has is the one answer guaranteed not to
 *  make things worse — and never an empty string, which would make the whole
 *  declaration a parse error and drop it silently. */
export function doorbellVarsForBroadsheet(resolve: CssVarResolver): Record<string, string> {
  const read = (name: string, fallback: string) => resolve(name).trim() || fallback

  const paper = read('--paper', '#d0d0d0')
  const ink = read('--ink', '#444')

  return {
    '--doorbell-bg': paper,
    // Broadsheet has no "card" surface — the look is ink on bare paper. The
    // sidebar takes a hair of ink mixed into the paper so it reads as a
    // distinct block without introducing a colour the theme doesn't own.
    '--doorbell-surface': `color-mix(in srgb, ${ink} 6%, ${paper})`,
    '--doorbell-text': ink,
    '--doorbell-text-muted': read('--ink-muted', '#555'),
    // Rust. The page uses accent for the quick-reply fill and the loading
    // spinner, but `BROADSHEET_LAYOUT` sets the replies as outlined paper
    // cards per the mock, so in practice this only reaches the spinner — which
    // sits on the near-black overlay and needs the spot colour to be visible
    // at all. Ink would disappear into it.
    '--doorbell-accent': read('--rust', '#3a7bd5'),
    '--doorbell-accent-text': paper,
    '--doorbell-danger': read('--rust', '#c0392b'),
    '--doorbell-success': read('--forest', '#27ae60'),
    '--doorbell-border': read('--rule-faint', 'rgba(0, 0, 0, 0.1)'),
    '--doorbell-font-body': read('--font-body', 'sans-serif'),
    '--doorbell-font-display': read('--font-display', 'sans-serif'),
    '--doorbell-font-mono': read('--font-mono', 'monospace'),
  }
}
