import { describe, expect, it } from 'vitest'
import {
  INTAKE_FREQUENCIES,
  isOnDemand,
  needsInterval,
  needsWeekdays,
  slotCountForFrequency,
} from './intakeFrequency'
import { cycleAppliesToDay, type ScheduleCycle } from '../../../lib/intakeSchedule'

function zyklus(frequency: string): ScheduleCycle {
  return {
    id: 'c1',
    stack_item_id: 's1',
    start_date: '2026-09-01',
    end_date: null,
    frequency,
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    dose: 1,
    unit: 'mg',
    schedule_history: null,
  }
}

describe('Frequenzen', () => {
  it('bietet genau die an, die die Auswertung auch kennt', () => {
    // Der Befund, mit dem das anfing: `cycleAppliesToDay` konnte „2x täglich"
    // und „3x täglich" längst, der PDF-Export übersetzte sie, das FAQ erklärte
    // sie — nur das Formular bot sie nie an. Zwei Wahrheiten über dasselbe.
    const geplant = INTAKE_FREQUENCIES.filter(frequency => !isOnDemand(frequency))
    for (const frequency of geplant) {
      // 2026-09-01 ist der Starttag: jede geplante Frequenz greift dort.
      const passend = frequency === 'Wochentage wählen'
        ? { ...zyklus(frequency), schedule_days: ['Di'] }
        : frequency === 'Alle X Tage'
          ? { ...zyklus(frequency), x_days_interval: 3 }
          : zyklus(frequency)
      expect(cycleAppliesToDay(passend, new Date('2026-09-01T12:00:00')), frequency).toBe(true)
    }
  })

  it('zählt die Einnahmezeitpunkte aus der Frequenz', () => {
    expect(slotCountForFrequency('Täglich')).toBe(1)
    expect(slotCountForFrequency('2x täglich')).toBe(2)
    expect(slotCountForFrequency('3x täglich')).toBe(3)
    expect(slotCountForFrequency('Wöchentlich')).toBe(1)
    expect(slotCountForFrequency('Bei Bedarf')).toBe(0)
  })

  it('plant bei „Bei Bedarf" keinen einzigen Tag', () => {
    // Nichts wird fällig, nichts gilt als verpasst, nichts wird automatisch
    // als ausgelassen geloggt. Genau das ist der Sinn: ein Schmerzmittel hat
    // keinen Plan, nur eine Historie.
    for (const tag of ['2026-09-01', '2026-09-02', '2026-09-30', '2026-12-24']) {
      expect(cycleAppliesToDay(zyklus('Bei Bedarf'), new Date(`${tag}T12:00:00`)), tag).toBe(false)
    }
  })

  it('sagt, welche Frequenz welche Zusatzangabe braucht', () => {
    expect(needsInterval('Alle X Tage')).toBe(true)
    expect(needsInterval('Täglich')).toBe(false)
    expect(needsWeekdays('Wochentage wählen')).toBe(true)
    expect(needsWeekdays('Mo-Fr')).toBe(false)
  })
})
