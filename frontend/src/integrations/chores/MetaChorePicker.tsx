import { useState, useEffect } from 'react'
import { BottomSheet } from '@/ui/BottomSheet'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { choresIntegration } from './config'
import type { ChoreRef } from './types'

interface MetaChorePickerProps {
  assignmentId: number
  pickFromTags: string[]
  currentPickId: number | null
  onPick: (assignmentId: number, choreId: number) => Promise<void>
  onClear: (assignmentId: number) => Promise<void>
  onClose: () => void
}

export function MetaChorePicker({
  assignmentId,
  pickFromTags,
  currentPickId,
  onPick,
  onClear,
  onClose,
}: MetaChorePickerProps) {
  const [chores, setChores] = useState<ChoreRef[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    choresIntegration
      .api!.get<ChoreRef[]>('/chores/by-tags?tags=' + pickFromTags.join(','))
      .then((data) => {
        if (!cancelled) {
          setChores(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pickFromTags])

  return (
    <BottomSheet isOpen onClose={onClose}>
      <h2 className="text-[18px] font-semibold text-text-primary mb-4">Pick a chore</h2>

      {currentPickId !== null && (
        <button
          className="w-full text-left px-3 py-3 mb-2 text-[14px] text-error border border-border rounded-lg"
          onClick={async () => {
            await onClear(assignmentId)
            onClose()
          }}
        >
          Clear selection
        </button>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : !chores || chores.length === 0 ? (
        <div className="text-[14px] text-text-muted py-4">No matching chores found</div>
      ) : (
        <div className="flex flex-col gap-1">
          {chores.map((chore) => (
            <button
              key={chore.id}
              className={`w-full text-left px-3 py-3 rounded-lg text-[15px] transition-colors ${
                chore.id === currentPickId
                  ? 'bg-chores/10 text-chores font-semibold'
                  : 'text-text-primary hover:bg-bg-card-hover'
              }`}
              onClick={async () => {
                await onPick(assignmentId, chore.id)
                onClose()
              }}
            >
              {chore.name}
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
