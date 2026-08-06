import { describe, expect, it, afterEach, vi } from 'vitest'
import { z } from 'zod'
import { defineIntegration } from './defineIntegration'

/**
 * The multipart writers, `postForm` and `putForm`.
 *
 * Two things make them worth a test of their own. They must prefix `/api/{id}`
 * like every other method — that prefix is the whole reason `api` exists, and
 * an upload that composes its own path is how it got bypassed in the first
 * place. And they must send *no* `Content-Type`: multipart needs a boundary
 * parameter alongside the type, only the browser knows the boundary it
 * generated, and a hand-written header drops it. Nothing in the type system
 * catches that; the upload just arrives unparseable.
 */

const demo = defineIntegration({
  id: 'demo',
  name: 'Demo',
  schema: z.object({}),
  fields: {},
})

let calls: { url: string; init?: RequestInit }[] = []

function mockFetch(status = 200, body: unknown = { ok: true }) {
  calls = []
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  }) as unknown as typeof fetch
}

function form() {
  const fd = new FormData()
  fd.append('name', 'Ben')
  fd.append('avatar', new File(['bytes'], 'ben.png', { type: 'image/png' }))
  return fd
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('postForm / putForm', () => {
  it('prefixes /api/{id} exactly like the JSON methods', async () => {
    mockFetch()

    await demo.api.postForm('/people', form())
    await demo.api.putForm('/people/1', form())

    expect(calls.map((c) => c.url)).toEqual(['/api/demo/people', '/api/demo/people/1'])
    expect(calls.map((c) => c.init?.method)).toEqual(['POST', 'PUT'])
  })

  it('sends the FormData untouched and sets no Content-Type', async () => {
    mockFetch()
    const body = form()

    await demo.api.postForm('/people', body)

    expect(calls[0].init?.body).toBe(body)
    // Not a stray assertion: naming the type here strips the boundary and
    // breaks every multipart upload through this client.
    expect(calls[0].init?.headers).toBeUndefined()
  })

  it("throws the server's error message on a rejected upload", async () => {
    mockFetch(500, { error: 'avatar too large' })

    await expect(demo.api.postForm('/people', form())).rejects.toThrow('avatar too large')
  })

  it('resolves with the parsed response body', async () => {
    mockFetch(200, { id: 7, name: 'Ben' })

    await expect(demo.api.postForm('/people', form())).resolves.toEqual({ id: 7, name: 'Ben' })
  })
})
