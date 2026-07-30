import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenErrorBoundary } from './ScreenErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

describe('ScreenErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ScreenErrorBoundary>
        <div>content</div>
      </ScreenErrorBoundary>,
    )
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders fallback UI when a child throws', () => {
    // Silence React's noisy error log for expected boundary catch
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ScreenErrorBoundary>
        <Boom />
      </ScreenErrorBoundary>,
    )
    expect(screen.getByText(/screen failed to load/i)).toBeInTheDocument()
    expect(screen.getByText(/kaboom/i)).toBeInTheDocument()
    consoleSpy.mockRestore()
  })
})
