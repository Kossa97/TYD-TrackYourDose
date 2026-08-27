import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const approvedDosageForms = {
  'BPC-157': ['vial', 'capsule', 'nasal_spray', 'tube'],
  'TB-500': ['vial'],
  Ipamorelin: ['vial', 'nasal_spray'],
  'CJC-1295': ['vial', 'tablet'],
  'GHRP-2': ['vial', 'nasal_spray'],
  Sermorelin: ['vial', 'ampoule'],
  Semaglutid: ['pen', 'tablet', 'vial'],
  Tirzepatid: ['pen', 'vial'],
  Selank: ['nasal_spray', 'drops'],
  Epithalon: ['vial', 'capsule', 'tablet'],
  'GHK-Cu': ['vial', 'liquid', 'gel', 'tube'],
  'Vitamin D3': ['capsule', 'drops', 'tablet', 'spray'],
  'Vitamin K2': ['capsule', 'drops', 'tablet'],
  Magnesium: ['capsule', 'tablet', 'powder', 'liquid'],
  'Omega-3': ['capsule', 'liquid'],
  Creatin: ['powder', 'capsule', 'tablet'],
  Testosteron: ['vial', 'ampoule', 'gel', 'capsule', 'pen'],
  'Testosteron Enantat': ['vial', 'ampoule', 'pen'],
  Metformin: ['tablet', 'liquid'],
  Melatonin: ['tablet', 'capsule', 'drops', 'spray'],
} as const

const allowedDosageForms = new Set([
  'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid',
  'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other',
])

function readSql(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : ''
}

function extractMappings(sql: string): Record<string, string[]> {
  const match = sql.match(
    /with catalog_dosage_forms \(canonical_name, suggested_dosage_forms\) as \(\s*values([\s\S]*?)\n\)\s*update public\.substance_catalog/i,
  )
  const values = match?.[1] ?? ''

  return Object.fromEntries(
    [...values.matchAll(/\('([^']+)', array\[([^\]]*)\]::text\[\]\)/g)].map(([, name, forms]) => [
      name,
      [...forms.matchAll(/'([^']+)'/g)].map(([, form]) => form),
    ]),
  )
}

describe('catalog dosage form SQL contract', () => {
  const foundationSql = readSql(resolve('supabase-my-stack-foundation.sql'))
  const incrementalSql = readSql(resolve('supabase-my-stack-catalog-dosage-forms.sql'))

  it.each([
    ['foundation migration', foundationSql],
    ['incremental migration', incrementalSql],
  ])('stores the approved ordered dosage forms in the %s', (_source, sql) => {
    const mappings = extractMappings(sql)

    expect(Object.keys(mappings)).toHaveLength(20)
    expect(mappings).toEqual(approvedDosageForms)
    expect(Object.values(mappings).flat().every(form => allowedDosageForms.has(form))).toBe(true)
    expect(mappings['GHK-Cu']?.[0]).toBe('vial')
  })

  it('keeps the incremental migration transactional and case-insensitive by canonical name', () => {
    expect(incrementalSql).toMatch(/^\s*begin;/i)
    expect(incrementalSql.trimEnd()).toMatch(/commit;$/i)
    expect(incrementalSql).toMatch(
      /where\s+lower\(catalog\.canonical_name\)\s*=\s*lower\(catalog_dosage_forms\.canonical_name\)/i,
    )
  })
})
