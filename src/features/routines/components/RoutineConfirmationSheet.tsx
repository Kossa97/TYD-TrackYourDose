import { useId, useRef, useState } from 'react'
import { Check, Pencil, RotateCcw, Syringe, X } from 'lucide-react'
import { formatTrackedQuantity } from '../quantityPresentation'
import {
  buildConfirmationEntry,
  type RoutineConfirmationEntry,
  type RoutineGroupModel,
  type RoutineIntake,
} from '../intakeGroups'
import { buildOneOffActualDose, dosePlanCapabilities } from '../../my-stack/lib/dosePlan'

interface ConfirmedIntake {
  entry: RoutineConfirmationEntry
  doseLogId: string
}

interface RoutineConfirmationSheetProps {
  group: RoutineGroupModel
  onClose: () => void
  onConfirm: (entries: RoutineConfirmationEntry[]) => Promise<string[]>
  onAfterConfirm?: (entries: RoutineConfirmationEntry[], savedLogIds: string[]) => void | Promise<void>
  onAddInjection?: (entry: RoutineIntake, doseLogId: string) => void
}

const GROUP_LABELS: Record<RoutineGroupModel['key'], string> = {
  morning: 'Morgens',
  midday: 'Mittags',
  evening: 'Abends',
}

export function RoutineConfirmationSheet({
  group,
  onClose,
  onConfirm,
  onAfterConfirm,
  onAddInjection,
}: RoutineConfirmationSheetProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [entries, setEntries] = useState<RoutineConfirmationEntry[]>(() => (
    group.items.map(buildConfirmationEntry)
  ))
  const [editingKeys, setEditingKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedIntake[] | null>(null)

  const updateEntry = (key: string, update: Partial<RoutineConfirmationEntry>) => {
    setEntries(current => current.map(entry => entry.key === key ? { ...entry, ...update } : entry))
  }

  const selectedEntries = entries.filter(entry => entry.selected)
  const hasInvalidQuantity = selectedEntries.some(entry => (
    entry.trackingLevel !== 'intake_only'
    && (
      entry.actualDose == null
      || !Number.isFinite(entry.actualDose)
      || entry.actualDose <= 0
      || !entry.actualUnit?.trim()
      || entry.actualUnit !== entry.unit
    )
  ))
  const canConfirm = selectedEntries.length > 0 && !hasInvalidQuantity && !saving

  const save = async () => {
    if (!canConfirm) return
    setSaving(true)
    setError(false)
    let savedLogIds: string[]
    try {
      savedLogIds = await onConfirm(entries)
    } catch {
      setError(true)
      setSaving(false)
      return
    }
    setConfirmed(selectedEntries.map((entry, index) => ({
      entry,
      doseLogId: savedLogIds[index],
    })).filter(item => Boolean(item.doseLogId)))
    setSaving(false)
    void Promise.resolve()
      .then(() => onAfterConfirm?.(entries, savedLogIds))
      .catch(() => undefined)
  }

  return (
    <>
      <button
        type="button"
        aria-label="Routine-Bestätigung schließen"
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-pointer bg-black/70"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-3 bottom-3 z-[60] max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-cyan-300">
              {GROUP_LABELS[group.key]}-Routine
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-black text-white">
              Gemeinsam bestätigen
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Auswahl und Mengen vor dem Speichern prüfen.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {confirmed ? (
          <div className="space-y-3">
            <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-bold text-emerald-300">
              <Check size={17} aria-hidden="true" /> Routine gespeichert
            </div>
            {confirmed.filter(item => item.entry.injectable).map(item => (
              <button
                key={item.entry.key}
                type="button"
                aria-label={`Injektionsstelle ergänzen für ${item.entry.stackItemName}`}
                onClick={() => onAddInjection?.(item.entry, item.doseLogId)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/15 px-3 text-sm font-black text-sky-300 transition-colors hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <Syringe size={16} aria-hidden="true" /> Injektionsstelle ergänzen
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-200 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Fertig
            </button>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {entries.map(entry => {
                const editing = editingKeys.includes(entry.key)
                const capabilities = dosePlanCapabilities(entry.trackingLevel)
                const plannedQuantity = capabilities.oneOff
                  ? formatTrackedQuantity(entry.dose, entry.unit, '')
                  : null
                return (
                  <li key={entry.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex min-h-11 items-center gap-3">
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`${entry.stackItemName} auswählen`}
                          checked={entry.selected}
                          onChange={event => updateEntry(entry.key, { selected: event.target.checked })}
                          className="h-5 w-5 shrink-0 cursor-pointer accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{entry.stackItemName}</span>
                          {plannedQuantity && (
                            <span className="block text-xs font-semibold text-slate-400">Geplant: {plannedQuantity}</span>
                          )}
                        </span>
                      </label>
                      {capabilities.oneOff && (
                        <button
                          type="button"
                          aria-label="Einmalige Abweichung"
                          aria-expanded={editing}
                          onClick={() => {
                            if (editing) {
                              updateEntry(entry.key, { actualDose: entry.dose, actualUnit: entry.unit })
                              setEditingKeys(current => current.filter(key => key !== entry.key))
                            } else {
                              setEditingKeys(current => [...current, entry.key])
                            }
                          }}
                          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 text-xs font-black text-cyan-300 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          <Pencil size={13} aria-hidden="true" /> Einmalige Abweichung
                        </button>
                      )}
                    </div>
                    {editing && capabilities.oneOff && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="sr-only" htmlFor={`routine-amount-${entry.key}`}>
                          Menge für {entry.stackItemName}
                        </label>
                        <input
                          id={`routine-amount-${entry.key}`}
                          type="number"
                          min="0"
                          step="any"
                          value={entry.actualDose ?? ''}
                          onChange={event => {
                            if (event.target.value === '') {
                              updateEntry(entry.key, { actualDose: null })
                              return
                            }
                            const dose = Number(event.target.value)
                            if (!Number.isFinite(dose) || dose <= 0) {
                              updateEntry(entry.key, { actualDose: dose })
                              return
                            }
                            setEntries(current => current.map(currentEntry => currentEntry.key === entry.key
                              ? buildOneOffActualDose(currentEntry, {
                                  dose,
                                  unit: currentEntry.actualUnit ?? currentEntry.unit ?? '',
                                })
                              : currentEntry))
                          }}
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--surface-input)] px-3 text-base font-black text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300"
                        />
                        <span className="text-sm font-bold text-slate-300">{entry.actualUnit}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {error && (
              <div role="alert" className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                <p>Gruppe konnte nicht gespeichert werden. Deine Auswahl bleibt erhalten.</p>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/15 px-3 text-sm font-black text-red-200 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <RotateCcw size={15} aria-hidden="true" /> Erneut versuchen
                </button>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => void save()}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-sm font-black text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={16} aria-hidden="true" /> {saving ? 'Speichert …' : 'Alles eingenommen'}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
