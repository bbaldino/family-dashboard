/**
 * Shared return-shape contract for integration hooks that poll on an
 * interval and adapt a react-query `useQuery` result back to it:
 * `data` stays `null` (never react-query's `undefined`) until a fetch has
 * actually succeeded, `error` is a message string rather than an `Error`
 * object, and `refetch` resolves to `void`. `useCountdowns`,
 * `useGoogleCalendar`, `useMonthCalendar` and `useLunchMenu` all adapt to
 * this shape because their consumers depend on the `null`-before-success
 * distinction — see `useLunchMenu` for the fuller account of why it matters.
 */
export interface UsePollingResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  refetch: () => Promise<void>
}
