import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthCalendar } from './useMonthCalendar'

export function CalendarBoard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { data, isLoading, error } = useMonthCalendar(year, month)

  const goToPrev = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  const goToNext = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const monthName = new Date(year, month).toLocaleDateString([], { month: 'long', year: 'numeric' })

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-text-primary">{monthName}</h1>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-[12px] font-medium text-calendar bg-calendar/10 rounded-[var(--radius-button)] hover:bg-calendar/20 transition-colors"
            >
              Today
            </button>
          )}
          <button
            onClick={goToPrev}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToNext}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-button)] border border-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid area */}
      <div className="flex-1 min-h-0 bg-bg-card rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            Connect Google Calendar in Settings
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            {isLoading ? 'Loading...' : `Month grid placeholder — ${Object.keys(data?.byDate ?? {}).length} days with events`}
          </div>
        )}
      </div>
    </div>
  )
}
