import { Moon, Sun, Sunrise } from 'lucide-react'
import type { ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import { WEEKDAY_KEYS } from '../lib/intakeRhythm'
import type { PlanCardSlot, PlanStepRow } from '../lib/planCard'
import { aufzuziehendeEinheiten, type SpritzenRechnung } from '../lib/bestand'
import { formatAmount } from '../lib/bestandLabels'
import {
  chipLabels,
  routineLabel,
  slotDoseLabel,
  weekdayLabel,
  type Translate,
} from '../lib/planLabels'

/** Bausteine der Plan-Darstellung, geteilt von Plan-Uebersicht und Kurzfassung. */

export function RoutineIcon({ group }: { group: ResolvedRoutineGroup }) {
  if (group === 'morning') return <Sunrise size={16} aria-hidden="true" className="shrink-0 text-amber-300" />
  if (group === 'midday') return <Sun size={16} aria-hidden="true" className="shrink-0 text-yellow-200" />
  return <Moon size={16} aria-hidden="true" className="shrink-0 text-indigo-300" />
}

export function DayChips({ days, language }: { days: string[]; language: string }) {
  const labels = chipLabels(language)
  return (
    <span aria-hidden="true" className="mt-1.5 flex flex-wrap gap-0.5">
      {WEEKDAY_KEYS.map((day, index) => {
        const active = days.includes(day)
        return (
          <span
            key={day}
            className={`grid h-5 min-w-5 place-items-center rounded-full px-0.5 text-[10px] font-bold ${active
              ? 'bg-cyan-300/15 text-cyan-100'
              : 'border border-white/10 text-slate-600'}`}
          >
            {labels[index]}
          </span>
        )
      })}
    </span>
  )
}

/** Einheiten auf der Spritze fuer diese Einnahme, als Zahl-Text — oder null. */
function drawUnits(slot: PlanCardSlot, syringe: SpritzenRechnung | null | undefined, language: string): string | null {
  if (!syringe) return null
  const units = aufzuziehendeEinheiten(slot.dose, slot.unit, syringe)
  return units == null ? null : formatAmount(units, language)
}

/**
 * Woraus die Spritzeneinheiten berechnet sind — damit „3 E" nachpruefbar ist:
 * „aus 50 mg auf 1,5 ml (33,3 mg/ml)".
 */
export function SyringeNote({ syringe, language, t }: { syringe: SpritzenRechnung; language: string; t: Translate }) {
  return (
    <p className="text-[11px] text-slate-500">
      {String(t('my_stack_plan_units_note', {
        amount: `${formatAmount(syringe.imVial, language)} ${syringe.einheit}`,
        ml: formatAmount(syringe.ml, language),
        perMl: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(syringe.proMl)} ${syringe.einheit}`,
      }))}
    </p>
  )
}

export function CurrentSlotRow({ slot, language, t, syringe }: { slot: PlanCardSlot; language: string; t: Translate; syringe?: SpritzenRechnung | null }) {
  const dose = slotDoseLabel(slot)
  const units = drawUnits(slot, syringe, language)
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">
          {routineLabel(slot, t)} · {slot.time}
        </p>
        {slot.days.length > 0 && (
          <span className="sr-only">{slot.days.map(day => weekdayLabel(day, language)).join(', ')}</span>
        )}
      </div>
      {dose && (
        <p className="flex flex-col items-end whitespace-nowrap">
          <span className="text-base font-bold text-white">{dose}</span>
          {units && <span className="text-xs font-semibold text-cyan-300">{String(t('my_stack_plan_draw_units', { units }))}</span>}
        </p>
      )}
      {slot.days.length > 0 && (
        <div className="col-span-2 col-start-2 -mt-1.5">
          <DayChips days={slot.days} language={language} />
        </div>
      )}
    </li>
  )
}

export function ChangeMarker({ change, t }: { change: PlanStepRow['change']; t: Translate }) {
  if (change === 'initial') return null
  if (change === 'same') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/25 px-1.5 py-px text-[10.5px] font-semibold text-slate-400">
        <span aria-hidden="true" className="text-xs leading-none">=</span>
        {String(t('my_stack_plan_change_same', { defaultValue: 'gleich' }))}
      </span>
    )
  }
  const copy = {
    increased: { text: t('my_stack_plan_change_increased', { defaultValue: 'erhöht' }), arrow: '↑', tone: 'bg-emerald-400/15 text-emerald-200' },
    decreased: { text: t('my_stack_plan_change_decreased', { defaultValue: 'reduziert' }), arrow: '↓', tone: 'bg-amber-300/15 text-amber-100' },
    changed: { text: t('my_stack_plan_change_changed', { defaultValue: 'geändert' }), arrow: '', tone: 'bg-violet-300/15 text-violet-100' },
    new: { text: t('my_stack_plan_change_new', { defaultValue: 'neu' }), arrow: '', tone: 'bg-cyan-300/15 text-cyan-100' },
    removed: { text: t('my_stack_plan_change_removed', { defaultValue: 'entfällt' }), arrow: '', tone: 'bg-rose-300/10 text-rose-200' },
  }[change]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-bold ${copy.tone}`}>
      {copy.arrow && <span aria-hidden="true">{copy.arrow}</span>}
      {String(copy.text)}
    </span>
  )
}

export function StepSlotRow({ row, language, t, syringe }: { row: PlanStepRow; language: string; t: Translate; syringe?: SpritzenRechnung | null }) {
  const { slot, previous, change } = row
  const units = change === 'removed' ? null : drawUnits(slot, syringe, language)
  const quiet = change === 'same' || change === 'removed'
  const dose = slotDoseLabel(slot)
  const previousDose = previous ? slotDoseLabel(previous) : null
  const doseMoved = previous != null && change !== 'removed' && previousDose !== dose
  const timeMoved = previous != null && change !== 'removed' && previous.time !== slot.time
  const days = slot.days.map(day => weekdayLabel(day, language)).join(', ')
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-2.5 py-2 ${quiet
        ? 'border-white/[0.04]'
        : 'border-white/[0.08] bg-white/[0.045]'}`}
    >
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${quiet ? 'text-slate-400' : 'text-slate-100'}`}>
          {routineLabel(slot, t)} · {timeMoved && <span className="font-medium text-slate-500">{previous.time} → </span>}{slot.time}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-400">
          {days && <span>{days}</span>}
          <ChangeMarker change={change} t={t} />
        </p>
      </div>
      {dose && (
        <p className={`flex flex-col items-end whitespace-nowrap text-sm font-bold ${quiet ? 'text-slate-400' : 'text-white'} ${change === 'removed' ? 'line-through' : ''}`}>
          {doseMoved && previousDose && (
            <span className="text-[11px] font-medium text-slate-500">{previousDose} →</span>
          )}
          <span>{dose}{units && <span className="font-semibold text-cyan-300"> · {String(t('my_stack_plan_units_short', { units }))}</span>}</span>
        </p>
      )}
    </li>
  )
}
