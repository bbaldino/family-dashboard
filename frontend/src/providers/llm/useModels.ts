import { useQuery } from '@tanstack/react-query'

interface ModelsResponse {
  models: { name: string }[]
}

/**
 * The models the configured LLM service reports, for the settings pickers.
 *
 * Lives here for the same reason `generate` does: the LLM routes belong to
 * this provider, so nothing outside it composes an `/api/llm/…` URL. The
 * admin `ModelSelect` used to `fetch('/api/llm/models')` itself, which meant
 * every instance on a settings page ran its own request; one query key now
 * dedupes them.
 *
 * Raw `fetch` rather than `llmProvider.api.get`, matching `generate`: the
 * error text is rendered verbatim ("Could not load models: HTTP 500"), and
 * `api`'s error path reports a body-supplied message or a bare status instead.
 */
export function useModels() {
  return useQuery({
    queryKey: ['llm', 'models'],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch('/api/llm/models')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ModelsResponse
      return data.models.map((m) => m.name)
    },
  })
}
