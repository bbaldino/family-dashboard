/**
 * The line of prose to show for one of the sports AI endpoints — the pregame
 * preview or the post-game recap — given the react-query result behind it.
 *
 * **Three states, not two.** An empty summary on a *settled* query is a
 * failure, not a pending one: treating it as pending leaves "Generating…" on
 * the wall permanently, with nothing further coming to replace it.
 *
 * **It says something on failure** rather than rendering nothing, which is
 * what the grid theme's `AiFinalRecap` does. `OffdayBlock`'s own comment
 * records why: ESPN refused this app's requests for weeks while the column
 * reported a plausible off-day — "the failure was invisible precisely because
 * its empty state was plausible." Prose that silently never arrives is that
 * same trap.
 *
 * Shared by both blocks rather than written out twice. The subtle part is the
 * empty-summary rule, and one copy of it is one place to get it right.
 */
export function aiSummaryText(
  query: { data?: { summary: string }; isLoading: boolean; error: unknown },
  labels: { pending: string; unavailable: string },
): string {
  if (query.isLoading) return labels.pending
  if (query.error || !query.data?.summary) return labels.unavailable
  return query.data.summary
}
