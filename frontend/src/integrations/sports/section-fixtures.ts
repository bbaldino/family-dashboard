import type { SportsSection } from './section-types'

/**
 * Fixture sections for `?scenario=`, transcribed verbatim from the design
 * mock's `SPORTS_DATA` (`public/mock5/sports.jsx`). Two scenarios cover the
 * two structural modes the screen has to get right:
 *
 * - `sports-summer` — a **single front**: MLB in regular season clearly on top,
 *   the NFL only in preseason and the NBA off, so both drop to `elsewhere`.
 * - `sports-autumn` — a **split front**: MLB and NFL both in regular season,
 *   tied at the top rank, running as two parallel tracks down all four columns.
 *
 * These are the only way the Sports screen can be exercised until the backend
 * aggregation (stage 2) exists — the same fixtures-first path the media screens
 * took while Music Assistant was unreachable.
 */

const summer: SportsSection = {
  fixtures: [
    { team: 'Dodgers', detail: 'vs KC · Thu 7:10p' },
    { team: '49ers', detail: 'at DEN · Sat 1:25p' },
    { team: 'Warriors', detail: 'camp opens Sep 30' },
  ],
  clock: [
    { league: 'MLB', detail: '42 games left' },
    { league: 'NFL', detail: 'preseason wk 1' },
    { league: 'NBA', detail: '49 days out' },
  ],
  standfirst:
    'Muncy walked it off in the tenth and the Dodgers sit two behind Milwaukee with fifty to play. The 49ers open preseason Saturday; the Warriors are still seven weeks out.',
  leagues: [
    {
      league: 'MLB',
      team: 'Los Angeles Dodgers',
      seasonType: 'Regular Season',
      record: '72–48',
      standing: '1st in NL West',
      home: '35-23',
      away: '37-25',
      next: 'KC @ LAD · Thu Aug 13',
      headline: "Max Muncy's 10th-inning single lifts the Dodgers past the Royals 5-4",
      dek: 'Max Muncy singled in Shohei Ohtani in the bottom of the 10th inning, lifting the Los Angeles Dodgers over the Kansas City Royals 5-4 on Tuesday night.',
      caption: 'Muncy is met at the plate after the single that ended it in the tenth.',
      more: [
        {
          h: "Dodgers' Blake Snell K's 10 in 6 innings in return from injury",
          dek: 'Blake Snell struck out 10 batters in six innings in his return to the mound after three months out with loose bodies in his left elbow.',
          meta: 'Wed Aug 12 · Headline',
        },
        {
          h: "Tarik Skubal struggles in Dodgers' series opener",
          dek: "Alden Gonzalez recaps Tarik Skubal's performance in his debut for the Dodgers.",
          meta: 'Tue Aug 11 · Media',
        },
      ],
      table: {
        title: 'National League',
        sub: 'top of the table',
        rows: [
          { t: 'MIL', w: 74, l: 46, pct: '.617', gb: '—', strk: 'L2' },
          { t: 'ATL', w: 72, l: 48, pct: '.600', gb: '2', strk: 'W1' },
          { t: 'LAD', w: 72, l: 48, pct: '.600', gb: '2', strk: 'W2', me: true },
          { t: 'CHC', w: 70, l: 50, pct: '.583', gb: '4', strk: 'W2' },
          { t: 'SD', w: 64, l: 57, pct: '.529', gb: '10.5', strk: 'W4' },
          { t: 'PHI', w: 64, l: 57, pct: '.529', gb: '10.5', strk: 'L1' },
          { t: 'NYM', w: 62, l: 58, pct: '.517', gb: '12', strk: 'L1' },
          { t: 'SF', w: 60, l: 60, pct: '.500', gb: '14', strk: 'W1' },
          { t: 'CIN', w: 59, l: 61, pct: '.492', gb: '15', strk: 'W2' },
          { t: 'STL', w: 57, l: 63, pct: '.475', gb: '17', strk: 'W1' },
        ],
      },
      scoresLabel: "Tuesday's",
      scores: [
        { a: 'KC', as: 4, h: 'LAD', hs: 5, star: 'M. Muncy', line: '2-5, RBI, walk-off' },
        { a: 'CLE', as: 4, h: 'DET', hs: 6, star: 'C. DeLauter', line: '3-5, HR, RBI, R' },
        { a: 'PIT', as: 0, h: 'MIA', hs: 2, star: 'E. Perez', line: '7.0 IP, 0 ER, 3 H, 7 SO' },
        { a: 'CHC', as: 8, h: 'WSH', hs: 6, star: 'A. Bregman', line: '2-4, HR, RBI, 3 R' },
        { a: 'SEA', as: 1, h: 'NYY', hs: 4, star: 'T. Grisham', line: '2-4, 2B, 2 RBI' },
        { a: 'BOS', as: 3, h: 'TOR', hs: 5, star: 'C. Rafaela', line: '1-4, HR, 2 RBI, R' },
        { a: 'NYM', as: 0, h: 'ATL', hs: 4, star: 'M. Olson', line: '1-3, HR, 2 RBI, 2 R' },
        { a: 'BAL', as: 5, h: 'MIN', hs: 2, star: 'G. Henderson', line: '3-5, HR, 2B, 2 RBI' },
        { a: 'CIN', as: 5, h: 'CHW', hs: 4, star: 'S. Burke', line: '7.0 IP, ER, 3 H, 8 SO' },
        { a: 'TEX', as: 2, h: 'HOU', hs: 7, star: 'Y. Alvarez', line: '3-4, HR, 4 RBI' },
        { a: 'STL', as: 6, h: 'MIL', hs: 3, star: 'M. Winn', line: '2-4, 2B, 3 RBI, R' },
        { a: 'ARI', as: 1, h: 'SD', hs: 4, star: 'F. Tatis Jr.', line: '2-3, HR, 2 RBI, BB' },
        { a: 'COL', as: 3, h: 'SF', hs: 8, star: 'H. Ramos', line: '3-5, 2 HR, 5 RBI' },
        { a: 'OAK', as: 5, h: 'LAA', hs: 2, star: 'L. Severino', line: '6.2 IP, ER, 5 H, 6 SO' },
        { a: 'PHI', as: 9, h: 'ATH', hs: 4, star: 'B. Marsh', line: '3-5, HR, 3 RBI, 2 R' },
      ],
      leaders: [
        {
          cat: 'Home runs',
          abbr: 'HR',
          rows: [
            ['M. Olson', 'ATL', '35'],
            ['K. Schwarber', 'PHI', '35'],
            ['Y. Alvarez', 'HOU', '35'],
          ],
        },
        {
          cat: 'Batting average',
          abbr: 'AVG',
          rows: [
            ['Y. Alvarez', 'HOU', '.322'],
            ['O. Lopez', 'MIA', '.318'],
            ['L. Arraez', 'PHI', '.314'],
          ],
        },
        {
          cat: 'Runs batted in',
          abbr: 'RBI',
          rows: [
            ['C. Abrams', 'WSH', '91'],
            ['Y. Alvarez', 'HOU', '87'],
            ['S. Stewart', 'CIN', '87'],
          ],
        },
        {
          cat: 'Earned run average',
          abbr: 'ERA',
          rows: [
            ['J. Misiorowski', 'MIL', '1.76'],
            ['C. Sale', 'ATL', '2.20'],
            ['C. Schlittler', 'NYY', '2.21'],
          ],
        },
        {
          cat: 'Strikeouts',
          abbr: 'K',
          rows: [
            ['J. Misiorowski', 'MIL', '204'],
            ['D. Cease', 'TOR', '191'],
            ['G. Cole', 'NYY', '188'],
          ],
        },
      ],
      hot: [
        { t: 'TB', rec: '73-46', strk: 'W8' },
        { t: 'SD', rec: '64-57', strk: 'W4' },
        { t: 'DET', rec: '59-60', strk: 'W3' },
      ],
      cold: [
        { t: 'SEA', rec: '56-64', strk: 'L5' },
        { t: 'BOS', rec: '64-55', strk: 'L4' },
        { t: 'CLE', rec: '58-62', strk: 'L3' },
      ],
    },
  ],
  elsewhere: [
    {
      league: 'NFL',
      team: 'San Francisco 49ers',
      record: '0-0',
      tag: 'preseason',
      note: 'Preseason opens Saturday at Denver.',
      story: {
        h: 'Purdy sharp in first full padded practice of camp',
        meta: 'Tue Aug 11 · Headline',
      },
    },
    {
      league: 'NBA',
      team: 'Golden State Warriors',
      record: null,
      note: 'Season opens Sep 30 · 49 days out.',
      story: {
        h: 'Curry still on track to finish career with Warriors, GM says',
        meta: 'Wed Aug 12 · Headline',
      },
    },
  ],
}

