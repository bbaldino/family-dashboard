/**
 * URL-safe encode/decode for a Music Assistant URI used as a route param
 * (`media/artist/:uri`, `media/album/:uri` — `shell/routes.ts`'s
 * `ROUTE_PATHS`). A plain `encodeURIComponent`/`decodeURIComponent` pair —
 * duplicated from grid's own copy (`src/themes/grid/screens/media/track-url.ts`,
 * read for reference only, nothing imported: broadsheet may not import from
 * grid) rather than shared, the same way this theme already keeps its own
 * `formatDuration` in every screen that needs one instead of a shared util.
 */
export function encodeUriParam(uri: string): string {
  return encodeURIComponent(uri)
}

export function decodeUriParam(param: string): string {
  return decodeURIComponent(param)
}
