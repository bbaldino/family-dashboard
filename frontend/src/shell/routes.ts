import type { ScreenKey } from './types'

/**
 * Maps a semantic ScreenKey to its react-router URL path (relative to
 * the theme root — no leading slash). The shell owns this table so
 * themes never string-match URLs.
 */
export const ROUTE_PATHS: Record<ScreenKey, string> = {
  home: '',
  calendar: 'calendar',
  media: 'media',
  'media.artist': 'media/artist/:uri',
  'media.album': 'media/album/:uri',
  cameras: 'cameras',
  health: 'health',
}
