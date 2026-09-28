import type {
  BriefItem,
  PostseasonView,
  SeriesRow,
  SportColumn,
  SportsSection,
  TeamCardData,
} from './section-types'

/**
 * Fixture sections for `?scenario=`, one per shape the page has to get right:
 *
 * - `sports-summer` — MLB alone in season (one wide column), NFL preseason and
 *   NBA off-season as narrow columns.
 * - `sports-autumn` — NFL and MLB both regular season, NBA preseason.
 * - `sports-postseason` — MLB in the NLDS with the Dodgers alive, NFL regular.
 * - `sports-eliminated` — the Dodgers out; the MLB column still follows the field.
 *
 * Numbers are plausible, not real; the backend's own tests pin real ESPN shapes.
 */

const card = (over: Partial<TeamCardData> = {}): TeamCardData => ({
  record: null,
  standing: null,
  streak: null,
  home: null,
  road: null,
  last10: null,
  last: null,
  next: null,
  seriesStatus: null,
  seasonEnded: null,
  ...over,
})

const brief = (
  tag: string,
  league: string,
  heads: string[],
  leagueHeads: string[],
): BriefItem[] => [
  ...heads.map((h, i) => ({
    h,
    dek: i < 2 ? `${h.split(' ').slice(0, 5).join(' ')} — the details, in a sentence.` : null,
    source: 'team' as const,
    tag,
    publishedAt: new Date(Date.now() - (i + 1) * 3.6e6).toISOString(),
  })),
  ...leagueHeads.map((h, i) => ({
    h,
    dek: null,
    source: 'league' as const,
    tag: league,
    publishedAt: new Date(Date.now() - (i + 2) * 5.4e6).toISOString(),
  })),
]

const soon = (hours: number) => new Date(Date.now() + hours * 3.6e6).toISOString()
const ago = (hours: number) => new Date(Date.now() - hours * 3.6e6).toISOString()

const row = (t: string, w: number, l: number, gb: string, strk: string, me = false) => ({
  t,
  w,
  l,
  pct: (w / (w + l)).toFixed(3).replace(/^0/, ''),
  gb,
  strk,
  ...(me ? { me } : {}),
})
const final = (a: string, as: number, h: string, hs: number, hoursAgo: number, mine = false) => ({
  a,
  as,
  h,
  hs,
  state: 'final' as const,
  detail: 'Final',
  startsAt: ago(hoursAgo),
  mine,
})
const live = (a: string, as: number, h: string, hs: number, detail: string) => ({
  a,
  as,
  h,
  hs,
  state: 'live' as const,
  detail,
  startsAt: ago(2),
  mine: false,
})
const upcoming = (a: string, h: string, hours: number) => ({
  a,
  as: 0,
  h,
  hs: 0,
  state: 'upcoming' as const,
  detail: '',
  startsAt: soon(hours),
  mine: false,
})

