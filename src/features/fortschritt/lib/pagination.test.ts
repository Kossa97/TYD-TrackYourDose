import { describe, expect, it } from 'vitest'
import { collectPagedRows } from './pagination'

describe('collectPagedRows', () => {
  it('lädt auch Datensätze jenseits des Supabase-Limits von 1000 Zeilen', async () => {
    const rows = Array.from({ length: 2243 }, (_, index) => ({ index }))
    const ranges: Array<[number, number]> = []

    const result = await collectPagedRows(async (from, to) => {
      ranges.push([from, to])
      return { data: rows.slice(from, to + 1), error: null }
    })

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2243)
    expect(result.data?.at(-1)).toEqual({ index: 2242 })
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('bricht bei einem Seitenfehler ab und gibt ihn weiter', async () => {
    const failure = { message: 'Supabase nicht erreichbar' }
    const result = await collectPagedRows(async from => (
      from === 0
        ? { data: Array.from({ length: 1000 }, (_, index) => index), error: null }
        : { data: null, error: failure }
    ))

    expect(result).toEqual({ data: null, error: failure })
  })
})
