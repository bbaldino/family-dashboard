import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverlayErrorBoundary } from './OverlayErrorBoundary'

function Boom(): never {
  throw new Error('overlay went south')
}

describe('OverlayErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <OverlayErrorBoundary>
        <div data-testid="ok">ok</div>
      </OverlayErrorBoundary>,
    )
    expect(screen.getByTestId('ok')).toBeInTheDocument()
  })

  it('renders nothing when a child throws (silent unmount)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <OverlayErrorBoundary>
        <Boom />
      </OverlayErrorBoundary>,
    )
    expect(container).toBeEmptyDOMElement()
    consoleSpy.mockRestore()
  })
})
