/** The two tabs this screen has data for. The mock shows four (`Quick
 *  Dials · For You · Playlists · Radio`, `media.jsx:119-122`) — Playlists
 *  and Radio have no data source anywhere in this codebase, so per the
 *  design brief's standing rule against rendering data it doesn't have,
 *  they're omitted rather than shown empty. */
export type MediaTab = 'quick-dials' | 'for-you'

const TABS: { key: MediaTab; label: string }[] = [
  { key: 'quick-dials', label: 'Quick Dials' },
  { key: 'for-you', label: 'For You' },
]

const inactiveTabStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  color: 'var(--ink-muted)',
  paddingBottom: 4,
}

const activeTabStyle = {
  ...inactiveTabStyle,
  color: 'var(--ink)',
  fontWeight: 700,
  borderBottom: '2px solid var(--rust)',
}

/** The search input plus the tab row, mock `media.jsx:107-125`. `searching`
 *  is true once `Media.tsx`'s debounced query is long enough to drive the
 *  body — it dims both tabs (neither is "active") without disabling them,
 *  so clearing the search returns to whichever tab was last selected. */
export function SearchTabsRow({
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  searching,
}: {
  query: string
  onQueryChange: (query: string) => void
  activeTab: MediaTab
  onTabChange: (tab: MediaTab) => void
  searching: boolean
}) {
  return (
    <div
      className="grid items-center"
      style={{ padding: '12px 56px 8px', borderBottom: '1px solid var(--rule)', gridTemplateColumns: '1fr auto', gap: 24 }}
    >
      <div style={{ position: 'relative', maxWidth: 920 }}>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search music…"
          aria-label="Search music"
          style={{
            width: '100%',
            padding: '10px 16px 10px 38px',
            background: 'transparent',
            border: '1px solid var(--rule)',
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 17,
            color: 'var(--ink-muted)',
            outline: 'none',
          }}
        />
        <span
          aria-hidden
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }}
        >
          ⌕
        </span>
      </div>
      <div className="flex uppercase" style={{ gap: 18, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.22em' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            style={!searching && tab.key === activeTab ? activeTabStyle : inactiveTabStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
