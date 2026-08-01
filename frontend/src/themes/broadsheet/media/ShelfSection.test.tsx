import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShelfSection } from './ShelfSection'

describe('ShelfSection', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<ShelfSection title="Frequently played" items={[]} maxRows={2} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the kicker and the cards when items are present', () => {
    render(
      <ShelfSection
        title="Frequently played"
        items={[{ key: 'u1', name: 'Amber Hours', secondary: 'The Night Shift', imageUrl: null, onTap: () => {} }]}
        maxRows={2}
      />,
    )
    expect(screen.getByText('Frequently played')).toBeInTheDocument()
    expect(screen.getByText('Amber Hours')).toBeInTheDocument()
  })
})
