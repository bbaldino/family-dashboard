import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SportColumn } from '@/integrations/sports'
import { TeamCard } from './TeamCard'
import { InBrief } from './InBrief'
import { LeagueScores } from './LeagueScores'
import { PostseasonSeries } from './PostseasonSeries'
import { DivisionTable, LeaderBlock } from './SportsBlocks'
import { StreakList } from './SportsPrimitives'
import { fitLeadingCount } from './column-fit'
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
 * One league's column, shaped by its phase: the regular season stacks the
 * team card, division table, league scores and In brief, with form and
 * leaders only as room allows; the postseason swaps table and scores for the
 * whole field's series list; preseason and off-season keep to a compact card
 * and In brief.
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
      <InBrief items={column.brief} max={briefMax} deks={caps.briefDeks} now={now} />
      {extras.length > 0 && <FittedExtras blocks={extras} />}
    </div>
  )
}
