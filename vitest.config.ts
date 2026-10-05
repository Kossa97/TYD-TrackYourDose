import { defineConfig } from 'vitest/config'

// Local-date fixtures assume Berlin; set it before Vitest starts its workers.
process.env.TZ = 'Europe/Berlin'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts', 'api/**/*.test.js', 'supabase/functions/**/*.test.ts'],
  },
})
