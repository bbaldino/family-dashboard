import type {
  AssignmentMove,
  AssignmentResponse,
  Chore,
  NewAssignment,
} from '@/integrations/chores'

/**
 * What a drop on the assignments grid means, kept out of the component so it
 * can be tested: @dnd-kit's pointer sensor needs a real drag, which jsdom
 * can't produce.
 */

/** What's being dragged: a chore from the pool, or an assignment already in a
 *  cell. Rides on the draggable's `data`. */
export type DragPayload =
  { kind: 'chore'; chore: Chore } | { kind: 'assignment'; assignment: AssignmentResponse }

export type DropPlan =
  { kind: 'create'; body: NewAssignment } | { kind: 'move'; move: AssignmentMove } | null

/** A grid cell's droppable id: one person's row on one day. */
export function cellId(personId: number, dayOfWeek: number): string {
  return `${personId}-${dayOfWeek}`
}

export function parseCellId(id: string): { personId: number; dayOfWeek: number } | null {
  const match = /^(\d+)-([0-6])$/.exec(id)
  return match ? { personId: Number(match[1]), dayOfWeek: Number(match[2]) } : null
}

/**
 * A pool chore dropped on a cell is a new assignment there. An assignment
 * dropped on another cell moves there — another day, and another person if the
 * cell is on their row — and dropped back on its own cell is nothing at all.
 */
export function planDrop(
  payload: DragPayload | undefined,
  overId: string | null,
  weekStr: string,
): DropPlan {
  const cell = overId == null ? null : parseCellId(overId)
  if (!payload || !cell) return null

  if (payload.kind === 'chore') {
    return {
      kind: 'create',
      body: {
        chore_id: payload.chore.id,
        person_id: cell.personId,
        week_of: weekStr,
        day_of_week: cell.dayOfWeek,
      },
    }
  }

  const { assignment } = payload
  if (assignment.person.id === cell.personId && assignment.day_of_week === cell.dayOfWeek) {
    return null
  }
  return {
    kind: 'move',
    move: {
      id: assignment.id,
      week_of: assignment.week_of,
      person_id: cell.personId,
      day_of_week: cell.dayOfWeek,
    },
  }
}
