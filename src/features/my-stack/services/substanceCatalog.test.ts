import { describe, expect, it } from 'vitest'
import type { SubstanceCatalogEntry } from '../types'
import {
  filterCatalog,
  searchSubstanceCatalog,
  type SubstanceCatalogClient,
  type SubstanceCatalogQueryResult,
} from './substanceCatalog'

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU'],
  suggested_dosage_forms: ['capsule'],
  pk_profile_id: null,
  active: true,
}

const magnesium: SubstanceCatalogEntry = {
  ...vitaminD3,
  id: 'magnesium',
  canonical_name: 'Magnesium',
  aliases: [],
  default_category: 'supplement',
}

function catalogClient(result: SubstanceCatalogQueryResult): SubstanceCatalogClient {
  return {
    from: table => {
      expect(table).toBe('substance_catalog')
      return {
        select: () => ({
          eq: async (column, value) => {
            expect(column).toBe('active')
            expect(value).toBe(true)
            return result
          },
        }),
      }
    },
  }
}

describe('substance catalog service', () => {
  it('durchsucht kanonische Namen und Aliase case-insensitiv', () => {
    expect(filterCatalog([vitaminD3, magnesium], 'CHOLE')).toEqual([vitaminD3])
    expect(filterCatalog([vitaminD3, magnesium], 'magn')).toEqual([magnesium])
  })

  it('liefert bei Katalogfehlern ein leeres Ergebnis statt den freien Flow zu blockieren', async () => {
    const failingClient = catalogClient({ data: null, error: { message: 'offline' } })

    const result = await searchSubstanceCatalog(failingClient, 'Vitamin D')

    expect(result).toEqual({ entries: [], unavailable: true })
  })

  it('lädt nur aktive Katalogeinträge und begrenzt sichtbare Vorschläge auf 20', async () => {
    const entries = Array.from({ length: 25 }, (_, index): SubstanceCatalogEntry => ({
      ...vitaminD3,
      id: `vitamin-${index}`,
      canonical_name: `Vitamin ${index}`,
    }))

    const result = await searchSubstanceCatalog(
      catalogClient({ data: entries, error: null }),
      'vitamin',
    )

    expect(result).toEqual({ entries: entries.slice(0, 20), unavailable: false })
  })
})
