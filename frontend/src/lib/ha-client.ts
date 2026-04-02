interface RuntimeConfig {
  ha_url: string | null
  ha_token: string | null
}

let cached: RuntimeConfig | null = null

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached
  try {
    const resp = await fetch('/api/runtime-config')
    cached = await resp.json()
    return cached!
  } catch {
    return { ha_url: null, ha_token: null }
  }
}
