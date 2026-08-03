import { Link } from 'react-router-dom'
import type { ScreenKey } from '../types'

interface Props {
  screenKey: ScreenKey | 'unknown'
}

export function ScreenNotAvailable({ screenKey }: Props) {
  return (
    <div className="p-8 text-text-primary bg-bg-primary min-h-screen">
      <h1 className="text-lg font-bold mb-2">Screen not available</h1>
      <p className="text-sm text-text-secondary mb-4">
        The <code className="font-mono">{screenKey}</code> screen isn't provided by the active
        theme.
      </p>
      <Link to="/" className="text-sm underline text-text-primary">
        Back to home
      </Link>
    </div>
  )
}
