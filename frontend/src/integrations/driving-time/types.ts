export interface DrivingTimeResult {
  durationSeconds: number | null
  durationText: string | null
  bufferMinutes: number
}

export type DriveUrgency = 'ok' | 'soon' | 'urgent'

export interface EventDriveInfo {
  durationSeconds: number
  durationText: string
  leaveByTime: Date
  minutesUntilLeave: number
  urgency: DriveUrgency
  displayText: string
}
