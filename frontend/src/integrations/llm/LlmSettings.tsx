import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

type Provider = 'ollama' | 'openai_compat'

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'openai_compat', label: 'OpenAI-compatible' },
]

export function LlmSettings() {
  const [provider, setProvider] = useState<Provider>('ollama')
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaToken, setOllamaToken] = useState('')
  const [openaiUrl, setOpenaiUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      const p = config['llm.provider'] ?? 'ollama'
      setProvider(p === 'openai_compat' ? 'openai_compat' : 'ollama')
      setOllamaUrl(config['ollama.url'] ?? 'http://localhost:11434')
      setOllamaToken(config['ollama.token'] ?? '')
      setOpenaiUrl(config['llm.url'] ?? '')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const put = (key: string, value: string) =>
    fetch(`/api/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })

  const del = (key: string) =>
    fetch(`/api/config/${encodeURIComponent(key)}`, { method: 'DELETE' })

  const handleSave = async () => {
    try {
      setError(null)
      await put('llm.provider', provider)
      if (provider === 'ollama') {
        await put('ollama.url', ollamaUrl)
        if (ollamaToken) {
          await put('ollama.token', ollamaToken)
        } else {
          await del('ollama.token')
        }
      } else {
        await put('llm.url', openaiUrl)
      }
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm'

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border">
        <label className="text-xs text-text-muted block mb-2">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className={inputClass}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <div className="text-xs text-text-muted mt-1">
          The model backend used for filtering and summaries.
        </div>
      </div>

      {provider === 'ollama' && (
        <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border space-y-4">
          <div className="text-sm font-medium text-text-primary">Ollama settings</div>
          <div>
            <label className="text-xs text-text-muted block mb-2">URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className={inputClass}
            />
            <div className="text-xs text-text-muted mt-1">
              e.g. <code>http://192.168.1.100:11434</code>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-2">API Token</label>
            <input
              type="password"
              value={ollamaToken}
              onChange={(e) => setOllamaToken(e.target.value)}
              placeholder="optional"
              className={inputClass}
            />
            <div className="text-xs text-text-muted mt-1">
              Optional bearer token for authentication.
            </div>
          </div>
        </div>
      )}

      {provider === 'openai_compat' && (
        <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border space-y-4">
          <div className="text-sm font-medium text-text-primary">OpenAI-compatible settings</div>
          <div>
            <label className="text-xs text-text-muted block mb-2">Service URL</label>
            <input
              type="text"
              value={openaiUrl}
              onChange={(e) => setOpenaiUrl(e.target.value)}
              placeholder="http://localhost:8080"
              className={inputClass}
            />
            <div className="text-xs text-text-muted mt-1">
              Base URL of the chat-completions service (no trailing <code>/v1/chat/completions</code> — that's appended).
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
