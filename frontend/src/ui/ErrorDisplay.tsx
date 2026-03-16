import { Button } from './Button'

interface ErrorDisplayProps { message: string; onRetry?: () => void }

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-error text-sm">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  )
}
