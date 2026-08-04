export interface PlatformIntegration {
  id: string
  name: string
}

export function defineIntegration(def: PlatformIntegration): PlatformIntegration {
  return def
}
