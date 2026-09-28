/**
 * The aggregated data behind the Sports section — "The Sporting Page".
 *
 * One `SportsSection` is a whole page: one `SportColumn` per followed league,
 * already ordered by the league's phase — postseason, then regular season,
 * then preseason, then off-season (ties keep the configured order). A
 * column's phase decides its shape: in season it carries the team card,
 * division table, league scores and In brief; in the postseason the whole
 * field's series list replaces table and scores; preseason and off-season
 * keep to a compact card and In brief.
 *
 * Display-ready where the backend can make them so (records carry their own
 * dash, percentages their own leading dot); timestamps stay ISO so the page
 * can say "Today" or "3h ago" against its own clock.
 */
export interface SportsSection {
  /** Masthead right ear: where each league sits in its season. */
  clock: { league: string; detail: string }[]
  /** One per followed league, already ordered: postseason, regular season,
   *  preseason, off-season. */
  columns: SportColumn[]
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

/** A scoreboard line's own state, independent of the column's season phase. */
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

/** The league's whole scoreboard for the slate — `total` counts every game
 *  even when `rows` is capped for display. */
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

/** One round of the postseason currently in progress — its own series, plural
 *  when two leagues' rounds overlap (e.g. ALDS and NLDS at once). */
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
