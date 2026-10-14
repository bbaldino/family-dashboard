/**
 * A live game's leader figure, labelled with its stat. ESPN's game-summary
 * leaders carry the stat only in the category (`displayName`): basketball and
 * hockey values are bare numbers ("24" under "Points"), so printed on their own
 * they're just a number next to a name. Football and baseball values already
 * name their stats ("331 YDS, 2 TD", "2-4, HR") and are left as they come.
 *
 * Box-score abbreviations per league where the convention is clear; any other
 * category falls back to its own name, so a bare figure is never unlabelled.
 */
const ABBREVIATIONS: Record<string, Record<string, string>> = {
  nba: { points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK' },
  nhl: { goals: 'G', assists: 'A', points: 'PTS', saves: 'SV' },
}

/** Only a plain number needs a label — anything with words already has one. */
const BARE_NUMBER = /^-?\d*\.?\d+$/

export function leaderStatText(league: string, category: string, displayValue: string): string {
  if (!category || !BARE_NUMBER.test(displayValue.trim())) return displayValue
  const label =
    ABBREVIATIONS[league.toLowerCase()]?.[category.toLowerCase()] ?? category.toUpperCase()
  return `${displayValue} ${label}`
}
