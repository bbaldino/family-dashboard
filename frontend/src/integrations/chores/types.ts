export interface Chore {
  id: number
  name: string
  description: string | null
  created_at: string
}

export interface ChoreAssignment {
  id: number
  chore_id: number
  chore_name: string
  child_name: string
  day_of_week: number
  completed: boolean
}