const autumn: SportsSection = {
  fixtures: [
    { team: 'Dodgers', detail: 'vs SF · Mon 7:10p' },
    { team: '49ers', detail: 'vs SEA · Sun 1:25p' },
    { team: 'Warriors', detail: 'camp opens Tue' },
  ],
  clock: [
    { league: 'MLB', detail: 'six to play' },
    { league: 'NFL', detail: 'week 3 of 18' },
    { league: 'NBA', detail: 'camp week' },
  ],
  standfirst:
    'The Dodgers cut it to four with six to play and the 49ers are 2-1 after taking Arizona on the road. Two seasons now run side by side; the Warriors report for camp on Tuesday.',
  leagues: [
    {
      league: 'MLB',
      team: 'Los Angeles Dodgers',
      seasonType: 'Regular Season',
      record: '94–62',
      standing: '1st in NL West',
      home: '49-29',
      away: '45-33',
      next: 'SF @ LAD · Mon Sep 28',
      headline: 'Ohtani goes deep twice as the Dodgers cut the magic number to four',
      dek: 'Two home runs and a stolen base in a 7-2 win over San Diego leave Los Angeles needing four to clinch a thirteenth division title in fourteen years.',
      caption: 'Ohtani rounds second on the second of two, in the fifth.',
      more: [
        {
          h: 'Glasnow lines up for a Game 1 start if the Dodgers hold on',
          dek: '',
          meta: 'Sun Sep 27 · Headline',
        },
      ],
      table: {
        title: 'NL West',
        sub: 'six to play',
        rows: [
          { t: 'LAD', w: 94, l: 62, pct: '.603', gb: '—', strk: 'W3', me: true },
          { t: 'SD', w: 90, l: 66, pct: '.577', gb: '4', strk: 'L1' },
          { t: 'ARI', w: 84, l: 72, pct: '.538', gb: '10', strk: 'W1' },
          { t: 'SF', w: 78, l: 78, pct: '.500', gb: '16', strk: 'L2' },
          { t: 'COL', w: 61, l: 95, pct: '.391', gb: '33', strk: 'L4' },
        ],
      },
      scoresLabel: "Saturday's",
      scores: [
        { a: 'SD', as: 2, h: 'LAD', hs: 7, star: 'S. Ohtani', line: '3-4, 2 HR, 4 RBI, SB' },
        { a: 'NYM', as: 1, h: 'ATL', hs: 3, star: 'S. Strider', line: '7.0 IP, ER, 4 H, 11 SO' },
        { a: 'HOU', as: 5, h: 'SEA', hs: 4, star: 'J. Peña', line: '2-4, HR, 2 RBI' },
        { a: 'NYY', as: 8, h: 'BAL', hs: 3, star: 'A. Judge', line: '3-5, HR, 4 RBI, 2 R' },
        {
          a: 'CHC',
          as: 6,
          h: 'MIL',
          hs: 5,
          star: 'P. Crow-Armstrong',
          line: '2-4, 2B, 3 RBI',
        },
        { a: 'PHI', as: 4, h: 'MIA', hs: 0, star: 'Z. Wheeler', line: '8.0 IP, 0 ER, 3 H, 9 SO' },
        { a: 'BOS', as: 3, h: 'TB', hs: 6, star: 'J. Lowe', line: '2-3, HR, 3 RBI' },
      ],
      leaders: [
        {
          cat: 'Home runs',
          abbr: 'HR',
          rows: [
            ['S. Ohtani', 'LAD', '49'],
            ['K. Schwarber', 'PHI', '46'],
            ['A. Judge', 'NYY', '44'],
          ],
        },
        {
          cat: 'Earned run average',
          abbr: 'ERA',
          rows: [
            ['Z. Wheeler', 'PHI', '2.11'],
            ['T. Skubal', 'LAD', '2.24'],
            ['C. Sale', 'ATL', '2.36'],
          ],
        },
        {
          cat: 'Batting average',
          abbr: 'AVG',
          rows: [
            ['L. Arraez', 'PHI', '.331'],
            ['Y. Alvarez', 'HOU', '.319'],
            ['B. Witt Jr.', 'KC', '.316'],
          ],
        },
      ],
      hot: [
        { t: 'LAD', rec: '94-62', strk: 'W3' },
        { t: 'CLE', rec: '88-68', strk: 'W6' },
        { t: 'TOR', rec: '91-65', strk: 'W4' },
      ],
      cold: [
        { t: 'SD', rec: '90-66', strk: 'L1' },
        { t: 'COL', rec: '61-95', strk: 'L4' },
        { t: 'SF', rec: '78-78', strk: 'L2' },
      ],
    },
    {
      league: 'NFL',
      team: 'San Francisco 49ers',
      seasonType: 'Regular Season',
      record: '2–1',
      standing: '2nd in NFC West',
      home: '1-1',
      away: '1-0',
      next: 'SF vs SEA · Sun Oct 4',
      headline: 'Purdy throws three as the 49ers take Arizona on the road',
      dek: 'San Francisco scored on four of five second-half drives in a 27-16 win, moving to 2-1 a week before Seattle visit Levi’s.',
      caption: '',
      more: [
        {
          h: 'Kittle listed as limited in Friday practice with a hamstring',
          dek: '',
          meta: 'Sat Sep 26 · Headline',
        },
      ],
      table: {
        title: 'NFC West',
        sub: 'week three',
        rows: [
          { t: 'SEA', w: 3, l: 0, pct: '1.000', gb: '—', strk: 'W3' },
          { t: 'SF', w: 2, l: 1, pct: '.667', gb: '1', strk: 'W1', me: true },
          { t: 'LAR', w: 1, l: 2, pct: '.333', gb: '2', strk: 'L2' },
          { t: 'ARI', w: 1, l: 2, pct: '.333', gb: '2', strk: 'L1' },
        ],
      },
      scoresLabel: "Sunday's early",
      scores: [
        { a: 'SF', as: 27, h: 'ARI', hs: 16, star: 'B. Purdy', line: '24-31, 301 YDS, 3 TD' },
        { a: 'GB', as: 21, h: 'CHI', hs: 17, star: 'J. Love', line: '19-27, 244 YDS, 2 TD' },
        { a: 'BUF', as: 31, h: 'MIA', hs: 10, star: 'J. Allen', line: '22-30, 288 YDS, 3 TD' },
        { a: 'DET', as: 24, h: 'MIN', hs: 20, star: 'J. Gibbs', line: '18 CAR, 112 YDS, 2 TD' },
        { a: 'KC', as: 28, h: 'DEN', hs: 14, star: 'P. Mahomes', line: '25-34, 312 YDS, 3 TD' },
        {
          a: 'BAL',
          as: 20,
          h: 'CLE',
          hs: 13,
          star: 'L. Jackson',
          line: '17-24, 210 YDS, 68 RUSH',
        },
        { a: 'PHI', as: 26, h: 'DAL', hs: 23, star: 'S. Barkley', line: '22 CAR, 141 YDS, TD' },
      ],
      leaders: [
        {
          cat: 'Passing yards',
          abbr: 'YDS',
          rows: [
            ['J. Allen', 'BUF', '912'],
            ['P. Mahomes', 'KC', '884'],
            ['B. Purdy', 'SF', '861'],
          ],
        },
        {
          cat: 'Rushing yards',
          abbr: 'YDS',
          rows: [
            ['S. Barkley', 'PHI', '388'],
            ['J. Gibbs', 'DET', '341'],
            ['D. Henry', 'BAL', '329'],
          ],
        },
      ],
      hot: [],
      cold: [],
    },
  ],
  elsewhere: [
    {
      league: 'NBA',
      team: 'Golden State Warriors',
      record: null,
      tag: 'preseason',
      note: 'Camp opens Tuesday · first preseason game Oct 6.',
      story: {
        h: 'Warriors open camp with the same starting five',
        meta: 'Sat Sep 26 · Headline',
      },
    },
  ],
}

const SECTIONS: Record<string, SportsSection> = {
  'sports-summer': summer,
  'sports-autumn': autumn,
}

/** The fixture `SportsSection` for `scenario`, or `undefined` when it isn't one
 *  this integration defines — in which case the hook fetches instead. */
export function sportsSectionFixtureFor(scenario: string | null): SportsSection | undefined {
  if (!scenario) return undefined
  return SECTIONS[scenario]
}
