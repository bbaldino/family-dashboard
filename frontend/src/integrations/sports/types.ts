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

export interface MlbSituationData {
  type: 'mlb'
  outs: number
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
  balls: number | null
  strikes: number | null
  batter: string | null
  pitcher: string | null
}

export interface NbaSituationData {
  type: 'nba'
}

export interface NhlSituationData {
  type: 'nhl'
}

export interface NflSituationData {
  type: 'nfl'
}

export type GameSituation = MlbSituationData | NbaSituationData | NhlSituationData | NflSituationData

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
  situation: GameSituation | null
  lastPlay: string | null
  headline: string | null
  linescores: LinescoreEntry[]
  athletes: GameAthlete[]
  espnUrl: string | null
  liveDetail: GameLiveDetail | null
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
  athleteId: string | null
  team: 'home' | 'away' | null
  headshotUrl: string | null
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

export interface WinProbability {
  home: number
  away: number
}

export interface PitcherInfo {
  id: string
  name: string
  headshotUrl: string | null
  hand: string | null
  era: string | null
  pitchesToday: number | null
  record: string | null
}

export interface BatterInfo {
  id: string
  name: string
  headshotUrl: string | null
  hand: string | null
  avg: string | null
  hr: number | null
  rbi: number | null
  todayLine: string | null
}

export interface Matchup {
  pitcher: PitcherInfo
  batter: BatterInfo
}

export interface Pitch {
  kind: 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'in_play'
  speedMph: number | null
  pitchType: string | null
}

export interface Play {
  id: string
  text: string
  inningHalf: string | null
  inningNumber: number | null
  scoring: boolean
}

export interface GameLeader {
  category: string
  playerName: string
  displayValue: string
}

export interface GameLeaders {
  home: GameLeader[]
  away: GameLeader[]
}

export interface ScoringRecap {
  text: string
  throughInning: { half: string; number: number } | null
}

export interface MlbLiveDetail {
  sport: 'mlb'
  matchup: Matchup | null
  pitchSequence: Pitch[]
  recentPlays: Play[]
  scoringPlays: Play[]
  inProgressScoring: Play[]
  scoringRecap: ScoringRecap | null
  leaders: GameLeaders
}

export type SportSpecificLiveDetail = MlbLiveDetail
// | NbaLiveDetail (future)

export interface LiveGameDetailBase {
  winProbability: WinProbability | null
}

// On the wire, the backend flattens the sport-specific block into LiveGameDetail
// (Rust: #[serde(flatten)] on the sport_specific enum). So the JSON shape is
// LiveGameDetailBase & SportSpecificLiveDetail merged at the same level.
export type GameLiveDetail = LiveGameDetailBase & SportSpecificLiveDetail
