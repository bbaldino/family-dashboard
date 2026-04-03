import type { WidgetMeta } from '@/lib/widget-types'
import { useChores } from './useChores'

export function useChoresWidgetMeta(): WidgetMeta {
  const { data } = useChores()
  const persons = data?.persons ?? []

  const hasAssignments = persons.some((p) => p.assignments.length > 0)
  if (!hasAssignments) {
    return { visible: false }
  }

  return { visible: true, preferredSize: 'standard', priority: 4 }
}
