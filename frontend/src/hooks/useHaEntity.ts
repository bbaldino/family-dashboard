import { useEntity } from '@hakit/core'

export function useHaEntity(entityId: string) {
  return useEntity(entityId as any)
}
