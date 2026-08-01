import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Cameras } from './Cameras'

const useIntegrationConfig = vi.hoisted(() => vi.fn())
vi.mock('@/data/use-integration-config', () => ({ useIntegrationConfig }))

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
    expect(root.className).toContain('h-[900px]')
  })

  it('renders the masthead title and centre numeral', () => {
    useIntegrationConfig.mockReturnValue({ camera_url: 'https://example.com/cam' })
    render(<Cameras />)
    expect(screen.getByText('The Watch Room')).toBeInTheDocument()
    expect(screen.getByText('The Front Step')).toBeInTheDocument()
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
})
