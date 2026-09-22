-- Unify the doorbell into the cameras integration: the doorbell is now a
-- camera with special treatment (live view + ring popup) living under the
-- cameras.* namespace, alongside the Frigate recordings config that already
-- lives there. Rename the six live doorbell.* keys; Frigate keys were already
-- cameras.* and are untouched.
UPDATE config SET key = 'cameras.doorbell_live_url'              WHERE key = 'doorbell.camera_url';
UPDATE config SET key = 'cameras.doorbell_press_sensor'         WHERE key = 'doorbell.press_sensor_entity';
UPDATE config SET key = 'cameras.doorbell_screensaver_entity'   WHERE key = 'doorbell.screensaver_entity';
UPDATE config SET key = 'cameras.doorbell_auto_dismiss_seconds' WHERE key = 'doorbell.auto_dismiss_seconds';
UPDATE config SET key = 'cameras.doorbell_chime_enabled'        WHERE key = 'doorbell.chime_enabled';
UPDATE config SET key = 'cameras.doorbell_chime_sound_id'       WHERE key = 'doorbell.chime_sound_id';
