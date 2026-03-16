import { useEffect, useState } from 'react'
import { Button } from '@/ui/Button'
import { choresIntegration, type Chore } from '@/integrations/chores'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

interface LocalAssignment {
  childName: string
  daysOfWeek: number[]
}

export function ChoreAdmin() {
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New chore form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Per-chore assignment form state
  const [assignForms, setAssignForms] = useState<
    Record<number, { childName: string; selectedDays: Set<number> }>
  >({})

  // NOTE: Displaying existing assignments per chore requires an endpoint that
  // returns assignments grouped by chore (not by date). For now, assignments
  // are tracked locally after setting them via the API.
  const [localAssignments, setLocalAssignments] = useState<
    Record<number, LocalAssignment[]>
  >({})

  async function loadChores() {
    setLoading(true)
    setError(null)
    try {
      const data = await choresIntegration.api.get<Chore[]>('/')
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

  async function handleCreateChore(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError(null)
    try {
      const chore = await choresIntegration.api.post<Chore>('/', {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      })
      setChores((prev) => [...prev, chore])
      setNewName('')
      setNewDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chore')
    }
  }

  async function handleDeleteChore(id: number) {
    setError(null)
    try {
      await choresIntegration.api.del(`/${id}`)
      setChores((prev) => prev.filter((c) => c.id !== id))
      setLocalAssignments((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chore')
    }
  }

  function getAssignForm(choreId: number) {
    return assignForms[choreId] ?? { childName: '', selectedDays: new Set<number>() }
  }

  function updateAssignForm(
    choreId: number,
    update: Partial<{ childName: string; selectedDays: Set<number> }>,
  ) {
    setAssignForms((prev) => ({
      ...prev,
      [choreId]: { ...getAssignForm(choreId), ...update },
    }))
  }

  function toggleDay(choreId: number, dayIndex: number) {
    const form = getAssignForm(choreId)
    const next = new Set(form.selectedDays)
    if (next.has(dayIndex)) {
      next.delete(dayIndex)
    } else {
      next.add(dayIndex)
    }
    updateAssignForm(choreId, { selectedDays: next })
  }

  async function handleAssign(choreId: number) {
    const form = getAssignForm(choreId)
    if (!form.childName.trim() || form.selectedDays.size === 0) return
    setError(null)
    try {
      const assignments = Array.from(form.selectedDays).map((day) => ({
        child_name: form.childName.trim(),
        day_of_week: day,
      }))
      await choresIntegration.api.put(`/${choreId}/assignments`, { assignments })

      // Track locally
      setLocalAssignments((prev) => ({
        ...prev,
        [choreId]: [
          ...(prev[choreId] ?? []),
          {
            childName: form.childName.trim(),
            daysOfWeek: Array.from(form.selectedDays).sort(),
          },
        ],
      }))

      // Reset form
      updateAssignForm(choreId, { childName: '', selectedDays: new Set() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set assignments')
    }
  }

  if (loading) {
    return <p className="text-text-secondary">Loading chores...</p>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary">Chore Management</h2>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Add new chore */}
      <form
        onSubmit={handleCreateChore}
        className="bg-bg-card border border-border rounded-lg p-4 space-y-3"
      >
        <h3 className="text-sm font-medium text-text-secondary">Add New Chore</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Chore name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-calendar"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-calendar"
          />
          <Button type="submit" size="sm" disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </form>

      {/* Chore list */}
      {chores.length === 0 ? (
        <p className="text-text-secondary text-sm">No chores yet. Add one above.</p>
      ) : (
        <div className="space-y-4">
          {chores.map((chore) => {
            const form = getAssignForm(chore.id)
            const assignments = localAssignments[chore.id] ?? []

            return (
              <div
                key={chore.id}
                className="bg-bg-card border border-border rounded-lg p-4 space-y-3"
              >
                {/* Chore header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-text-primary">{chore.name}</h3>
                    {chore.description && (
                      <p className="text-sm text-text-secondary mt-0.5">
                        {chore.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteChore(chore.id)}
                    className="text-red-400 hover:text-red-300 shrink-0"
                  >
                    Delete
                  </Button>
                </div>

                {/* Local assignments display */}
                {assignments.length > 0 && (
                  <div className="text-sm text-text-secondary space-y-1">
                    <p className="font-medium">Assignments:</p>
                    {assignments.map((a, i) => (
                      <p key={i}>
                        {a.childName} &mdash;{' '}
                        {a.daysOfWeek.map((d) => DAYS[d]).join(', ')}
                      </p>
                    ))}
                  </div>
                )}

                {/* Assignment form */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium text-text-secondary">
                    Assign to child
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <input
                      type="text"
                      placeholder="Child name"
                      value={form.childName}
                      onChange={(e) =>
                        updateAssignForm(chore.id, { childName: e.target.value })
                      }
                      className="bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-calendar"
                    />
                    <div className="flex gap-1">
                      {DAYS.map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(chore.id, idx)}
                          className={`w-8 h-8 text-xs font-medium rounded-full transition-colors ${
                            form.selectedDays.has(idx)
                              ? 'bg-calendar text-white'
                              : 'bg-bg-primary text-text-secondary border border-border hover:bg-bg-card-hover'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAssign(chore.id)}
                      disabled={!form.childName.trim() || form.selectedDays.size === 0}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
