import { describe, expect, it } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import type { StackItemInventory } from '../types'
import { gruppeVon, haltbarkeitFuer, istAktiv } from './listRow'

const timeZone = 'Europe/Berlin'
const now = new Date('2026-09-25T08:00:00.000Z')

function inventory(changes: Partial<StackItemInventory> = {}): StackItemInventory {
  return {
    enabled: true,
    package_quantity: 30,
    package_unit: 'tablet',
    remaining_quantity: 12,
    batch_number: null,
    expires_at: null,
    ...changes,
  }
}

function version(): CyclePlanVersion {
  return {
    id: 'v1', cycle_id: 'cycle-1', effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-09-01',
    change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null,
    cycle_off_days: null, schedule_days: [], intake_time: 'morgens', intake_time_custom: '08:00', slot_doses: null,
    slot_days: null, dose: 1, unit: 'mg', method: 'Oral',
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

describe('haltbarkeitFuer', () => {
  it('ohne Angaben: keine Haltbarkeit', () => {
    expect(haltbarkeitFuer({}, now, timeZone)).toBeNull()
    expect(haltbarkeitFuer({ inventory: inventory() }, now, timeZone)).toBeNull()
  })

  it('das Datum auf der Packung — fuer jede Form, etwa Tabletten', () => {
    expect(haltbarkeitFuer({ inventory: inventory({ expires_at: '2027-03-31' }) }, now, timeZone))
      .toEqual({ bis: '2027-03-31', tage: 187, anbruchAbgelaufen: false })
  })

  it('nach dem Oeffnen: Tage ab dem Oeffnen, aus dem Bestand', () => {
    const geoeffnet = inventory({ opened_at: '2026-09-20', use_within_days: 28 })
    expect(haltbarkeitFuer({ inventory: geoeffnet }, now, timeZone)).toEqual({ bis: '2026-10-18', tage: 23, anbruchAbgelaufen: false })
  })

  it('aeltere Eintraege: Anmischdatum und Haltbarkeit am Eintrag', () => {
    expect(haltbarkeitFuer({ reconstitution_date: '2026-09-01', expiry_days: 27 }, now, timeZone))
      .toEqual({ bis: '2026-09-28', tage: 3, anbruchAbgelaufen: false })
  })

  it('gelten beide Fristen, zaehlt die fruehere', () => {
    const beides = inventory({ opened_at: '2026-09-20', use_within_days: 28, expires_at: '2026-10-01' })
    expect(haltbarkeitFuer({ inventory: beides }, now, timeZone)).toEqual({ bis: '2026-10-01', tage: 6, anbruchAbgelaufen: false })
  })

  it('weiss, ob die Frist nach dem Anmischen vorbei ist — nur die behebt neues Anmischen', () => {
    const angemischtAbgelaufen = inventory({ opened_at: '2026-08-20', use_within_days: 28 })
    expect(haltbarkeitFuer({ inventory: angemischtAbgelaufen }, now, timeZone))
      .toEqual({ bis: '2026-09-17', tage: -8, anbruchAbgelaufen: true })
    const nurPackungAbgelaufen = inventory({ opened_at: '2026-09-20', use_within_days: 28, expires_at: '2026-09-20' })
    expect(haltbarkeitFuer({ inventory: nurPackungAbgelaufen }, now, timeZone)?.anbruchAbgelaufen).toBe(false)
  })

  it('abgelaufen ist negativ, heute ist 0', () => {
    expect(haltbarkeitFuer({ inventory: inventory({ expires_at: '2026-09-20' }) }, now, timeZone)?.tage).toBe(-5)
    expect(haltbarkeitFuer({ inventory: inventory({ expires_at: '2026-09-25' }) }, now, timeZone)?.tage).toBe(0)
  })
})

describe('istAktiv', () => {
  it('ein laufender Zyklus ist aktiv', () => {
    expect(istAktiv([timeline()], now, timeZone)).toBe(true)
  })

  it('ohne Zyklus, beendet, pausiert oder erst geplant: inaktiv', () => {
    expect(istAktiv([], now, timeZone)).toBe(false)
    expect(istAktiv([timeline({}, { ended_at: '2026-09-10T10:00:00.000Z', end_local_date: '2026-09-10' })], now, timeZone)).toBe(false)
    expect(istAktiv([timeline({ pauses: [{ id: 'p1', cycle_id: 'cycle-1', paused_at: '2026-09-20T10:00:00.000Z', ends_at: null }] })], now, timeZone)).toBe(false)
    expect(istAktiv([timeline({}, { started_at: '2026-10-04T22:00:00.000Z', start_local_date: '2026-10-05' })], now, timeZone)).toBe(false)
  })
})

describe('gruppeVon', () => {
  const haltbar = (tage: number) => ({ bis: '2026-10-01', tage, anbruchAbgelaufen: false })

  it('abgelaufen oder binnen 7 Tagen: braucht Aufmerksamkeit — aktiv oder nicht', () => {
    expect(gruppeVon(true, haltbar(-3))).toBe('achtung')
    expect(gruppeVon(false, haltbar(7))).toBe('achtung')
  })

  it('sonst aktiv vor inaktiv', () => {
    expect(gruppeVon(true, haltbar(8))).toBe('aktiv')
    expect(gruppeVon(false, null)).toBe('inaktiv')
  })

  it('solange die Plaene laden: keine Aussage, also aktiv', () => {
    expect(gruppeVon(null, null)).toBe('aktiv')
  })
})
