import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, RotateCcw, CheckCircle2, Circle, Pencil } from 'lucide-react'
import { format } from 'date-fns'

interface Cycle {
  id: string
  name: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  frequency: string
  x_days_interval: number | null
  start_date: string
  end_date: string | null
  notes: string | null
  active: boolean
  peptides: { name: string }
}

interface Peptide { id: string; name: string; default_unit: string; default_dose: number | null; default_method: string }

const UNITS = ['mcg', 'mg', 'IU', 'ml', 'nmol']
const METHODS = ['Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere']
const BASE_FREQUENCIES = ['Täglich', '2x täglich', 'Jeden 2. Tag', '5 Tage an / 2 aus', 'Mo-Fr', 'Wöchentlich', 'Alle X Tage']

interface Form {
  name: string
  peptide_id: string
  dose: string
  unit: string
  method: string
  frequency: string
  x_days_interval: string
  start_date: string
  end_date: string
  notes: string
}

const emptyForm = (peptides: Peptide[]): Form => {
  const p = peptides[0]
  return {
    name: '', peptide_id: p?.id ?? '', dose: p?.default_dose?.toString() ?? '',
    unit: p?.default_unit ?? 'mcg', method: p?.default_method ?? 'Subkutan',
    frequency: 'Täglich', x_days_interval: '3',
    start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', notes: '',
  }
}

export function Zyklen() {
  const { user } = useAuth()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm([]))
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('cycles')
      .select('*, peptides(name)')
      .eq('user_id', user!.id)
      .order('active', { ascending: false })
      .order('start_date', { ascending: false })
    if (data) setCycles(data as Cycle[])
  }

  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user!.id).order('name')
    if (data) setPeptides(data)
  }

  useEffect(() => { load(); loadPeptides() }, [])

  const openNew = () => {
    if (peptides.length === 0) return toast.error('Zuerst ein Peptid anlegen!')
    setEditingId(null)
    setForm(emptyForm(peptides))
    setShowForm(true)
  }

  const openEdit = (c: Cycle) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      peptide_id: c.peptide_id,
      dose: c.dose.toString(),
      unit: c.unit,
      method: c.method,
      frequency: c.frequency,
      x_days_interval: c.x_days_interval?.toString() ?? '3',
      start_date: c.start_date,
      end_date: c.end_date ?? '',
      notes: c.notes ?? '',
    })
    setShowForm(true)
  }

  const onPeptideChange = (id: string) => {
    const p = peptides.find(x => x.id === id)
    if (p) setForm(f => ({ ...f, peptide_id: id, dose: p.default_dose?.toString() ?? '', unit: p.default_unit, method: p.default_method }))
  }

  const save = async () => {
    if (!form.name || !form.dose) return toast.error('Name und Dosis erforderlich')
    setSaving(true)

    const payload = {
      user_id: user!.id,
      name: form.name,
      peptide_id: form.peptide_id,
      dose: parseFloat(form.dose),
      unit: form.unit,
      method: form.method,
      frequency: form.frequency,
      x_days_interval: form.frequency === 'Alle X Tage' ? parseInt(form.x_days_interval) : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      notes: form.notes || null,
      active: true,
    }

    if (editingId) {
      const { error } = await supabase.from('cycles').update(payload).eq('id', editingId)
      if (error) toast.error('Fehler')
      else toast.success('Zyklus aktualisiert')
    } else {
      const { error } = await supabase.from('cycles').insert(payload)
      if (error) toast.error('Fehler')
      else toast.success('Zyklus erstellt')
    }

    setSaving(false); setShowForm(false); load()
  }

  const toggleActive = async (c: Cycle) => {
    await supabase.from('cycles').update({ active: !c.active }).eq('id', c.id)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Zyklus löschen?')) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success('Gelöscht'); load()
  }

  const freqLabel = (c: Cycle) =>
    c.frequency === 'Alle X Tage' && c.x_days_interval
      ? `Alle ${c.x_days_interval} Tage`
      : c.frequency

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Zyklen & Pläne</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} /> Neu
        </button>
      </div>

      {cycles.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <RotateCcw size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Zyklen angelegt</p>
        </div>
      )}

      <div className="space-y-3">
        {cycles.map(c => (
          <div key={c.id} className={`card border ${c.active ? 'border-sky-500/30' : 'border-slate-800'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-white truncate">{c.name}</p>
                  <span className={`badge ${c.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {c.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <p className="text-sky-400 text-sm font-medium">{c.peptides?.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-slate-400 text-xs">
                  <span>{c.dose} {c.unit} · {c.method}</span>
                  <span>{freqLabel(c)}</span>
                  <span>Start: {format(new Date(c.start_date), 'dd.MM.yyyy')}</span>
                  {c.end_date && <span>Ende: {format(new Date(c.end_date), 'dd.MM.yyyy')}</span>}
                </div>
                {c.notes && <p className="text-slate-500 text-xs mt-1">{c.notes}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors" onClick={() => openEdit(c)}>
                  <Pencil size={15} />
                </button>
                <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors" onClick={() => toggleActive(c)}>
                  {c.active ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Circle size={18} />}
                </button>
                <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" onClick={() => remove(c.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editingId ? 'Zyklus bearbeiten' : 'Neuer Zyklus'}</h2>

            <div>
              <label className="label">Name des Zyklus</label>
              <input className="input" placeholder="z.B. BPC-157 Heilungsprotokoll" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div>
              <label className="label">Peptid</label>
              <select className="select" value={form.peptide_id} onChange={e => onPeptideChange(e.target.value)}>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Dosis</label>
                <input className="input" type="number" value={form.dose}
                  onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
              </div>
              <div>
                <label className="label">Einheit</label>
                <select className="select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Applikationsart</label>
              <select className="select" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Frequenz</label>
              <select className="select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {BASE_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
              </select>
            </div>

            {form.frequency === 'Alle X Tage' && (
              <div>
                <label className="label">Alle wie viele Tage?</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">Alle</span>
                  <input className="input w-24" type="number" min="2" max="30" value={form.x_days_interval}
                    onChange={e => setForm(f => ({ ...f, x_days_interval: e.target.value }))} />
                  <span className="text-slate-400 text-sm">Tage</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Startdatum</label>
                <input className="input" type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Enddatum (optional)</label>
                <input className="input" type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="label">Notizen (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
