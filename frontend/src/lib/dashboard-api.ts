class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch(`/api${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'Request failed' }))
    throw new ApiError(response.status, body.error || 'Request failed')
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// --- Interfaces matching backend models ---

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

export interface LunchDay {
  day: string
  items: string[]
}

export interface LunchMenu {
  week_of: string
  days: LunchDay[]
}

export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  location?: string
}

// --- Typed API objects ---

export const choresApi = {
  list: () => request<Chore[]>('/chores'),
  create: (data: { name: string; description?: string }) =>
    request<Chore>('/chores', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name?: string; description?: string }) =>
    request<Chore>(`/chores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    request<void>(`/chores/${id}`, { method: 'DELETE' }),
  getAssignments: (date: string) =>
    request<ChoreAssignment[]>(`/chores/assignments?date=${date}`),
  setAssignments: (
    choreId: number,
    assignments: { child_name: string; day_of_week: number }[],
  ) =>
    request(`/chores/${choreId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),
  completeAssignment: (assignmentId: number, date: string) =>
    request(`/chores/assignments/${assignmentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
}

export const lunchMenuApi = {
  get: (week: string) => request<LunchMenu>(`/lunch-menu?week=${week}`),
  upsert: (week: string, data: { days: LunchDay[] }) =>
    request<LunchMenu>(`/lunch-menu/${week}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

export const googleCalendarApi = {
  listCalendars: () => request<CalendarListEntry[]>('/google/calendars'),
  listEvents: (calendar: string, start: string, end: string) =>
    request<CalendarEvent[]>(
      `/google/events?calendar=${encodeURIComponent(calendar)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    ),
}
