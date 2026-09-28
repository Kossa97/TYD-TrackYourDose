import { expect, test as base } from '@playwright/test'
import { MockSupabase } from './mockSupabase'

/** Fester Zeitpunkt: „Tag 28", „naechste Einnahme" usw. haengen am Datum. */
export const NOW = new Date('2026-09-28T10:00:00+02:00')

/**
 * `mock`: das nachgebildete Supabase, schon im Browser eingehaengt und mit
 * einer angemeldeten Testperson. Vor dem ersten `page.goto` lassen sich
 * Ausgangsdaten anlegen.
 *
 * Nach jedem Test: keine Anfrage, die der Mock nicht kennt, und kein
 * unbehandelter Fehler in der Seite.
 */
export const test = base.extend<{ mock: MockSupabase }>({
  mock: async ({ page }, provide) => {
    const mock = new MockSupabase({ now: NOW })
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.clock.install({ time: NOW })
    await mock.install(page)
    await provide(mock)
    expect(mock.unhandled, 'Anfragen ohne Nachbildung').toEqual([])
    expect(pageErrors, 'unbehandelte Fehler in der Seite').toEqual([])
  },
})

export { expect }
