import type { SubstanceCatalogEntry } from '../types'

interface ServiceError {
  message: string
}

export interface SubstanceCatalogQueryResult {
  data: SubstanceCatalogEntry[] | null
  error: ServiceError | null
}

export interface SubstanceCatalogClient {
  from(table: 'substance_catalog'): {
    select(columns: string): {
      eq(column: 'active', value: true): PromiseLike<SubstanceCatalogQueryResult>
    }
  }
}

export interface SubstanceCatalogSearchResult {
  entries: SubstanceCatalogEntry[]
  unavailable: boolean
}

const CATALOG_COLUMNS = [
  'id',
  'canonical_name',
  'aliases',
  'default_category',
  'suggested_units',
  'suggested_dosage_forms',
  'pk_profile_id',
  'active',
].join(', ')

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function filterCatalog(
  entries: SubstanceCatalogEntry[],
  query: string,
): SubstanceCatalogEntry[] {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return entries

  return entries.filter(entry => (
    normalize(entry.canonical_name).includes(normalizedQuery)
    || entry.aliases.some(alias => normalize(alias).includes(normalizedQuery))
  ))
}

export async function searchSubstanceCatalog(
  client: SubstanceCatalogClient,
  query: string,
): Promise<SubstanceCatalogSearchResult> {
  try {
    const { data, error } = await client
      .from('substance_catalog')
      .select(CATALOG_COLUMNS)
      .eq('active', true)

    if (error) return { entries: [], unavailable: true }

    return {
      entries: filterCatalog(data ?? [], query).slice(0, 20),
      unavailable: false,
    }
  } catch {
    return { entries: [], unavailable: true }
  }
}
