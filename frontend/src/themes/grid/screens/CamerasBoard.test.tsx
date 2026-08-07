import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CamerasBoard } from './CamerasBoard'
import { CONFIG_QUERY_KEY } from '@/platform'
import { doorbellIntegration } from '@/integrations/doorbell'

const DEFAULT_URL = doorbellIntegration.schema.parse({}).camera_url

function stubConfig(config: Record<string, string>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderBoard(client: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<CamerasBoard />, { wrapper })
}

function frameSrc() {
  return document.querySelector('iframe')?.getAttribute('src')
}

describe('CamerasBoard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the configured camera page', async () => {
    stubConfig({ 'doorbell.camera_url': 'https://cam.test/front' })
    renderBoard(newClient())

    await waitFor(() => expect(frameSrc()).toBe('https://cam.test/front'))
  })

  it('falls back to the schema default when no url is stored', async () => {
    stubConfig({})
    renderBoard(newClient())

    await waitFor(() => expect(frameSrc()).toBe(DEFAULT_URL))
  })

  it('asks for the camera url to be configured when it is blanked out', async () => {
    stubConfig({ 'doorbell.camera_url': '' })
    renderBoard(newClient())

    await waitFor(() => expect(screen.getByText(/Configure camera URL/i)).toBeInTheDocument())
  })

  it('picks up a camera url change with no remount', async () => {
    const fetchMock = stubConfig({ 'doorbell.camera_url': 'https://cam.test/old' })
    const client = newClient()
    renderBoard(client)
    await waitFor(() => expect(frameSrc()).toBe('https://cam.test/old'))

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 'doorbell.camera_url': 'https://cam.test/new' }),
    })
    await act(async () => {
      await client.invalidateQueries({ queryKey: CONFIG_QUERY_KEY })
    })

    await waitFor(() => expect(frameSrc()).toBe('https://cam.test/new'))
  })

  // The keys the admin form writes alongside this one, as the config table
  // holds them — all strings. They used to make scoped parsing fail outright
  // (see `integrations/doorbell/config.test.ts`); the schema coerces them now,
  // and reading the one key it needs off the raw query keeps this screen
  // independent of the rest of the integration's config either way.
  it('still finds the camera url when other doorbell keys are stored as strings', async () => {
    stubConfig({
      'doorbell.camera_url': 'https://cam.test/front',
      'doorbell.auto_dismiss_seconds': '45',
      'doorbell.chime_enabled': 'false',
    })
    renderBoard(newClient())

    await waitFor(() => expect(frameSrc()).toBe('https://cam.test/front'))
  })
})
