/**
 * The aggregated data behind the Sports section — "The Sporting Page".
 *
 * One `SportsSection` is a whole page. Its `leagues` array is the structural
 * pivot: **one track leads a single front, two tracks run a split front** down
 * all four columns. Leagues rank by season *type* — Regular Season, then
 * Postseason, then Preseason, then off-season — so a mid-season league always
 * outranks one only in preseason with placeholder `0-0` records, and only the
 * top rank (never more than two) gets a track; the rest drop to `elsewhere`.
 *
 * These are display-ready strings, not raw API values: records carry their own
 * dash, percentages their own leading dot, dates their own format. The backend
 * aggregation (stage 2) shapes them; the frontend only lays them out. This
 * mirrors the mock's `SPORTS_DATA` verbatim so the screen can be built and
 * verified against fixtures before that aggregation exists.
 */
export interface SportsSection {
  /** Masthead left ear: the next game for each followed team. */
  fixtures: { team: string; detail: string }[]
  /** Masthead right ear: where each league sits in its own season — what makes
   *  the table below mean anything. */
  clock: { league: string; detail: string }[]
  /** The house's one-line prose lede beneath the masthead. */
  standfirst: string
  /** One entry leads a single front; two run a split front. Never more. */
  leagues: SportsTrack[]
  /** Leagues below the top rank — status and one headline each, no track. */
  elsewhere: ElsewhereEntry[]
}

/** One league's self-contained page-worth of content. */
export interface SportsTrack {
  league: string
  /** The followed team in this league. */
  team: string
  /** "Regular Season" | "Postseason" | "Preseason" — the rank source. */
  seasonType: string
  record: string
  standing: string
  home: string
  away: string
  next: string
  headline: string
  dek: string
  /** The lead photo's caption. */
  caption: string
  /** Follow-up stories under the lead. */
  more: { h: string; dek: string; meta: string }[]
  table: { title: string; sub: string; rows: TableRow[] }
  /** "Tuesday's" — labels the finals as last night's rather than today's. */
  scoresLabel: string
  scores: ScoreRow[]
  leaders: LeaderCategory[]
  hot: StreakRow[]
  cold: StreakRow[]
}

export interface TableRow {
  t: string
  w: number
  l: number
  pct: string
  gb: string
  strk: string
  /** The followed team's own row, marked so the table can pick it out. */
  me?: boolean
}

export interface ScoreRow {
  /** Away abbreviation and score, then home. */
  a: string
  as: number
  h: string
  hs: number
  /** The standout performer and their line — from the scoreboard's own
   *  per-game leader, so it costs no extra call. */
  star: string
  line: string
}

export interface LeaderCategory {
  cat: string
  abbr: string
  /** `[name, team, value]` per leader. League-specific categories: HR/AVG/ERA
   *  for baseball, PPG/RPG/APG for basketball, and so on. */
  rows: [string, string, string][]
}

export interface StreakRow {
  t: string
  rec: string
  strk: string
}

/** A league column's place in its own season, in column order (postseason
 *  first, off-season last). */
export type SportPhase = 'postseason' | 'regular' | 'preseason' | 'offseason'

/** The followed team's most recent completed game. */
export interface LastGame {
  result: 'W' | 'L' | 'T'
  score: string
  opponent: string
  homeAway: 'home' | 'away'
  startsAt: string
}

/** The followed team's next scheduled game. `label` names a playoff game
 *  ("NLDS · Game 1") when there is one, otherwise null. */
export interface NextGame {
  opponent: string
  homeAway: 'home' | 'away'
  startsAt: string
  tv: string | null
  label: string | null
}

/** The team card's own fields — record and form in the regular season,
 *  `seriesStatus` while the postseason is live, `seasonEnded` once it's
 *  over; `last`/`next` drop to null when the schedule couldn't be read. */
export interface TeamCardData {
  record: string | null
  standing: string | null
  streak: string | null
  home: string | null
  road: string | null
  last10: string | null
  last: LastGame | null
  next: NextGame | null
  /** Still playing — e.g. "NLDS · LAD leads 1–0 · best of 5". */
  seriesStatus: string | null
  /** Out, champion, or missed — e.g. "Out in NLDS, 1–3 to SD". */
  seasonEnded: string | null
}

/** The regular-season division/standings block. */
export interface StandingsTable {
  title: string
  rows: TableRow[]
}

export type GameStatus = 'live' | 'upcoming' | 'final'

/** One line of the league's scoreboard slate. */
export interface ScoreLine {
  a: string
  as: number
  h: string
  hs: number
  state: GameStatus
  detail: string
  startsAt: string
  /** The followed team is playing in this game. */
  mine: boolean
}

export interface ScoreSlate {
  rows: ScoreLine[]
  total: number
}

/** One postseason series between two teams. */
export interface SeriesRow {
  a: string
  aWins: number
  b: string
  bWins: number
  detail: string
  live: boolean
  done: boolean
  /** The followed team is one of the two sides. */
  mine: boolean
  nextStartsAt: string | null
}

export interface PostseasonRound {
  round: string
  bestOf: number | null
  series: SeriesRow[]
}

/** The postseason bracket, by round: series in progress, finished rounds
 *  summarised, rounds still to come. */
export interface PostseasonView {
  current: PostseasonRound[]
  completed: { round: string; summary: string }[]
  upcoming: { round: string; bestOf: number | null; startsAt: string }[]
}

/** One In brief headline — team news first, then league, newest first. */
export interface BriefItem {
  h: string
  dek: string | null
  source: 'team' | 'league'
  tag: string
  publishedAt: string
}

/** One league column: the followed team's card plus whichever blocks its
 *  phase supports — a regular-season column carries `table`/`scores`, a
 *  postseason one carries `postseason`; any block can be null when its own
 *  fetch failed. */
export interface SportColumn {
  league: string
  team: string
  teamAbbr: string
  phase: SportPhase
  phaseDetail: string
  card: TeamCardData
  table: StandingsTable | null
  scores: ScoreSlate | null
  postseason: PostseasonView | null
  brief: BriefItem[]
  leaders: LeaderCategory[] | null
  hot: StreakRow[] | null
  cold: StreakRow[] | null
}

/** A league below the top rank: its followed team's status and one story, but
 *  no track. `record` is null off-season (with a countdown in `note`) and a
 *  real `0-0` with a `tag` in preseason — real data, visibly distinct from
 *  absent data. */
export interface ElsewhereEntry {
  league: string
  team: string
  record: string | null
  tag?: string
  note: string
  story: { h: string; meta: string }
}
