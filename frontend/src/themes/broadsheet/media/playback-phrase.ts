import type { QueueState } from '@/integrations/music'

/**
 * How to introduce the room a masthead is about, given what that room is
 * actually doing: "Now playing in the Kitchen", but "Paused in the
 * Kitchen" when it's paused and "Quiet in the Kitchen" when there's nothing
 * on at all.
 *
 * Both mastheads said "Now playing in" regardless of state, which was
 * simply untrue for the paused queue that prompted this — a wall panel that
 * claims music is playing when the room is silent is worse than one that
 * says nothing. Shared by `MediaMasthead` and `CentreSpreadMasthead` rather
 * than written twice, for the same reason their room pills share one hook:
 * the two screens' wording is not allowed to drift.
 *
 * The caller supplies the article and the room — `MediaMasthead` puts them
 * on separate lines (kicker over numeral), the Centre Spread runs them into
 * one — so this returns only the leading phrase.
 */
export function playbackPhrase(state: QueueState['state'] | null): string {
  if (state === 'playing') return 'Now playing in'
  if (state === 'paused') return 'Paused in'
  // An idle queue that still has a track on it is the last thing this room
  // played, not something it is playing now.
  if (state === 'idle') return 'Last played in'
  return 'Quiet in'
}
