import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomeBoard } from './HomeBoard'
import { gridSettingsSchema } from '@/themes/grid/settings-declaration'

const smallMeta = {
  visible: true as const,
  priority: 1,
  sizePreference: { orientation: 'square' as const, relativeSize: 'small' as const },
}

vi.mock('@/integrations/google-calendar', () => ({
  useGoogleCalendar: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('@/integrations/weather', () => ({
  useHeroWeather: () => null,
}))
vi.mock('@/integrations/driving-time', () => ({
  useDrivingTime: () => ({}),
}))
vi.mock('@/themes/grid/widgets/timers/TimerBanner', () => ({
  TimerBanner: () => null,
}))
vi.mock('@/themes/grid/widgets/google-calendar/CalendarWidget', () => ({
  CalendarWidget: () => <div data-testid="widget-calendar" />,
}))
vi.mock('@/themes/grid/widgets/chores/ChoresWidget', () => ({
  ChoresWidget: () => <div data-testid="widget-chores" />,
}))
vi.mock('@/themes/grid/widgets/countdowns/CountdownsWidget', () => ({
  CountdownsWidget: () => <div data-testid="widget-countdowns" />,
}))
vi.mock('@/themes/grid/widgets/nutrislice/LunchMenuWidget', () => ({
  LunchMenuWidget: () => <div data-testid="widget-lunch" />,
}))
vi.mock('@/themes/grid/widgets/sports/SportsWidget', () => ({
  SportsWidget: () => <div data-testid="widget-sports" />,
}))
vi.mock('@/themes/grid/widgets/packages/PackagesWidget', () => ({
  PackagesWidget: () => <div data-testid="widget-packages" />,
}))
vi.mock('@/themes/grid/widgets/on-this-day/OnThisDayWidget', () => ({
  OnThisDayWidget: () => <div data-testid="widget-on-this-day" />,
}))
vi.mock('@/themes/grid/widgets/word-of-the-day/WordOfTheDayWidget', () => ({
  WordOfTheDayWidget: () => <div data-testid="widget-word-of-the-day" />,
}))
vi.mock('@/themes/grid/widget-meta/google-calendar', () => ({
  useCalendarWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/sports', () => ({
  useSportsWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/packages', () => ({
  usePackagesWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/chores', () => ({
  useChoresWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/countdowns', () => ({
  useCountdownsWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/nutrislice', () => ({
  useLunchWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/on-this-day', () => ({
  useOnThisDayWidgetMeta: () => smallMeta,
}))
vi.mock('@/themes/grid/widget-meta/word-of-the-day', () => ({
  useWordOfTheDayWidgetMeta: () => smallMeta,
}))

function seedConfig(config: Record<string, string>) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(config) }),
  )
}

function renderHomeBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(wrap(client, <HomeBoard />))
}

function wrap(client: QueryClient, ui: ReactNode) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

/** The `.grid` container `CellGridLayout` renders, whose inline style carries
 *  the live column/row count. */
function findGridContainer(): HTMLElement {
  const el = document.querySelector('.grid')
  if (!el) throw new Error('grid container not found')
  return el as HTMLElement
}

describe('HomeBoard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads grid dimensions from theme.grid config', async () => {
    seedConfig({ 'theme.grid.columns': '10', 'theme.grid.rows': '7' })
    renderHomeBoard()

    await waitFor(() => {
      const grid = findGridContainer()
      expect(grid.style.gridTemplateColumns).toBe('repeat(10, 1fr)')
      expect(grid.style.gridTemplateRows).toBe('repeat(7, 1fr)')
    })
  })

  it('falls back to the schema defaults when unset', async () => {
    seedConfig({})
    renderHomeBoard()

    const defaults = gridSettingsSchema.parse({})
    await waitFor(() => {
      const grid = findGridContainer()
      expect(grid.style.gridTemplateColumns).toBe(`repeat(${defaults.columns}, 1fr)`)
      expect(grid.style.gridTemplateRows).toBe(`repeat(${defaults.rows}, 1fr)`)
    })
  })

  it('hides a widget listed in theme.grid.hidden', async () => {
    seedConfig({ 'theme.grid.hidden': 'sports' })
    renderHomeBoard()

    await waitFor(() => expect(screen.getByTestId('widget-chores')).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByTestId('widget-sports')).not.toBeInTheDocument())
  })

  it('falls back only the invalid key, leaving the other valid keys intact', async () => {
    // columns=30 exceeds the schema's max(24) and must fall back to its own
    // default. It must not also wipe out the valid, unrelated rows and
    // hidden values that came along with it in the same config payload.
    seedConfig({
      'theme.grid.columns': '30',
      'theme.grid.rows': '7',
      'theme.grid.hidden': 'sports',
    })
    renderHomeBoard()

    const defaults = gridSettingsSchema.parse({})
    await waitFor(() => {
      const grid = findGridContainer()
      expect(grid.style.gridTemplateColumns).toBe(`repeat(${defaults.columns}, 1fr)`)
      expect(grid.style.gridTemplateRows).toBe('repeat(7, 1fr)')
    })
    await waitFor(() => expect(screen.getByTestId('widget-chores')).toBeInTheDocument())
    expect(screen.queryByTestId('widget-sports')).not.toBeInTheDocument()
  })
})
