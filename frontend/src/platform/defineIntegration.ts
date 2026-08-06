import { z } from 'zod'

export interface FieldMeta {
  label: string
  type?: 'text' | 'secret' | 'boolean' | 'model-select'
  description?: string
}

export interface IntegrationDef<T extends z.ZodObject<z.ZodRawShape>> {
  id: string
  name: string
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
}

export interface IntegrationApi {
  get: <R>(path: string) => Promise<R>
  post: <R>(path: string, body: unknown) => Promise<R>
  put: <R>(path: string, body: unknown) => Promise<R>
  /**
   * The multipart siblings of `post`/`put`, for the endpoints that take a file.
   *
   * They exist because a client that cannot express the content types its own
   * integration needs is a client callers route around: chore-admin uploaded
   * avatars with a hand-written `fetch('/api/chores/people')` precisely
   * because `post` JSON-encodes, which quietly put a second, unprefixed path
   * back in the codebase.
   */
  postForm: <R>(path: string, body: FormData) => Promise<R>
  putForm: <R>(path: string, body: FormData) => Promise<R>
  del: (path: string) => Promise<void>
}

export interface Integration<T extends z.ZodObject<z.ZodRawShape>> extends IntegrationDef<T> {
  api: IntegrationApi
}

async function apiRequest<R>(baseUrl: string, path: string, options?: RequestInit): Promise<R> {
  const resp = await fetch(`${baseUrl}${path}`, options)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${resp.status}`)
  }
  if (resp.status === 204) return undefined as R
  const text = await resp.text()
  if (!text) return undefined as R
  return JSON.parse(text)
}

export function defineIntegration<T extends z.ZodObject<z.ZodRawShape>>(
  def: IntegrationDef<T>,
): Integration<T> {
  const baseUrl = `/api/${def.id}`
  return {
    ...def,
    api: {
      get: <R>(path: string) => apiRequest<R>(baseUrl, path),
      post: <R>(path: string, body: unknown) =>
        apiRequest<R>(baseUrl, path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      put: <R>(path: string, body: unknown) =>
        apiRequest<R>(baseUrl, path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      // No `Content-Type` header on either of these, deliberately. multipart
      // needs a boundary parameter alongside the type, and only the browser
      // knows the boundary it generated; setting the header by hand drops it
      // and the server has no way to split the parts.
      postForm: <R>(path: string, body: FormData) =>
        apiRequest<R>(baseUrl, path, { method: 'POST', body }),
      putForm: <R>(path: string, body: FormData) =>
        apiRequest<R>(baseUrl, path, { method: 'PUT', body }),
      del: (path: string) => apiRequest<void>(baseUrl, path, { method: 'DELETE' }),
    },
  }
}
