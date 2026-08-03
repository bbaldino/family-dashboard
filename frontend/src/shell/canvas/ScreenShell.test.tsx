import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenShell } from './ScreenShell'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
    writable: true,
  })
  window.dispatchEvent(new Event('resize'))
}

const canvas = {
  model: 'fixed-scale' as const,
  designWidth: 1600,
  designHeight: 900,
  minViewportWidth: 800,
}

describe('ScreenShell', () => {
  beforeEach(() => setViewport(1920, 1080))
  afterEach(() => setViewport(1024, 768))

  it('renders the design canvas at scale 1.2 on a 1920x1080 viewport', () => {
    render(
      <ScreenShell canvas={canvas}>
        <div data-testid="content">c</div>
      </ScreenShell>,
    )
    const stage = screen.getByTestId('theme-canvas')
    expect(stage.style.width).toBe('1600px')
    expect(stage.style.height).toBe('900px')
    expect(stage.style.transform).toContain('scale(1.2)')
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('scales to fit a 1440x900 laptop (0.9x)', () => {
    setViewport(1440, 900)
    render(
      <ScreenShell canvas={canvas}>
        <div>c</div>
      </ScreenShell>,
    )
    expect(screen.getByTestId('theme-canvas').style.transform).toContain('scale(0.9)')
  })

  it('renders SmallViewportFallback when viewport is narrower than minViewportWidth', () => {
    setViewport(700, 500)
    render(
      <ScreenShell canvas={canvas}>
        <div data-testid="content">c</div>
      </ScreenShell>,
    )
    expect(screen.queryByTestId('theme-canvas')).not.toBeInTheDocument()
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
    expect(screen.getByText(/screen too small/i)).toBeInTheDocument()
  })
})
