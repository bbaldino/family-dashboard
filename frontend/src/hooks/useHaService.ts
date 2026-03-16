import { useHass } from '@hakit/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useHaService(): { callService: any } {
  const hass = useHass() as any
  return { callService: hass.callService }
}
