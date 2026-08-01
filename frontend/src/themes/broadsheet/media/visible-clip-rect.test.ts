import { describe, expect, it, afterEach } from 'vitest'
import { visibleClipRect } from './visible-clip-rect'

function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...rect }) as DOMRect
}

describe('visibleClipRect', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when no ancestor clips (every ancestor is overflow: visible)', () => {
    document.body.innerHTML = '<div id="outer"><div id="inner"></div></div>'
    const inner = document.getElementById('inner')!
    expect(visibleClipRect(inner)).toBeNull()
  })

  it('returns the bounding rect of a single clipping ancestor', () => {
    document.body.innerHTML = '<div id="outer" style="overflow: hidden"><div id="inner"></div></div>'
    const outer = document.getElementById('outer')!
    const inner = document.getElementById('inner')!
    mockRect(outer, { top: 10, bottom: 200 })
    expect(visibleClipRect(inner)).toEqual({ top: 10, bottom: 200 })
  })

  it('intersects two nested clipping ancestors to the tighter of the two', () => {
    document.body.innerHTML =
      '<div id="page" style="overflow: hidden"><div id="column" style="overflow: hidden"><div id="inner"></div></div></div>'
    const page = document.getElementById('page')!
    const column = document.getElementById('column')!
    const inner = document.getElementById('inner')!
    // The page (outer canvas) is taller than the column (a shelf body) —
    // the column's own bound is the one that actually clips.
    mockRect(page, { top: 0, bottom: 900 })
    mockRect(column, { top: 195, bottom: 836 })
    expect(visibleClipRect(inner)).toEqual({ top: 195, bottom: 836 })
  })

  it('ignores an ancestor with overflow: visible even if it sits between two clipping ancestors', () => {
    document.body.innerHTML =
      '<div id="page" style="overflow: hidden">' +
      '<div id="passthrough" style="overflow: visible">' +
      '<div id="column" style="overflow: hidden"><div id="inner"></div></div>' +
      '</div></div>'
    const page = document.getElementById('page')!
    const column = document.getElementById('column')!
    const inner = document.getElementById('inner')!
    mockRect(page, { top: 0, bottom: 900 })
    mockRect(column, { top: 195, bottom: 836 })
    expect(visibleClipRect(inner)).toEqual({ top: 195, bottom: 836 })
  })
})
