import { describe, expect, it } from 'vitest'
import { evaluatePkReadiness, mgPerMlFromStrength, resolvePkScheduleForDay, toPkMilligrams } from './pkReadiness'
import type { EscalationRow, ScheduleCycle } from '../../../lib/intakeSchedule'

const readyInput = {
  trackingLevel: 'complete' as const,
  pkProfileId: 'profile-1',
  pkProfileMethod: 'Subkutan',
  method: 'Subkutan',
  dose: 1,
  unit: 'mg',
  scheduledAt: '08:00',
}

describe('evaluatePkReadiness', () => {
  it('requires complete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
    })).toEqual({ status: 'missing', missing: ['complete_tracking'] })
  })

  it('reports every missing requirement alongside incomplete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['complete_tracking', 'method', 'dose', 'unit', 'time'],
    })
  })

  it('reports unsupported when no profile exists', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileId: null,
    })).toEqual({ status: 'unsupported', reason: 'no_profile' })
  })

  it('reports the exact missing route, dose, unit, and time', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['method', 'dose', 'unit', 'time'],
    })
  })

  it('requires the confirmed PK method to match the active plan method', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: 'Oral',
    })).toEqual({ status: 'missing', missing: ['method'] })
  })

  it('rejects units without an explicit conservative conversion', () => {
    expect(evaluatePkReadiness({ ...readyInput, unit: 'IU' })).toEqual({
      status: 'unsupported',
      reason: 'unit_conversion',
    })
  })

  it('reports ready only when every PK requirement is satisfied', () => {
    expect(evaluatePkReadiness(readyInput)).toEqual({ status: 'ready' })
  })
})

describe('toPkMilligrams', () => {
  it('normalizes mg and mcg without help', () => {
    expect(toPkMilligrams(1, 'mg')).toBe(1)
    expect(toPkMilligrams(1000, 'mcg')).toBe(1)
  })

  it('rechnet IU um, sobald die Substanz ihren Faktor mitbringt', () => {
    // Eine Internationale Einheit ist keine Masse, sondern eine biologische
    // Wirkstaerke — der Faktor haengt an der Substanz. HGH: 3 IU je mg.
    expect(toPkMilligrams(6, 'IU', 3)).toBe(2)
    // HCG: rund 10.000 IU je mg.
    expect(toPkMilligrams(5000, 'IU', 10000)).toBe(0.5)
    expect(toPkMilligrams(5000, 'iu', 10000)).toBe(0.5)
  })

  it('bleibt bei null, solange kein brauchbarer Faktor dasteht', () => {
    // Vor dieser Runde fielen HCG und HGH genau hier durch — mit dem
    // Unterschied, dass es gar keinen Faktor geben konnte.
    expect(toPkMilligrams(5000, 'IU')).toBeNull()
    expect(toPkMilligrams(5000, 'IU', null)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', 0)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', -3)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', Number.NaN)).toBeNull()
  })

  it('laesst einen Faktor Einheiten unberuehrt, die keine IU sind', () => {
    // Der Faktor gilt der Umrechnung von IU. Auf ml oder Kapseln angewendet
    // waere er eine erfundene Masse.
    expect(toPkMilligrams(2, 'ml', 10000)).toBeNull()
    expect(toPkMilligrams(1, 'capsule', 3)).toBeNull()
    expect(toPkMilligrams(1, 'mg', 3)).toBe(1)
  })
})

describe('resolvePkScheduleForDay', () => {
  const cycle: ScheduleCycle & { method: string } = {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    start_date: '2026-08-01',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: [],
    intake_time: 'custom',
    intake_time_custom: '08:00',
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    schedule_history: [{
      effective_from: '2026-08-01',
      frequency: 'Täglich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '08:00',
      dose: 1,
      unit: 'mg',
    }, {
      effective_from: '2026-08-20',
      frequency: 'Wöchentlich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '09:30',
      dose: 2,
      unit: 'mg',
    }],
  }

  it.each([
    {
      label: 'before a future effective date',
      day: new Date(2026, 7, 19, 12),
      expected: { dose: 1, unit: 'mg', scheduledAt: '08:00', frequency: 'Täglich' },
    },
    {
      label: 'on the future effective date',
      day: new Date(2026, 7, 20, 12),
      expected: { dose: 2, unit: 'mg', scheduledAt: '09:30', frequency: 'Wöchentlich' },
    },
  ])('uses the date-effective segment $label', ({ day, expected }) => {
    expect(resolvePkScheduleForDay(cycle, [], day)).toMatchObject({
      ...expected,
      method: 'Subkutan',
    })
  })

  it('rejects an active escalation whose unit differs from the effective segment', () => {
    const escalations: EscalationRow[] = [{
      cycle_id: cycle.id,
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-20',
      start_after_days: null,
    }]

    expect(resolvePkScheduleForDay(cycle, escalations, new Date(2026, 7, 20, 12)))
      .toMatchObject({ dose: null, unit: null, scheduledAt: '09:30', frequency: 'Wöchentlich' })
  })
})


