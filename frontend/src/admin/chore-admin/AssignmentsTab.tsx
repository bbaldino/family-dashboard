import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Button } from '@/ui/Button'
import { choresIntegration } from '@/integrations/chores'
import type { AssignmentResponse, Chore, Person } from '@/integrations/chores/types'
import { ChorePool } from './ChorePool'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay(): 0=Sun, 1=Mon... We want Monday as start
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayDayIndex(): number {
  // Returns 0=Mon, 1=Tue, ..., 6=Sun
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

interface DroppableCellProps {
  id: string
  children: React.ReactNode
}

function DroppableCell({ id, children }: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[130px] p-2 rounded-lg border transition-colors ${
        isOver ? 'border-palette-1 bg-palette-1/10' : 'border-border bg-bg-primary'
      }`}
    >
      {children}
    </div>
  )
}

interface AssignmentChipProps {
  assignment: AssignmentResponse
  onRemove: () => void
}

function AssignmentChip({ assignment, onRemove }: AssignmentChipProps) {
  const isMeta = assignment.chore.chore_type === 'meta'

  return (
    <button
      type="button"
      onClick={onRemove}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium mb-1.5 mr-1 cursor-pointer active:opacity-60 transition-opacity ${
        isMeta
          ? 'border border-dashed border-blue-400 text-blue-300 bg-blue-900/20'
          : 'bg-bg-card-hover text-text-primary border border-border'
      }`}
    >
      <span className="truncate max-w-[120px]">{assignment.chore.name}</span>
      <span className="text-text-muted text-xs ml-0.5 shrink-0">&times;</span>
    </button>
  )
}

function DragOverlayChip({ name, isMeta }: { name: string; isMeta: boolean }) {
  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium shadow-lg ${
        isMeta
          ? 'border-2 border-dashed border-blue-400 text-blue-300 bg-blue-900/80'
          : 'bg-bg-card text-text-primary border border-border'
      }`}
    >
      {name}
    </div>
  )
}

export function AssignmentsTab() {
  const [weekOf, setWeekOf] = useState(() => getMonday(new Date()))
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [chores, setChores] = useState<Chore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeChore, setActiveChore] = useState<Chore | null>(null)
  const hasLoadedOnce = useRef(false)

  const weekStr = toIsoDate(weekOf)

  const fetchData = useCallback(async () => {
    if (!hasLoadedOnce.current) setLoading(true)
    setError(null)
    try {
      const [assignData, peopleData, choresData] = await Promise.all([
        choresIntegration.api.get<AssignmentResponse[]>(`/assignments?week=${weekStr}`),
        choresIntegration.api.get<Person[]>('/people'),
        choresIntegration.api.get<Chore[]>('/chores'),
      ])
      setAssignments(assignData)
      setPeople(peopleData)
      setChores(choresData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
      hasLoadedOnce.current = true
    }
  }, [weekStr])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function prevWeek() {
    hasLoadedOnce.current = false
    setWeekOf((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    hasLoadedOnce.current = false
    setWeekOf((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  async function copyFromLastWeek() {
    setError(null)
    try {
      const prevMonday = new Date(weekOf)
      prevMonday.setDate(prevMonday.getDate() - 7)
      await choresIntegration.api.post('/weeks/copy', {
        from_week: toIsoDate(prevMonday),
        to_week: weekStr,
      })
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy from last week')
    }
  }

  async function rotate() {
    setError(null)
    try {
      await choresIntegration.api.post('/weeks/rotate', { week: weekStr })
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate')
    }
  }

  async function handleRemoveAssignment(id: number) {
    setError(null)
    try {
      await choresIntegration.api.del('/assignments/' + id)
      setAssignments((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
    }
  }

  function handleDragStart(event: { active: { data: { current?: { chore?: Chore } } } }) {
    const chore = event.active.data.current?.chore ?? null
    setActiveChore(chore)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveChore(null)
    const { active, over } = event
    if (!over) return

    const chore = active.data.current?.chore as Chore | undefined
    if (!chore) return

    const droppableId = String(over.id)
    const parts = droppableId.split('-')
    if (parts.length < 2) return

    const dayOfWeek = parseInt(parts[parts.length - 1], 10)
    const personId = parseInt(parts.slice(0, parts.length - 1).join('-'), 10)

    if (isNaN(dayOfWeek) || isNaN(personId)) return

    setError(null)
    try {
      await choresIntegration.api.post('/assignments', {
        chore_id: chore.id,
        person_id: personId,
        week_of: weekStr,
        day_of_week: dayOfWeek,
      })
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign chore')
    }
  }

  function getAssignmentsForCell(personId: number, dayOfWeek: number): AssignmentResponse[] {
    return assignments.filter(
      (a) => a.person.id === personId && a.day_of_week === dayOfWeek,
    )
  }

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
  const sensors = useSensors(pointerSensor)

  const todayDayIndex = getTodayDayIndex()
  const isCurrentWeek = toIsoDate(getMonday(new Date())) === weekStr

  if (loading) {
    return <p className="text-text-secondary">Loading assignments...</p>
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4" style={{ touchAction: 'none' }}>
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Week selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={prevWeek}>
              &lt;
            </Button>
            <span className="text-text-primary font-medium text-sm min-w-[200px] text-center">
              Week of {formatDate(weekOf)}
            </span>
            <Button size="sm" variant="ghost" onClick={nextWeek}>
              &gt;
            </Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copyFromLastWeek}>
              Copy from Last Week
            </Button>
            <Button size="sm" variant="secondary" onClick={rotate}>
              Rotate
            </Button>
          </div>
        </div>

        {/* Grid */}
        {people.length === 0 ? (
          <p className="text-text-secondary text-sm">
            No people found. Add some in the People tab first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid gap-px bg-border rounded-[var(--radius-card)] overflow-hidden"
              style={{
                gridTemplateColumns: '140px repeat(7, 1fr)',
              }}
            >
              {/* Header row */}
              <div className="bg-bg-card p-2" />
              {DAY_NAMES.map((day, idx) => (
                <div
                  key={day}
                  className={`bg-bg-card p-2 text-center text-xs font-semibold ${
                    isCurrentWeek && idx === todayDayIndex
                      ? 'text-palette-1'
                      : 'text-text-secondary'
                  }`}
                >
                  {day}
                </div>
              ))}

              {/* Person rows */}
              {people.map((person) => (
                <Fragment key={person.id}>
                  {/* Person label */}
                  <div
                    className="bg-bg-card p-2 flex items-center gap-2"
                  >
                    {person.avatar ? (
                      <img
                        src={`/api/chores/people/${person.id}/avatar`}
                        alt={person.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
                        style={{ backgroundColor: person.color }}
                      >
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-text-primary text-sm font-medium truncate">
                      {person.name}
                    </span>
                  </div>

                  {/* Day cells */}
                  {DAY_NAMES.map((_, dayIdx) => (
                    <div key={`${person.id}-${dayIdx}`} className="bg-bg-card p-1">
                      <DroppableCell id={`${person.id}-${dayIdx}`}>
                        {getAssignmentsForCell(person.id, dayIdx).map((assignment) => (
                          <AssignmentChip
                            key={assignment.id}
                            assignment={assignment}
                            onRemove={() => handleRemoveAssignment(assignment.id)}
                          />
                        ))}
                      </DroppableCell>
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Chore pool */}
        <ChorePool chores={chores} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeChore ? (
          <DragOverlayChip
            name={activeChore.name}
            isMeta={activeChore.chore_type === 'meta'}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
