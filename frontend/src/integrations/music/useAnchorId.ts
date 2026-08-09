import { useIntegrationConfig } from '@/platform'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import { musicAnchorFixtureFor } from './fixtures'

/**
 * The anchor player id — the panel's own room, `music.default_player` from
 * config — for every surface that needs it: `MusicProvider`'s queue
 * derivation and `useRoomPills`' pill row.
 *
 * One hook rather than the same three lines in both, because the scenario
 * half is easy to get subtly wrong: `useIntegrationConfig` always hits the
 * real, live `/api/config` (the `?scenario=` mechanism short-circuits the
 * music *hooks*, not that fetch), so under a scenario the config value is
 * still the household's real Sonos id, which no `fixture-*` player id can
 * ever match. `useRoomPills` shipped that defect once — every room pill
 * silently disappeared under every scenario — and the same mismatch would
 * now blank the Media screen entirely, since the anchor's queue is the only
 * queue the provider will show.
 *
 * With no scenario active `musicAnchorFixtureFor` returns `undefined` and
 * the config value is used exactly as before. A scenario that defines a
 * `null` anchor (`empty`) means it genuinely has no anchor, which is why
 * this tests for `undefined` rather than falsiness.
 */
export function useAnchorId(): string | null {
  const config = useIntegrationConfig(musicIntegration)
  const fixtureAnchorId = musicAnchorFixtureFor(activeScenario)
  return fixtureAnchorId !== undefined ? fixtureAnchorId : (config?.default_player ?? null)
}
