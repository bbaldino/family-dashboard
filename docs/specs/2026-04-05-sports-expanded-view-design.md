# Sports Widget — Enhanced Expanded View

## Goal

Make the sports widget's expanded (hero) view sport-aware, with richer live game data for MLB and NBA, structured situation data, last play display, and game state-appropriate rendering.

## Backend: Structured situation data

### New GameSituation enum

Replace the current `situation: Option<String>` on `Game` with a structured enum:

```rust
enum GameSituation {
    Mlb {
        outs: u8,
        on_first: bool,
        on_second: bool,
        on_third: bool,
        balls: Option<u8>,
        strikes: Option<u8>,
        batter: Option<String>,
        pitcher: Option<String>,
    },
    Nba {},
    Nhl {},
    Nfl {},
}
```

MLB variant carries full at-bat context. Other sport variants start empty — they exist so the enum is extensible without breaking changes.

### New shared fields on Game

- `situation: Option<GameSituation>` — replaces old string situation, populated for live games
- `last_play: Option<String>` — most recent play description, parsed from `competition.situation.lastPlay.text` for all sports during live games
- `headline: Option<String>` — ESPN recap, parsed from `competition.headlines[0].description` for final games

### ESPN data sources

- MLB situation fields: `competition.situation.outs`, `.onFirst`, `.onSecond`, `.onThird`, `.balls`, `.strikes`, `.batter.athlete.displayName`, `.pitcher.athlete.displayName`
- Last play (all sports): `competition.situation.lastPlay.text`
- Headline (all sports): `competition.headlines[0].description`

## Frontend: Sport-specific expanded components

### Component breakdown

**Shared components (all sports):**
- `LastPlayBar` — accent-colored bar with "LAST PLAY" label and play text. Yellow left border on dark background. Only renders when `last_play` is present.
- `GameHeadline` — italic recap text for final games. Only renders when `headline` is present.

**MLB-specific:**
- `MlbSituation` — base diamond (3 bases, no home plate; filled = runner on), batter name + "at bat", ball/strike/out count as colored dots (green/red/orange), opposing pitcher name. Renders in a compact row with diamond on the left.
- `MlbLinescore` — inning-by-inning table with R/H/E columns. Current inning highlighted.

**NBA-specific:**
- `NbaLinescore` — quarter scores table with Q1/Q2/Q3/Q4/T columns. Current quarter highlighted.

**Generic (NHL, NFL for now):**
- Fall back to the existing `Linescore` component with period/quarter columns.

### GameCardExpanded rendering by state

**Live game:**
1. Matchup header (score + live indicator + period/inning)
2. Sport-specific situation (MLB: diamond + count + batter/pitcher, others: nothing extra)
3. Last play bar
4. Sport-specific linescore
5. Leaders / pitching stats

**Final game:**
1. Matchup header (final score)
2. Sport-specific linescore
3. Leaders / featured athletes
4. ESPN recap headline

**Upcoming game:**
1. Matchup header (start time + broadcast)
2. MLB: probable pitchers with stats
3. Upcoming schedule (other games coming up)

## Files

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/integrations/sports/MlbSituation.tsx` | Diamond + batter + count display |
| `frontend/src/integrations/sports/MlbLinescore.tsx` | Inning-by-inning box score with R/H/E |
| `frontend/src/integrations/sports/NbaLinescore.tsx` | Quarter scores table |
| `frontend/src/integrations/sports/LastPlayBar.tsx` | Shared accent bar for most recent play |
| `frontend/src/integrations/sports/GameHeadline.tsx` | Recap headline for final games |

### Modified files

| File | Change |
|------|--------|
| `backend/src/integrations/sports/types.rs` | Add `GameSituation` enum, `last_play`, `headline` fields |
| `backend/src/integrations/sports/transform.rs` | Parse structured situation, lastPlay, headline from ESPN |
| `frontend/src/integrations/sports/types.ts` | Update types to match new backend structure |
| `frontend/src/integrations/sports/GameCardExpanded.tsx` | Switch on league for sport-specific rendering, compose new components |
