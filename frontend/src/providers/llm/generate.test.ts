import { describe, expect, it, vi, afterEach } from 'vitest'
import { generate } from './generate'

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input
    void init
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('generate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('composes the request and resolves the response text field', async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ text: 'the picked events' }),
    } as Response)

    const result = await generate('haiku', 'pick some')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/llm/generate')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init?.body).toBe(JSON.stringify({ model: 'haiku', prompt: 'pick some' }))

    expect(result).toBe('the picked events')
  })

  it('rejects with an error naming the model and status, never the prompt, on a non-2xx response', async () => {
    stubFetch({ ok: false, status: 503 } as Response)

    await expect(generate('haiku', 'a very secret prompt')).rejects.toThrow(/haiku.*503|503.*haiku/)

    try {
      await generate('haiku', 'a very secret prompt')
      throw new Error('expected generate to reject')
    } catch (err) {
      const message = (err as Error).message
      expect(message).not.toContain('a very secret prompt')
    }
  })
})
