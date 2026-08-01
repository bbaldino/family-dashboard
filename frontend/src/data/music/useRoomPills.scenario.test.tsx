import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Regression coverage for a defect a browser check caught that
 * `useRoomPills.test.tsx`'s mocked-id tests could not: under an active
 * `?scenario=`, `useIntegrationConfig` still hits the real, live
 * `/api/config` — the scenario mechanism only short-circuits the music
 * hooks' own query functions, not that fetch. So in a real browser under
 * `?scenario=packed`, `config.default_player` was the household's actual
 * Sonos id (`RINCON_…`), which no `fixture-*` player id in `fixtures.ts`
 * could ever match — `resolveAnchorAndRooms` correctly found no matching
 * player, and every room pill silently disappeared.
 *
 * Every other test file mocks `useIntegrationConfig` to *return* a
 * fixture-shaped id directly, which makes the id-agreement question
 * disappear rather than test it. This file instead mocks config to return
 * a value that looks like the real, unrelated Sonos id, activates a real
 * scenario via `@/data/scenario`, and leaves `usePlayers` completely real
 * (not mocked) — so it goes through the actual scenario short-circuit in
 * `usePlayers.ts`. If `useRoomPills` ever again preferred the config value
 * over the scenario's own anchor, this test fails the same way the pills
 * failed in the browser: an empty pill list.
 */
vi.mock('@/data/scenario', () => ({ activeScenario: 'packed' }))

const useIntegrationConfig = vi.hoisted(() => vi.fn())
vi.mock('@/data/use-integration-config', () => ({ useIntegrationConfig }))

const useGroupMutations = vi.hoisted(() => vi.fn())
vi.mock('./useGroupMutations', () => ({ useGroupMutations }))

import { useRoomPills } from './useRoomPills'
import { musicPlayersFixtureFor } from './fixtures'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useRoomPills under an active scenario, with a live config value that does not match any fixture player', () => {
  it('resolves pills from the scenario fixture anchor, not the mismatched real config id', async () => {
    useIntegrationConfig.mockReturnValue({ default_player: 'RINCON_B8E937A613DC01400' })
    useGroupMutations.mockReturnValue({
      pendingIds: new Set<string>(),
      pollingPaused: false,
      addToGroup: vi.fn(),
      removeFromGroup: vi.fn(),
    })

    const { result } = renderHook(() => useRoomPills(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.pills.length).toBeGreaterThan(0))

    const fixturePlayerIds = musicPlayersFixtureFor('packed')!.map((p) => p.player_id)
    const anchorPill = result.current.pills.find((p) => p.isAnchor)
    expect(anchorPill).toBeDefined()
    // The resolved anchor must be a player the scenario's own fixture
    // actually contains — never the id `useIntegrationConfig` reported.
    expect(fixturePlayerIds).toContain(anchorPill!.player.playerId)
    expect(anchorPill!.player.playerId).not.toBe('RINCON_B8E937A613DC01400')
    expect(anchorPill!.player.displayName).toBe('Kitchen')

    // And the full expected shape is there too — a joinable room, an
    // already-joined room, and the ungroupable room excluded.
    const byName = Object.fromEntries(result.current.pills.map((p) => [p.player.displayName, p]))
    expect(byName['Living Room'].joined).toBe(false)
    expect(byName['Bedroom'].joined).toBe(true)
    expect(byName['Office Display']).toBeUndefined()
  })
})
