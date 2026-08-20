import { useQuery } from '@tanstack/react-query'

/**
 * The caas-generated "From the House" standfirst for a given facts block.
 *
 * The backend (`POST /api/house/standfirst`) caches the line keyed by a hash of
 * `facts`, so the same facts never regenerate; a changed facts block — a new
 * time-of-day, an event that has passed — is a new key and a fresh line. `null`
 * facts disables the query, and the caller falls back to the deterministic
 * `buildStandfirst` line whenever this isn't ready (loading, error, disabled),
 * so the standfirst is never blank.
 */
export function useHouseStandfirst(facts: string | null) {
  return useQuery({
    queryKey: ['house', 'standfirst', facts],
    enabled: !!facts,
    queryFn: async (): Promise<{ summary: string }> => {
      const res = await fetch('/api/house/standfirst', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ facts }),
      })
      if (!res.ok) throw new Error(`house standfirst: ${res.status}`)
      return res.json()
    },
    // The same facts always map to the same cached line — no reason to refetch.
    staleTime: Infinity,
    retry: 1,
  })
}
