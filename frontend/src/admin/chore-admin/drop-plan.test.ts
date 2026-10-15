import { describe, expect, it } from 'vitest'
import type { AssignmentResponse, Chore } from '@/integrations/chores'
import { cellId, parseCellId, planDrop } from './drop-plan'

const chore: Chore = {
  id: 100,
  name: 'Dishes',
  description: null,
  chore_type: 'regular',
  tags: [],
  pick_from_tags: [],
}

const assignment: AssignmentResponse = {
  id: 10,
  chore: { id: 100, name: 'Dishes', chore_type: 'regular', tags: [] },
  person: { id: 1, name: 'Ben', color: '#000', avatar: null },
  week_of: '2026-10-12',
  day_of_week: 1,
  picked_chore: null,
  completed: true,
}

const WEEK = '2026-10-12'

describe('cell ids', () => {
  it('round-trip a person and a day', () => {
    expect(parseCellId(cellId(12, 6))).toEqual({ personId: 12, dayOfWeek: 6 })
  })

  it('reject anything that is not a cell', () => {
    expect(parseCellId('pool')).toBeNull()
    expect(parseCellId('3-x')).toBeNull()
    expect(parseCellId('3-7')).toBeNull()
  })
})

describe('planDrop', () => {
  it('creates an assignment when a pool chore lands on a cell', () => {
    expect(planDrop({ kind: 'chore', chore }, cellId(2, 3), WEEK)).toEqual({
      kind: 'create',
      body: { chore_id: 100, person_id: 2, week_of: WEEK, day_of_week: 3 },
    })
  })

  it('moves an assignment dropped on another day of the same row', () => {
    expect(planDrop({ kind: 'assignment', assignment }, cellId(1, 4), WEEK)).toEqual({
      kind: 'move',
      move: { id: 10, week_of: WEEK, person_id: 1, day_of_week: 4 },
    })
  })

  it("moves it to another person when dropped on that person's row", () => {
    expect(planDrop({ kind: 'assignment', assignment }, cellId(2, 1), WEEK)).toEqual({
      kind: 'move',
      move: { id: 10, week_of: WEEK, person_id: 2, day_of_week: 1 },
    })
  })

  it('does nothing when an assignment is dropped back on its own cell', () => {
    expect(planDrop({ kind: 'assignment', assignment }, cellId(1, 1), WEEK)).toBeNull()
  })

  it('moves within the assignment’s own week, whatever week is passed', () => {
    // The tab only ever shows one week, but the move's cache key must be the
    // week the row is actually in.
    expect(planDrop({ kind: 'assignment', assignment }, cellId(1, 5), '2026-10-19')).toEqual({
      kind: 'move',
      move: { id: 10, week_of: '2026-10-12', person_id: 1, day_of_week: 5 },
    })
  })

  it('does nothing when dropped outside the grid or with no payload', () => {
    expect(planDrop({ kind: 'chore', chore }, null, WEEK)).toBeNull()
    expect(planDrop({ kind: 'assignment', assignment }, 'pool', WEEK)).toBeNull()
    expect(planDrop(undefined, cellId(1, 2), WEEK)).toBeNull()
  })
})
