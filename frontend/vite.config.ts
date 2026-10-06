import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Back end address used by `npm run dev:api` (see backend launchSettings.json).
const apiTarget = 'http://localhost:5132'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Pending tests (*.pending.test.ts[x]) describe behaviour not built yet (D-12).
    // `npm test` runs the baseline project only; `npm run test:pending` runs the pending one.
    projects: [
      {
        extends: true,
        test: {
          name: 'baseline',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.pending.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'pending',
          include: ['src/**/*.pending.test.{ts,tsx}'],
        },
      },
    ],
  },
})
