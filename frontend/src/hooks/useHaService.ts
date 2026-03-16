import { useHass } from '@hakit/core'

export function useHaService() {
  const { callService } = useHass()
  return { callService }
}
