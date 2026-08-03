import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

/** Stands in for hakit's `useEntity`, which throws `entity_not_found` for an
 *  unknown entity unless `returnNullIfNotFound` is set. Reproducing the throw
 *  is the point: asserting we merely *pass* the option would still pass if the
 *  option were renamed upstream. */
const useEntity = vi.hoisted(() =>
  vi.fn((id: string, options?: { returnNullIfNotFound?: boolean }) => {
    if (id === 'binary_sensor.missing') {
      if (options?.returnNullIfNotFound) return null
      throw new Error(`entity_not_found - "${id}"`)
    }
    return { state: 'on' }
  }),
)
vi.mock('@hakit/core', () => ({ useEntity }))

import { useHaEntity } from './useHaEntity'

describe('useHaEntity', () => {
  it('returns the entity when it exists', () => {
    const { result } = renderHook(() => useHaEntity('binary_sensor.present'))

    expect(result.current.state).toBe('on')
  })

  /** Home Assistant goes unreachable, or someone renames an entity in the HA
   *  UI. A throw here propagates out of whatever component called it — for the
   *  doorbell overlay that means the error boundary silently unmounts the whole
   *  ring feature, and nobody finds out until a visitor goes unannounced. */
  it('returns null instead of throwing when the entity is missing', () => {
    const { result } = renderHook(() => useHaEntity('binary_sensor.missing'))

    expect(result.current).toBeNull()
  })
})