const nfl49ers: SportColumn = {
  league: 'NFL',
  team: 'San Francisco 49ers',
  teamAbbr: 'SF',
  phase: 'regular',
  phaseDetail: 'Week 4',
  card: card({
    record: '3-0',
    standing: '1st in NFC West',
    streak: 'W3',
    home: '2-0',
    road: '1-0',
    last: { result: 'W', score: '36–30', opponent: 'ARI', homeAway: 'home', startsAt: ago(22) },
    next: { opponent: 'LAR', homeAway: 'away', startsAt: soon(146), tv: 'FOX', label: null },
  }),
  table: {
    title: 'NFC West',
    rows: [
      row('SF', 3, 0, '—', 'W3', true),
      row('LAR', 2, 1, '1', 'W1'),
      row('SEA', 1, 2, '2', 'L2'),
      row('ARI', 1, 2, '2', 'L1'),
    ],
  },
  scores: {
    rows: [
      final('ARI', 30, 'SF', 36, 22, true),
      live('NYG', 10, 'DAL', 17, '3rd 4:12'),
      upcoming('KC', 'NYJ', 3),
      upcoming('GB', 'CHI', 7),
      final('BUF', 24, 'MIA', 27, 25),
      final('KC', 31, 'LV', 10, 24),
      final('DET', 20, 'GB', 17, 25),
      final('PHI', 27, 'WSH', 13, 25),
      final('BAL', 23, 'CLE', 16, 25),
      final('HOU', 17, 'JAX', 20, 25),
      final('PIT', 14, 'CIN', 24, 25),
      final('DEN', 27, 'LAC', 24, 21),
      final('TB', 10, 'NO', 17, 25),
      final('MIN', 31, 'ATL', 28, 21),
    ],
    total: 14,
  },
  postseason: null,
  brief: brief(
    '49ers',
    'NFL',
    [
      'Purdy’s four touchdowns keep the 49ers perfect',
      'McCaffrey limited in Thursday practice',
      'Warner named NFC Defensive Player of the Week',
      'Aiyuk ahead of schedule in his rehab',
      'Shanahan on the red-zone turnaround',
    ],
    [
      'League fines three after Sunday-night brawl',
      'Chiefs’ Kelce to miss two weeks',
      'Trade deadline: who is buying',
    ],
  ),
  leaders: [
    {
      cat: 'Passing yards',
      abbr: 'YDS',
      rows: [
        ['B. Purdy', 'SF', '1012'],
        ['J. Allen', 'BUF', '968'],
        ['P. Mahomes', 'KC', '941'],
      ],
    },
    {
      cat: 'Rushing yards',
      abbr: 'YDS',
      rows: [
        ['B. Robinson', 'ATL', '402'],
        ['S. Barkley', 'PHI', '388'],
        ['C. McCaffrey', 'SF', '361'],
      ],
    },
    {
      cat: 'Receiving yards',
      abbr: 'YDS',
      rows: [
        ['J. Chase', 'CIN', '389'],
        ['C. Lamb', 'DAL', '351'],
        ['P. Nacua', 'LAR', '344'],
      ],
    },
    {
      cat: 'Passing TDs',
      abbr: 'TD',
      rows: [
        ['B. Purdy', 'SF', '9'],
        ['L. Jackson', 'BAL', '8'],
        ['J. Goff', 'DET', '8'],
      ],
    },
    {
      cat: 'Tackles',
      abbr: 'TCK',
      rows: [
        ['F. Warner', 'SF', '41'],
        ['R. Smith', 'PIT', '38'],
        ['B. Wagner', 'WSH', '36'],
      ],
    },
  ],
  hot: [
    { t: 'DET', rec: '3-0', strk: 'W6' },
    { t: 'KC', rec: '3-0', strk: 'W5' },
    { t: 'SF', rec: '3-0', strk: 'W3' },
  ],
  cold: [
    { t: 'NYG', rec: '0-3', strk: 'L4' },
    { t: 'CHI', rec: '0-3', strk: 'L3' },
    { t: 'CAR', rec: '1-2', strk: 'L2' },
  ],
}

