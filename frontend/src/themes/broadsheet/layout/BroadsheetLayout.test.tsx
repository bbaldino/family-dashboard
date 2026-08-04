import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BroadsheetLayout } from './BroadsheetLayout'
import { useMusic } from '@/data/music'

/** A stand-in screen that exercises useMusic() the way GlanceStrip does. */
function MusicProbe() {
  const { state } = useMusic()
  return <div data-testid="music-probe">{state.queues.length}</div>
}

describe('BroadsheetLayout', () => {
  beforeEach(() => {
    // Deliberately NOT mocking @/data/music — this test exists to prove the
    // real MusicProvider is mounted. MusicProvider's useIntegrationConfig
    // hits `/api/config` through the shared react-query config query, and
    // jsdom doesn't provide a global fetch, so stub it. An empty config
    // means the music integration reads as unconfigured, so MusicProvider
    // takes its early-return branch and never opens an EventSource — no
    // need to stub that too.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    )
  })

  it('mounts MusicProvider so a screen calling useMusic() does not crash', () => {
    // Regression test for the Task 11 hardware finding: GlanceStrip (part
    // of Home, broadsheet's only screen so far) calls useMusic(). Grid gets
    // MusicProvider from its own AppShell; broadsheet must supply its own
    // in BroadsheetLayout or every real render throws "useMusic must be
    // used within MusicProvider" the instant it hits hardware — a failure
    // no existing test caught because Home.test.tsx and GlanceStrip.test.tsx
    // both mock @/data/music wholesale.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    expect(() =>
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Routes>
              <Route element={<BroadsheetLayout />}>
                <Route index element={<MusicProbe />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    ).not.toThrow()
    expect(screen.getByTestId('music-probe')).toBeInTheDocument()
  })
})
