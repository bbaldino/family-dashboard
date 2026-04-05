import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { integrations } from '@/integrations/registry'
import { OllamaModelSelect } from '@/integrations/ollama/OllamaModelSelect'

/** Get default values from all integrations' Zod schemas, prefixed with integration ID */
function getSchemaDefaults(): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const integration of integrations) {
    try {
      const parsed = integration.schema.parse({})
      for (const [key, val] of Object.entries(parsed as Record<string, string>)) {
        if (val !== undefined && val !== '') {
          defaults[`${integration.id}.${key}`] = String(val)
        }
      }
    } catch {
      // Schema parse failed, skip defaults
    }
  }
  return defaults
}

export function SettingsAdmin() {
  const [selectedId, setSelectedId] = useState<string | null>(
    integrations.length > 0 ? integrations[0].id : null,
  )
  const [allConfig, setAllConfig] = useState<Record<string, string>>({})
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/config')
      const data = await resp.json()
      // Merge schema defaults under saved values so unsaved fields show their defaults
      const defaults = getSchemaDefaults()
      const merged = { ...defaults, ...data }
      setAllConfig(merged)
      setLocalConfig(merged)
    } catch {
      setError('Failed to load settings')
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleChange = (fullKey: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [fullKey]: value }))
  }

  const selectedIntegration = integrations.find((i) => i.id === selectedId)

  const handleSave = async () => {
    if (!selectedIntegration) return
    try {
      setError(null)

      // Validate this integration's config via its Zod schema
      if (!selectedIntegration.settingsComponent) {
        const prefix = selectedIntegration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(localConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        const result = selectedIntegration.schema.safeParse(scoped)
        if (!result.success) {
          const firstError = result.error.issues[0]
          setError(`${firstError.message}`)
          return
        }
      }

      // Save changed keys for this integration
      const prefix = selectedIntegration.id + '.'
      for (const [key, value] of Object.entries(localConfig)) {
        if (key.startsWith(prefix) && allConfig[key] !== value) {
          await fetch(`/api/config/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
          })
        }
      }
      setAllConfig({ ...localConfig })
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0">
        <ul className="space-y-1">
          {integrations.map((integration) => (
            <li key={integration.id}>
              <button
                onClick={() => {
                  setSelectedId(integration.id)
                  setError(null)
                  setStatus(null)
                }}
                className={`w-full text-left px-3 py-2 rounded-[var(--radius-button)] text-sm transition-colors ${
                  selectedId === integration.id
                    ? 'bg-palette-1 text-white font-medium'
                    : 'text-text-secondary hover:bg-bg-card-hover'
                }`}
              >
                {integration.name}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {error && (
          <div className="bg-error/10 text-error rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {!selectedIntegration && (
          <p className="text-text-muted text-sm">
            Select an integration to configure.
          </p>
        )}

        {selectedIntegration && (
          <div className="flex-1 min-h-0 flex flex-col">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex-shrink-0">
              {selectedIntegration.name}
            </h3>

            {selectedIntegration.settingsComponent ? (
              <div className="flex-1 min-h-0">
                <selectedIntegration.settingsComponent />
              </div>
            ) : (
              <div className="max-w-2xl">
                <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border mb-4">
                  <div className="space-y-3">
                    {(
                      Object.entries(selectedIntegration.fields) as [
                        string,
                        {
                          label: string
                          type?: string
                          description?: string
                        },
                      ][]
                    ).map(([key, meta]) => {
                      const fullKey = `${selectedIntegration.id}.${key}`
                      const value = localConfig[fullKey] ?? ''

                      if (meta.type === 'ollama-model') {
                        return (
                          <OllamaModelSelect
                            key={key}
                            value={value}
                            onChange={(v) => handleChange(fullKey, v)}
                            label={meta.label}
                            description={meta.description}
                          />
                        )
                      }

                      if (meta.type === 'boolean') {
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-3"
                          >
                            <input
                              type="checkbox"
                              checked={value === 'true'}
                              onChange={(e) =>
                                handleChange(
                                  fullKey,
                                  String(e.target.checked),
                                )
                              }
                              className="w-5 h-5 rounded accent-palette-1"
                            />
                            <div>
                              <div className="text-sm font-medium text-text-primary">
                                {meta.label}
                              </div>
                              {meta.description && (
                                <div className="text-xs text-text-muted">
                                  {meta.description}
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      }

                      return (
                        <div key={key}>
                          <label className="text-xs text-text-muted block mb-1">
                            {meta.label}
                          </label>
                          <input
                            type={
                              meta.type === 'secret' ? 'password' : 'text'
                            }
                            value={value}
                            onChange={(e) =>
                              handleChange(fullKey, e.target.value)
                            }
                            placeholder={meta.description}
                            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={handleSave}>Save</Button>
                  {status && (
                    <span className="text-sm text-success">{status}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
