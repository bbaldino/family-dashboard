import { describe, expect, it } from 'vitest'
import { healthIntegration } from './config'

/**
 * The Rust reads exactly one config value —
 * `backend/src/integrations/health/routes.rs`: `config.get_or("base_url",
 * "http://health.home")`. If this default ever drifts from that one, the
 * admin panel shows a value the backend doesn't actually use.
 */
describe('healthIntegration config', () => {
  it('parses an absent base_url to the same default as the Rust get_or fallback', () => {
    expect(healthIntegration.schema.parse({})).toEqual({
      base_url: 'http://health.home',
    })
  })

  it('parses a stored base_url as-is', () => {
    expect(healthIntegration.schema.parse({ base_url: 'http://health.internal:9000' })).toEqual({
      base_url: 'http://health.internal:9000',
    })
  })
})
