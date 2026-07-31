/**
 * English ordinal suffix for a day-of-month number: 1 -> "st", 2 -> "nd",
 * 3 -> "rd", everything else -> "th" — except the 11/12/13 teens, which take
 * "th" even though they end in 1/2/3 (11th, not 11st). Used to render the
 * masthead's date, e.g. "Friday, July 31" + <sup>"st"</sup>.
 */
export function ordinalSuffix(day: number): string {
  const remainder100 = day % 100
  if (remainder100 >= 11 && remainder100 <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}
