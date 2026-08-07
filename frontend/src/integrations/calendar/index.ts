export { calendarIntegration } from './config'
export { useGoogleCalendar } from './useGoogleCalendar'
export type { CalendarData, CalendarDay } from './useGoogleCalendar'
export { useMonthCalendar } from './useMonthCalendar'
export type { MonthEvents } from './useMonthCalendar'
export { useCalendarEvents } from './useCalendarEvents'
// `CalendarEvent` and `CalendarListEntry` are deliberately not re-exported:
// the event shape is Google's, so it belongs to the provider, and a second
// path to the same type is how two copies of it start.
