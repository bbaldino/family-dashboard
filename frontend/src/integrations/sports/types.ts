export interface GameTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  record: string | null
  score: number | null
  winner: boolean | null
}

export interface Leader {
  team: 'home' | 'away'
  name: string
  stats: string
}

export type GameState = 'live' | 'final' | 'upcoming' | 'postponed'

export interface Game {
  id: string
  league: string
  state: GameState
  name: string
  startTime: string
  venue: string | null
  broadcast: string | null
  playoffRound: string | null
  home: GameTeam
  away: GameTeam
  clock: string | null
  period: number | null
  periodLabel: string | null
  leaders: Leader[]
  allLeaders: Leader[]
  situation: string | null
  linescores: LinescoreEntry[]
  athletes: GameAthlete[]
  espnUrl: string | null
}

export interface LinescoreEntry {
  period: number
  homeScore: string
  awayScore: string
}

export interface GameAthlete {
  name: string
  stats: string | null
  role: string
}

export interface GamesResponse {
  games: Game[]
  hasLive: boolean
}

export interface TeamInfo {
  id: string
  name: string
  displayName: string
  abbreviation: string
  logo: string
  league: string
}

export interface TeamsResponse {
  teams: TeamInfo[]
}

export interface TrackedTeam {
  league: string
  teamId: string
  name?: string
  logo?: string
}
