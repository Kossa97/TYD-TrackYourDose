import { defineConfig, devices } from '@playwright/test'

/**
 * Geraetetests: die gebaute App im Browser, Supabase nachgebildet
 * (`e2e/support/mockSupabase.ts`). Kein Netz, keine echten Daten.
 *
 *   npm run test:e2e
 *
 * Chromium mit den Massen und der Touch-Eingabe der Geraete — WebKit
 * (echtes Safari) ist hier nicht installiert.
 */
const PORT = 5197
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ?? (process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers' ? '/opt/pw-browsers/chromium' : undefined)

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: chromium ? { executablePath: chromium } : {},
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: `npx vite build --outDir e2e/.dist --emptyOutDir && npx vite preview --outDir e2e/.dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Ohne DSN: kein Sentry in den Tests.
    env: { VITE_SENTRY_DSN: '' },
  },
})
