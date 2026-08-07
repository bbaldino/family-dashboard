import { useAllConfig } from '@/platform'
import { doorbellIntegration } from '@/integrations/doorbell'

export function CamerasBoard() {
  // Was a mount-only fetch of /api/config, so a new camera url needed a page
  // reload; through the shared query it lands within the poll interval.
  //
  // Deliberately the raw query rather than `useIntegrationConfig`: the
  // doorbell schema types `auto_dismiss_seconds` as a number and
  // `chime_enabled` as a boolean, but the config table stores every value as
  // a string, so scoped parsing fails outright once the admin form has
  // written those two — and a null config here would silently swap the
  // household's own camera for the schema default.
  const { data, isPending } = useAllConfig()
  const defaults = doorbellIntegration.schema.parse({})
  // While the first fetch is in flight there is nothing to show yet; a
  // failed one falls back to the default, as the old `.catch` did.
  const cameraUrl = isPending ? null : data?.['doorbell.camera_url'] || defaults.camera_url || null

  if (!cameraUrl) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Configure camera URL in Settings → Doorbell Camera
      </div>
    )
  }

  return (
    <div className="h-full">
      <iframe
        src={cameraUrl}
        className="w-full h-full border-0"
        allow="autoplay; camera; microphone"
      />
    </div>
  )
}
