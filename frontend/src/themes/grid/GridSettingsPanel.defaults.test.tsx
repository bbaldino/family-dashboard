import { describe, expect, it, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { render, screen } from '@testing-library/react'
import { GridSettingsPanel } from './GridSettingsPanel'

// A schema whose defaults differ from the real one (8/6) so the assertion
// below can only pass if the panel actually reads its defaults off this
// mocked module at render time — a hardcoded literal in the component would
// still show 8, not 5, and the test would fail. `vi.mock` calls are hoisted
// above the import above, so `GridSettingsPanel` sees this module.
vi.mock('./settings-declaration', () => ({
  gridSettingsSchema: z.object({
    columns: z.coerce.number().int().min(1).max(24).default(5),
    rows: z.coerce.number().int().min(1).max(24).default(6),
    hidden: z.string().default(''),
  }),
  gridSettingsFields: {
    columns: { label: 'Grid columns' },
    rows: { label: 'Grid rows' },
    hidden: { label: 'Visible widgets' },
  },
}))

describe('GridSettingsPanel defaults', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows defaults sourced from the settings schema, not a hardcoded copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    render(<GridSettingsPanel />)

    expect(await screen.findByDisplayValue('5')).toBeInTheDocument()
    expect(
      screen.getByText('Number of columns in the widget grid (default: 5)'),
    ).toBeInTheDocument()
  })
})
