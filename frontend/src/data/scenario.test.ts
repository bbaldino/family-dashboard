import { describe, expect, it } from 'vitest'
import { parseScenario } from './scenario'

describe('parseScenario', () => {
  it('reads the scenario name out of a query string', () => {
    expect(parseScenario('?scenario=packed')).toBe('packed')
  })

  it('returns null when no scenario parameter is present', () => {
    expect(parseScenario('')).toBeNull()
    expect(parseScenario('?foo=bar')).toBeNull()
  })
})