describe('mgPerMlFromStrength — die Konzentration aus der Staerke', () => {
  it('rechnet das aufgeloeste Vial: 5 mg auf 2 ml sind 2,5 mg/ml', () => {
    expect(mgPerMlFromStrength(5, 'mg', 2, 'ml')).toBe(2.5)
  })

  it('rechnet auch in Mikrogramm eingetragene Staerken', () => {
    // 500 mcg auf 1 ml sind 0,5 mg/ml.
    expect(mgPerMlFromStrength(500, 'mcg', 1, 'ml')).toBe(0.5)
  })

  it('schweigt, wo die Produktmenge kein Volumen ist', () => {
    // Eine Kapsel hat keine Konzentration — „mg je Kapsel" ist schon die Menge.
    expect(mgPerMlFromStrength(500, 'mg', 1, 'capsule')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', 1, 'vial')).toBeNull()
  })

  it('schweigt bei unvollstaendiger oder unsinniger Staerke', () => {
    expect(mgPerMlFromStrength(null, 'mg', 2, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', null, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(5, 'mg', 0, 'ml')).toBeNull()
    expect(mgPerMlFromStrength(-5, 'mg', 2, 'ml')).toBeNull()
    // Eine Einheit, die keine Wirkstoffmenge ist, ergibt keine Konzentration.
    expect(mgPerMlFromStrength(5, 'ml', 2, 'ml')).toBeNull()
  })
})

describe('toPkMilligrams — Milliliter', () => {
  it('macht aus aufgezogenem Volumen eine Wirkstoffmenge', () => {
    // So dosiert man ein aufgeloestes Peptid: 5 mg im Vial auf 2 ml Wasser
    // sind 2,5 mg/ml; wer 0,2 ml aufzieht, hat 0,5 mg.
    const konzentration = mgPerMlFromStrength(5, 'mg', 2, 'ml')!
    expect(toPkMilligrams(0.2, 'ml', null, konzentration)).toBeCloseTo(0.5, 10)
  })

  it('gibt jeder Zutat eines Kombi-Vials ihre eigene Menge', () => {
    // 5 mg CJC-1295 ohne DAC UND 5 mg Ipamorelin in denselben 2 ml. Aus
    // denselben 0,2 ml folgt fuer jede ihre eigene Dosis — hier gleich viel,
    // weil beide gleich stark eingewogen sind; bei 5 mg und 10 mg waere es
    // doppelt so viel fuer die zweite.
    const cjc = mgPerMlFromStrength(5, 'mg', 2, 'ml')!
    const ipa = mgPerMlFromStrength(10, 'mg', 2, 'ml')!
    expect(toPkMilligrams(0.2, 'ml', null, cjc)).toBeCloseTo(0.5, 10)
    expect(toPkMilligrams(0.2, 'ml', null, ipa)).toBeCloseTo(1.0, 10)
  })

  it('bleibt ohne Konzentration bei null, statt eine Zahl zu erfinden', () => {
    // Milliliter sind ein Volumen. Ohne zu wissen, was darin geloest ist,
    // gibt es keine Menge — und null heisst „koennen wir nicht umrechnen",
    // nicht „ist null Milligramm".
    expect(toPkMilligrams(0.2, 'ml')).toBeNull()
    expect(toPkMilligrams(0.2, 'ml', null, 0)).toBeNull()
  })

  it('laesst mg, mcg und IU, wie sie waren', () => {
    expect(toPkMilligrams(1, 'mg', null, 2.5)).toBe(1)
    expect(toPkMilligrams(500, 'mcg', null, 2.5)).toBe(0.5)
    expect(toPkMilligrams(3, 'IU', 3, 2.5)).toBe(1)
  })
})

describe('evaluatePkReadiness — in Millilitern geplant', () => {
  it('nimmt einen in ml geplanten Zyklus an, sobald die Konzentration bekannt ist', () => {
    // Vorher fiel genau das durch: „unsupported", und die Karte verschwand
    // wortlos aus dem Karussell — obwohl der Nutzer alles eingetragen hatte.
    const inMl = { ...readyInput, dose: 0.2, unit: 'ml' }
    expect(evaluatePkReadiness(inMl).status).toBe('unsupported')
    expect(evaluatePkReadiness({ ...inMl, mgPerMl: 2.5 }).status).toBe('ready')
  })
})
