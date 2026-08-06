import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GridSettingsPanel } from './GridSettingsPanel'
import { gridSettingsFields, gridSettingsSchema } from './settings-declaration'

describe('GridSettingsPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders field labels from the settings declaration, not a hardcoded copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    const original = gridSettingsFields.columns.label
    gridSettingsFields.columns.label = 'Custom columns label'
    try {
      render(<GridSettingsPanel />)
      expect(await screen.findByText('Custom columns label')).toBeInTheDocument()
    } finally {
      gridSettingsFields.columns.label = original
    }
  })

  it('shows defaults sourced from the settings schema, not a hardcoded copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    const defaults = gridSettingsSchema.parse({})
    render(<GridSettingsPanel />)

    expect(await screen.findByDisplayValue(String(defaults.columns))).toBeInTheDocument()
    expect(screen.getByDisplayValue(String(defaults.rows))).toBeInTheDocument()
    expect(
      screen.getByText(`Number of columns in the widget grid (default: ${defaults.columns})`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`Number of rows in the widget grid (default: ${defaults.rows})`),
    ).toBeInTheDocument()
  })
})
