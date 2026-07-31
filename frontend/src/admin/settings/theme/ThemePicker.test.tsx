import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import { registerTheme, _resetRegistry } from '@/shell/ThemeRegistry'
import type { ThemeModule } from '@/shell/types'

const stub = (id: string, name: string): ThemeModule => ({
  id,
  name,
  canvas: { model: 'fluid' },
  screens: { home: () => <div /> },
  overlays: [],
})

describe('ThemePicker', () => {
  beforeEach(() => {
    _resetRegistry()
    registerTheme(stub('grid', 'Cards Grid'))
    registerTheme(stub('broadsheet', 'Broadsheet'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetRegistry()
  })

  it('lists every registered theme by name', async () => {
    render(<ThemePicker />)
    await waitFor(() => expect(screen.getByText('Cards Grid')).toBeInTheDocument())
    expect(screen.getByText('Broadsheet')).toBeInTheDocument()
  })

  it('marks the configured theme as selected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 'theme.presentation': 'broadsheet' }),
      }),
    )
    render(<ThemePicker />)
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Broadsheet/ })).toBeChecked(),
    )
  })

  it('defaults to grid when no theme is configured', async () => {
    render(<ThemePicker />)
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Cards Grid/ })).toBeChecked(),
    )
  })

  it('persists the choice to theme.presentation', async () => {
    render(<ThemePicker />)
    await waitFor(() => expect(screen.getByText('Broadsheet')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio', { name: /Broadsheet/ }))

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/config/theme.presentation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'broadsheet' }),
      }),
    )
  })
})