const mlbDodgersRegular: SportColumn = {
  league: 'MLB',
  team: 'Los Angeles Dodgers',
  teamAbbr: 'LAD',
  phase: 'regular',
  phaseDetail: 'Regular season',
  card: card({
    record: '96-60',
    standing: '1st in NL West',
    streak: 'W3',
    last10: '8-2',
    home: '51-27',
    road: '45-33',
    last: { result: 'W', score: '6–2', opponent: 'COL', homeAway: 'home', startsAt: ago(18) },
    next: { opponent: 'COL', homeAway: 'home', startsAt: soon(5), tv: 'Sportsnet LA', label: null },
  }),
  table: {
    title: 'National League West',
    rows: [
      row('LAD', 96, 60, '—', 'W3', true),
      row('SD', 88, 68, '8', 'W2'),
      row('ARI', 83, 73, '13', 'L2'),
      row('SF', 63, 93, '33', 'L5'),
      row('COL', 55, 101, '41', 'L1'),
    ],
  },
  scores: {
    rows: [
      final('COL', 2, 'LAD', 6, 18, true),
      live('NYY', 3, 'BOS', 1, 'Top 7th'),
      upcoming('PHI', 'ATL', 4),
      final('SD', 5, 'SF', 3, 17),
      final('CHC', 4, 'MIL', 7, 19),
      final('NYM', 2, 'WSH', 1, 19),
      final('HOU', 8, 'SEA', 6, 17),
      final('TOR', 3, 'TB', 4, 19),
      final('CLE', 6, 'DET', 5, 19),
      final('KC', 1, 'MIN', 0, 19),
      final('TEX', 9, 'LAA', 2, 17),
      final('ATH', 4, 'CWS', 3, 18),
      final('BAL', 7, 'PIT', 2, 19),
      final('CIN', 3, 'STL', 5, 19),
      final('MIA', 2, 'ARI', 6, 17),
    ],
    total: 15,
  },
  postseason: null,
  brief: brief(
    'Dodgers',
    'MLB',
    [
      'Muncy walks it off in the tenth',
      'Snell sharp in his return from the IL',
      'Ohtani reaches 50 homers',
      'Betts back in the lineup Friday',
      'Roberts sets the playoff rotation',
    ],
    [
      'Wild-card race tightens as Mets fade',
      'Judge chases a second triple crown',
      'Umpire review changes approved for October',
    ],
  ),
  leaders: [
    {
      cat: 'Home runs',
      abbr: 'HR',
      rows: [
        ['S. Ohtani', 'LAD', '50'],
        ['A. Judge', 'NYY', '47'],
        ['C. Raleigh', 'SEA', '45'],
      ],
    },
    {
      cat: 'Batting average',
      abbr: 'AVG',
      rows: [
        ['A. Judge', 'NYY', '.318'],
        ['F. Freeman', 'LAD', '.311'],
        ['B. Witt Jr.', 'KC', '.305'],
      ],
    },
  ],
  hot: [
    { t: 'LAD', rec: '96-60', strk: 'W3' },
    { t: 'SD', rec: '88-68', strk: 'W2' },
    { t: 'CLE', rec: '85-71', strk: 'W2' },
  ],
  cold: [
    { t: 'SF', rec: '63-93', strk: 'L5' },
    { t: 'NYM', rec: '80-76', strk: 'L4' },
    { t: 'ARI', rec: '83-73', strk: 'L2' },
  ],
}

const series = (
  a: string,
  aWins: number,
  b: string,
  bWins: number,
  over: Partial<SeriesRow> = {},
): SeriesRow => ({
  a,
  aWins,
  b,
  bWins,
  detail: 'G2',
  live: false,
  done: false,
  mine: false,
  nextStartsAt: soon(26),
  ...over,
})

/** The MLB field in the division series: the Dodgers' series and the other
 *  NLDS, with the AL side and the finished wild-card round around them. */
const mlbView = (lad: SeriesRow, otherNlds: SeriesRow): PostseasonView => ({
  current: [
    { round: 'NLDS', bestOf: 5, series: [lad, otherNlds] },
    {
      round: 'ALDS',
      bestOf: 5,
      series: [series('TB', 2, 'NYY', 0, { detail: 'G3' }), series('HOU', 1, 'CLE', 0)],
    },
  ],
  completed: [
    { round: 'ALWC', summary: 'NYY def BOS 2–1 · HOU def CHW 2–0' },
    { round: 'NLWC', summary: 'PHI def ATL 2–1 · SD def CHC 2–0' },
  ],
  upcoming: [
    { round: 'NLCS', bestOf: 7, startsAt: soon(24 * 9) },
    { round: 'ALCS', bestOf: 7, startsAt: soon(24 * 10) },
  ],
})

const mlbDodgersPostseason: SportColumn = {
  ...mlbDodgersRegular,
  phase: 'postseason',
  phaseDetail: 'Postseason',
  card: card({
    seriesStatus: 'NLDS · LAD leads 1–0 · best of 5',
    last: { result: 'W', score: '5–3', opponent: 'PHI', homeAway: 'home', startsAt: ago(20) },
    next: {
      opponent: 'PHI',
      homeAway: 'home',
      startsAt: soon(26),
      tv: 'TBS',
      label: 'NLDS Game 2',
    },
  }),
  table: null,
  scores: null,
  leaders: null,
  hot: null,
  cold: null,
  postseason: mlbView(
    series('LAD', 1, 'PHI', 0, { mine: true }),
    series('SD', 1, 'MIL', 1, { detail: 'Top 4th', live: true, nextStartsAt: null }),
  ),
}

/** Out to San Diego — so the other NLDS is Philadelphia's, keeping each team
 *  in exactly one series. */
