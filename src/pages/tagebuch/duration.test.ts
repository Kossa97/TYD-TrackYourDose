import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DURATION_KEYS, durationKeyOf, durationLabel } from './duration'

const generator = await import(
  pathToFileURL(resolve('scripts/generate-effect-duration-sql.mjs')).href
) as { DURATION_KEYS: string[]; buildSql: () => string; buildAppTable: () => string; textZuSchluessel: () => [string, string][] }

describe('Tagebuch-Dauer', () => {
  it('erkennt Schluessel, alte DE/EN-Texte und laesst Freitext stehen', () => {
    expect(durationKeyOf('std_2')).toBe('std_2')
    expect(durationKeyOf('2 Std')).toBe('std_2')
    expect(durationKeyOf('2 hrs')).toBe('std_2')
    expect(durationKeyOf('3 Tage, schwankend')).toBeNull()
    expect(durationKeyOf(null)).toBeNull()
    expect(durationLabel('woche_1', key => `[${key}]`)).toBe('[woche_1]')
    expect(durationLabel('ab und zu', key => `[${key}]`)).toBe('ab und zu')
  })

  it('Generator und App kennen dieselben Schluessel', () => {
    expect(generator.DURATION_KEYS).toEqual([...DURATION_KEYS])
  })

  it('erkennt alte Texte in jeder Sprache — dieselben wie die Migration', () => {
    expect(durationKeyOf('2時間')).toBe('std_2')
    const migration = new Map(generator.textZuSchluessel())
    for (const lang of ['de', 'en', 'ar', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh']) {
      const texte = JSON.parse(readFileSync(resolve(`src/i18n/locales/${lang}.json`), 'utf8')) as Record<string, string>
      for (const key of DURATION_KEYS) {
        expect(migration.get(texte[key]), `${lang}.${key}`).toBe(key)
        expect(durationKeyOf(texte[key]), `${lang}.${key}`).toBe(key)
      }
    }
  })

  it('Migration und App-Tabelle sind aktuell (npm run effects:duration:sql)', () => {
    expect(readFileSync(resolve('supabase-effects-duration-keys.sql'), 'utf8').replace(/\r\n/g, '\n')).toBe(generator.buildSql())
    expect(readFileSync(resolve('src/pages/tagebuch/legacyDurationTexts.ts'), 'utf8').replace(/\r\n/g, '\n')).toBe(generator.buildAppTable())
  })
})
