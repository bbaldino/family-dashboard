export interface PersonRef {
  id: number
  name: string
  color: string
  avatar: string | null
}

export interface ChoreRef {
  id: number
  name: string
  chore_type: 'regular' | 'meta'
  tags: string[]
}

export interface TodayAssignment {
  id: number
  chore: ChoreRef
  picked_chore: ChoreRef | null
  completed: boolean
}

export interface PersonAssignments {
  person: PersonRef
  assignments: TodayAssignment[]
}

export interface TodayResponse {
  persons: PersonAssignments[]
  completed_count: number
  total_count: number
}

// For admin pages
export interface Person {
  id: number
  name: string
  color: string
  avatar: string | null
}

export interface Chore {
  id: number
  name: string
  description: string | null
  chore_type: 'regular' | 'meta'
  tags: string[]
  pick_from_tags: string[]
}

export interface AssignmentResponse {
  id: number
  chore: ChoreRef
  person: PersonRef
  week_of: string
  day_of_week: number
  picked_chore: ChoreRef | null
  completed: boolean
}
