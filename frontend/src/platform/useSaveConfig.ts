import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CONFIG_QUERY_KEY } from './useAllConfig'

/**
 * One `/api/config` write. `value: null` means *delete the key* — the config
 * table treats an absent key and an empty string differently (absent falls
 * back to the schema default; `''` is a real, empty value), so a form that
 * clears a field needs to say which one it means.
 */
export type ConfigWrite = { key: string; value: string | null }

async function writeOne({ key, value }: ConfigWrite): Promise<void> {
  const url = `/api/config/${encodeURIComponent(key)}`
  const resp =
    value === null
      ? await fetch(url, { method: 'DELETE' })
      : await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
  // Every caller of this mutation already has a "failed to save" branch. They
  // used to reach it only on a network error, because a bare `await fetch`
  // resolves happily on a 500 — so a rejected write reported "Saved!". The
  // status check is what makes those branches mean what they say.
  if (!resp.ok) {
    throw new Error(`config write failed: ${key} -> ${resp.status}`)
  }
}

/**
 * The single way the app writes `/api/config`, and the reason a saved setting
 * shows up at once instead of within a minute.
 *
 * Every screen that reads config now goes through `useAllConfig`, one shared
 * query. Writing was the other half: a save handler that `PUT`s a key and
 * says nothing leaves that query holding the old value until its next poll
 * tick, which is why changing the theme (or the grid size, or a calendar
 * selection) used to take up to 60 seconds to show. Invalidating
 * `CONFIG_QUERY_KEY` on success closes the loop immediately, on every
 * consumer at once.
 *
 * **Takes a batch, deliberately.** Most save handlers here write several keys
 * from one button — `SettingsAdmin` writes every changed field of an
 * integration, `SportsSettings` writes five. Invalidating per key would fire
 * one refetch of the whole config table per key for a single user action.
 * Passing the whole batch as one mutation keeps that at exactly one refetch,
 * no matter how many keys moved. A single write is just a batch of one, so
 * callers never need two shapes.
 *
 * The writes run in order rather than concurrently: with several keys landing
 * in one SQLite table, serial writes are the predictable ones, and the first
 * failure stops the rest instead of leaving a half-applied save whose
 * outcome depends on which requests happened to win.
 *
 * Nothing is invalidated on failure — the cache still matches the server,
 * because the write that would have changed it did not happen.
 */
export function useSaveConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (writes: ConfigWrite | ConfigWrite[]): Promise<void> => {
      for (const write of Array.isArray(writes) ? writes : [writes]) {
        await writeOne(write)
      }
    },
    onSuccess: () => {
      // Not returned: awaiting the refetch here would hold every handler's
      // "Saved!" back until a fresh copy of the whole config table landed.
      // The consumers update a tick later either way.
      void queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    },
  })
}
