// src/components/injection3d/InjectionLogSheet.tsx
import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { InjectionPinDraft, InjectionProximityWarning, SelectableInjectionCycle } from '../../lib/injectionLogTypes'

export function InjectionLogSheet({
  pin,
  cycles,
  warning,
  onCancel,
  onSave,
}: {
  pin: InjectionPinDraft
  cycles: SelectableInjectionCycle[]
  warning: InjectionProximityWarning
  onCancel: () => void
  onSave: (input: { cycle: SelectableInjectionCycle | null; dose: number | null; unit: string | null; method: string | null; notes: string | null }) => Promise<void>
}) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const selected = cycles.find(cycle => cycle.id === cycleId) ?? null
  const [dose, setDose] = useState(selected ? String(selected.dose) : '')
  const [unit, setUnit] = useState(selected?.unit ?? 'mcg')
  const [method, setMethod] = useState(selected?.method ?? 'Subkutan')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave({
      cycle: selected,
      dose: dose ? Number(dose) : null,
      unit,
      method,
      notes,
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

        {warning.level !== 'none' && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{warning.level === 'strong' ? 'Sehr nahe an einer kürzlichen Injektion.' : 'Nahe an einer Injektion der letzten 7 Tage.'}</p>
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="label">Aktiver Zyklus</span>
            <select className="input" value={cycleId} onChange={event => {
              const next = cycles.find(cycle => cycle.id === event.target.value) ?? null
              setCycleId(event.target.value)
              if (next) {
                setDose(String(next.dose))
                setUnit(next.unit)
                setMethod(next.method)
              }
            }}>
              <option value="">Substanz manuell erfassen</option>
              {cycles.map(cycle => (
                <option key={cycle.id} value={cycle.id}>{cycle.peptide_name} · {cycle.cycle_name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Dosis</span>
              <input className="input" value={dose} onChange={event => setDose(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              <span className="label">Einheit</span>
              <input className="input" value={unit} onChange={event => setUnit(event.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">Methode</span>
            <input className="input" value={method} onChange={event => setMethod(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Notiz optional</span>
            <textarea className="input min-h-20 resize-none" value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          <p className="text-xs text-slate-500">
            Stelle: {pin.body_side} · {pin.body_region}
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Abbrechen</button>
            <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || !dose || !unit || !method}>
              <Check size={14} /> Speichern
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
