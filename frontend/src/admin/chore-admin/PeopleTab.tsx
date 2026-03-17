import { useEffect, useState } from 'react'
import { Button } from '@/ui/Button'
import { choresIntegration } from '@/integrations/chores'
import type { Person } from '@/integrations/chores/types'
import { ColorPicker } from './ColorPicker'

export function PeopleTab() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#e88a6a')
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null)
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null)

  async function loadPeople() {
    setLoading(true)
    setError(null)
    try {
      const data = await choresIntegration.api.get<Person[]>('/people')
      setPeople(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load people')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPeople()
  }, [])

  function resetForm() {
    setFormName('')
    setFormColor('#e88a6a')
    setFormAvatarFile(null)
    setFormAvatarPreview(null)
  }

  function startAdd() {
    resetForm()
    setEditingId(null)
    setShowAddForm(true)
  }

  function startEdit(person: Person) {
    setFormName(person.name)
    setFormColor(person.color)
    setFormAvatarFile(null)
    setFormAvatarPreview(person.avatar ? `/api/chores/people/${person.id}/avatar` : null)
    setEditingId(person.id)
    setShowAddForm(false)
  }

  function cancelForm() {
    resetForm()
    setShowAddForm(false)
    setEditingId(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setFormAvatarFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setFormAvatarPreview(url)
    } else {
      setFormAvatarPreview(null)
    }
  }

  async function handleSave() {
    if (!formName.trim()) return
    setError(null)
    try {
      const formData = new FormData()
      formData.append('name', formName.trim())
      formData.append('color', formColor)
      if (formAvatarFile) formData.append('avatar', formAvatarFile)

      if (editingId !== null) {
        await fetch(`/api/chores/people/${editingId}`, { method: 'PUT', body: formData })
      } else {
        await fetch('/api/chores/people', { method: 'POST', body: formData })
      }
      cancelForm()
      await loadPeople()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save person')
    }
  }

  async function handleDelete(id: number) {
    setError(null)
    try {
      await choresIntegration.api.del('/people/' + id)
      setPeople((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete person')
    }
  }

  function renderForm() {
    return (
      <div className="bg-bg-card border border-border rounded-[var(--radius-card)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-text-secondary">
          {editingId !== null ? 'Edit Person' : 'Add Person'}
        </h3>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Name</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Person name"
            className="w-full max-w-xs bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-calendar"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Color</label>
          <ColorPicker value={formColor} onChange={setFormColor} />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Avatar</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-bg-card-hover file:text-text-primary hover:file:bg-border"
          />
          {formAvatarPreview && (
            <img
              src={formAvatarPreview}
              alt="Preview"
              className="mt-2 w-16 h-16 rounded-full object-cover border border-border"
            />
          )}
        </div>

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
    return <p className="text-text-secondary">Loading people...</p>
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
          Add Person
        </Button>
      )}

      {showAddForm && renderForm()}

      {people.length === 0 && !showAddForm ? (
        <p className="text-text-secondary text-sm">No people yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {people.map((person) => {
            if (editingId === person.id) {
              return <div key={person.id}>{renderForm()}</div>
            }

            return (
              <div
                key={person.id}
                className="bg-bg-card border border-border rounded-[var(--radius-card)] p-3 flex items-center gap-3"
              >
                {/* Avatar or color initial */}
                {person.avatar ? (
                  <img
                    src={`/api/chores/people/${person.id}/avatar`}
                    alt={person.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <span className="text-text-primary font-medium flex-1">{person.name}</span>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(person)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(person.id)}
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
