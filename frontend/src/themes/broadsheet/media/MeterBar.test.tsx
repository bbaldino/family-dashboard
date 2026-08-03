import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MeterBar } from './MeterBar'

function parts(container: HTMLElement) {
  const track = container.firstElementChild as HTMLElement
  const fill = track.firstElementChild as HTMLElement
  return { track, fill }
}

describe('MeterBar', () => {
  it('sizes the fill to the percentage', () => {
    const { container } = render(<MeterBar percent={35} fill="var(--ink)" />)
    expect(parts(container).fill.style.width).toBe('35%')
  })

  it('anchors the fill on one edge only, so its width is not over-constrained', () => {
    // `inset: 0` sets both left and right, which makes the box
    // over-constrained and the width inert — every bar in this theme rendered
    // permanently full because of it. A width assertion alone would not have
    // caught that, since the width was set; it was simply ignored.
    const { fill } = parts(render(<MeterBar percent={10} fill="var(--ink)" />).container)
    expect(fill.style.left).toBe('0px')
    expect(fill.style.right).toBe('')
  })

  it('draws the unfilled track in a colour that actually differs from the fill', () => {
    // The theme's `--rule` is deliberately identical to `--ink`, so a bar
    // using it as a track had a black fill on a black track: correct geometry,
    // nothing visible. The fill level has to be distinguishable.
    const { track, fill } = parts(render(<MeterBar percent={50} fill="var(--ink)" />).container)
    expect(track.style.background).toBe('var(--rule-faint)')
    expect(track.style.background).not.toBe(fill.style.background)
  })

  it('clamps out-of-range and non-finite percentages', () => {
    expect(
      parts(render(<MeterBar percent={140} fill="var(--rust)" />).container).fill.style.width,
    ).toBe('100%')
    expect(
      parts(render(<MeterBar percent={-5} fill="var(--rust)" />).container).fill.style.width,
    ).toBe('0%')
    expect(
      parts(render(<MeterBar percent={NaN} fill="var(--rust)" />).container).fill.style.width,
    ).toBe('0%')
  })

  it('passes a test id through for callers that need to find their own bar', () => {
    const { container } = render(
      <MeterBar percent={0} fill="var(--rust)" testId="centre-spread-progress-track" />,
    )
    expect(parts(container).track).toHaveAttribute('data-testid', 'centre-spread-progress-track')
  })
})
