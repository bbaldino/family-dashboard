import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BriefItem, SportColumn } from '@/integrations/sports'
import { TeamCard } from './TeamCard'
import { InBrief, BRIEF_FRAME_HEIGHT } from './InBrief'
import { LeagueScores } from './LeagueScores'
import { PostseasonSeries } from './PostseasonSeries'
import { DivisionTable, LeaderBlock } from './SportsBlocks'
import { StreakList } from './SportsPrimitives'
import { fitBriefCount, fitLeadingCount } from './column-fit'
import { COLUMN_CAPS } from './sports-tokens'
import { shownFitStyle, hiddenFitStyle } from '@/themes/broadsheet/fit-styles'

/**
 * The optional tail of a regular-season column (form, then leaders): each
 * block shows only if it fits whole in what's left of the column — measured,
 * so a tall table or a long brief simply leaves no room rather than clipping
 * an extra mid-line. Every block stays mounted so it can be measured again
 * when the column's content changes.
 */
function FittedExtras({ blocks }: { blocks: { key: string; node: ReactNode }[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const [count, setCount] = useState(0)

  const measure = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const heights = blocks.map((_, i) => itemRefs.current[i]?.offsetHeight ?? 0)
    setCount(fitLeadingCount(heights, box.clientHeight))
  }, [blocks])

  useLayoutEffect(measure)
  const blockKeys = blocks.map((b) => b.key).join('|')
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    itemRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [blockKeys, measure])

  return (
    <div ref={boxRef} className="flex-1 min-h-0 relative overflow-hidden">
      {blocks.map((b, i) => (
        <div
          key={b.key}
          ref={(el) => {
            itemRefs.current[i] = el
          }}
          style={i < count ? shownFitStyle : hiddenFitStyle}
          aria-hidden={i < count ? undefined : true}
        >
          {b.node}
        </div>
      ))}
    </div>
  )
}

/**
 * Everything under a column's fixed blocks (card, table, scores or series):
 * In brief, then the optional extras. The brief shows as many whole items as
 * fit the room actually left — measured, up to `max` — and names the rest in
 * "+N more"; the extras then get whatever the brief leaves. That is the
 * spec's shedding order: extras give way first, then In brief, and the fixed
 * blocks above never do.
 */
function FittedTail({
  items,
  max,
  deks,
  now,
  extras,
}: {
  items: BriefItem[]
  max: number
  deks: number
  now: Date
  extras: { key: string; node: ReactNode }[]
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ shown: max, more: true })

  const measure = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    const height = (sel: string) => box.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0
    const heights = [...box.querySelectorAll<HTMLElement>('[data-brief-item]')].map(
      (el) => el.offsetHeight,
    )
    const available = box.clientHeight - BRIEF_FRAME_HEIGHT - height('[data-brief-head]')
    const next = fitBriefCount(heights, available, height('[data-brief-more]'), items.length)
    setFit((prev) => (prev.shown === next.shown && prev.more === next.more ? prev : next))
  }, [items.length])

  useLayoutEffect(measure)
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    // The box for the room, and every measured part for its own height — a
    // late web font reflows the items without resizing the box.
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    box
      .querySelectorAll('[data-brief-head], [data-brief-item], [data-brief-more]')
      .forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [measure, items])

  return (
    <div
      ref={boxRef}
      data-testid="league-tail"
      className="flex-1 min-h-0 flex flex-col relative overflow-hidden"
    >
      <InBrief items={items} max={max} deks={deks} now={now} shown={fit.shown} more={fit.more} />
      {extras.length > 0 && <FittedExtras blocks={extras} />}
    </div>
  )
}

/**
 * One league's column, shaped by its phase: the regular season stacks the
 * team card, division table, league scores and In brief (as many items as
 * fit), with form and leaders only as room allows; the postseason swaps
 * table and scores for the whole field's series list; preseason and
 * off-season keep to a compact card and In brief.
 */
export function LeagueColumn({ column, now }: { column: SportColumn; now: Date }) {
  const caps = COLUMN_CAPS

  const extras = useMemo(() => {
    const blocks: { key: string; node: ReactNode }[] = []
    if (
      column.phase === 'regular' &&
      column.hot &&
      column.cold &&
      (column.hot.length || column.cold.length)
    ) {
      blocks.push({
        key: 'form',
        node: (
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 10 }}>
            <StreakList label="Running hot" rows={column.hot} />
            <StreakList label="Cold snap" rows={column.cold} />
          </div>
        ),
      })
    }
    if (column.phase === 'regular' && column.leaders?.length) {
      blocks.push({
        key: 'leaders',
        node: (
          <div style={{ marginTop: 10 }}>
            <LeaderBlock leaders={column.leaders} maxCats={4} depth={1} />
          </div>
        ),
      })
    }
    return blocks
  }, [column])

  const briefMax =
    column.phase === 'regular'
      ? caps.regular.brief
      : column.phase === 'postseason'
        ? caps.postseason.brief
        : caps.compact.brief

  return (
    <div data-testid={`league-column-${column.league}`} className="h-full min-h-0 flex flex-col">
      <TeamCard column={column} />
      {column.phase === 'regular' && column.table && (
        <div style={{ marginTop: 8 }}>
          <DivisionTable table={column.table} />
        </div>
      )}
      {/* An empty slate (no games at all, not just none shown) renders no
          block — a bare "Around the <league>" header with nothing under it
          reads as broken, not quiet. */}
      {column.phase === 'regular' && column.scores && column.scores.total > 0 && (
        <LeagueScores league={column.league} slate={column.scores} max={caps.regular.scores} />
      )}
      {column.phase === 'postseason' && column.postseason && (
        <PostseasonSeries view={column.postseason} maxSeries={caps.postseason.series} />
      )}
      <FittedTail
        items={column.brief}
        max={briefMax}
        deks={caps.briefDeks}
        now={now}
        extras={extras}
      />
    </div>
  )
}
