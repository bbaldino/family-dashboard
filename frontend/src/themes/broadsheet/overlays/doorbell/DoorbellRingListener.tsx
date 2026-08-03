import { useIntegrationConfig } from '@/data/use-integration-config'
import { doorbellIntegration, useDoorbellRing } from '@/data/doorbell'
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
  const config = useIntegrationConfig(doorbellIntegration)

  if (!config) return null
  return <ActiveListener config={config} />
}

function ActiveListener({
  config,
}: {
  config: ReturnType<typeof doorbellIntegration.schema.parse>
}) {
  const { isRinging, dismiss } = useDoorbellRing({
    press_sensor_entity: config.press_sensor_entity,
    screensaver_entity: config.screensaver_entity,
    auto_dismiss_seconds: config.auto_dismiss_seconds,
    chime_enabled: config.chime_enabled,
    chime_sound_id: config.chime_sound_id,
    camera_url: config.camera_url ?? '',
  })

  return (
    <DoorbellRingModal
      isOpen={isRinging}
      cameraUrl={config.camera_url || null}
      onClose={dismiss}
    />
  )
}
