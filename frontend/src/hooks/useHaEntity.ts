import { useEntity } from '@hakit/core'

// HAKit's useEntity requires a specific entity ID type generated from a HA instance.
// We cast to any since we don't have type generation set up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useHaEntity(entityId: string): any {
  return useEntity(entityId as any)
}
