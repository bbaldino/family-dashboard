import { Check } from 'lucide-react'
import { useCountdowns } from '@/data/countdowns'
import type { CountdownItem } from '@/data/countdowns'
import { useChores } from '@/data/chores'
import type { PersonAssignments, TodayResponse } from '@/data/chores'
import { useLunchMenu } from '@/data/nutrislice'
import type { LunchMenuData } from '@/data/nutrislice'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

/** A soft accent for "On this day"'s year — the mock's `C.accent2`, a muted
 *  gold distinct from the rust used for kickers and drive times. No token
 *  for it; approximated as a blend of the two we do have (per the design
 *  brief's guidance on `ruleSoft`/`ink2`/`accent2`: approximate rather than
 *  add a token) instead of hard-coding a new colour. */

/* ───────────────────────── Lunch ─────────────────────────
 * Mock: broadsheet-v2.jsx:229-249. */

function LunchSection({ lunch }: { lunch: LunchMenuData }) {
  const today = lunch.today
  const items = today
    ? today.entries.length > 0
      ? today.entries.map((entry) => ({
          name: entry.name,
          sub: (entry.withItems ?? []).join(', ') || null,
        }))
      : today.extras.map((name) => ({ name, sub: null as string | null }))
    : []

  return (
    <div>
      <Kicker>Cafeteria · today</Kicker>
      <h3
        className="m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          margin: '4px 0 6px',
          borderBottom: '1px solid var(--ink)',
          paddingBottom: 4,
        }}
      >
        {today ? 'School lunch' : 'No school today'}
      </h3>
      {items.length > 0 ? (
        <ol className="m-0 p-0 flex flex-col gap-1" style={{ listStyle: 'none' }}>
          {items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--ink-muted)',
                  width: 14,
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    lineHeight: 1.2,
                    color: 'var(--ink)',
                  }}
                >
                  {item.name}
                </span>
                {item.sub && (
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontStyle: 'italic',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                      marginLeft: 5,
                    }}
                  >
                    {item.sub}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p
          className="m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
          }}
        >
          The cafeteria&apos;s closed. Pantry&apos;s yours — leftovers, fruit, the usual.
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── Chores ─────────────────────────
 * Mock: broadsheet-v2.jsx:252-297. The mock's chores are clickable and show
 * a per-person streak; ours now toggle (tap a row to check or uncheck it —
 * see the row's own comment for why the tap target is the existing box) and
 * the streak has no backing data (`TodayResponse` carries
 * `completed_count`/`total_count`, not a streak), so it's omitted rather
 * than invented. Everything else the mock shows — chores grouped under a
 * person heading, each with their own done/total — the real `useChores()`
 * payload already returns in that shape: `TodayResponse.persons` is an
 * array of `{ person, assignments }`, each assignment carrying a `chore`
 * (and an optional `picked_chore` for meta-chores). No flattening needed. */

interface VisibleChoreGroup {
  personId: number
  personName: string
  tasks: { id: number; name: string; completed: boolean }[]
  hiddenTaskCount: number
  doneCount: number
  totalCount: number
}

/** How many person groups this section ever renders, and how many tasks
 *  each group shows — separate budgets, mirroring `ScheduleColumn`'s
 *  day/event split (`MAX_WEEK_AHEAD_DAYS`/`MAX_WEEK_AHEAD_EVENTS`). A single
 *  cap on "rows" — what the old flat `MAX_VISIBLE_CHORES` did — doesn't
 *  work once a row's cost depends on grouping: a heading costs about as
 *  much vertical space as a task row (measured live: ~25px each at this
 *  canvas's logical scale, plus an 8px gap between groups), so total cost
 *  is `people × (1 + tasksPerPerson)`, not just a task count.
 *
 *  The original pair were tuned by measurement rather than guesswork:
 *  rendered live via Playwright route interception at the column's fullest
 *  realistic state, checking that the section beneath them was not clipped.
 *  A heading can report a healthy margin while the paragraph below it is
 *  entirely off the fold, so what mattered was measuring the *last* element,
 *  not the section's top edge.
 *
 *  These were 2 and 2, sized so the On this day blurb beneath them stayed
 *  fully on screen — with, as measured at the time, zero clearance to spare.
 *  That section has since been taken off Home entirely (the design moved it
 *  to the glance strip precisely so chores get the vertical room), so the
 *  constraint that forced 2/2 no longer exists and the caps rise to 4/4 to
 *  match the design's own `CHORE_TASK_CAP`.
 *
 *  `MAX_TASKS_PER_PERSON` then went 4 -> 6, measured against a real heavy day
 *  (two people, six chores each — twelve in total). At 6 the whole list shows
 *  with no "+N more" at all, and the lowest line in the column clears the
 *  body's bottom edge by **0.4px**. That is a fit, not a margin: one more
 *  chore for either person, a third person, or a webfont metric shift on a
 *  cold boot pushes Coming up under the fold, and this column clips with
 *  `overflow: hidden`, so it goes silently.
 *
 *  That is a deliberate trade — days this busy are rare, and the alternative
 *  (the design's two-up people grid, halving the vertical cost) wraps task
 *  names like "Refill mini fridge/snacks" in a ~230px column. If chores grow
 *  routinely past this, that grid is the lever to reach for rather than a
 *  smaller cap.
 *
 *  Note people stack vertically here; the design's two-up grid was never
 *  implemented. So each extra task per person costs a full row per person,
 *  not a shared one — the caps multiply rather than add.
 *
 *  The caps exist so nothing is ever sliced mid-row: anything past them rolls
 *  into a "+N more" line rather than being clipped. And if On this day is ever
 *  restored here, or the column gains another section, these must be
 *  re-measured rather than left as they are on the assumption the room is
 *  still there — it is not.
 */
const MAX_VISIBLE_PEOPLE = 4
const MAX_TASKS_PER_PERSON = 6

function capChoreGroups(persons: PersonAssignments[]): {
  groups: VisibleChoreGroup[]
  hiddenPeopleCount: number
} {
  const visiblePersons = persons.slice(0, MAX_VISIBLE_PEOPLE)
  const groups = visiblePersons.map((p) => {
    const allTasks = p.assignments.map((a) => ({
      id: a.id,
      name: (a.picked_chore ?? a.chore).name,
      completed: a.completed,
    }))
    const visibleTasks = allTasks.slice(0, MAX_TASKS_PER_PERSON)
    return {
      personId: p.person.id,
      personName: p.person.name,
      tasks: visibleTasks,
      hiddenTaskCount: allTasks.length - visibleTasks.length,
      doneCount: allTasks.filter((t) => t.completed).length,
      totalCount: allTasks.length,
    }
  })
  return { groups, hiddenPeopleCount: persons.length - visiblePersons.length }
}

function ChoresSection({
  chores,
  onToggle,
}: {
  chores: TodayResponse
  onToggle: (id: number, completed: boolean) => void
}) {
  const { groups, hiddenPeopleCount } = capChoreGroups(chores.persons ?? [])

  return (
    <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
        <Kicker>Chores today</Kicker>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--ink-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {chores.completed_count}/{chores.total_count}
        </span>
      </div>
      {groups.length > 0 && (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {groups.map((group) => {
            const allDone = group.totalCount > 0 && group.doneCount === group.totalCount
            return (
              <div key={group.personId}>
                {/* person heading — carries the group's name and its own
                 *  done/total; individual task rows no longer repeat the
                 *  assignee (the mock moved it here from a per-row label). */}
                <div
                  className="flex items-baseline"
                  style={{
                    gap: 8,
                    borderBottom: '1px solid var(--ink)',
                    paddingBottom: 2,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14.5,
                      fontWeight: 600,
                      letterSpacing: '-0.005em',
                      color: allDone ? 'var(--forest)' : 'var(--ink)',
                    }}
                  >
                    {group.personName}
                  </span>
                  {allDone && (
                    <Check size={11} strokeWidth={2.6} style={{ color: 'var(--forest)' }} />
                  )}
                  <span className="flex-1" />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {group.doneCount}/{group.totalCount}
                  </span>
                </div>
                <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none' }}>
                  {group.tasks.map((task) => (
                    <li key={task.id}>
                      {/* The row's own box is the tap target — a button that
                       *  fills it, carrying the padding the `li` used to hold
                       *  rather than adding a box of its own. That is not a
                       *  stylistic preference: this column is `overflow:
                       *  hidden` and clears its last line by 0.4px at six
                       *  chores per person, so any extra height silently
                       *  pushes Coming up under the fold.
                       *
                       *  29.9px is under the 44px touch guideline, but the row
                       *  is 592px wide, and a toggle is self-undoing — a stray
                       *  tap is corrected by tapping again, which is why the
                       *  brief's original read-only treatment could be
                       *  relaxed. */}
                      <button
                        type="button"
                        aria-pressed={task.completed}
                        onClick={() => onToggle(task.id, !task.completed)}
                        className="flex items-center w-full text-left active:opacity-60"
                        style={{
                          gap: 9,
                          padding: '4px 0 4px 2px',
                          background: 'none',
                          border: 'none',
                          font: 'inherit',
                          color: 'inherit',
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <span
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 16,
                            height: 16,
                            border: `1.5px solid ${task.completed ? 'var(--forest)' : 'var(--ink)'}`,
                            background: task.completed ? 'var(--forest)' : 'transparent',
                            color: 'var(--paper)',
                          }}
                        >
                          {task.completed && <Check size={11} strokeWidth={2.5} />}
                        </span>
                        <span
                          className="flex-1 min-w-0"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 13.5,
                            lineHeight: 1.25,
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? 'var(--ink-muted)' : 'var(--ink)',
                          }}
                        >
                          {task.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {group.hiddenTaskCount > 0 && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontStyle: 'italic',
                      color: 'var(--ink-muted)',
                      marginTop: 2,
                    }}
                  >
                    +{group.hiddenTaskCount} more for {group.personName}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Distinct from the per-person overflow above: that one hides tasks
       *  belonging to a person who IS shown, this one hides whole people.
       *  Rendered identically they read as the same thing — and the people
       *  line sits directly beneath the last person's task list, so it looks
       *  like more of *their* tasks. Name what is hidden in each. */}
      {hiddenPeopleCount > 0 && (
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--ink-muted)',
            marginTop: 6,
            paddingTop: 4,
            borderTop: '1px dotted var(--rule)',
          }}
        >
          +{hiddenPeopleCount} {hiddenPeopleCount === 1 ? 'person' : 'people'} not shown
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Coming up ─────────────────────────
 * Mock: broadsheet-v2.jsx:288-301. The dotted leader rule that flexes to
 * fill the gap between title and count is the signature detail here. */

const MAX_COMING_UP = 4

function ComingUpSection({ items }: { items: CountdownItem[] }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <Kicker color="var(--ink-muted)">Coming up</Kicker>
      {/* Two-up, per the design: four entries across two columns rather than
          a single stack of three, so the column's width carries them instead
          of its height. */}
      <ul
        className="m-0 p-0"
        style={{
          listStyle: 'none',
          marginTop: 4,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px 24px',
        }}
      >
        {items.slice(0, MAX_COMING_UP).map((item) => (
          <li
            key={item.id}
            className="flex items-baseline"
            style={{
              gap: 8,
              fontFamily: 'var(--font-display)',
              fontSize: 12.5,
              color: 'var(--ink)',
            }}
          >
            <span>{item.name}</span>
            <span
              style={{
                flex: 1,
                borderBottom: '1px dotted var(--rule)',
                height: 8,
                alignSelf: 'flex-end',
                marginBottom: 4,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--rust)',
              }}
            >
              {item.daysUntil}d
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ───────────────────────── On this day ─────────────────────────
 * Mock: broadsheet-v2.jsx:303-313. `margin-top: auto` pins this to the
 * column's foot rather than letting it float wherever the sections above
 * it happen to end — the column reads as a designed page rather than a
 * stack that stops early. It only has room to work because `HouseholdColumn`
 * itself fills the height of its grid cell (`h-full`) — margin-top: auto
 * has nothing to push against in a container sized to its content.
 *
 * The mock puts the blurb inline beside the 22px year, sharing what's left
 * of the row after a fixed-width label — that reads fine for the mock's
 * one-line sample text, but the real feed's blurbs run a full sentence or
 * two, and wrapping that beside the year in the narrowest column on the
 * page (household, off-day) read as cramped (found live against the
 * running dashboard). Label and year now share their own line; the blurb
 * drops beneath at the column's full width instead of the leftover sliver.
 * `line-clamp-2` bounds it — the real feed has no length guarantee, and
 * this is the column's bottom-pinned section, so an unbounded blurb could
 * push its own top edge past what's visible when the sections above it are
 * full. Was `line-clamp-3` until `WeatherStrip` (the full-width band above
 * the footer) took roughly 70px from every column above it. With On this day
 * now off Home, this section is the last block in the column and the design
 * gives it two columns of four (`broadsheet-v2.jsx`), which is what the cap
 * below reflects. */

/**
 * The third column of the Home screen's body: the household rundown —
 * lunch, chores, what's coming up, and a bit of trivia — stacked top to
 * bottom in that order, "On this day" pinned to the foot. Every source can
 * be empty (or, for Lunch, simply not confirmed yet) on a cold cache; each
 * section guards its own data.
 *
 * Lunch and Chores distinguish "nothing to show" from "not fetched yet":
 * `useLunchMenu()`/`useChores()` return `null` on a cold cache or a failed
 * poll, but once a fetch has actually succeeded `lunch` is always an object
 * (`lunch.today` is `null` on a real no-school day, per
 * `LunchMenuData`/`fetchMenu`) — so a genuinely confirmed "no school today"
 * gets the mock's written heading, while a cache that hasn't loaded yet
 * stays silent rather than flashing a false negative.
 */
export function HouseholdColumn() {
  const { data: lunch } = useLunchMenu()
  const { data: chores, completeAssignment, uncompleteAssignment } = useChores()
  const { data: countdowns } = useCountdowns()

  const hasChores = !!chores && chores.total_count > 0
  const nextCountdowns = countdowns ?? []

  const hasAnything = !!lunch || hasChores || nextCountdowns.length > 0
  if (!hasAnything) return null

  // `completed` is the desired next state. `useChores` swallows failures and
  // reverts its own optimistic flip, so there is nothing to catch here.
  const handleToggle = (id: number, completed: boolean) => {
    void (completed ? completeAssignment(id) : uncompleteAssignment(id))
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {lunch && <LunchSection lunch={lunch} />}
      {hasChores && chores && <ChoresSection chores={chores} onToggle={handleToggle} />}
      {nextCountdowns.length > 0 && <ComingUpSection items={nextCountdowns} />}
    </div>
  )
}
