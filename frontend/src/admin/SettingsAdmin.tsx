import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { integrations } from '@/integrations/registry'

export function SettingsAdmin() {
  const [allConfig, setAllConfig] = useState<Record<string, string>>({})
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const resp = await fetch('/api/config')
      const data = await resp.json()
      setAllConfig(data)
      setLocalConfig(data)
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

  const handleSave = async () => {
    try {
      setError(null)

      // Validate each integration's config via its Zod schema
      for (const integration of integrations) {
        if (integration.settingsComponent) continue
        const prefix = integration.id + '.'
        const scoped: Record<string, string> = {}
        for (const [key, value] of Object.entries(localConfig)) {
          if (key.startsWith(prefix)) {
            scoped[key.slice(prefix.length)] = value
          }
        }
        const result = integration.schema.safeParse(scoped)
        if (!result.success) {
          const firstError = result.error.issues[0]
          setError(`${integration.name}: ${firstError.message}`)
          return
        }
      }

      // Save changed keys
      for (const [key, value] of Object.entries(localConfig)) {
        if (allConfig[key] !== value) {
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
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>

      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {integrations.length === 0 && (
        <p className="text-text-muted text-sm">No integrations configured yet.</p>
      )}

      {integrations.map((integration) => {
        if (integration.settingsComponent) {
          const CustomSettings = integration.settingsComponent
          return (
            <div key={integration.id} className="mb-8">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                {integration.name}
              </h3>
              <CustomSettings />
            </div>
          )
        }

        const fieldEntries = Object.entries(integration.fields) as [
          string,
          { label: string; type?: string; description?: string },
        ][]

        return (
          <div
            key={integration.id}
            className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border mb-6"
          >
            <h3 className="text-sm font-semibold text-text-secondary mb-4">
              {integration.name}
            </h3>
            <div className="space-y-3">
              {fieldEntries.map(([key, meta]) => {
                const fullKey = `${integration.id}.${key}`
                const value = localConfig[fullKey] ?? ''

                if (meta.type === 'boolean') {
                  return (
                    <label key={key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={value === 'true'}
                        onChange={(e) =>
                          handleChange(fullKey, String(e.target.checked))
                        }
                        className="w-5 h-5 rounded accent-calendar"
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
                      type={meta.type === 'secret' ? 'password' : 'text'}
                      value={value}
                      onChange={(e) => handleChange(fullKey, e.target.value)}
                      placeholder={meta.description}
                      className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {integrations.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>Save Settings</Button>
          {status && <span className="text-sm text-success">{status}</span>}
        </div>
      )}
    </div>
  )
}
