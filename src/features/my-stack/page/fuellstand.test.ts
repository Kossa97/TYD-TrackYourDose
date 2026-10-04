import { describe, expect, it } from 'vitest'
import type { StackItemInventory } from '../types'
import { fuellstandFuer, type Peptide } from './model'

function spray(inventory: Partial<StackItemInventory> | null, dosage_form: Peptide['dosage_form'] = 'nasal_spray'): Peptide {
  return {
    dosage_form,
    vials_in_stock: null,
    vials_initial: null,
    inventory: inventory && {
      enabled: true, package_quantity: 100, package_unit: 'spray', remaining_quantity: 240,
      batch_number: null, expires_at: null, ...inventory,
    },
  } as Peptide
}

describe('fuellstandFuer', () => {
  it('der geoeffnete Behaelter: 240 Stoesse, 100 je Flasche, geoeffnet → 40 %', () => {
    expect(fuellstandFuer(spray({ opened_at: '2026-09-20' }))).toBe(40)
  })

  it('nichts geoeffnet: eine volle Flasche — oder was vom letzten Behaelter noch da ist', () => {
    expect(fuellstandFuer(spray({}))).toBe(100)
    expect(fuellstandFuer(spray({ remaining_quantity: 30 }))).toBe(30)
  })

  it('aufgebraucht: leer', () => {
    expect(fuellstandFuer(spray({ remaining_quantity: 0 }))).toBe(0)
  })

  it('ohne gefuehrten Bestand oder Behaeltergroesse: keine Aussage', () => {
    expect(fuellstandFuer(spray(null))).toBeNull()
    expect(fuellstandFuer(spray({ enabled: false }))).toBeNull()
    expect(fuellstandFuer(spray({ package_quantity: null }))).toBeNull()
  })

  it('Formen ohne Pegel: keine Aussage', () => {
    expect(fuellstandFuer(spray({ opened_at: '2026-09-20' }, 'tablet'))).toBeNull()
    expect(fuellstandFuer(spray({ opened_at: '2026-09-20' }, 'pen'))).toBeNull()
  })
})
