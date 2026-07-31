import { Check } from 'lucide-react'
import { useCountdowns } from '@/data/countdowns'
import type { CountdownItem } from '@/data/countdowns'
import { useOnThisDay } from '@/data/on-this-day'
import { useChores } from '@/data/chores'
import type { TodayResponse } from '@/data/chores'
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
 * Mock: broadsheet-v2.jsx:251-286. The mock's chores are clickable and show
 * a per-person streak; ours are read-only (per the brief — no toggling in
 * this task) and the streak has no backing data (`TodayResponse` carries
 * `completed_count`/`total_count`, not a streak), so it's omitted rather
 * than invented. Everything else the mock shows — per-chore name and
 * assignee — the real `useChores()` payload does support: each person in
 * `TodayResponse.persons` carries their own `assignments`, each with a
 * `chore` (and an optional `picked_chore` for meta-chores). */

interface FlatChore {
  id: number
  name: string
  personName: string
  completed: boolean
}

function flattenChores(chores: TodayResponse): FlatChore[] {
  return (chores.persons ?? []).flatMap((p) =>
    p.assignments.map((a) => ({
      id: a.id,
      name: (a.picked_chore ?? a.chore).name,
      personName: p.person.name,
      completed: a.completed,
    })),
  )
}

/** How many chore rows this section ever renders. The mock's chore list is
 *  a handful of fixed mock entries; the real feed has no such ceiling — a
 *  full house on a busy day could run well past what this column, stacked
 *  beneath Lunch and above Coming Up / On This Day, has room for on the
 *  fixed canvas. Capped the same way `ScheduleColumn` caps its day and
 *  event lists, with a "+N more" line rather than a silent clip. */
const MAX_VISIBLE_CHORES = 6

function ChoresSection({ chores }: { chores: TodayResponse }) {
  const flat = flattenChores(chores)
  const visible = flat.slice(0, MAX_VISIBLE_CHORES)
  const hidden = flat.length - visible.length

  return (
    <div style={{ marginTop: 14, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
        <Kicker>Chores today</Kicker>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
          {chores.completed_count}/{chores.total_count}
        </span>
      </div>
      {visible.length > 0 && (
        <ul className="m-0 p-0 flex flex-col" style={{ listStyle: 'none' }}>
          {visible.map((chore, i) => (
            <li
              key={chore.id}
              className="flex items-center gap-2.5"
              style={{ padding: '6px 4px', borderTop: i === 0 ? 'none' : '1px dotted var(--rule)' }}
            >
              {/* Read-only status mark, not a control — the mock's chores
               *  are clickable, ours aren't (per the brief). No cursor,
               *  no hover, no button semantics. */}
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 18,
                  height: 18,
                  border: `1.5px solid ${chore.completed ? 'var(--forest)' : 'var(--ink)'}`,
                  background: chore.completed ? 'var(--forest)' : 'transparent',
                  color: 'var(--paper)',
                }}
              >
                {chore.completed && <Check size={12} strokeWidth={2.5} />}
              </span>
              <span
                className="flex-1 min-w-0"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  lineHeight: 1.25,
                  textDecoration: chore.completed ? 'line-through' : 'none',
                  color: chore.completed ? 'var(--ink-muted)' : 'var(--ink)',
                }}
              >
                {chore.name}
              </span>
              <span
                className="uppercase flex-shrink-0"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.15em' }}
              >
                {chore.personName}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontStyle: 'italic', color: 'var(--ink-muted)', marginTop: 4 }}>
          +{hidden} more
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
 * `line-clamp-3` bounds it the same way `grid`'s own on-this-day widget
 * already caps this exact field (`OnThisDayWidget.tsx`) — the real feed
 * has no length guarantee, and this is the column's bottom-pinned section,
 * so an unbounded blurb could push its own top edge past what's visible
 * when the sections above it are full. */

function OnThisDaySection({ event }: { event: { year: number | null; text: string } }) {
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
        className="m-0 line-clamp-3"
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          // The mock sets 11.5px, but its sample blurb was one short line. Real
          // entries run to three, and at wall-viewing distance 11.5px is too
          // small to be worth reading — sized up to sit with the lunch list.
          fontSize: 13.5,
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

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {lunch && <LunchSection lunch={lunch} />}
      {hasChores && chores && <ChoresSection chores={chores} />}
      {nextCountdowns.length > 0 && <ComingUpSection items={nextCountdowns} />}
      {onThisDayEvent && <OnThisDaySection event={onThisDayEvent} />}
    </div>
  )
}
