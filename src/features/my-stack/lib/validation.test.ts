import { describe, expect, it } from 'vitest'
import type { IntakePlanDraft, StackItemDraft, StackItemIngredient } from '../types'
import { validateIntakePlan, validateStackItemDraft } from './validation'
import { emptyRhythm } from './intakeRhythm'

const ingredient: StackItemIngredient = {
  catalog_substance_id: 'vitamin-d3',
  custom_name: '',
  amount_value: 5000,
  amount_unit: 'IU',
  basis_value: 1,
  basis_unit: 'capsule',
  position: 0,
}

const validVitaminD: StackItemDraft = {
  displayName: 'Vitamin D3',
  trackingLevel: 'complete',
  category: 'vitamin',
  dosageForm: 'capsule',
  brand: '',
  colorHex: '',
  notes: '',
  ingredients: [ingredient],
}

const validPlan: IntakePlanDraft = {
  name: 'Vitamin D3',
  unit: 'capsule',
  method: 'Oral',
  rhythm: emptyRhythm(),
  startDate: '2026-07-29',
  endDate: null,
  slots: [{ routineGroup: 'morning', time: null, dose: 1 }],
  reminders: [],
}

describe('validateStackItemDraft', () => {
  it('requires a positive dose and unit only when tracking quantity', () => {
    const planWithoutQuantity = {
      ...validPlan,
      unit: null,
      slots: [{ routineGroup: 'morning' as const, time: null, dose: null }],
    }

    expect(validateIntakePlan(planWithoutQuantity, 'intake_only')).toEqual({})
    expect(validateIntakePlan(planWithoutQuantity, 'with_amount')).toEqual({
      dose: 'required',
      // Und je Zeitpunkt, damit der Hinweis an der Karte stehen kann, in der
      // die Zahl fehlt — und nicht unten bei der Einheit.
      doses: ['required'],
      unit: 'required',
    })
    expect(validateIntakePlan({
      ...validPlan,
      name: ' ',
      slots: [{ routineGroup: '' as never, time: null, dose: null }],
    }, 'complete')).toEqual({
      name: 'required',
      dose: 'required',
      doses: ['required'],
      slots: ['required'],
    })
  })

  it('lässt ein Ende vor dem Start nicht durch — und ein leeres Ende schon', () => {
    // Eine Kur hat ein Ende, alles andere nicht. Nur die Umkehrung ist ein
    // Fehler: ein Ende, das vor dem Start liegt.
    expect(validateIntakePlan({ ...validPlan, endDate: '2026-07-28' }, 'complete'))
      .toMatchObject({ endDate: 'before_start' })
    expect(validateIntakePlan({ ...validPlan, endDate: '2026-07-29' }, 'complete').endDate)
      .toBeUndefined()
    expect(validateIntakePlan({ ...validPlan, endDate: '2026-08-05' }, 'complete').endDate)
      .toBeUndefined()
    expect(validateIntakePlan({ ...validPlan, endDate: null }, 'complete').endDate).toBeUndefined()
  })

  it('verlangt bei „Bei Bedarf" keine Tageszeit', () => {
    // Dort gibt es keinen geplanten Zeitpunkt — eine Pflichtangabe ohne
    // Bedeutung wäre schlimmer als keine.
    const beiBedarf = { ...validPlan, rhythm: { ...emptyRhythm(), kind: 'on_demand' as const }, slots: [] }

    expect(validateIntakePlan(beiBedarf, 'complete').slots).toBeUndefined()
  })

  it('verlangt je geplantem Einnahmezeitpunkt eine Tageszeit', () => {
    const zweiMal = {
      ...validPlan,
      slots: [
        { routineGroup: 'morning' as const, time: null, dose: 1 },
        { routineGroup: '' as never, time: null, dose: 1 },
      ],
    }

    expect(validateIntakePlan(zweiMal, 'complete').slots).toEqual(['', 'required'])
  })

  it('requires a method and a start/effective date for every tracking level', () => {
    for (const trackingLevel of ['intake_only', 'with_amount', 'complete'] as const) {
      expect(validateIntakePlan({ ...validPlan, method: ' ', startDate: '' }, trackingLevel))
        .toMatchObject({ method: 'required', startDate: 'required' })
    }
  })

  it.each([null, 0, 2.5, 91, Number.POSITIVE_INFINITY])(
    'weist einen unbrauchbaren Abstand ab (%s)',
    intervalValue => {
      expect(validateIntakePlan({
        ...validPlan,
        rhythm: { ...emptyRhythm(), kind: 'interval' as const, intervalValue },
      }, 'complete').xDaysInterval).toBe('invalid_interval')
    },
  )

  it('richtet die Grenze des Abstands nach seiner Einheit', () => {
    // 52 Wochen sind gültig, 53 nicht; 12 Monate gültig, 13 nicht. Vorher galt
    // pauschal „2 bis 30 Tage", und ein Depot alle zehn Wochen ging gar nicht.
    const mit = (intervalUnit: 'day' | 'week' | 'month', intervalValue: number) =>
      validateIntakePlan({
        ...validPlan,
        rhythm: { ...emptyRhythm(), kind: 'interval' as const, intervalUnit, intervalValue },
      }, 'complete').xDaysInterval

    expect(mit('week', 10)).toBeUndefined()
    expect(mit('week', 52)).toBeUndefined()
    expect(mit('week', 53)).toBe('invalid_interval')
    expect(mit('month', 6)).toBeUndefined()
    expect(mit('month', 13)).toBe('invalid_interval')
    expect(mit('day', 90)).toBeUndefined()
    expect(mit('day', 91)).toBe('invalid_interval')
  })

  it('verlangt beim Wechsel einen Tag an und einen Tag Pause', () => {
    const mit = (onDays: number | null, offDays: number | null) =>
      validateIntakePlan({
        ...validPlan,
        rhythm: { ...emptyRhythm(), kind: 'cycle' as const, onDays, offDays },
      }, 'complete').scheduleDays

    expect(mit(21, 7)).toBeUndefined()   // die Pille
    expect(mit(5, 2)).toBeUndefined()
    expect(mit(null, 2)).toBe('invalid_cycle')
    expect(mit(5, null)).toBe('invalid_cycle')
    expect(mit(0, 2)).toBe('invalid_cycle')
    expect(mit(5, 91)).toBe('invalid_cycle')
  })

  it('requires at least one valid unique selected weekday', () => {
    for (const weekdays of [[], ['XX'], ['Mo', 'Mo']]) {
      expect(validateIntakePlan({
        ...validPlan,
        rhythm: { ...emptyRhythm(), kind: 'weekdays' as const, weekdays },
      }, 'complete').scheduleDays).toBe('invalid_weekdays')
    }
    expect(validateIntakePlan({
      ...validPlan,
      rhythm: { ...emptyRhythm(), kind: 'weekdays' as const, weekdays: ['Mo', 'Fr'] },
    }, 'complete').scheduleDays).toBeUndefined()
  })

  it('verlangt die Menge an JEDEM Einnahmezeitpunkt', () => {
    // „morgens 1000, abends —" ist kein Plan, sondern ein halber.
    expect(validateIntakePlan({
      ...validPlan,
      slots: [
        { routineGroup: 'morning' as const, time: '08:00', dose: 1000 },
        { routineGroup: 'evening' as const, time: '20:00', dose: null },
      ],
    }, 'with_amount').dose).toBe('required')

    expect(validateIntakePlan({
      ...validPlan,
      slots: [
        { routineGroup: 'morning' as const, time: '08:00', dose: 1000 },
        { routineGroup: 'evening' as const, time: '20:00', dose: 500 },
      ],
    }, 'with_amount').dose).toBeUndefined()
  })

  it('allows missing strength for intake_only and with_amount', () => {
    for (const trackingLevel of ['intake_only', 'with_amount'] as const) {
      const errors = validateStackItemDraft({
        ...validVitaminD,
        trackingLevel,
        ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
      })
      expect(errors.ingredients?.[0]?.amountValue).toBeUndefined()
    }
  })

  it('requires product strength for complete', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      trackingLevel: 'complete',
      ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
    })
    expect(errors.ingredients?.[0]?.amountValue).toBe('required_for_complete')
  })

  it('rejects non-positive complete strength and basis values before SQL', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: 0, basis_value: 0 }],
    })

    expect(errors.ingredients?.[0]).toMatchObject({
      amountValue: 'required_for_complete',
      basisValue: 'required_for_complete',
    })
  })

  it('rejects non-finite tracked quantities and complete strength before SQL', () => {
    expect(validateIntakePlan({
      ...validPlan,
      slots: [{ routineGroup: 'morning' as const, time: null, dose: Number.POSITIVE_INFINITY }],
    }, 'with_amount').dose).toBe('required')
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: Number.POSITIVE_INFINITY }],
    }).ingredients?.[0]?.amountValue).toBe('required_for_complete')
  })

  it('akzeptiert einen vollständigen Entwurf', () => {
    expect(validateStackItemDraft(validVitaminD)).toEqual({})
  })

  it('verlangt eine Darreichungsform', () => {
    expect(validateStackItemDraft({ ...validVitaminD, dosageForm: null }).dosageForm).toBeTruthy()
  })

  it('verlangt mindestens einen Inhaltsstoff', () => {
    expect(validateStackItemDraft({ ...validVitaminD, ingredients: [] }).ingredients).toBeTruthy()
  })

  it('markiert fehlende Stärke und Bezugsgröße an der Inhaltsstoffzeile', () => {
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: null }],
    }).ingredients?.[0].amountValue).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_unit: null }],
    }).ingredients?.[0].amountUnit).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, basis_value: null }],
    }).ingredients?.[0].basisValue).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, basis_unit: null }],
    }).ingredients?.[0].basisUnit).toBeTruthy()
  })

  it('akzeptiert freie und katalogbasierte Inhaltsstoffe', () => {
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, catalog_substance_id: null, custom_name: 'Vitamin D3' }],
    })).toEqual({})
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, custom_name: '' }],
    })).toEqual({})
  })

  it('behandelt eine reine Leerraum-Katalog-ID als fehlend', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, catalog_substance_id: '   ', custom_name: ' ' }],
    })

    expect(errors.ingredients?.[0].name).toBeTruthy()
  })

  it('markiert bei Mehrfachwirkstoffen nur fehlerhafte Zeilen', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [
        ingredient,
        {
          ...ingredient,
          catalog_substance_id: null,
          custom_name: ' ',
          position: 1,
        },
      ],
    })

    expect(errors.ingredients?.[0]).toEqual({})
    expect(errors.ingredients?.[1].name).toBeTruthy()
  })
})
