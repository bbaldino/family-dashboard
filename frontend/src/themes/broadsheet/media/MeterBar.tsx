/**
 * The 3px hairline bar used for both progress (`NowSpinning`,
 * `CentreSpreadPlate`) and volume (`VolumeSlider`) — one definition rather
 * than three, because it was three copies that let one mistake ship three
 * times: each drew its fill with `position: absolute; inset: 0` plus a
 * `width`. Setting both `left` and `right` over-constrains the box, so the
 * width was ignored and every bar rendered permanently full. The progress
 * bars read as "the track is at the end" at all times, and the volume bar as
 * "volume is at 100%".
 *
 * The unfilled track is `--rule-faint`, not `--rule`: the latter is the
 * theme's hairline separator colour and is deliberately identical to `--ink`,
 * so a bar drawn on it had a black fill on a black track — geometrically
 * correct and completely invisible.
 */
export function MeterBar({
  percent,
  fill,
  testId,
}: {
  percent: number
  /** Fill colour — rust for progress, ink for volume. */
  fill: string
  testId?: string
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0))
  return (
    <div
      data-testid={testId}
      style={{ width: '100%', height: 3, background: 'var(--rule-faint)', position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${clamped}%`,
          background: fill,
        }}
      />
    </div>
  )
}
