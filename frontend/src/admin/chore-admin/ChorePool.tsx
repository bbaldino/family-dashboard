import { useDraggable } from '@dnd-kit/core'
import type { Chore } from '@/integrations/chores/types'

interface DraggableChoreChipProps {
  chore: Chore
}

function DraggableChoreChip({ chore }: DraggableChoreChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chore-${chore.id}`,
    data: { chore },
  })

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none', // Prevent browser scroll/zoom while dragging
  }

  const isMeta = chore.chore_type === 'meta'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`inline-flex items-center px-5 py-3 rounded-full text-base font-medium cursor-grab active:cursor-grabbing select-none ${
        isMeta
          ? 'border-2 border-dashed border-blue-400 text-blue-300 bg-blue-900/20'
          : 'bg-bg-card-hover text-text-primary border border-border'
      }`}
    >
      {chore.name}
    </div>
  )
}

interface ChorePoolProps {
  chores: Chore[]
}

export function ChorePool({ chores }: ChorePoolProps) {
  return (
    <div className="bg-bg-card border border-border rounded-[var(--radius-card)] p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-3">Chore Pool</h3>
      <div className="flex flex-wrap gap-2">
        {chores.map((chore) => (
          <DraggableChoreChip key={chore.id} chore={chore} />
        ))}
        {chores.length === 0 && (
          <p className="text-text-secondary text-sm">No chores available. Add some in the Manage Chores tab.</p>
        )}
      </div>
    </div>
  )
}
