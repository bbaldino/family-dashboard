import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const useHaEntity = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useHaEntity', () => ({ useHaEntity }))

const play = vi.hoisted(() => vi.fn(() => ({ close: () => Promise.resolve() })))
vi.mock('@/lib/alarmSounds', () => ({ getAlarmById: () => ({ play }) }))

import { useDoorbellRing } from './useDoorbellRing'

const CONFIG = {
  press_sensor_entity: 'binary_sensor.visitor',
  screensaver_entity: 'switch.screensaver',
  auto_dismiss_seconds: 60,
  chime_enabled: true,
  chime_sound_id: 'soft-doorbell',
  camera_url: 'https://example.com/cam',
}

/** Drives the two entities the hook watches. `useHaEntity` is called with the
 *  press sensor first and the screensaver second, matching the hook's order. */
function setEntities(press: string | undefined, screensaver = 'off') {
  useHaEntity.mockImplementation((id: string) =>
    id === CONFIG.press_sensor_entity ? { state: press } : { state: screensaver },
  )
}

describe('useDoorbellRing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useHaEntity.mockReset()
    play.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('does not ring on the first observed state', () => {
    setEntities('on')
    const { result } = renderHook(() => useDoorbellRing(CONFIG))

    expect(result.current.isRinging).toBe(false)
  })

  it('rings on a rising edge', async () => {
    setEntities('off')
    const { result, rerender } = renderHook(() => useDoorbellRing(CONFIG))

    setEntities('on')
    rerender()

    await waitFor(() => expect(result.current.isRinging).toBe(true))
    expect(play).toHaveBeenCalledTimes(1)
  })

  /** Fully Kiosk's screensaver being on means nobody is looking at the
   *  dashboard — a popup would just burn in behind it. */
  it('stays shut when the screensaver is on', async () => {
    setEntities('off', 'on')
    const { result, rerender } = renderHook(() => useDoorbellRing(CONFIG))

    setEntities('on', 'on')
    rerender()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(result.current.isRinging).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })

  it('closes itself after the configured delay', async () => {
    setEntities('off')
    const { result, rerender } = renderHook(() =>
      useDoorbellRing({ ...CONFIG, auto_dismiss_seconds: 5 }),
    )

    setEntities('on')
    rerender()
    await waitFor(() => expect(result.current.isRinging).toBe(true))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(result.current.isRinging).toBe(false)
  })

  /** A second press while the popup is already up should buy more time, not
   *  stack another chime on top of the first. */
  it('extends the deadline on a re-press without replaying the chime', async () => {
    setEntities('off')
    const { result, rerender } = renderHook(() =>
      useDoorbellRing({ ...CONFIG, auto_dismiss_seconds: 5 }),
    )

    setEntities('on')
    rerender()
    await waitFor(() => expect(result.current.isRinging).toBe(true))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    setEntities('off')
    rerender()
    setEntities('on')
    rerender()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(result.current.isRinging).toBe(true)
    expect(play).toHaveBeenCalledTimes(1)
  })

  /** HA can be unreachable, or the entity renamed in the HA UI. `useEntity`
   *  throws in that case unless asked not to, and an overlay that throws takes
   *  the whole doorbell feature down silently behind the error boundary. */
  it('stays quiet and does not throw when the sensor is missing', async () => {
    useHaEntity.mockReturnValue(null)

    const { result } = renderHook(() => useDoorbellRing(CONFIG))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(result.current.isRinging).toBe(false)
  })

  it('closes when dismissed', async () => {
    setEntities('off')
    const { result, rerender } = renderHook(() => useDoorbellRing(CONFIG))

    setEntities('on')
    rerender()
    await waitFor(() => expect(result.current.isRinging).toBe(true))

    act(() => result.current.dismiss())

    expect(result.current.isRinging).toBe(false)
  })
})
