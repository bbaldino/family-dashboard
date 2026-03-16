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

export const configApi = {
  getAll: () => request<Record<string, string>>('/config'),
  get: (key: string) =>
    request<{ key: string; value: string }>(`/config/${encodeURIComponent(key)}`),
  set: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
}
