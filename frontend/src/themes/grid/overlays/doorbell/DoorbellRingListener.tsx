import { useEffect, useRef, useState } from 'react'
import { useHaEntity } from '@/hooks/useHaEntity'
import { getAlarmById } from '@/integrations/timers'
import { doorbellIntegration, detectRisingEdge } from '@/integrations/doorbell'
import { DoorbellRingModal } from './DoorbellRingModal'

interface DoorbellRingConfig {
  press_sensor_entity: string
  screensaver_entity: string
  auto_dismiss_seconds: number
  chime_enabled: boolean
  chime_sound_id: string
  camera_url: string
}

/**
 * Loads the doorbell-integration config from /api/config once at mount.
 * Values are stored as strings in the shared config table; we coerce here.
 */
function useDoorbellConfig(): DoorbellRingConfig | null {
  const [config, setConfig] = useState<DoorbellRingConfig | null>(null)

  useEffect(() => {
    const load = async () => {
      const defaults = doorbellIntegration.schema.parse({})
      try {
        const raw = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
        const get = (k: string, d: string) => raw[`doorbell.${k}`] ?? d
        const seconds = parseInt(
          get('auto_dismiss_seconds', String(defaults.auto_dismiss_seconds)),
          10,
        )
        setConfig({
          press_sensor_entity: get('press_sensor_entity', defaults.press_sensor_entity),
          screensaver_entity: get('screensaver_entity', defaults.screensaver_entity),
          auto_dismiss_seconds: Number.isFinite(seconds) ? seconds : defaults.auto_dismiss_seconds,
          chime_enabled: get('chime_enabled', String(defaults.chime_enabled)) === 'true',
          chime_sound_id: get('chime_sound_id', defaults.chime_sound_id),
          camera_url: get('camera_url', defaults.camera_url ?? ''),
        })
      } catch {
        setConfig({
          press_sensor_entity: defaults.press_sensor_entity,
          screensaver_entity: defaults.screensaver_entity,
          auto_dismiss_seconds: defaults.auto_dismiss_seconds,
          chime_enabled: defaults.chime_enabled,
          chime_sound_id: defaults.chime_sound_id,
          camera_url: defaults.camera_url ?? '',
        })
      }
    }
    load()
  }, [])

  return config
}

export function DoorbellRingListener() {
  const config = useDoorbellConfig()

  if (!config) return null
  return <ActiveListener config={config} />
}

/**
 * `useHaEntity` returns `any`. We read `.state` defensively — if the entity
 * doesn't exist or hakit hasn't hydrated yet, `.state` is undefined and the
 * rising-edge detector treats it as baseline.
 */
function ActiveListener({ config }: { config: DoorbellRingConfig }) {
  const pressSensor = useHaEntity(config.press_sensor_entity)
  const screensaver = useHaEntity(config.screensaver_entity || config.press_sensor_entity)
  const screensaverActive = Boolean(config.screensaver_entity) && screensaver?.state === 'on'

  const [isRinging, setIsRinging] = useState(false)
  const prevStateRef = useRef<string | undefined>(undefined)
  const dismissTimerRef = useRef<number | null>(null)
  const chimeCtxRef = useRef<AudioContext | null>(null)

  const clearDismissTimer = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }

  const scheduleDismiss = () => {
    clearDismissTimer()
    if (config.auto_dismiss_seconds > 0) {
      dismissTimerRef.current = window.setTimeout(
        () => setIsRinging(false),
        config.auto_dismiss_seconds * 1000,
      )
    }
  }

  const handleClose = () => {
    clearDismissTimer()
    chimeCtxRef.current?.close().catch(() => {})
    setIsRinging(false)
  }

  useEffect(() => {
    const current = pressSensor?.state
    const prev = prevStateRef.current
    const rising = detectRisingEdge(prev, current)
    prevStateRef.current = current

    if (!rising) return

    if (screensaverActive) {
      console.log('[doorbell] ring suppressed: screensaver is on')
      return
    }

    if (isRinging) {
      // Re-press while modal already open — reset the dismiss timer, no chime replay.
      scheduleDismiss()
      return
    }

    setIsRinging(true)
    scheduleDismiss()

    if (config.chime_enabled) {
      try {
        chimeCtxRef.current?.close().catch(() => {})
        chimeCtxRef.current = getAlarmById(config.chime_sound_id).play()
      } catch (e) {
        console.warn('[doorbell] chime failed to play', e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressSensor?.state])

  useEffect(() => {
    return () => {
      clearDismissTimer()
      chimeCtxRef.current?.close().catch(() => {})
    }
  }, [])

  return (
    <DoorbellRingModal
      isOpen={isRinging}
      cameraUrl={config.camera_url || null}
      onClose={handleClose}
    />
  )
}
