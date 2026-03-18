import { useEffect, useState } from 'react'
import { Button } from '@/ui/Button'
import { choresIntegration } from '@/integrations/chores'
import type { Chore } from '@/integrations/chores/types'

export function ChoresTab() {
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTags, setFormTags] = useState<string[]>([])
  const [formTagInput, setFormTagInput] = useState('')
  const [formChoreType, setFormChoreType] = useState<'regular' | 'meta'>('regular')
  const [formPickFromTags, setFormPickFromTags] = useState<string[]>([])
  const [formPickFromTagsInput, setFormPickFromTagsInput] = useState('')

  async function loadChores() {
    setLoading(true)
    setError(null)
    try {
      const data = await choresIntegration.api.get<Chore[]>('/chores')
      setChores(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChores()
  }, [])

  function resetForm() {
    setFormName('')
    setFormDescription('')
    setFormTags([])
    setFormTagInput('')
    setFormChoreType('regular')
    setFormPickFromTags([])
    setFormPickFromTagsInput('')
  }

  function startAdd() {
    resetForm()
    setEditingId(null)
    setShowAddForm(true)
  }

  function startEdit(chore: Chore) {
    setFormName(chore.name)
    setFormDescription(chore.description ?? '')
    setFormTags([...chore.tags])
    setFormTagInput('')
    setFormChoreType(chore.chore_type)
    setFormPickFromTags([...chore.pick_from_tags])
    setFormPickFromTagsInput('')
    setEditingId(chore.id)
    setShowAddForm(false)
  }

  function cancelForm() {
    resetForm()
    setShowAddForm(false)
    setEditingId(null)
  }

  function processTagInput(input: string, existing: string[]): string[] {
    const newTags = input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !existing.includes(t))
    return [...existing, ...newTags]
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      setFormTags(processTagInput(formTagInput, formTags))
      setFormTagInput('')
    }
  }

  function handleTagInputBlur() {
    if (formTagInput.trim()) {
      setFormTags(processTagInput(formTagInput, formTags))
      setFormTagInput('')
    }
  }

  function handlePickFromTagsKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      setFormPickFromTags(processTagInput(formPickFromTagsInput, formPickFromTags))
      setFormPickFromTagsInput('')
    }
  }

  function handlePickFromTagsBlur() {
    if (formPickFromTagsInput.trim()) {
      setFormPickFromTags(processTagInput(formPickFromTagsInput, formPickFromTags))
      setFormPickFromTagsInput('')
    }
  }

  async function handleSave() {
    if (!formName.trim()) return
    setError(null)
    try {
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        chore_type: formChoreType,
        tags: formTags,
        pick_from_tags: formChoreType === 'meta' ? formPickFromTags : [],
      }

      if (editingId !== null) {
        await choresIntegration.api.put('/chores/' + editingId, body)
      } else {
        await choresIntegration.api.post('/chores', body)
      }
      cancelForm()
      await loadChores()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save chore')
    }
  }

  async function handleDelete(id: number) {
    setError(null)
    try {
      await choresIntegration.api.del('/chores/' + id)
      setChores((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chore')
    }
  }

  function renderTagPills(tags: string[], onRemove: (tag: string) => void) {
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-card-hover text-text-secondary text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="text-text-secondary hover:text-text-primary ml-0.5"
            >
              x
            </button>
          </span>
        ))}
      </div>
    )
  }

  function renderForm() {
    return (
      <div className="bg-bg-card border border-border rounded-[var(--radius-card)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-text-secondary">
          {editingId !== null ? 'Edit Chore' : 'Add Chore'}
        </h3>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Name *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Chore name"
            className="w-full max-w-xs bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-palette-1"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Description</label>
          <input
            type="text"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full max-w-md bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-palette-1"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={formTagInput}
            onChange={(e) => setFormTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            onBlur={handleTagInputBlur}
            placeholder="Type tags, press Enter or comma to add"
            className="w-full max-w-md bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-palette-1"
          />
          {formTags.length > 0 &&
            renderTagPills(formTags, (tag) => setFormTags((prev) => prev.filter((t) => t !== tag)))}
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormChoreType('regular')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                formChoreType === 'regular'
                  ? 'bg-palette-1 text-white'
                  : 'bg-bg-primary border border-border text-text-secondary hover:bg-bg-card-hover'
              }`}
            >
              Regular
            </button>
            <button
              type="button"
              onClick={() => setFormChoreType('meta')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                formChoreType === 'meta'
                  ? 'bg-palette-1 text-white'
                  : 'bg-bg-primary border border-border text-text-secondary hover:bg-bg-card-hover'
              }`}
            >
              Meta
            </button>
          </div>
        </div>

        {formChoreType === 'meta' && (
          <div>
            <label className="text-xs text-text-secondary block mb-1">
              Pick from tags (comma-separated)
            </label>
            <input
              type="text"
              value={formPickFromTagsInput}
              onChange={(e) => setFormPickFromTagsInput(e.target.value)}
              onKeyDown={handlePickFromTagsKeyDown}
              onBlur={handlePickFromTagsBlur}
              placeholder="Tags to pick from"
              className="w-full max-w-md bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-palette-1"
            />
            {formPickFromTags.length > 0 &&
              renderTagPills(formPickFromTags, (tag) =>
                setFormPickFromTags((prev) => prev.filter((t) => t !== tag)),
              )}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!formName.trim()}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelForm}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <p className="text-text-secondary">Loading chores...</p>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!showAddForm && editingId === null && (
        <Button size="sm" onClick={startAdd}>
          Add Chore
        </Button>
      )}

      {showAddForm && renderForm()}

      {chores.length === 0 && !showAddForm ? (
        <p className="text-text-secondary text-sm">No chores yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {chores.map((chore) => {
            if (editingId === chore.id) {
              return <div key={chore.id}>{renderForm()}</div>
            }

            return (
              <div
                key={chore.id}
                className="bg-bg-card border border-border rounded-[var(--radius-card)] p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-text-primary font-medium">{chore.name}</span>
                    {chore.chore_type === 'meta' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-700/50">
                        meta
                      </span>
                    )}
                    {chore.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-xs bg-bg-card-hover text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {chore.description && (
                    <p className="text-sm text-text-secondary mt-0.5">{chore.description}</p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(chore)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(chore.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
