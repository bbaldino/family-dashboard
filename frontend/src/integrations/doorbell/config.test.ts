import { describe, expect, it, vi } from 'vitest'
import { doorbellIntegration } from './config'
import { parseIntegrationConfig } from '@/platform/useIntegrationConfig'

/**
 * Every value in the config table is TEXT. The doorbell schema used to type
 * `auto_dismiss_seconds` as a number and `chime_enabled` as a boolean, so the
 * first save of the admin form would have made `useIntegrationConfig` return
 * `null` for the whole integration — broadsheet's camera screen and doorbell
 * popup both read it that way. It survived only because nobody had ever
 * saved that form.
 */

/** Exactly what `DoorbellSettings.handleSave` writes, values and all. */
const STORED_CONFIG: Record<string, string> = {
  'doorbell.camera_url': 'https://cam.test/front',
  'doorbell.press_sensor_entity': 'binary_sensor.side_door',
  'doorbell.screensaver_entity': 'switch.kiosk_screensaver',
  'doorbell.auto_dismiss_seconds': '45',
  'doorbell.chime_enabled': 'false',
  'doorbell.chime_sound_id': 'soft-doorbell',
}

describe('doorbellIntegration config', () => {
  // The regression that would have caught the whole class: a config as
  // actually stored has to parse at all.
  it('parses a saved config, every value a string as the table holds them', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const parsed = parseIntegrationConfig(doorbellIntegration, STORED_CONFIG)

    expect(parsed).not.toBeNull()
    expect(parsed).toMatchObject({
      camera_url: 'https://cam.test/front',
      press_sensor_entity: 'binary_sensor.side_door',
      screensaver_entity: 'switch.kiosk_screensaver',
      auto_dismiss_seconds: 45,
      chime_enabled: false,
      chime_sound_id: 'soft-doorbell',
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  describe('auto_dismiss_seconds', () => {
    it('reads a stored number written as a string', () => {
      expect(doorbellIntegration.schema.parse({ auto_dismiss_seconds: '45' })).toMatchObject({
        auto_dismiss_seconds: 45,
      })
    })

    it('takes zero, which means never auto-close', () => {
      expect(doorbellIntegration.schema.parse({ auto_dismiss_seconds: '0' })).toMatchObject({
        auto_dismiss_seconds: 0,
      })
    })

    it('falls back to the default for a cleared field rather than zeroing it', () => {
      // A cleared admin input is a blank string, not an absent key — and
      // `z.coerce.number()` alone would turn that into 0, i.e. "never
      // auto-close", which is the opposite of a reset.
      expect(doorbellIntegration.schema.parse({ auto_dismiss_seconds: '' })).toMatchObject({
        auto_dismiss_seconds: 60,
      })
    })

    it('falls back to the default when the key was never written', () => {
      expect(doorbellIntegration.schema.parse({})).toMatchObject({ auto_dismiss_seconds: 60 })
    })
  })

  describe('chime_enabled', () => {
    // The one that matters. A test that only exercises "true" passes under
    // `z.coerce.boolean()` — which runs `Boolean("false")`, i.e. `true` — and
    // so proves nothing about the value people actually change.
    it('reads "false" as off', () => {
      expect(doorbellIntegration.schema.parse({ chime_enabled: 'false' })).toMatchObject({
        chime_enabled: false,
      })
    })

    it('reads "true" as on', () => {
      expect(doorbellIntegration.schema.parse({ chime_enabled: 'true' })).toMatchObject({
        chime_enabled: true,
      })
    })

    it('defaults to on when the key was never written or was cleared', () => {
      expect(doorbellIntegration.schema.parse({})).toMatchObject({ chime_enabled: true })
      expect(doorbellIntegration.schema.parse({ chime_enabled: '' })).toMatchObject({
        chime_enabled: true,
      })
    })

    it('rejects a value it cannot read rather than guessing at it', () => {
      expect(doorbellIntegration.schema.safeParse({ chime_enabled: 'sometimes' }).success).toBe(
        false,
      )
    })
  })
})
