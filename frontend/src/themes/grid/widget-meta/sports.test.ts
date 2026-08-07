import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { GamesResponse } from '@/integrations/sports'
import { useSportsWidgetMeta } from './sports'

const useSportsGames = vi.hoisted(() => vi.fn<() => { data: GamesResponse | undefined }>())

vi.mock('@/integrations/sports', async () => {
  const actual =
    await vi.importActual<typeof import('@/integrations/sports')>('@/integrations/sports')
  return { ...actual, useSportsGames }
})

beforeEach(() => {
  useSportsGames.mockReset()
})

describe('useSportsWidgetMeta', () => {
  it('keeps the widget on the board when a league is unreachable', () => {
    // Otherwise the outage is doubly silent: the widget that would report it
    // is the one that disappears.
    useSportsGames.mockReturnValue({
      data: { games: [], hasLive: false, unavailableLeagues: ['mlb'] },
    })

    const { result } = renderHook(() => useSportsWidgetMeta())

    expect(result.current.visible).toBe(true)
  })

  it('hides the widget on a genuinely empty day', () => {
    useSportsGames.mockReturnValue({ data: { games: [], hasLive: false, unavailableLeagues: [] } })

    const { result } = renderHook(() => useSportsWidgetMeta())

    expect(result.current.visible).toBe(false)
  })
})
