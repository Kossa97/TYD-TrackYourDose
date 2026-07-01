// src/components/injection3d/InjectionLogSheet.tsx
import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Check, Clock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { InjectionPinDraft, InjectionProximityWarning } from '../../lib/injectionLogTypes'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { getOpenInjectionIntakeKey } from '../../lib/injectionDeepLink'
import {
  filterOpenInjectionIntakes,
  type IntakeHistoryDays,
  type IntakeSortOrder,
  type IntakeStatusFilter,
} from '../../lib/openInjectionIntakeFilters'
import {
  areInjectionDetailsLocked,
  replaceTimeInLocalDateTime,
} from '../../lib/injectionLogSheetState'

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

const intakeKey = getOpenInjectionIntakeKey
const toLocalInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")

export function InjectionLogSheet({
  pin,
  openIntakes = [],
  warning,
  targetIntakeKey = null,
  onCancel,
  onSave,
}: {
  pin: InjectionPinDraft
  openIntakes?: OpenInjectionIntake[]
  cycles?: readonly unknown[]
  warning: InjectionProximityWarning
  targetIntakeKey?: string | null
  onCancel: () => void
  onSave: (input: InjectionSaveInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<InjectionSaveMode>(targetIntakeKey || openIntakes.length > 0 ? 'intake' : 'manual')
  const [cycleFilter, setCycleFilter] = useState('all')
  const [historyDays, setHistoryDays] = useState<IntakeHistoryDays>(targetIntakeKey ? 'all' : 7)
  const [sortOrder, setSortOrder] = useState<IntakeSortOrder>('newest')
  const [statusFilter, setStatusFilter] = useState<IntakeStatusFilter>('all')
  const [selectedKey, setSelectedKey] = useState(targetIntakeKey ?? '')
  const [substance, setSubstance] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('mcg')
  const [method, setMethod] = useState('Subkutan')
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [saving, setSaving] = useState(false)

  const overdueLabel = (days: number): string => {
    if (days <= 0) return String(t('injection_due_today', { defaultValue: 'heute fällig' }))
    if (days === 1) return String(t('injection_due_yesterday', { defaultValue: 'gestern fällig' }))
    return String(t('injection_due_days_ago', { days, defaultValue: `vor ${days} Tagen fällig` }))
  }

  const cycleOptions = useMemo(() => Array.from(
    new Map(openIntakes.flatMap(intake => intake.cycleId ? [[
      intake.cycleId,
      { id: intake.cycleId, label: intake.cycleName || intake.peptideName },
    ] as const] : [])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, 'de')), [openIntakes])

  const filteredIntakes = useMemo(() => filterOpenInjectionIntakes(openIntakes, {
    cycleId: cycleFilter,
    days: historyDays,
    order: sortOrder,
    status: statusFilter,
  }), [cycleFilter, historyDays, openIntakes, sortOrder, statusFilter])

  const selectedIntake = filteredIntakes.find(i => intakeKey(i) === selectedKey) ?? null
  const detailsLocked = areInjectionDetailsLocked(mode, selectedIntake !== null)

  const selectIntake = (i: OpenInjectionIntake) => {
    setSelectedKey(intakeKey(i))
    setDose(String(i.dose))
    setUnit(i.unit)
    setMethod(i.method)
    setLoggedAt(toLocalInput(i.scheduledAt))
  }

  useEffect(() => {
    if (!targetIntakeKey) return
    const target = filteredIntakes.find(i => intakeKey(i) === targetIntakeKey)
    if (!target) return
    if (mode !== 'intake') setMode('intake')
    if (selectedKey !== targetIntakeKey || !dose || !unit || !method) selectIntake(target)
  }, [dose, filteredIntakes, method, mode, selectedKey, targetIntakeKey, unit])

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

  const saveActionLabel = mode === 'intake' && selectedIntake
    ? selectedIntake.status === 'confirmed'
      ? t('injection_add_site_action', { defaultValue: 'Injektionsstelle hinzufügen' })
      : t('injection_save_and_confirm', { defaultValue: 'Speichern & bestätigen' })
    : t('injection_save', { defaultValue: 'Speichern' })

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" />
      <div
        className="fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overscroll-y-contain"
        style={{
          background: 'linear-gradient(180deg, rgba(7,11,24,0.96), var(--surface))',
          overscrollBehaviorY: 'contain',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-white">{t('injection_log_title', { defaultValue: 'Injektion speichern' })}</h2>
            </div>
            <button
              type="button"
              aria-label={String(t('injection_position_cancel', { defaultValue: 'Abbrechen' }))}
              onClick={onCancel}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
            {(['intake', 'manual'] as InjectionSaveMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`min-h-11 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === m ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'}`}
              >
                {m === 'intake'
                  ? t('injection_mode_intake', { defaultValue: 'Zyklen' })
                  : t('injection_mode_manual', { defaultValue: 'Manuell' })}
              </button>
            ))}
          </div>

          {warning.level !== 'none' && (
            <div className="mt-3 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{warning.level === 'strong'
                ? t('injection_warning_strong', { defaultValue: 'Sehr nahe an einer kürzlichen Injektion.' })
                : t('injection_warning_caution', { defaultValue: 'Nahe an einer Injektion der letzten 7 Tage.' })}</p>
            </div>
          )}

          <div className="mt-3 space-y-4">
            {mode === 'intake' && (
              <div className="space-y-2">
                {openIntakes.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="col-span-2">
                      <span className="label">{t('injection_cycle_label', { defaultValue: 'Zyklus' })}</span>
                      <select className="input" value={cycleFilter} onChange={event => {
                        setCycleFilter(event.target.value)
                        setSelectedKey('')
                      }}>
                        <option value="all">{t('injection_all_cycles', { defaultValue: 'Alle Zyklen' })}</option>
                        {cycleOptions.map(cycle => (
                          <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="col-span-2">
                      <span className="label">{t('injection_status_label', { defaultValue: 'Status' })}</span>
                      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
                        {([
                          ['all', t('injection_status_all', { defaultValue: 'Alle' })],
                          ['open', t('injection_status_open', { defaultValue: 'Offen' })],
                          ['confirmed', t('injection_status_confirmed', { defaultValue: 'Bestätigt' })],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setStatusFilter(value)
                              setSelectedKey('')
                            }}
                            className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-xs font-bold ${statusFilter === value ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      <span className="label">{t('injection_history_back', { defaultValue: 'Rückwirkend' })}</span>
                      <select className="input" value={historyDays} onChange={event => {
                        const value = event.target.value
                        setHistoryDays(value === 'all' ? 'all' : Number(value) as IntakeHistoryDays)
                        setSelectedKey('')
                      }}>
                        {[7, 14, 30, 60, 90].map(days => (
                          <option key={days} value={days}>{t('injection_history_days', { days, defaultValue: `${days} Tage` })}</option>
                        ))}
                        <option value="all">{t('injection_history_all', { defaultValue: 'Alle' })}</option>
                      </select>
                    </label>
                    <label>
                      <span className="label">{t('injection_sort_order', { defaultValue: 'Reihenfolge' })}</span>
                      <select className="input" value={sortOrder} onChange={event => {
                        setSortOrder(event.target.value as IntakeSortOrder)
                        setSelectedKey('')
                      }}>
                        <option value="newest">{t('injection_sort_newest', { defaultValue: 'Neueste zuerst' })}</option>
                        <option value="oldest">{t('injection_sort_oldest', { defaultValue: 'Älteste zuerst' })}</option>
                      </select>
                    </label>
                  </div>
                )}

                {openIntakes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                    {t('injection_no_matching_intakes', { defaultValue: 'Keine passenden Einnahmen. Wechsle zu Manuell.' })}
                  </p>
                ) : filteredIntakes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                    {t('injection_no_filtered_intakes', { defaultValue: 'Keine Einnahmen für diese Filter.' })}
                  </p>
                ) : (
                  <div className="relative">
                    <div className="max-h-[24dvh] space-y-2 overflow-y-auto overscroll-y-contain pr-1 pb-4">
                      {filteredIntakes.map(intake => {
                        const active = intakeKey(intake) === selectedKey
                        return (
                          <button
                            key={intakeKey(intake)}
                            type="button"
                            onClick={() => selectIntake(intake)}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${active ? 'border-sky-400/50 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'}`}
                          >
                            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? 'bg-sky-400/20 text-sky-300' : 'bg-white/5 text-slate-400'}`}>
                              {intake.status === 'confirmed' ? <Check size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">{intake.peptideName}</p>
                              <p className="text-xs text-slate-400">
                                <span className={intake.status === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'}>
                                  {intake.status === 'confirmed'
                                    ? t('injection_already_confirmed', { defaultValue: 'Bereits bestätigt' })
                                    : t('injection_status_open', { defaultValue: 'Offen' })}
                                </span>
                                {' - '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
                                {intake.status === 'open' ? ` - ${overdueLabel(intake.daysOverdue)}` : ''}
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--surface)] to-transparent" />
                  </div>
                )}
              </div>
            )}

            {mode === 'manual' && (
              <label className="block">
                <span className="label">{t('injection_substance_label', { defaultValue: 'Substanz' })}</span>
                <input
                  className="input"
                  value={substance}
                  onChange={e => setSubstance(e.target.value)}
                  placeholder={String(t('injection_substance_placeholder', { defaultValue: 'z.B. Testosteron Enantat' }))}
                />
              </label>
            )}

            <div className="space-y-4 pb-2">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="label">{t('injection_dose_label', { defaultValue: 'Dosis' })}</span>
                  <input className="input" value={dose} onChange={e => setDose(e.target.value)} inputMode="decimal" disabled={detailsLocked} />
                </label>
                <label>
                  <span className="label">{t('injection_unit_label', { defaultValue: 'Einheit' })}</span>
                  <select className="input" value={unit} onChange={e => setUnit(e.target.value)} disabled={detailsLocked}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="label">{t('injection_method_label', { defaultValue: 'Methode' })}</span>
                <select className="input" value={method} onChange={e => setMethod(e.target.value)} disabled={detailsLocked}>
                  {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  {!METHOD_OPTIONS.includes(method) && <option value={method}>{method}</option>}
                </select>
              </label>
              <div className="block">
                <span className="label">{t('injection_time_label', { defaultValue: 'Zeitpunkt (rückwirkend möglich)' })}</span>
                {mode === 'intake' && selectedIntake ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="label">{t('injection_date_label', { defaultValue: 'Datum' })}</span>
                      <input className="input opacity-70" type="date" value={loggedAt.slice(0, 10)} readOnly aria-readonly="true" />
                    </label>
                    <label>
                      <span className="label">{t('injection_clock_label', { defaultValue: 'Uhrzeit' })}</span>
                      <input
                        className="input"
                        type="time"
                        value={loggedAt.slice(11, 16)}
                        onChange={event => setLoggedAt(replaceTimeInLocalDateTime(loggedAt, event.target.value))}
                      />
                    </label>
                  </div>
                ) : (
                  <input className="input" type="datetime-local" value={loggedAt} onChange={event => setLoggedAt(event.target.value)} />
                )}
              </div>
              <label className="block">
                <span className="label">{t('injection_notes_label', { defaultValue: 'Notiz optional' })}</span>
                <textarea className="input min-h-16 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
              </label>
              <p className="text-xs text-slate-500">
                {t('injection_site_label', { defaultValue: 'Stelle' })}: {pin.body_side} - {pin.body_region}
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3" style={{ background: 'rgba(7,11,24,0.96)' }}>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary min-h-11 flex-1" onClick={onCancel}>{t('injection_position_cancel', { defaultValue: 'Abbrechen' })}</button>
            <button type="button" className="btn-primary min-h-11 flex-1" onClick={save} disabled={saving || !canSave}>
              <Check size={14} aria-hidden="true" /> {saveActionLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}