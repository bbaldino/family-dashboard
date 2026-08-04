import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'
import { useIntegrationConfig } from '@/data/use-integration-config'
import { CONFIG_QUERY_KEY } from './useAllConfig'

const alpha = defineIntegration({
  id: 'alpha',
  name: 'Alpha',
  schema: z.object({ token: z.string().optional() }),
  fields: { token: { label: 'Token' } },
})

function Consumer({ label }: { label: string }) {
  const config = useIntegrationConfig(alpha)
  return <div data-testid={label}>{config?.token ?? 'none'}</div>
}

function wrap(client: QueryClient, ui: ReactNode) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('useAllConfig', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ 'alpha.token': 'abc', 'beta.other': 'x' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches /api/config once no matter how many consumers there are', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrap(
      client,
      <>
        <Consumer label="one" />
        <Consumer label="two" />
        <Consumer label="three" />
      </>,
    )
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('abc'))
    expect(screen.getByTestId('three')).toHaveTextContent('abc')

    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/config'))
    expect(configCalls).toHaveLength(1)
  })

  it('gives each integration only its own prefix', async () => {
    // `alpha` declares an `other` field, and the config table contains
    // `beta.other`. If slicing were done by suffix rather than prefix — or not
    // at all — `other` would be populated from beta's row. It must not be.
    const alphaWithOther = defineIntegration({
      id: 'alpha',
      name: 'Alpha',
      schema: z.object({ token: z.string().optional(), other: z.string().optional() }),
      fields: { token: { label: 'Token' }, other: { label: 'Other' } },
    })
    function OtherConsumer() {
      const c = useIntegrationConfig(alphaWithOther)
      return (
        <div data-testid="scoped">
          {c?.token ?? 'no-token'}/{c?.other ?? 'no-other'}
        </div>
      )
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrap(client, <OtherConsumer />)
    await waitFor(() => expect(screen.getByTestId('scoped')).toHaveTextContent('abc/no-other'))
  })

  it('an invalidated query key refreshes every consumer without remounting', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrap(client, <Consumer label="one" />)
    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('abc'))

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ 'alpha.token': 'zzz' }) })
    await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })

    await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('zzz'))
  })

  // The tablet this app runs on is a wall-mounted kiosk: it never regains
  // window focus and never remounts, so nothing ever calls invalidateQueries
  // (none of the 10 config-writing save handlers do, nor could a direct
  // `curl` edit to /api/config/<key>). refetchInterval is what actually
  // closes the loop on a real device — this proves it does, with no
  // invalidation in sight.
  it('propagates a settings change to every consumer via the refetch interval, with no invalidation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      wrap(client, <Consumer label="one" />)
      await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('abc'))

      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ 'alpha.token': 'zzz' }) })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      await waitFor(() => expect(screen.getByTestId('one')).toHaveTextContent('zzz'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('names the integration and the failing field when config is invalid', async () => {
    const strict = defineIntegration({
      id: 'strict',
      name: 'Strict',
      schema: z.object({ port: z.string().regex(/^\d+$/, 'must be digits') }),
      fields: { port: { label: 'Port' } },
    })
    function StrictConsumer() {
      const c = useIntegrationConfig(strict)
      return <div data-testid="strict">{c ? 'ok' : 'null'}</div>
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ 'strict.port': 'banana' }) })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrap(client, <StrictConsumer />)

    // The consumer renders 'null' both before the fetch resolves and after a
    // failed parse, so asserting on text content alone would pass trivially
    // at the loading state, before the parse (and the log) ever runs. Wait
    // for the log too, so this actually observes the invalid-config path.
    await waitFor(() => {
      expect(screen.getByTestId('strict')).toHaveTextContent('null')
      expect(spy).toHaveBeenCalled()
    })
    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('strict')
    expect(logged).toContain('port')
    spy.mockRestore()
  })
})
