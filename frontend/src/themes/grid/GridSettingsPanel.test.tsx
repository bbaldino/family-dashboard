import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GridSettingsPanel } from './GridSettingsPanel'
import { gridSettingsFields } from './settingsFields'

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
})
