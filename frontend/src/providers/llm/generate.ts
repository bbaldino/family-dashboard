interface GenerateResponse {
  text: string
}

/**
 * Runs a single-prompt completion through the backend's LLM route.
 *
 * Same-origin, so it does not go through `/api/fetch` — that proxy exists
 * for external URLs. The backend resolves `llm.url` and the credentials;
 * the browser never sees them.
 *
 * Never puts `prompt` into an error message. `backend/src/llm.rs` is
 * careful to keep prompts and completions out of logs, and an error that
 * echoes the prompt into the browser console would defeat that.
 */
export async function generate(model: string, prompt: string): Promise<string> {
  const res = await fetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
  })
  if (!res.ok) {
    throw new Error(`LLM returned ${res.status} for model '${model}'`)
  }
  const data: GenerateResponse = await res.json()
  return data.text
}
