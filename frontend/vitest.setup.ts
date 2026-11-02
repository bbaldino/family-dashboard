import '@testing-library/jest-dom/vitest'

// jsdom implements no layout, so it leaves out `Element.scrollTo`. Components
// that scroll themselves (`TodayDocket`) still need the call to exist; tests
// that care where it lands replace it with their own.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (this: Element, ...args: unknown[]) {
    const options = args[0]
    if (typeof options === 'object' && options !== null) {
      this.scrollTop = (options as ScrollToOptions).top ?? this.scrollTop
    }
  } as Element['scrollTo']
}
