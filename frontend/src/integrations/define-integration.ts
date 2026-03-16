import { z } from 'zod'
import type { ComponentType } from 'react'

export interface FieldMeta {
  label: string
  type?: 'text' | 'secret' | 'boolean'
  description?: string
}

export interface IntegrationDef<T extends z.ZodObject<z.ZodRawShape>> {
  id: string
  name: string
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
  settingsComponent?: ComponentType
}

export interface Integration<T extends z.ZodObject<z.ZodRawShape>> extends IntegrationDef<T> {
  api: {
    get: <R>(path: string) => Promise<R>
    post: <R>(path: string, body: unknown) => Promise<R>
    put: <R>(path: string, body: unknown) => Promise<R>
    del: (path: string) => Promise<void>
  }
}

async function apiRequest<R>(baseUrl: string, path: string, options?: RequestInit): Promise<R> {
  const resp = await fetch(`${baseUrl}${path}`, options)
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `${resp.status}`)
  }
  if (resp.status === 204) return undefined as R
  return resp.json()
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
      del: (path: string) =>
        apiRequest<void>(baseUrl, path, { method: 'DELETE' }),
    },
  }
}
