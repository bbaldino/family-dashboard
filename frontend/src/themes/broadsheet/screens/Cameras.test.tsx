import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Cameras } from './Cameras'

const useIntegrationConfig = vi.hoisted(() => vi.fn())
vi.mock('@/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform')>()),
  useIntegrationConfig,
}))

const DEFAULT_CAMERA_URL = 'https://cast.baldino.me/webrtc-doorbell.html'

describe('broadsheet Cameras (the Watch Room)', () => {
  beforeEach(() => {
    useIntegrationConfig.mockReset()
  })

  it('fills the design canvas exactly', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    const root = screen.getByTestId('broadsheet-cameras')
    expect(root.className).toContain('w-[1600px]')
    expect(root.className).toContain('h-full')
  })

  /**
   * The suite's masthead rule: the centre names or states the page, and no
   * ear is a second name. This screen previously carried "Section V / The
   * Watch Room" in the left ear and named the *camera* in the centre. With
   * one camera configured, that name never changed either.
   *
   * Both absences are asserted, because the positive alone would pass with
   * the retired labels still sitting beside it.
   */
  it('names the page in the centre, with no page-name ear', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cameras')
    expect(screen.queryByText('The Watch Room')).not.toBeInTheDocument()
    expect(screen.queryByText(/Section V/)).not.toBeInTheDocument()
  })

  it('prints the date once, in the centre kicker rather than twice', () => {
    // The right ear's clock used to repeat the date directly opposite it.
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    const dated = screen.getAllByText(/^[A-Z]{3}, [A-Z]{3} \d+$/)
    expect(dated).toHaveLength(1)
  })

  it('renders the configured camera URL in a framed iframe', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    const frame = screen.getByTitle('Front step camera') as HTMLIFrameElement
    expect(frame).toBeInTheDocument()
    expect(frame.src).toBe('https://example.com/cam')
    expect(frame.getAttribute('allow')).toBe('autoplay; camera; microphone')
    expect(screen.getByTestId('cameras-feed-frame')).toBeInTheDocument()
  })

  it('falls back to the schema default while config is loading or the fetch failed', () => {
    // useIntegrationConfig returns null both while the first fetch is still
    // in flight and when it fails outright — see that hook's own source.
    useIntegrationConfig.mockReturnValue(null)
    render(<Cameras />)
    const frame = screen.getByTitle('Front step camera') as HTMLIFrameElement
    expect(frame.src).toBe(`${DEFAULT_CAMERA_URL}`)
  })

  it('shows a written line instead of an empty frame when camera_url is blanked', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: '' })
    render(<Cameras />)
    expect(screen.queryByTestId('cameras-feed-frame')).not.toBeInTheDocument()
    expect(screen.getByText(/No picture from the front step/)).toBeInTheDocument()
    expect(screen.getByText(/Settings → Doorbell Camera/)).toBeInTheDocument()
  })

  it('shows the live clock in the masthead right cell', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    expect(screen.getByText('Now')).toBeInTheDocument()
  })

  /** Config resolves after first paint, so the frame mounts pointing at the
   *  schema default and only then switches to the household's real URL.
   *  Changing an iframe's `src` attribute in place does not reliably
   *  re-navigate a frame that is already loading — observed sticking on the
   *  default's origin — so the element has to be replaced, not edited. */
  it('remounts the frame when the configured URL changes', () => {
    useIntegrationConfig.mockReturnValue(null)
    const { rerender } = render(<Cameras />)
    const before = screen.getByTitle('Front step camera')

    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/other' })
    rerender(<Cameras />)
    const after = screen.getByTitle('Front step camera')

    expect(after.getAttribute('src')).toBe('https://example.com/other')
    expect(after).not.toBe(before)
  })
})
