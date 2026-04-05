import { useQuery } from '@tanstack/react-query'
import { ollamaIntegration } from './config'

interface OllamaModelSelectProps {
  value: string
  onChange: (value: string) => void
  label?: string
  description?: string
}

interface ModelInfo {
  name: string
}

interface ModelsResponse {
  models: ModelInfo[]
}

export function OllamaModelSelect({ value, onChange, label, description }: OllamaModelSelectProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ollama', 'models'],
    queryFn: () => ollamaIntegration.api.get<ModelsResponse>('/models'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const models = data?.models ?? []

  return (
    <div>
      {label && <label className="text-xs text-text-muted block mb-1">{label}</label>}
      {error ? (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={description}
            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
          />
          <div className="text-xs text-text-muted mt-1">Could not fetch models from Ollama — enter manually</div>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        >
          {isLoading && <option>Loading models...</option>}
          {!isLoading && value && !models.some((m) => m.name === value) && (
            <option value={value}>{value}</option>
          )}
          {models.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
      )}
      {description && !error && <div className="text-xs text-text-muted mt-1">{description}</div>}
    </div>
  )
}
