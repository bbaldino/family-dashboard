import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MastheadFrame } from './MastheadFrame'

/**
 * **What this file can and cannot prove.**
 *
 * The bug these tests guard is a layout one: without `min-width: 0`, a grid
 * item refuses to shrink below its own content, so a long centre title
 * ignored the frame's `1.5fr` and grew the column to fit. Measured in a real
 * browser with a 62-character track name, the columns resolved to
 * `86px / 1474px / 71px` instead of roughly `382 / 675 / 382`; the side cells
 * were crushed until their text wrapped, taking the masthead from 113px to
 * 306px tall and pushing the Close button off-screen.
 *
 * jsdom performs no layout, so **none of that is reproducible here** — every
 * width it reports is 0 and the grid is never resolved. Removing the fix
 * leaves the whole broadsheet suite green, which is why this file asserts the
 * *declaration* rather than its effect.
 *
 * That is a weaker test than this project usually accepts, and deliberately
 * so: it cannot tell you the layout is right, only that the property someone
 * might tidy away is still there. The real verification was a browser
 * measurement, recorded in `MastheadFrame.tsx`'s own comment.
 */
describe('MastheadFrame', () => {
  it('lets every cell shrink below its content, so a long title cannot grow its column', () => {
    render(<MastheadFrame left={<span>L</span>} center={<span>C</span>} right={<span>R</span>} />)

    const cells = [screen.getByText('L'), screen.getByText('C'), screen.getByText('R')].map(
      (el) => el.parentElement as HTMLElement,
    )

    expect(cells).toHaveLength(3)
    for (const cell of cells) {
      expect(cell.style.minWidth).toBe('0px')
    }
  })

  it('renders each slot into its own cell', () => {
    render(
      <MastheadFrame
        left={<span>Section IV</span>}
        center={<span>Title</span>}
        right={<span>Rooms</span>}
      />,
    )
    expect(screen.getByText('Section IV')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Rooms')).toBeInTheDocument()
  })

  it('renders the footer inside the ruled container, after the grid', () => {
    const { container } = render(
      <MastheadFrame
        left={<span>L</span>}
        center={<span>C</span>}
        right={<span>R</span>}
        footer={<span>High 24° Low 11°</span>}
      />,
    )
    const outer = container.firstElementChild as HTMLElement
    // Home puts its high/low line here precisely because it must sit outside
    // the `align-items: end` grid — see `Masthead.tsx`'s own comment.
    expect(outer.lastElementChild?.textContent).toBe('High 24° Low 11°')
    expect(screen.getByText('High 24° Low 11°').closest('.grid')).toBeNull()
  })
})
