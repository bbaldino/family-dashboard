import { themeToVariables } from './types'
import type { ThemeColors } from './types'

interface ThemePreviewProps {
  colors: ThemeColors
}

export function ThemePreview({ colors }: ThemePreviewProps) {
  const vars = themeToVariables(colors)
  const style: Record<string, string> = { ...vars }

  return (
    <div style={style}>
      <div
        className="rounded-lg border overflow-hidden"
        style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* Mini hero */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <span className="text-[20px] font-extralight" style={{ color: 'var(--color-text-primary)' }}>
            4:40 PM
          </span>
          <div className="w-px h-6" style={{ background: 'var(--color-border-subtle)' }} />
          <div>
            <div
              className="text-[9px] font-bold uppercase"
              style={{ color: 'var(--color-palette-1)' }}
            >
              Next Up
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
                AA Practice
              </span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: 'var(--color-palette-1)' }}
              >
                5:00 PM
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[14px]">☀️</span>
            <span className="text-[14px] font-light" style={{ color: 'var(--color-text-primary)' }}>
              90°
            </span>
          </div>
        </div>

        {/* Mini widget grid */}
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {/* Schedule */}
          <MiniWidget title="Schedule" color="var(--color-palette-1)" badge="14" rowSpan>
            <div className="space-y-0.5">
              <MiniEventRow time="11:30" name="Mileage Club" color="var(--color-palette-1)" />
              <MiniEventRow time="5:00" name="AA Practice" color="var(--color-palette-1)" />
              <MiniEventRow time="5:00" name="AAA Practice" color="var(--color-palette-1)" />
            </div>
          </MiniWidget>

          {/* Packages */}
          <MiniWidget title="Packages" color="var(--color-palette-5)" badge="1">
            <div className="flex items-center gap-1">
              <span className="text-[10px]">📦</span>
              <span className="text-[9px] truncate" style={{ color: 'var(--color-text-primary)' }}>
                Toothpaste
              </span>
            </div>
          </MiniWidget>

          {/* Coming Up */}
          <MiniWidget title="Coming Up" color="var(--color-palette-3)">
            <MiniCountdown name="Avila Beach" days="25d" color="var(--color-palette-3)" />
            <MiniCountdown name="Birthday" days="28d" color="var(--color-palette-3)" />
          </MiniWidget>

          {/* Sports */}
          <MiniWidget title="Sports" color="var(--color-palette-6)" badge="1 Live">
            <div className="text-center">
              <div className="text-[8px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                NBA
              </div>
              <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                23 - 36
              </div>
              <div>
                <span
                  className="text-[8px] font-bold uppercase"
                  style={{ color: 'var(--color-role-error)' }}
                >
                  ● Live
                </span>
              </div>
            </div>
          </MiniWidget>

          {/* Chores */}
          <MiniWidget title="Chores" color="var(--color-palette-2)" badge="2/4">
            <div className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
              ✓ Make bed
            </div>
            <div className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
              ○ Clean room
            </div>
          </MiniWidget>

          {/* Lunch */}
          <MiniWidget title="Lunch" color="var(--color-palette-4)">
            <div className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
              • Hot Dog
            </div>
            <div className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
              • Corn Dog
            </div>
          </MiniWidget>

          {/* Grocery */}
          <MiniWidget title="Grocery" color="var(--color-palette-5)">
            <div className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
              No items
            </div>
          </MiniWidget>
        </div>

        {/* Mini tab bar */}
        <div
          className="flex justify-center gap-6 py-2"
          style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}
        >
          <MiniTab label="Home" active color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
          <MiniTab label="Calendar" color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
          <MiniTab label="Media" color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
        </div>
      </div>
    </div>
  )
}

function MiniWidget({
  title, color, badge, rowSpan, children,
}: {
  title: string; color: string; badge?: string; rowSpan?: boolean; children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md p-2 ${rowSpan ? 'row-span-2' : ''}`}
      style={{ background: 'var(--color-bg-card)' }}
    >
      <div
        className="flex justify-between items-center pb-1 mb-1.5"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>
          {title}
        </span>
        {badge && (
          <span
            className="text-[9px] font-semibold px-1.5 rounded"
            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function MiniEventRow({ time, name, color }: { time: string; name: string; color: string }) {
  return (
    <div className="flex gap-1 items-baseline">
      <span className="text-[9px] font-semibold min-w-[24px]" style={{ color }}>{time}</span>
      <span className="text-[9px] truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
    </div>
  )
}

function MiniCountdown({ name, days, color }: { name: string; days: string; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
      <span className="text-[9px] font-semibold" style={{ color }}>{days}</span>
    </div>
  )
}

function MiniTab({ label, active, color, textColor }: { label: string; active?: boolean; color: string; textColor: string }) {
  return (
    <div
      className="text-center text-[9px]"
      style={{ color: active ? color : textColor, fontWeight: active ? 600 : 400 }}
    >
      {label}
    </div>
  )
}
