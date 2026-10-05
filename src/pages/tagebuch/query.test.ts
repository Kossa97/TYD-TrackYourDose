import { describe, expect, it } from 'vitest'
import { ORDER, searchFilter } from './query'

const items = [{ id: 'a', display_name: 'BPC-157' }, { id: 'b', display_name: 'TB-500' }, { id: 'c', display_name: 'bpc nasal' }]

describe('Tagebuch-Abfrage', () => {
  it('ohne Suchtext kein Filter', () => {
    expect(searchFilter('', items)).toBeNull()
    expect(searchFilter('   ', items)).toBeNull()
  })

  it('sucht in der Beschreibung und ueber passende Substanzen', () => {
    expect(searchFilter(' bpc ', items)).toBe('description.ilike."%bpc%",stack_item_id.in.(a,c)')
    expect(searchFilter('Schlaf', items)).toBe('description.ilike."%Schlaf%"')
  })

  it('maskiert LIKE-Platzhalter, Anfuehrungszeichen und Backslash', () => {
    expect(searchFilter('50%_a', [])).toBe('description.ilike."%50\\\\%\\\\_a%"')
    expect(searchFilter('a"b', [])).toBe('description.ilike."%a\\"b%"')
    expect(searchFilter('kopf, (stark)', [])).toBe('description.ilike."%kopf, (stark)%"')
  })

  it('sortiert bei gleicher Intensitaet nach Datum und immer zuletzt nach id', () => {
    expect(ORDER.sev_high.map(([column]) => column)).toEqual(['severity', 'occurred_at', 'id'])
    for (const order of Object.values(ORDER)) expect(order.at(-1)).toEqual(['id', true])
  })
})
