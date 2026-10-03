import { describe, expect, it } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import type { StackItemIngredient, StackItemInventory } from '../types'
import { zeilenStand, type ZeilenEintrag } from './listRow'

const timeZone = 'Europe/Berlin'
// 10:00 in Berlin: die Einnahme um 08:00 ist heute schon vorbei.
const now = new Date('2026-09-25T08:00:00.000Z')

function inventory(changes: Partial<StackItemInventory> = {}): StackItemInventory {
  return {
    enabled: true,
    package_quantity: 5,
    package_unit: 'vial',
    remaining_quantity: 3,
    batch_number: null,
    expires_at: null,
    reconstitution_ml: 2,
    ...changes,
  }
}

const ingredient: StackItemIngredient = {
  catalog_substance_id: null,
  custom_name: 'Wirkstoff',
  amount_value: 10,
  amount_unit: 'mg',
  basis_value: 1,
  basis_unit: 'vial',
  position: 0,
}

function version(changes: Partial<CyclePlanVersion> = {}): CyclePlanVersion {
  return {
    id: 'v1',
    cycle_id: 'cycle-1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: '2026-09-01',
    change_kind: 'initial',
    frequency: 'Täglich',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens',
    intake_time_custom: '08:00',
    slot_doses: null,
    slot_days: null,
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    ...changes,
  }
}

function timeline(changes: Partial<CycleTimeline> = {}, cycle: Partial<CycleTimeline['cycle']> = {}): CycleTimeline {
  return {
    cycle: { id: 'cycle-1', stack_item_id: 'stack-1', started_at: '2026-08-31T22:00:00.000Z', ended_at: null, start_local_date: '2026-09-01', ...cycle },
    versions: [version()],
    pauses: [],
    ...changes,
  }
}

function eintrag(changes: Partial<ZeilenEintrag> = {}): ZeilenEintrag {
  return { configuration_status: 'complete', inventory: null, ingredients: [ingredient], ...changes }
}

describe('zeilenStand', () => {
  it('nennt die naechste Einnahme mit Menge — heute vorbei, also morgen', () => {
    const stand = zeilenStand({ item: eintrag(), timelines: [timeline()], now, timeZone })
    expect(stand.plan).toEqual({ art: 'naechste', localDate: '2026-09-26', time: '08:00', dose: 1, unit: 'mg' })
    expect(stand.hinweis).toBeNull()
    expect(stand.reichweite).toBeNull()
  })

  it('ohne Plan: kein_plan, und ob es frueher Zyklen gab', () => {
    expect(zeilenStand({ item: eintrag(), timelines: [], now, timeZone }).plan).toEqual({ art: 'kein_plan', hatteZyklen: false })
    const beendet = timeline({}, { ended_at: '2026-09-10T10:00:00.000Z', end_local_date: '2026-09-10' })
    expect(zeilenStand({ item: eintrag(), timelines: [beendet], now, timeZone }).plan).toEqual({ art: 'kein_plan', hatteZyklen: true })
  })

  it('pausiert ist pausiert, nicht „keine Einnahme"', () => {
    const pausiert = timeline({ pauses: [{ id: 'p1', cycle_id: 'cycle-1', paused_at: '2026-09-20T10:00:00.000Z', ends_at: null }] })
    expect(zeilenStand({ item: eintrag(), timelines: [pausiert], now, timeZone }).plan).toEqual({ art: 'pausiert' })
  })

  it('ein Plan zum Pruefen sperrt die Einnahme und ist der Hinweis', () => {
    const stand = zeilenStand({ item: eintrag({ configuration_status: 'needs_review' }), timelines: [timeline()], now, timeZone })
    expect(stand.plan).toEqual({ art: 'pruefen' })
    expect(stand.hinweis).toEqual({ art: 'pruefen' })
  })

  it('Reichweite nur mit gefuehrtem Bestand; wenig Vorrat heisst „knapp"', () => {
    // 1 mg taeglich aus 10-mg-Vials: 0,5 Vial deckt 5 Einnahmen. Heute ist
    // keine mehr offen, also zaehlt heute mit — 6 Tage.
    const stand = zeilenStand({ item: eintrag({ inventory: inventory({ remaining_quantity: 0.5 }) }), timelines: [timeline()], now, timeZone })
    expect(stand.reichweite).toMatchObject({ art: 'tage', tage: 6 })
    expect(stand.hinweis).toEqual({ art: 'knapp', tage: 6 })

    const reichlich = zeilenStand({ item: eintrag({ inventory: inventory() }), timelines: [timeline()], now, timeZone })
    expect(reichlich.reichweite).toMatchObject({ art: 'tage', tage: 31 })
    expect(reichlich.hinweis).toBeNull()

    const ausgeschaltet = zeilenStand({ item: eintrag({ inventory: inventory({ enabled: false }) }), timelines: [timeline()], now, timeZone })
    expect(ausgeschaltet.reichweite).toBeNull()
  })

  it('nur ein Hinweis, der dringendste: abgelaufen vor leer vor knapp', () => {
    const abgelaufenUndLeer = eintrag({
      reconstitution_date: '2026-08-01',
      expiry_days: 28,
      inventory: inventory({ remaining_quantity: 0 }),
    })
    expect(zeilenStand({ item: abgelaufenUndLeer, timelines: [timeline()], now, timeZone }).hinweis).toEqual({ art: 'abgelaufen' })
    expect(zeilenStand({ item: eintrag({ inventory: inventory({ remaining_quantity: 0 }) }), timelines: [timeline()], now, timeZone }).hinweis).toEqual({ art: 'leer' })
  })

  it('laeuft bald ab: innerhalb von sieben Tagen, heute eingeschlossen', () => {
    const bald = eintrag({ reconstitution_date: '2026-09-01', expiry_days: 27 })
    expect(zeilenStand({ item: bald, timelines: [timeline()], now, timeZone }).hinweis).toEqual({ art: 'laeuft_ab', tage: 3 })
    const heute = eintrag({ reconstitution_date: '2026-09-01', expiry_days: 24 })
    expect(zeilenStand({ item: heute, timelines: [timeline()], now, timeZone }).hinweis).toEqual({ art: 'laeuft_ab', tage: 0 })
    const lange = eintrag({ reconstitution_date: '2026-09-01', expiry_days: 60 })
    expect(zeilenStand({ item: lange, timelines: [timeline()], now, timeZone }).hinweis).toBeNull()
  })
})
