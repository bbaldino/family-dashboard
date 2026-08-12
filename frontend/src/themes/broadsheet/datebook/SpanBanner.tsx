import { FOREST_SOFT } from './colors'
import { BANNER_H, CHIP_TOP, LANE_H, type SpanSegment } from './month-spans'

/**
 * One row's piece of a multi-day event, drawn as a continuous bar across the
 * cells it covers.
 *
 * Positioned in percentages of the whole grid rather than inside a cell,
 * because a banner has to cross the cell rules — a bar clipped inside one
 * cell is exactly the per-day chip this replaces. The layer above it carries
 * `pointerEvents: none` so the cells underneath stay untouched.
 *
 * The end treatments carry the meaning. A square end with a 2px rule says the
 * event genuinely starts or finishes here; an open end running flush to the
 * grid edge, with a chevron, says it carries into the neighbouring week — and
 * the continuing piece repeats the title with "cont." so a row read on its own
 * still says what it is.
 */
export function SpanBanner({ segment, rowCount }: { segment: SpanSegment; rowCount: number }) {
  const { col, cols, row, lane, opensSpan, closesSpan, title } = segment

  // Insets only where the event really begins or ends, so a continuing edge
  // runs flush to the week boundary and the two halves read as one bar.
  const leftInset = opensSpan ? 4 : 0
  const rightInset = closesSpan ? 4 : 0

  return (
    <div
      data-testid="span-banner"
      style={{
        position: 'absolute',
        left: `calc(${(col / 7) * 100}% + ${leftInset}px)`,
        width: `calc(${(cols / 7) * 100}% - ${leftInset + rightInset}px)`,
        top: `calc(${(row / rowCount) * 100}% + ${CHIP_TOP + lane * LANE_H}px)`,
        height: BANNER_H,
        background: FOREST_SOFT,
        borderLeft: opensSpan ? '2px solid var(--forest)' : 'none',
        borderRight: closesSpan ? '2px solid var(--forest)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: `0 ${closesSpan ? 6 : 3}px 0 ${opensSpan ? 6 : 3}px`,
        overflow: 'hidden',
      }}
    >
      {!opensSpan && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--forest)',
            flexShrink: 0,
          }}
        >
          ‹
        </span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11.5,
          // Not 1. As a flex item this span is blockified, so its `overflow:
          // hidden` — which `text-overflow: ellipsis` requires — clips at the
          // content box, and at line-height 1 that box is 11.5px against an
          // 11px font box: a quarter-pixel of headroom. An accented capital's
          // ink reaches 10px above the baseline, so `É` lost its accent and
          // rendered as `E`. 1.4 puts the ceiling at 10.55px.
          lineHeight: 1.4,
          color: 'var(--forest)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
        {!opensSpan && <span style={{ fontStyle: 'italic', fontWeight: 400 }}> cont.</span>}
      </span>
      {!closesSpan && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--forest)',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          ›
        </span>
      )}
    </div>
  )
}
