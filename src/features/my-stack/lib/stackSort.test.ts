import { describe, expect, it } from 'vitest'
import { sortAbilities } from './stackSort'

describe('sortAbilities', () => {
  it('bietet Vial-Sortierungen nur an, wo es Vial-Angaben gibt', () => {
    // Füllstand, Rekonstitution und Bestand lesen Vial-Felder. In einem
    // Reiter aus lauter Kapseln sind sie überall leer — sortiert man danach,
    // ändert sich nichts, und die App wirkt kaputt.
    const nurKapseln = [{ vials_in_stock: null, reconstitution_date: null }]

    expect(sortAbilities(nurKapseln).size).toBe(0)
  })

  it('erkennt jede Angabe einzeln', () => {
    expect([...sortAbilities([{ vials_in_stock: 3 }])]).toEqual(['stock'])
    expect([...sortAbilities([{ vial_amount_mg: 10 }])]).toEqual(['fill'])
    expect([...sortAbilities([{ expiry_days: 28 }])]).toEqual(['expiry'])
  })

  it('zählt ein Rekonstitutionsdatum auch als Ablauf, denn daraus rechnet er sich', () => {
    expect([...sortAbilities([{ reconstitution_date: '2026-09-01' }])].sort())
      .toEqual(['expiry', 'recon'])
  })

  it('reicht ein einziger Eintrag, damit die Sortierung dasteht', () => {
    // „Alle" mischt Kapseln und Vials — ein Vial genügt, damit Füllstand
    // etwas bedeutet.
    const gemischt = [{ vials_in_stock: null }, { vials_in_stock: 2 }]

    expect(sortAbilities(gemischt).has('stock')).toBe(true)
  })

  it('zählt einen leeren Bestand nicht als Bestandsangabe', () => {
    // 0 Vials heißt „keine da", nicht „hier lässt sich nach Bestand ordnen".
    expect(sortAbilities([{ vials_in_stock: 0 }]).has('stock')).toBe(false)
  })
})
