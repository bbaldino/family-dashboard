import { Fragment, useMemo, useState } from 'react'
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
import {
  useAssignments,
  useChoreList,
  useCopyWeek,
  useCreateAssignment,
  useDeleteAssignment,
  usePeople,
  useRotateWeek,
} from '@/integrations/chores'
import type { AssignmentResponse, Chore } from '@/integrations/chores'
import { ChorePool } from './ChorePool'
import { useCalendarEvents, type CalendarEvent } from '@/integrations/google-calendar'
import { eventLocalDateStr, parseLocalDate, toLocalDateStr } from '@/utils/date'

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

function getTodayDayIndex(): number {
  // Returns 0=Mon, 1=Tue, ..., 6=Sun
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

/**
 * Slot the week's events into the seven grid columns. Which calendars supply
 * them is the integration's business; where they land is this grid's, because
 * only it knows the Monday the columns start from.
 */
function bucketByDay(events: CalendarEvent[], weekOf: Date): Record<number, CalendarEvent[]> {
  const byDay: Record<number, CalendarEvent[]> = {}
  for (let i = 0; i < 7; i++) byDay[i] = []

  for (const event of events) {
    // Bucket relative to Monday (weekOf is local-midnight Monday) so
    // all-day events parse as local — not UTC — to avoid off-by-one.
    const eventDate = parseLocalDate(eventLocalDateStr(event))
    const dayIdx = Math.floor((eventDate.getTime() - weekOf.getTime()) / (1000 * 60 * 60 * 24))
    if (dayIdx >= 0 && dayIdx < 7) {
      byDay[dayIdx].push(event)
    }
  }

  // Sort each day's events by time
  for (const day of Object.values(byDay)) {
    day.sort((a, b) => {
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return new Date(aTime).getTime() - new Date(bTime).getTime()
    })
  }

  return byDay
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
  const [activeChore, setActiveChore] = useState<Chore | null>(null)

  const weekStr = toLocalDateStr(weekOf)

  const assignmentsQuery = useAssignments(weekStr)
  const peopleQuery = usePeople()
  const choreListQuery = useChoreList()
  const createAssignment = useCreateAssignment()
  const deleteAssignment = useDeleteAssignment()
  const copyWeek = useCopyWeek()
  const rotateWeek = useRotateWeek()

  const assignments = assignmentsQuery.data ?? []
  const people = peopleQuery.data ?? []
  const chores = choreListQuery.data ?? []

  // The banner shows whichever failed most recently, so an action's error takes
  // precedence over a stale load error, and a successful reload clears the load
  // error on its own.
  const [actionError, setActionError] = useState<string | null>(null)
  const loadError = assignmentsQuery.error ?? peopleQuery.error ?? choreListQuery.error
  const error = actionError ?? loadError?.message ?? null

  // The calendar row is decoration on top of the grid: if it cannot load, the
  // week still renders with an empty row, and the error banner above stays for
  // chore failures only. That was true of the hand-rolled version's swallowed
  // catch and stays true here — the query's error is deliberately unread.
  const weekEnd = useMemo(() => {
    const d = new Date(weekOf)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekOf])
  const calendarQuery = useCalendarEvents(weekOf, weekEnd)
  const calendarEvents = useMemo(
    () => bucketByDay(calendarQuery.data ?? [], weekOf),
    [calendarQuery.data, weekOf],
  )

  function prevWeek() {
    setWeekOf((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    setWeekOf((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  async function copyFromLastWeek() {
    setActionError(null)
    try {
      const prevMonday = new Date(weekOf)
      prevMonday.setDate(prevMonday.getDate() - 7)
      await copyWeek.mutateAsync({
        from_week: toLocalDateStr(prevMonday),
        to_week: weekStr,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to copy from last week')
    }
  }

  async function rotate() {
    setActionError(null)
    try {
      await rotateWeek.mutateAsync(weekStr)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to rotate')
    }
  }

  async function handleRemoveAssignment(id: number) {
    setActionError(null)
    try {
      await deleteAssignment.mutateAsync(id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove assignment')
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

    setActionError(null)
    try {
      await createAssignment.mutateAsync({
        chore_id: chore.id,
        person_id: personId,
        week_of: weekStr,
        day_of_week: dayOfWeek,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign chore')
    }
  }

  function getAssignmentsForCell(personId: number, dayOfWeek: number): AssignmentResponse[] {
    return assignments.filter((a) => a.person.id === personId && a.day_of_week === dayOfWeek)
  }

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
  const sensors = useSensors(pointerSensor)

  const todayDayIndex = getTodayDayIndex()
  const isCurrentWeek = toLocalDateStr(getMonday(new Date())) === weekStr

  // Only while a week has nothing to show yet. A refetch behind an edit, or a
  // week already in cache, keeps the grid on screen rather than blanking it.
  if (assignmentsQuery.isPending || peopleQuery.isPending || choreListQuery.isPending) {
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

              {/* Calendar row */}
              <div className="bg-bg-card p-2 text-xs text-text-muted flex items-start">📅</div>
              {DAY_NAMES.map((_, dayIdx) => {
                const events = calendarEvents[dayIdx] ?? []
                return (
                  <div key={`cal-${dayIdx}`} className="bg-bg-card p-1.5">
                    {events.length === 0 ? (
                      <div className="text-[10px] text-text-muted italic">—</div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {events.map((event) => {
                          const start = event.start.dateTime ?? event.start.date ?? ''
                          const isAllDay = !event.start.dateTime
                          const time = isAllDay
                            ? ''
                            : new Date(start).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                          return (
                            <div
                              key={event.id}
                              className="text-[10px] text-text-secondary leading-tight truncate"
                              title={event.summary ?? ''}
                            >
                              {time && <span className="text-text-muted">{time} </span>}
                              {event.summary ?? '(No title)'}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Person rows */}
              {people.map((person) => (
                <Fragment key={person.id}>
                  {/* Person label */}
                  <div className="bg-bg-card p-2 flex items-center gap-2">
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
          <DragOverlayChip name={activeChore.name} isMeta={activeChore.chore_type === 'meta'} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
