import { useEntity } from '@hakit/core'

// HAKit's useEntity requires a specific entity ID type generated from a HA instance.
// We cast to any since we don't have type generation set up.
//
// `returnNullIfNotFound` matters more than it looks: without it hakit *throws*
// `entity_not_found` for an unknown entity — which happens whenever HA is
// unreachable, still connecting, or someone renames an entity in the HA UI. A
// throw propagates out of the calling component, so anything mounted behind an
// error boundary (the doorbell ring overlay, for one) unmounts silently and
// nobody finds out until it's needed. Callers already read `.state` off a
// possibly-absent entity defensively; this is what makes that defence
// reachable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useHaEntity(entityId: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useEntity(entityId as any, { returnNullIfNotFound: true })
}