const mlbDodgersOut: SportColumn = {
  ...mlbDodgersPostseason,
  card: card({
    seasonEnded: 'Out in NLDS, 1–3 to SD',
    last: { result: 'L', score: '2–6', opponent: 'SD', homeAway: 'away', startsAt: ago(20) },
  }),
  postseason: mlbView(
    series('SD', 3, 'LAD', 1, { mine: true, done: true, detail: 'Final', nextStartsAt: null }),
    series('PHI', 2, 'MIL', 1, { detail: 'G4' }),
  ),
}

const nflPreseason: SportColumn = {
  ...nfl49ers,
  phase: 'preseason',
  phaseDetail: 'Preseason',
  card: card({
    next: { opponent: 'DEN', homeAway: 'away', startsAt: soon(50), tv: 'KPIX', label: null },
  }),
  table: null,
  scores: null,
  leaders: null,
  hot: null,
  cold: null,
  brief: brief(
    '49ers',
    'NFL',
    ['Purdy sharp in camp', 'Rookie corner turns heads', 'Kittle to sit the preseason opener'],
    ['Preseason week 1: what to watch', 'New kickoff rules explained'],
  ),
}

/** The NBA opener, relative like every other timestamp, so the off-season
 *  column's "Season opens …", its NEXT game and the masthead's countdown
 *  always agree. */
const NBA_OPENER_DAYS = 23
const nbaOpener = soon(24 * NBA_OPENER_DAYS)

const nbaLakersOff: SportColumn = {
  league: 'NBA',
  team: 'Los Angeles Lakers',
  teamAbbr: 'LAL',
  phase: 'offseason',
  phaseDetail: `Season opens ${new Date(nbaOpener).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  card: card({
    next: {
      opponent: 'SAC',
      homeAway: 'away',
      startsAt: nbaOpener,
      tv: 'Spectrum SportsNet',
      label: null,
    },
  }),
  table: null,
  scores: null,
  postseason: null,
  leaders: null,
  hot: null,
  cold: null,
  brief: brief(
    'Lakers',
    'NBA',
    [
      'Lakers open camp with rotation questions',
      'James says he’s “fully healthy”',
      'Reaves signs his extension',
    ],
    [
      'League finalizes in-season tournament groups',
      'Wembanyama cleared for full contact',
      'Media day: five things we learned',
    ],
  ),
}

const nbaLakersPreseason: SportColumn = {
  ...nbaLakersOff,
  phase: 'preseason',
  phaseDetail: 'Preseason',
}

const summer: SportsSection = {
  clock: [
    { league: 'MLB', detail: 'postseason in 42 days' },
    { league: 'NFL', detail: 'preseason wk 1' },
    { league: 'NBA', detail: `${NBA_OPENER_DAYS} days out` },
  ],
  columns: [mlbDodgersRegular, nflPreseason, nbaLakersOff],
}
const autumn: SportsSection = {
  clock: [
    { league: 'NFL', detail: 'week 4 of 18' },
    { league: 'MLB', detail: 'postseason in 6 days' },
    { league: 'NBA', detail: 'preseason' },
  ],
  columns: [nfl49ers, mlbDodgersRegular, nbaLakersPreseason],
}
const postseason: SportsSection = {
  clock: [
    { league: 'MLB', detail: 'postseason' },
    { league: 'NFL', detail: 'week 4 of 18' },
    { league: 'NBA', detail: 'preseason' },
  ],
  columns: [mlbDodgersPostseason, nfl49ers, nbaLakersPreseason],
}
const eliminated: SportsSection = {
  ...postseason,
  columns: [mlbDodgersOut, ...postseason.columns.slice(1)],
}

const SECTIONS: Record<string, SportsSection> = {
  'sports-summer': summer,
  'sports-autumn': autumn,
  'sports-postseason': postseason,
  'sports-eliminated': eliminated,
}

/** The fixture `SportsSection` for `scenario`, or `undefined` when it isn't one
 *  this integration defines — in which case the hook fetches instead. */
export function sportsSectionFixtureFor(scenario: string | null): SportsSection | undefined {
  if (!scenario) return undefined
  return SECTIONS[scenario]
}
