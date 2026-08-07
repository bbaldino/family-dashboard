import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimerBanner } from './TimerBanner'
import { CONFIG_QUERY_KEY } from '@/platform'

/**
 * The banner has no config of its own to show — what it reads is the
 * service `useTimers` should talk to. So these assert on the arguments it
 * hands that hook, which is the only observable effect of the config read.
 */
const useTimersSpy = vi.fn()

vi.mock('@/integrations/timers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/timers')>()
  return {
    ...actual,
    useTimers: (serviceUrl?: string, alarmSoundId?: string) => {
      useTimersSpy(serviceUrl, alarmSoundId)
      return {
        timers: [],
        firedTimers: [],
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        dismiss: vi.fn(),
      }
    },
  }
})

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderBanner(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<TimerBanner />, { wrapper })
}

/** The most recent `(serviceUrl, alarmSoundId)` pair the banner passed on. */
function lastArgs() {
  return useTimersSpy.mock.calls[useTimersSpy.mock.calls.length - 1]
}

describe('TimerBanner', () => {
  beforeEach(() => {
    useTimersSpy.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('points useTimers at the configured service and alarm sound', async () => {
    stubConfig({
      'timers.service_url': 'http://timers.test/timers',
      'timers.alarm_sound': 'gentle-chime',
    })
    renderBanner(newClient())

    await waitFor(() => expect(lastArgs()).toEqual(['http://timers.test/timers', 'gentle-chime']))
  })

  it('passes nothing when timers are not configured', async () => {
    stubConfig({})
    renderBanner(newClient())

    await waitFor(() => expect(useTimersSpy).toHaveBeenCalled())
    expect(lastArgs()).toEqual([undefined, undefined])
  })

  it('shares the one /api/config request rather than fetching its own', async () => {
    const fetchMock = stubConfig({ 'timers.service_url': 'http://timers.test/timers' })
    const client = newClient()
    renderBanner(client)
    renderBanner(client)

    await waitFor(() => expect(lastArgs()?.[0]).toBe('http://timers.test/timers'))
    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })

  it('picks up a service url change with no remount', async () => {
    const fetchMock = stubConfig({ 'timers.service_url': 'http://old.test/timers' })
    const client = newClient()
    renderBanner(client)
    await waitFor(() => expect(lastArgs()?.[0]).toBe('http://old.test/timers'))

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'timers.service_url': 'http://new.test/timers' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    await waitFor(() => expect(lastArgs()?.[0]).toBe('http://new.test/timers'))
  })
})
