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
