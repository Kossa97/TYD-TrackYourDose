import { addDays, format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { cycleAppliesToDay as cron, daySlots as cronSlots } from './reminderSchedule.js'
import { cycleAppliesToDay as app, resolveScheduleSlots, scheduleForDay } from '../../src/lib/intakeSchedule.ts'

// Die Regel „gilt dieser Zyklus heute?" gibt es ZWEIMAL: in der App
// (`src/lib/intakeSchedule.ts`) und hier im Push-Cron, weil die api/-Functions
// nicht aus src/ importieren koennen. Laufen die beiden auseinander, erinnert
// der Cron an Tagen, an denen die App nichts faellig zeigt — und schweigt an
// Tagen, an denen etwas ansteht. Beides faellt im Betrieb kaum auf.
//
// Dieser Test hat genau das gefunden: der Cron las `interval_unit` nicht aus
// dem Segment und hielt „alle 2 Wochen" fuer „alle 2 Tage".

function zyklus(teile) {
  return {
    id: 'c1',
    stack_item_id: 's1',
    start_date: '2026-03-02',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    dose: 1,
    unit: 'mg',
    schedule_history: null,
    ...teile,
  }
}

const FAELLE = [
  zyklus({}),
  zyklus({ frequency: 'Alle X Tage', x_days_interval: 3 }),
  zyklus({ frequency: 'Alle X Tage', x_days_interval: 2, interval_unit: 'week' }),
  zyklus({ frequency: 'Alle X Tage', x_days_interval: 10, interval_unit: 'week' }),
  zyklus({ start_date: '2026-01-31', frequency: 'Alle X Tage', x_days_interval: 1, interval_unit: 'month' }),
  zyklus({ start_date: '2026-01-15', frequency: 'Alle X Tage', x_days_interval: 3, interval_unit: 'month' }),
  zyklus({ start_date: '2026-01-31', frequency: 'Alle X Tage', x_days_interval: 6, interval_unit: 'month' }),
  zyklus({ frequency: 'Im Wechsel', cycle_on_days: 21, cycle_off_days: 7 }),
  zyklus({ frequency: 'Im Wechsel', cycle_on_days: 5, cycle_off_days: 2 }),
  zyklus({ frequency: 'Im Wechsel', cycle_on_days: 1, cycle_off_days: 1 }),
  zyklus({ frequency: 'Wochentage wählen', schedule_days: ['Mo', 'Mi', 'Fr'] }),
  zyklus({ frequency: 'Bei Bedarf' }),
  zyklus({ frequency: 'Jeden 2. Tag' }),
  zyklus({ frequency: 'Mo-Fr' }),
  zyklus({ frequency: 'Wöchentlich' }),
  zyklus({ frequency: '5 Tage an / 2 aus' }),
  zyklus({ frequency: '2x täglich' }),
  zyklus({ end_date: '2026-03-10' }),
]

// Dieselben Zyklen, aber mit Mengen und Tagen je Zeitpunkt: was der Cron in
// die Erinnerung schreibt, muss die Zahl sein, die die App auf der Karte zeigt.
const MIT_MENGEN = [
  zyklus({ intake_time: 'morgens,abends', intake_time_custom: ',', slot_doses: '1000,500', dose: 1000 }),
  zyklus({ intake_time: 'morgens,abends', intake_time_custom: ',', dose: 250 }),
  zyklus({
    frequency: 'Wochentage wählen', schedule_days: ['Mo', 'Mi', 'Fr'],
    intake_time: 'morgens,abends,morgens', intake_time_custom: ',,',
    slot_doses: '1000,500,750', slot_days: 'Mo,Mo,Mi', dose: 1000,
  }),
  zyklus({ intake_time: 'custom,abends', intake_time_custom: '06:30,', slot_doses: '2,4', dose: 2 }),
]

describe('App und Push-Cron sagen dieselbe MENGE', () => {
  it('je Zeitpunkt, über 400 Tage', () => {
    const abweichungen = []
    for (const cycle of MIT_MENGEN) {
      for (let i = 0; i < 400; i += 1) {
        const tag = addDays(parseISO('2026-01-01'), i)
        const schluessel = format(tag, 'yyyy-MM-dd')
        if (!cron(cycle, schluessel)) continue
        const imCron = cronSlots(cycle, schluessel).map(slot => `${slot.time}=${slot.dose ?? '-'}`)
        const inDerApp = resolveScheduleSlots(scheduleForDay(cycle, tag), tag)
          .map(slot => `${slot.time}=${slot.dose ?? '-'}`)
        if (imCron.join(' ') !== inDerApp.join(' ')) {
          abweichungen.push(`${cycle.frequency} am ${schluessel}: Cron=[${imCron}], App=[${inDerApp}]`)
        }
      }
    }

    expect(abweichungen.slice(0, 5).join('\n')).toBe('')
  })
})

describe('App und Push-Cron sagen dasselbe', () => {
  it('über 400 Tage, für jeden Rhythmus', () => {
    const abweichungen = []
    for (const cycle of FAELLE) {
      for (let i = 0; i < 400; i += 1) {
        const tag = addDays(parseISO('2026-01-01'), i)
        const schluessel = format(tag, 'yyyy-MM-dd')
        const imCron = cron(cycle, schluessel)
        const inDerApp = app(cycle, tag)
        if (imCron !== inDerApp) {
          abweichungen.push(
            `${cycle.frequency}/${cycle.x_days_interval ?? '-'}/${cycle.interval_unit ?? '-'}`
            + ` am ${schluessel}: Cron=${imCron}, App=${inDerApp}`,
          )
        }
      }
    }

    expect(abweichungen.slice(0, 5).join('\n')).toBe('')
  })
})
