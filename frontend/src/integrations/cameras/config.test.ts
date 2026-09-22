import { describe, expect, it, vi } from 'vitest'
import { camerasIntegration } from './config'
import { parseIntegrationConfig } from '@/platform/useIntegrationConfig'

/**
 * Every value in the config table is TEXT. The doorbell schema used to type
 * `auto_dismiss_seconds` as a number and `chime_enabled` as a boolean, so the
 * first save of the admin form would have made `useIntegrationConfig` return
 * `null` for the whole integration — broadsheet's camera screen and doorbell
 * popup both read it that way. It survived only because nobody had ever
 * saved that form.
 */

/** Exactly what `CamerasSettings.handleSave` writes, values and all. */
const STORED_CONFIG: Record<string, string> = {
  'cameras.doorbell_live_url': 'https://cam.test/front',
  'cameras.doorbell_press_sensor': 'binary_sensor.side_door',
  'cameras.doorbell_screensaver_entity': 'switch.kiosk_screensaver',
  'cameras.doorbell_auto_dismiss_seconds': '45',
  'cameras.doorbell_chime_enabled': 'false',
  'cameras.doorbell_chime_sound_id': 'soft-doorbell',
}

describe('camerasIntegration config', () => {
  // The regression that would have caught the whole class: a config as
  // actually stored has to parse at all.
  it('parses a saved config, every value a string as the table holds them', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const parsed = parseIntegrationConfig(camerasIntegration, STORED_CONFIG)

    expect(parsed).not.toBeNull()
    expect(parsed).toMatchObject({
      doorbell_live_url: 'https://cam.test/front',
      doorbell_press_sensor: 'binary_sensor.side_door',
      doorbell_screensaver_entity: 'switch.kiosk_screensaver',
      doorbell_auto_dismiss_seconds: 45,
      doorbell_chime_enabled: false,
      doorbell_chime_sound_id: 'soft-doorbell',
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  describe('doorbell_auto_dismiss_seconds', () => {
    it('reads a stored number written as a string', () => {
      expect(
        camerasIntegration.schema.parse({ doorbell_auto_dismiss_seconds: '45' }),
      ).toMatchObject({
        doorbell_auto_dismiss_seconds: 45,
      })
    })

    it('takes zero, which means never auto-close', () => {
      expect(camerasIntegration.schema.parse({ doorbell_auto_dismiss_seconds: '0' })).toMatchObject(
        {
          doorbell_auto_dismiss_seconds: 0,
        },
      )
    })

    it('falls back to the default for a cleared field rather than zeroing it', () => {
      // A cleared admin input is a blank string, not an absent key — and
      // `z.coerce.number()` alone would turn that into 0, i.e. "never
      // auto-close", which is the opposite of a reset.
      expect(camerasIntegration.schema.parse({ doorbell_auto_dismiss_seconds: '' })).toMatchObject({
        doorbell_auto_dismiss_seconds: 60,
      })
    })

    it('falls back to the default when the key was never written', () => {
      expect(camerasIntegration.schema.parse({})).toMatchObject({
        doorbell_auto_dismiss_seconds: 60,
      })
    })
  })

  describe('doorbell_chime_enabled', () => {
    // The one that matters. A test that only exercises "true" passes under
    // `z.coerce.boolean()` — which runs `Boolean("false")`, i.e. `true` — and
    // so proves nothing about the value people actually change.
    it('reads "false" as off', () => {
      expect(camerasIntegration.schema.parse({ doorbell_chime_enabled: 'false' })).toMatchObject({
        doorbell_chime_enabled: false,
      })
    })

    it('reads "true" as on', () => {
      expect(camerasIntegration.schema.parse({ doorbell_chime_enabled: 'true' })).toMatchObject({
        doorbell_chime_enabled: true,
      })
    })

    it('defaults to on when the key was never written or was cleared', () => {
      expect(camerasIntegration.schema.parse({})).toMatchObject({ doorbell_chime_enabled: true })
      expect(camerasIntegration.schema.parse({ doorbell_chime_enabled: '' })).toMatchObject({
        doorbell_chime_enabled: true,
      })
    })

    it('rejects a value it cannot read rather than guessing at it', () => {
      expect(
        camerasIntegration.schema.safeParse({ doorbell_chime_enabled: 'sometimes' }).success,
      ).toBe(false)
    })
  })
})
