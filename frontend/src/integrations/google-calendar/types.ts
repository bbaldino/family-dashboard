export interface CalendarEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  description?: string
  location?: string
}

export interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}
