export type Clip = {
  eventId: string
  start: number
}
export type Visit = {
  id: string
  start: number
  end: number
  count: number
  clips: Clip[]
  snapshotEventId: string
  durationS: number
}
export const snapshotUrl = (eventId: string) => `/api/cameras/snapshot/${eventId}`
export const clipUrl = (eventId: string) => `/api/cameras/clip/${eventId}`
export const posterUrl = (eventId: string) => `/api/cameras/snapshot/${eventId}?full=1`
