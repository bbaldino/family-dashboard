import type { Player } from '@/integrations/music'

/**
 * One word for what a room is doing, for the Media masthead's room ear.
 *
 * The design shows the *track* playing in each room ("Black Steel"), which
 * this deliberately does not attempt: `/players` carries a player's state but
 * not its queue, so a title per room would mean a `/queue/{id}` call for every
 * speaker in the house on every masthead render. A state word is what the one
 * call we already make can answer honestly.
 *
 * `paused` is kept distinct from `silent` because they are different
 * situations to walk into — a paused room resumes where it left off, an idle
 * one has nothing to resume. Anything unavailable reads `off`: a speaker that
 * has dropped off the network is not quiet, it is gone.
 */
export function roomStateWord(player: Player): string {
  if (!player.available) return 'off'
  if (player.state === 'playing') return 'playing'
  if (player.state === 'paused') return 'paused'
  return 'silent'
}
