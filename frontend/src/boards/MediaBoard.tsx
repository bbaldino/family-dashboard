import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useMusic } from '@/integrations/music'
import { QuickDials } from './media/QuickDials'
import { NowPlaying } from './media/NowPlaying'
import { SearchResults } from './media/SearchResults'
import { PlayerPicker } from './media/PlayerPicker'
import { FullscreenNowPlaying } from './media/FullscreenNowPlaying'

export function MediaBoard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const isSearching = debouncedQuery.length >= 2

  return (
    <div className="h-full flex gap-6">
      {/* Left column */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search music..."
            className="w-full px-4 py-3 pl-10 rounded-lg bg-bg-card border border-border text-text-primary placeholder:text-text-secondary outline-none focus:border-accent"
          />
        </div>

        {isSearching ? (
          <SearchResults query={debouncedQuery} />
        ) : (
          <QuickDials />
        )}
      </div>

      {/* Right column */}
      <div className="w-[380px]">
        <NowPlaying
          onOpenFullscreen={() => setFullscreen(true)}
          onOpenPlayerPicker={() => setPickerOpen(true)}
        />
      </div>

      {/* Overlays */}
      <PlayerPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
      <FullscreenNowPlaying isOpen={fullscreen} onClose={() => setFullscreen(false)} />
    </div>
  )
}
