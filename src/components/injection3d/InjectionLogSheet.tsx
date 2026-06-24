// src/components/injection3d/InjectionLogSheet.tsx
import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Check, Clock, Syringe, X } from 'lucide-react'
import type { InjectionPinDraft, InjectionProximityWarning } from '../../lib/injectionLogTypes'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import {
  filterOpenInjectionIntakes,
  type IntakeHistoryDays,
  type IntakeSortOrder,
} from '../../lib/openInjectionIntakeFilters'
import { areInjectionDetailsLocked } from '../../lib/injectionLogSheetState'

const UNIT_OPTIONS = ['mcg', 'mg', 'IU', 'ml', 'nmol']
const METHOD_OPTIONS = ['Subkutan', 'Intramuskulär']

export type InjectionSaveMode = 'intake' | 'manual'

export interface InjectionSaveInput {
  mode: InjectionSaveMode
  intake: OpenInjectionIntake | null
  substanceLabel: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
}

const intakeKey = (i: OpenInjectionIntake) => `${i.cycleId}|${i.scheduledAt}`
const toLocalInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")

function overdueLabel(days: number): string {
  if (days <= 0) return 'heute fällig'
  if (days === 1) return 'gestern fällig'
  return `vor ${days} Tagen fällig`
}

export function InjectionLogSheet({
  pin,
  openIntakes = [],
  warning,
  onCancel,
  onSave,
}: {
  pin: InjectionPinDraft
  openIntakes?: OpenInjectionIntake[]
  cycles?: readonly unknown[]
  warning: InjectionProximityWarning
  onCancel: () => void
  onSave: (input: InjectionSaveInput) => Promise<void>
}) {
  const [mode, setMode] = useState<InjectionSaveMode>(openIntakes.length > 0 ? 'intake' : 'manual')
  const [cycleFilter, setCycleFilter] = useState('all')
  const [historyDays, setHistoryDays] = useState<IntakeHistoryDays>(7)
  const [sortOrder, setSortOrder] = useState<IntakeSortOrder>('newest')
  const [selectedKey, setSelectedKey] = useState('')
  const [substance, setSubstance] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('mcg')
  const [method, setMethod] = useState('Subkutan')
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [saving, setSaving] = useState(false)

  const cycleOptions = useMemo(() => Array.from(
    new Map(openIntakes.map(intake => [
      intake.cycleId,
      { id: intake.cycleId, label: intake.cycleName || intake.peptideName },
    ])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, 'de')), [openIntakes])

  const filteredIntakes = useMemo(() => filterOpenInjectionIntakes(openIntakes, {
    cycleId: cycleFilter,
    days: historyDays,
    order: sortOrder,
  }), [cycleFilter, historyDays, openIntakes, sortOrder])

  const selectedIntake = filteredIntakes.find(i => intakeKey(i) === selectedKey) ?? null
  const detailsLocked = areInjectionDetailsLocked(mode, selectedIntake !== null)

  const selectIntake = (i: OpenInjectionIntake) => {
    setSelectedKey(intakeKey(i))
    setDose(String(i.dose))
    setUnit(i.unit)
    setMethod(i.method)
    setLoggedAt(toLocalInput(i.scheduledAt))
  }

  const canSave = mode === 'intake'
    ? Boolean(selectedIntake && dose && unit && method)
    : Boolean(substance.trim() && dose && unit && method)

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    await onSave({
      mode,
      intake: mode === 'intake' ? selectedIntake : null,
      substanceLabel: mode === 'manual' ? substance.trim() : null,
      dose: dose ? Number(dose) : null,
      unit,
      method,
      notes,
      loggedAt: new Date(loggedAt).toISOString(),
    })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] max-h-[88vh] overflow-y-auto rounded-t-3xl border border-white/10 p-5 pb-8" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-sky-400">3D Injektionskarte</p>
            <h2 className="text-lg font-black text-white">Injektion speichern</h2>
          </div>
          <button type="button" aria-label="Abbrechen" onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
          {(['intake', 'manual'] as InjectionSaveMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === m ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'}`}
            >
              {m === 'intake' ? 'Offene Einnahme' : 'Manuell'}
            </button>
          ))}
        </div>

        {warning.level !== 'none' && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{warning.level === 'strong' ? 'Sehr nahe an einer kürzlichen Injektion.' : 'Nahe an einer Injektion der letzten 7 Tage.'}</p>
          </div>
        )}

        {/* ── Intake mode: pick an open/overdue intake ── */}
        {mode === 'intake' && (
          <div className="mb-4 space-y-2">
            {openIntakes.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className="col-span-2">
                  <span className="label">Zyklus</span>
                  <select className="input" value={cycleFilter} onChange={event => {
                    setCycleFilter(event.target.value)
                    setSelectedKey('')
                  }}>
                    <option value="all">Alle Zyklen</option>
                    {cycleOptions.map(cycle => (
                      <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Rückwirkend</span>
                  <select className="input" value={historyDays} onChange={event => {
                    const value = event.target.value
                    setHistoryDays(value === 'all' ? 'all' : Number(value) as IntakeHistoryDays)
                    setSelectedKey('')
                  }}>
                    {[7, 14, 30, 60, 90].map(days => (
                      <option key={days} value={days}>{days} Tage</option>
                    ))}
                    <option value="all">Alle</option>
                  </select>
                </label>
                <label>
                  <span className="label">Reihenfolge</span>
                  <select className="input" value={sortOrder} onChange={event => {
                    setSortOrder(event.target.value as IntakeSortOrder)
                    setSelectedKey('')
                  }}>
                    <option value="newest">Neueste zuerst</option>
                    <option value="oldest">Älteste zuerst</option>
                  </select>
                </label>
              </div>
            )}

            {openIntakes.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                Keine offenen Einnahmen. Wechsle zu <span className="font-bold text-slate-200">Manuell</span>.
              </p>
            ) : filteredIntakes.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                Keine offenen Einnahmen für diese Filter.
              </p>
            ) : (
              <div className="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
                {filteredIntakes.map(intake => {
                  const active = intakeKey(intake) === selectedKey
                  return (
                    <button
                      key={intakeKey(intake)}
                      type="button"
                      onClick={() => selectIntake(intake)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${active ? 'border-sky-400/50 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'}`}
                    >
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-sky-400/20 text-sky-300' : 'bg-white/5 text-slate-400'}`}>
                        <Syringe size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{intake.peptideName}</p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock size={11} />
                          {format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')} · {overdueLabel(intake.daysOverdue)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-sky-300">{intake.dose} {intake.unit}</p>
                        <p className="text-[0.62rem] text-slate-500">{intake.method}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Manual mode: free-text substance ── */}
        {mode === 'manual' && (
          <label className="mb-4 block">
            <span className="label">Substanz</span>
            <input className="input" value={substance} onChange={e => setSubstance(e.target.value)} placeholder="z.B. Testosteron Enantat" />
          </label>
        )}

        {/* ── Shared fields ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Dosis</span>
              <input className="input" value={dose} onChange={e => setDose(e.target.value)} inputMode="decimal" disabled={detailsLocked} />
            </label>
            <label>
              <span className="label">Einheit</span>
              <select className="input" value={unit} onChange={e => setUnit(e.target.value)} disabled={detailsLocked}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Methode</span>
            <select className="input" value={method} onChange={e => setMethod(e.target.value)} disabled={detailsLocked}>
              {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              {!METHOD_OPTIONS.includes(method) && <option value={method}>{method}</option>}
            </select>
          </label>
          <label className="block">
            <span className="label">Zeitpunkt (rückwirkend möglich)</span>
            <input className="input" type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} disabled={detailsLocked} />
          </label>
          <label className="block">
            <span className="label">Notiz optional</span>
            <textarea className="input min-h-20 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          <p className="text-xs text-slate-500">
            Stelle: {pin.body_side} · {pin.body_region}
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Abbrechen</button>
            <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || !canSave}>
              <Check size={14} /> {mode === 'intake' ? 'Speichern & bestätigen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
