import { Check } from 'lucide-react'
import { useCountdowns } from '@/data/countdowns'
import type { CountdownItem } from '@/data/countdowns'
import { useOnThisDay } from '@/data/on-this-day'
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
const SOFT_ACCENT = 'color-mix(in srgb, var(--rust) 55%, var(--ink-muted) 45%)'

/* ───────────────────────── Lunch ─────────────────────────
 * Mock: broadsheet-v2.jsx:229-249. */

function LunchSection({ lunch }: { lunch: LunchMenuData }) {
  const today = lunch.today
  const items = today
    ? today.entries.length > 0
      ? today.entries.map((entry) => ({ name: entry.name, sub: (entry.withItems ?? []).join(', ') || null }))
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', width: 14, flexShrink: 0 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.2, color: 'var(--ink)' }}>{item.name}</span>
                {item.sub && (
                  <span
                    style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-muted)', marginLeft: 5 }}
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
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}
        >
          The cafeteria&apos;s closed. Pantry&apos;s yours — leftovers, fruit, the usual.
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── Chores ─────────────────────────
 * Mock: broadsheet-v2.jsx:252-297. The mock's chores are clickable and show
 * a per-person streak; ours are read-only (per the brief — no toggling in
 * this task) and the streak has no backing data (`TodayResponse` carries
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
 *  These two numbers were tuned by measurement, not guesswork: rendered the
 *  household column live via Playwright route interception (school-day
 *  lunch populated + coming-up at its cap + the on-this-day blurb at its
 *  tight 2-line "crowded" clamp — the fullest realistic combination this
 *  file's other comments already establish) and checked whether the
 *  on-this-day *blurb paragraph itself* — not just its heading, which sits
 *  above it and can fit while the paragraph below still clips — stayed
 *  inside the body row's bounds. That distinction mattered: an
 *  `On this day` heading can report a healthy margin while the blurb
 *  beneath it is entirely clipped (found live, screenshotted, and reverted
 *  once caught), because `margin-top: auto` pins the *section* to the
 *  column's foot but doesn't protect the section's own children from being
 *  pushed past the fold if the section is taller than the space that's
 *  left. `MAX_VISIBLE_PEOPLE = 2` matches today's actual household size —
 *  a third member would need to join before it ever engages.
 *  `MAX_TASKS_PER_PERSON = 2` is the largest value that keeps the blurb
 *  paragraph fully on-screen at the worst case the caps ever allow (two
 *  people, each pushed past their cap) — verified both by measuring the
 *  paragraph's own bounding box and by screenshot. It's tighter than it
 *  looks: this household's own recorded history has both people
 *  simultaneously over a cap of 2 on roughly half of sampled days, so the
 *  "+N more" fallback is a routine sight, not a rare edge case — and the
 *  fit has zero measured clearance to spare, tight enough that a webfont
 *  swap on a cold boot is a real (if unconfirmed) risk. If the household
 *  grows past two people, or this ever clips in practice, re-measure
 *  against the blurb paragraph rather than raising these blind. */
const MAX_VISIBLE_PEOPLE = 2
const MAX_TASKS_PER_PERSON = 2

function capChoreGroups(persons: PersonAssignments[]): { groups: VisibleChoreGroup[]; hiddenPeopleCount: number } {
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

function ChoresSection({ chores }: { chores: TodayResponse }) {
  const { groups, hiddenPeopleCount } = capChoreGroups(chores.persons ?? [])

  return (
    <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
        <Kicker>Chores today</Kicker>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
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
                  style={{ gap: 8, borderBottom: '1px solid var(--ink)', paddingBottom: 2, marginBottom: 3 }}
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
                  {allDone && <Check size={11} strokeWidth={2.6} style={{ color: 'var(--forest)' }} />}
                  <span className="flex-1" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
                    {group.doneCount}/{group.totalCount}
                  </span>
                </div>
                <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none' }}>
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center"
                      style={{ gap: 9, padding: '4px 0 4px 2px' }}
                    >
                      {/* Read-only status mark, not a control — the mock's
                       *  chores are clickable, ours aren't (per the brief).
                       *  No cursor, no hover, no button semantics. */}
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
                    </li>
                  ))}
                </ul>
                {group.hiddenTaskCount > 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontStyle: 'italic', color: 'var(--ink-muted)', marginTop: 2 }}>
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

const MAX_COMING_UP = 3

function ComingUpSection({ items }: { items: CountdownItem[] }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <Kicker color="var(--ink-muted)">Coming up</Kicker>
      <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none', marginTop: 4, gap: 2 }}>
        {items.slice(0, MAX_COMING_UP).map((item) => (
          <li
            key={item.id}
            className="flex items-baseline"
            style={{ gap: 8, fontFamily: 'var(--font-display)', fontSize: 12.5, color: 'var(--ink)' }}
          >
            <span>{item.name}</span>
            <span style={{ flex: 1, borderBottom: '1px dotted var(--rule)', height: 8, alignSelf: 'flex-end', marginBottom: 4 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--rust)' }}>{item.daysUntil}d</span>
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
 * the footer) took roughly 70px from every column above it — measured live
 * against the running dashboard, the column's fullest state (lunch, capped
 * chores, capped coming-up, and this blurb) still fit at 3 lines with zero
 * pixels of clearance, which is a hairline to build on rather than a real
 * margin (webfont metrics before `Newsreader Variable` finishes loading on
 * a cold boot could tip it). Trimmed to 2 lines for real headroom, which
 * also now matches `grid`'s own on-this-day widget for this exact field
 * (`OnThisDayWidget.tsx`), coincidentally already 2. */

/**
 * How many lines of the blurb to show. Real entries run 80–165 characters —
 * two lines holds roughly 90, so a fixed two-line clamp truncates most of
 * them, and on a quiet day it does so with a screenful of empty column
 * sitting above. But the clamp can't simply be raised: when Lunch and Chores
 * are both populated (i.e. a school day) the column is full, and the extra
 * lines are exactly what would push this block past the canvas.
 *
 * So the clamp follows the column's own occupancy — which we already know
 * here, without measuring anything. A crowded column keeps the tight
 * two-line setting; a sparse one spends the space it actually has.
 */
function blurbLineClamp(crowded: boolean): 'line-clamp-2' | 'line-clamp-4' {
  return crowded ? 'line-clamp-2' : 'line-clamp-4'
}

function OnThisDaySection({
  event,
  crowded,
}: {
  event: { year: number | null; text: string }
  crowded: boolean
}) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <div className="flex items-baseline" style={{ gap: 10 }}>
        <span
          className="uppercase whitespace-nowrap"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.18em' }}
        >
          On this day
        </span>
        {event.year !== null && (
          <span
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, lineHeight: 0.9, color: SOFT_ACCENT }}
          >
            {event.year}
          </span>
        )}
      </div>
      <p
        className={`m-0 ${blurbLineClamp(crowded)}`}
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          // The mock sets 11.5px, but its sample blurb was one short line. Real
          // entries run to three, and at wall-viewing distance 11.5px is too
          // small to be worth reading — sized up to sit with the lunch list.
          fontSize: 15,
          lineHeight: 1.4,
          color: 'var(--ink)',
        }}
      >
        {event.text}
      </p>
    </div>
  )
}

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
  const { data: chores } = useChores()
  const { data: countdowns } = useCountdowns()
  const { data: onThisDay } = useOnThisDay()

  const hasChores = !!chores && chores.total_count > 0
  const nextCountdowns = countdowns ?? []
  const onThisDayEvent = onThisDay?.events?.[0]

  const hasAnything = !!lunch || hasChores || nextCountdowns.length > 0 || !!onThisDayEvent
  if (!hasAnything) return null

  // A lunch menu with actual items and a chore list are what fill this column;
  // with both present there is no slack left for a longer blurb below.
  const crowded = !!lunch?.today && hasChores

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {lunch && <LunchSection lunch={lunch} />}
      {hasChores && chores && <ChoresSection chores={chores} />}
      {nextCountdowns.length > 0 && <ComingUpSection items={nextCountdowns} />}
      {onThisDayEvent && <OnThisDaySection event={onThisDayEvent} crowded={crowded} />}
    </div>
  )
}
