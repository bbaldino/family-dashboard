import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DoorbellRingListener } from './DoorbellRingListener'
import { CONFIG_QUERY_KEY } from '@/platform'

const haEntitySpy = vi.fn()

vi.mock('@/hooks/useHaEntity', () => ({
  useHaEntity: (entityId: string) => {
    haEntitySpy(entityId)
    return undefined
  },
}))

vi.mock('./DoorbellRingModal', () => ({
  DoorbellRingModal: ({ isOpen, cameraUrl }: { isOpen: boolean; cameraUrl: string | null }) => (
    <div data-testid="ring-modal" data-open={String(isOpen)} data-camera={cameraUrl ?? ''} />
  ),
}))

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderListener(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<DoorbellRingListener />, { wrapper })
}

/** Every entity id the listener has subscribed to so far. */
function watchedEntities() {
  return haEntitySpy.mock.calls.map(([id]) => id)
}

describe('DoorbellRingListener', () => {
  beforeEach(() => haEntitySpy.mockClear())
  afterEach(() => vi.unstubAllGlobals())

  it('watches the configured press sensor', async () => {
    stubConfig({ 'doorbell.press_sensor_entity': 'binary_sensor.side_door' })
    renderListener(newClient())

    await waitFor(() => expect(watchedEntities()).toContain('binary_sensor.side_door'))
  })

  it('picks up a press sensor change with no remount', async () => {
    const fetchMock = stubConfig({ 'doorbell.press_sensor_entity': 'binary_sensor.old' })
    const client = newClient()
    renderListener(client)
    await waitFor(() => expect(watchedEntities()).toContain('binary_sensor.old'))

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'doorbell.press_sensor_entity': 'binary_sensor.new' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    await waitFor(() => expect(watchedEntities()).toContain('binary_sensor.new'))
  })

  // The config table stores everything as a string, and the admin form
  // writes `auto_dismiss_seconds` and `chime_enabled` as "45"/"false" — the
  // reason this reads the raw query and coerces here rather than leaning on
  // the doorbell schema, which types them as number and boolean and so fails
  // to parse them at all. If that ever regressed, the listener would render
  // nothing and the doorbell would stop popping up entirely.
  it('stays active when the numeric and boolean keys are stored as strings', async () => {
    stubConfig({
      'doorbell.press_sensor_entity': 'binary_sensor.side_door',
      'doorbell.camera_url': 'https://cam.test/front',
      'doorbell.auto_dismiss_seconds': '45',
      'doorbell.chime_enabled': 'false',
    })
    renderListener(newClient())

    await waitFor(() => expect(screen.getByTestId('ring-modal')).toBeInTheDocument())
    expect(screen.getByTestId('ring-modal')).toHaveAttribute(
      'data-camera',
      'https://cam.test/front',
    )
    expect(watchedEntities()).toContain('binary_sensor.side_door')
  })

  it('shares the one /api/config request rather than fetching its own', async () => {
    const fetchMock = stubConfig({ 'doorbell.press_sensor_entity': 'binary_sensor.side_door' })
    const client = newClient()
    renderListener(client)
    renderListener(client)

    await waitFor(() => expect(screen.getAllByTestId('ring-modal')).toHaveLength(2))
    const configCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/api/config')
    expect(configCalls).toHaveLength(1)
  })
})
