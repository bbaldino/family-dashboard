// Only set if VITE_HA_URL is explicitly configured — don't default to a URL
// that will block the app trying to connect
export const HA_URL: string | undefined = import.meta.env.VITE_HA_URL || undefined
export const HA_TOKEN: string | undefined = import.meta.env.VITE_HA_TOKEN || undefined
