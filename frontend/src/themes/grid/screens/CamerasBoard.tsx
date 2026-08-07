import { useAllConfig } from '@/platform'
import { doorbellIntegration } from '@/integrations/doorbell'

export function CamerasBoard() {
  // Was a mount-only fetch of /api/config, so a new camera url needed a page
  // reload; through the shared query it lands within the poll interval.
  //
  // Deliberately the raw query rather than `useIntegrationConfig`: that hook
  // returns null for the *whole* integration if any single `doorbell.*` value
  // fails to parse, and a null config here silently swaps the household's own
  // camera for the schema default. This screen needs one key, so an unrelated
  // bad one shouldn't blank it.
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
