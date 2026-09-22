import { useIntegrationConfig } from '@/platform'
import { camerasIntegration, useDoorbellRing } from '@/integrations/cameras'
import { DoorbellRingModal } from './DoorbellRingModal'

/**
 * Broadsheet's always-mounted doorbell watcher. Renders nothing until the press
 * sensor goes off → on, then puts up the late edition.
 *
 * The state machine lives in `useDoorbellRing` so this file is only about which
 * popup to show; grid keeps its own parallel copy of that logic, deliberately
 * untouched.
 */
export function DoorbellRingListener() {
  const config = useIntegrationConfig(camerasIntegration)

  if (!config) return null
  return <ActiveListener config={config} />
}

function ActiveListener({
  config,
}: {
  config: ReturnType<typeof camerasIntegration.schema.parse>
}) {
  const { isRinging, dismiss } = useDoorbellRing({
    press_sensor_entity: config.doorbell_press_sensor,
    screensaver_entity: config.doorbell_screensaver_entity,
    auto_dismiss_seconds: config.doorbell_auto_dismiss_seconds,
    chime_enabled: config.doorbell_chime_enabled,
    chime_sound_id: config.doorbell_chime_sound_id,
    camera_url: config.doorbell_live_url ?? '',
  })

  return (
    <DoorbellRingModal
      isOpen={isRinging}
      cameraUrl={config.doorbell_live_url || null}
      onClose={dismiss}
    />
  )
}
