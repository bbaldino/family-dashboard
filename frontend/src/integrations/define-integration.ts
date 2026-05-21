import { z } from 'zod'
import type { ComponentType } from 'react'

export interface FieldMeta {
  label: string
  type?: 'text' | 'secret' | 'boolean'
  description?: string
}

interface IntegrationDefBase<T extends z.ZodObject<z.ZodRawShape>> {
  id: string
  name: string
  schema: T
  fields: Record<keyof z.infer<T>, FieldMeta>
  settingsComponent?: ComponentType
}

export interface BackendIntegrationDef<T extends z.ZodObject<z.ZodRawShape>>
  extends IntegrationDefBase<T> {
  hasBackend?: true // default, can be omitted
}

export interface ClientIntegrationDef<T extends z.ZodObject<z.ZodRawShape>>
  extends IntegrationDefBase<T> {
  hasBackend: false
}

export type IntegrationDef<T extends z.ZodObject<z.ZodRawShape>> =
  | BackendIntegrationDef<T>
  | ClientIntegrationDef<T>

export interface IntegrationApi {
  get: <R>(path: string) => Promise<R>
  post: <R>(path: string, body: unknown) => Promise<R>
  put: <R>(path: string, body: unknown) => Promise<R>
  del: (path: string) => Promise<void>
}

export interface BackendIntegration<T extends z.ZodObject<z.ZodRawShape>>
  extends IntegrationDefBase<T> {
  api: IntegrationApi
}

export interface ClientIntegration<T extends z.ZodObject<z.ZodRawShape>>
  extends IntegrationDefBase<T> {
  api?: undefined
}

export type Integration<T extends z.ZodObject<z.ZodRawShape>> =
  | BackendIntegration<T>
  | ClientIntegration<T>

async function apiRequest<R>(
  baseUrl: string,
  path: string,
  options?: RequestInit,
): Promise<R> {
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

// Overloads for type-safe return
export function defineIntegration<T extends z.ZodObject<z.ZodRawShape>>(
  def: BackendIntegrationDef<T>,
): BackendIntegration<T>
export function defineIntegration<T extends z.ZodObject<z.ZodRawShape>>(
  def: ClientIntegrationDef<T>,
): ClientIntegration<T>
export function defineIntegration<T extends z.ZodObject<z.ZodRawShape>>(
  def: IntegrationDef<T>,
): Integration<T> {
  if (def.hasBackend === false) {
    return { ...def, api: undefined }
  }

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
