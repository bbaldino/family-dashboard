import { useContext } from 'react'
import { MusicContext } from './MusicProvider'

export function useMusic() {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic must be used within MusicProvider')
  return ctx
}
