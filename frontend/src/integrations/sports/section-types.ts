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
