import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['dashboard.baldino.me'],
    // The doorbell page is embedded cross-origin and we hand it `@font-face`
    // rules pointing back here (see `data/doorbell/theming.ts`). Fonts are
    // CORS-restricted even from plain CSS, and Vite sends no
    // `Access-Control-Allow-Origin` by default, so without this every face
    // fails to load and silently falls back to a generic family.
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3042',
        // Increase timeouts for SSE (music/events) — default is too short
        proxyTimeout: 0,
        timeout: 0,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Pin the timezone so local-date bucketing (e.g. src/data/google-calendar)
    // is deterministic regardless of where the suite runs.
    env: { TZ: 'America/Los_Angeles' },
    server: {
      deps: {
        // @hakit/core imports { clamp } from 'lodash' (CJS); vitest's default
        // ESM loader can't destructure named exports off a CJS module, so we
        // ask vitest to process @hakit/core through its own resolver.
        inline: ['@hakit/core'],
      },
    },
  },
})
