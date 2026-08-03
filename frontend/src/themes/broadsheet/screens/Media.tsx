import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { MediaMasthead } from '@/themes/broadsheet/media/MediaMasthead'
import { SearchTabsRow } from '@/themes/broadsheet/media/SearchTabsRow'
import type { MediaTab } from '@/themes/broadsheet/media/SearchTabsRow'
import { QuickDialsShelves } from '@/themes/broadsheet/media/QuickDialsShelves'
import { ForYouShelf } from '@/themes/broadsheet/media/ForYouShelf'
import { SearchResultsPanel } from '@/themes/broadsheet/media/SearchResultsPanel'
import { NowSpinning } from '@/themes/broadsheet/media/NowSpinning'
import { CentreSpread } from '@/themes/broadsheet/media/CentreSpread'
import { MenuScrim } from '@/themes/broadsheet/media/MenuScrim'

/** `useSearch` only enables its query once it's at least 2 characters
 *  (`src/data/music/useSearch.ts`) — matched here so "searching" (which
 *  body the shelf column shows) agrees with what the hook itself will
 *  actually fetch. */
const MIN_SEARCH_LENGTH = 2

/**
 * The Listening Room: broadsheet's third screen — masthead, a search/tabs
 * row, then a two-part body (the shelves on the left, the "Now Spinning"
 * rail on the right) over the theme's shared `Footer`, which `BroadsheetLayout`
 * already renders for every screen. Mock: `docs/superpowers/designs/broadsheet/media.jsx`.
 *
 * Unlike the mock, which absolutely-positions the body at a hard-coded
 * `top: 250` (`media.jsx:127`), this uses the same flex-column sizing Home
 * and the Datebook already establish for the identical "fixed canvas, size
 * the body to whatever's left" problem (`Home.tsx`, `Calendar.tsx`): the
 * masthead and the search/tabs row flow normally, the body is the flex
 * column's one `flex-1 min-h-0` item, and a 64px spacer at the end reserves
 * the footer's height. A hard-coded pixel offset would have to assume the
 * masthead and search row always render at exactly that height; letting
 * flexbox size the body instead means it's correct regardless of font
 * metrics, matching this screen's general instruction to measure rather
 * than trust a number.
 *
 * The shelf column owns which of three things it's showing — the "Quick
 * Dials" tab's two shelves, the "For You" tab's one shelf, or search
 * results — as local state `SearchTabsRow` drives; none of that state is
 * shared with the URL or any other screen, the same way the Datebook owns
 * its displayed month locally (`Calendar.tsx`'s own comment on why).
 *
 * `showCentreSpread` is this screen's own third piece of local state: when
 * set, `Media` renders `CentreSpread` — broadsheet's full-page now-playing
 * view — in place of its usual masthead/search/body entirely, the way
 * grid's `MediaBoard` holds its own `fullscreen` boolean (read for the
 * pattern only; nothing imported from grid). This is deliberately not a
 * `ScreenKey` on the shell — see `CentreSpread.tsx`'s own header comment for
 * why that trade is the right one here.
 *
 * `openMenuUri` is this screen's fourth piece of local state — the shared
 * track-actions menu's open item, one URI for the whole screen rather than
 * one per body, since only one of `QuickDialsShelves`/`ForYouShelf`/`SearchResultsPanel`
 * is ever mounted at a time. Lifted here rather than into any one of those
 * three for the same reason `Album.tsx`/`Artist.tsx` each lift theirs to
 * page level: `MenuScrim` has to size itself against the whole 1600×900
 * canvas, which only this component's own root actually is. Switching tabs
 * or starting a new search both close it — `handleTabChange`/`handleQueryChange`
 * both clear it below — since the item the open menu was anchored to may no
 * longer even be on screen once the body swaps to a different data set.
 */
export function Media() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<MediaTab>('quick-dials')
  const [debouncedQuery] = useDebounce(query.trim(), 250)
  const searching = debouncedQuery.length >= MIN_SEARCH_LENGTH
  const [showCentreSpread, setShowCentreSpread] = useState(false)
  const [openMenuUri, setOpenMenuUri] = useState<string | null>(null)

  const closeMenu = () => setOpenMenuUri(null)
  const toggleMenu = (uri: string) => setOpenMenuUri((current) => (current === uri ? null : uri))

  // Tapping a tab while a search is showing exits search mode too — without
  // this, the tab's own `active` styling would need this component's
  // consent it can't offer (`SearchTabsRow` already dims both tabs while
  // `searching`), and the tap would silently do nothing visible.
  const handleTabChange = (nextTab: MediaTab) => {
    setTab(nextTab)
    setQuery('')
    closeMenu()
  }

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery)
    closeMenu()
  }

  if (showCentreSpread) {
    return <CentreSpread onClose={() => setShowCentreSpread(false)} />
  }

  return (
    <div
      data-testid="broadsheet-media"
      className="broadsheet-root relative w-[1600px] h-[900px] flex flex-col"
    >
      <MediaMasthead />
      <SearchTabsRow
        query={query}
        onQueryChange={handleQueryChange}
        activeTab={tab}
        onTabChange={handleTabChange}
        searching={searching}
      />
      <div
        data-testid="broadsheet-media-body"
        className="flex-1 min-h-0 grid"
        style={{ gridTemplateColumns: '1fr 380px' }}
      >
        <div
          data-testid="broadsheet-media-shelves"
          className="min-h-0 overflow-hidden flex flex-col"
          style={{ gap: 14, padding: '12px 28px 12px 56px' }}
        >
          {searching ? (
            <SearchResultsPanel
              query={debouncedQuery}
              openMenuUri={openMenuUri}
              onToggleMenu={toggleMenu}
              onCloseMenu={closeMenu}
            />
          ) : tab === 'quick-dials' ? (
            <QuickDialsShelves
              openMenuUri={openMenuUri}
              onToggleMenu={toggleMenu}
              onCloseMenu={closeMenu}
            />
          ) : (
            <ForYouShelf
              openMenuUri={openMenuUri}
              onToggleMenu={toggleMenu}
              onCloseMenu={closeMenu}
            />
          )}
        </div>
        <aside
          className="min-h-0"
          style={{ borderLeft: '1px solid var(--rule)', padding: '12px 56px 16px 28px' }}
        >
          <NowSpinning onOpenCentreSpread={() => setShowCentreSpread(true)} />
        </aside>
      </div>
      {/* Reserves the 64px the footer occupies (see `BroadsheetLayout`) —
       *  same spacer Home and the Datebook both end with, and the same
       *  reason: the footer itself is pinned absolutely, outside this flex
       *  column's own height accounting. */}
      <div style={{ flexShrink: 0, height: 64 }} />
      {openMenuUri && <MenuScrim onClose={closeMenu} />}
    </div>
  )
}
