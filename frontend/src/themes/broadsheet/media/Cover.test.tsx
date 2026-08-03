import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Cover } from './Cover'

describe('Cover', () => {
  it('renders a real image when imageUrl is present', () => {
    // alt="" is intentional (decorative — the name is adjacent text), which
    // means the img has an accessible role of "presentation", not "img" —
    // query the DOM directly rather than by role.
    const { container } = render(
      <Cover imageUrl="https://example.com/art.jpg" name="Amber Hours" />,
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/art.jpg')
    expect(img).toHaveAttribute('alt', '')
  })

  it('falls back to the deterministic gradient with initials when imageUrl is null', () => {
    const { container } = render(<Cover imageUrl={null} name="Amber Hours" />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('AH')).toBeInTheDocument()
    const root = container.firstElementChild as HTMLElement
    expect(root.style.background).toContain('linear-gradient')
  })

  it('sizes the root element to the requested size', () => {
    const { container } = render(<Cover imageUrl={null} name="Black Steel" size={280} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.width).toBe('280px')
    expect(root.style.height).toBe('280px')
  })
})
