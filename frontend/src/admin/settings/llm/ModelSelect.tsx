import { useEffect, useState } from 'react'

interface ModelSelectProps {
  value: string
  onChange: (value: string) => void
  label?: string
  description?: string
}

interface ModelsResponse {
  provider: string
  models: { name: string }[]
}

export function ModelSelect({ value, onChange, label, description }: ModelSelectProps) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/llm/models')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ModelsResponse>
      })
      .then((data) => {
        if (cancelled) return
        setModels(data.models.map((m) => m.name))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm'

  const valueMissingFromList = value && !models.includes(value)

  return (
    <div>
      {label && <label className="text-xs text-text-muted block mb-2">{label}</label>}
      {loading ? (
        <div className="text-text-muted text-xs">Loading models…</div>
      ) : error ? (
        <div className="space-y-2">
          <div className="text-error text-xs">Could not load models: {error}</div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            {valueMissingFromList && (
              <option value={value}>{value} (not in current provider)</option>
            )}
            {models.length === 0 && <option value="">(no models reported)</option>}
            {models.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {valueMissingFromList && (
            <div className="text-xs text-role-warning mt-1">
              Current value isn't in the active provider's model list.
            </div>
          )}
        </>
      )}
      {description && <div className="text-xs text-text-muted mt-1">{description}</div>}
    </div>
  )
}
