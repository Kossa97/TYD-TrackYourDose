import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Package } from 'lucide-react'
import { format } from 'date-fns'

interface Vial {
  id: string
  peptide_id: string
  total_amount: number
  unit: string
  remaining_amount: number
  batch_label: string | null
  reconstituted_at: string | null
  notes: string | null
  peptides: { name: string }
}

interface Peptide { id: string; name: string; default_unit: string }
const UNITS = ['mcg', 'mg', 'IU', 'ml', 'nmol']

export function Inventar() {
  const { user } = useAuth()
  const [vials, setVials] = useState<Vial[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ peptide_id: '', total_amount: '', unit: 'mg', batch_label: '', reconstituted_at: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('vials').select('*, peptides(name)').eq('user_id', user!.id).order('created_at', { ascending: false })
    if (data) setVials(data as Vial[])
  }

  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('id, name, default_unit').eq('user_id', user!.id).order('name')
    if (data) { setPeptides(data); if (data[0]) setForm(f => ({ ...f, peptide_id: data[0].id, unit: data[0].default_unit })) }
  }

  useEffect(() => { load(); loadPeptides() }, [])

  const save = async () => {
    if (!form.peptide_id || !form.total_amount) return toast.error('Peptid und Menge erforderlich')
    setSaving(true)
    const total = parseFloat(form.total_amount)
    const { error } = await supabase.from('vials').insert({
      user_id: user!.id,
      peptide_id: form.peptide_id,
      total_amount: total,
      remaining_amount: total,
      unit: form.unit,
      batch_label: form.batch_label || null,
      reconstituted_at: form.reconstituted_at ? new Date(form.reconstituted_at).toISOString() : null,
      notes: form.notes || null,
    })
    if (error) toast.error('Fehler')
    else { toast.success('Vial hinzugefügt'); setShowForm(false); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Vial löschen?')) return
    await supabase.from('vials').delete().eq('id', id)
    toast.success('Gelöscht'); load()
  }

  const pct = (v: Vial) => Math.round((v.remaining_amount / v.total_amount) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Inventar</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => { if (peptides.length === 0) return toast.error('Zuerst ein Peptid anlegen!'); setShowForm(true) }}>
          <Plus size={16} /> Vial
        </button>
      </div>

      {vials.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <Package size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Vials im Inventar</p>
        </div>
      )}

      <div className="space-y-3">
        {vials.map(v => {
          const p = pct(v)
          const color = p > 50 ? 'bg-emerald-500' : p > 20 ? 'bg-amber-500' : 'bg-red-500'
          return (
            <div key={v.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{v.peptides?.name}</p>
                  {v.batch_label && <p className="text-slate-500 text-xs">{v.batch_label}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-300">{v.remaining_amount}/{v.total_amount} {v.unit}</span>
                  <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" onClick={() => remove(v.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${p}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-500 text-xs">{p}% verbleibend</span>
                {v.reconstituted_at && <span className="text-slate-500 text-xs">Rekonstitution: {format(new Date(v.reconstituted_at), 'dd.MM.yyyy')}</span>}
              </div>
              {v.notes && <p className="text-slate-500 text-xs mt-2">{v.notes}</p>}
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Neues Vial</h2>

            <div>
              <label className="label">Peptid</label>
              <select className="select" value={form.peptide_id} onChange={e => {
                const p = peptides.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, peptide_id: e.target.value, unit: p?.default_unit ?? 'mg' }))
              }}>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Gesamtmenge</label>
                <input className="input" type="number" placeholder="z.B. 5" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Einheit</label>
                <select className="select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Chargenbezeichnung (optional)</label>
              <input className="input" placeholder="z.B. Batch #001" value={form.batch_label} onChange={e => setForm(f => ({ ...f, batch_label: e.target.value }))} />
            </div>

            <div>
              <label className="label">Rekonstitutionsdatum (optional)</label>
              <input className="input" type="date" value={form.reconstituted_at} onChange={e => setForm(f => ({ ...f, reconstituted_at: e.target.value }))} />
            </div>

            <div>
              <label className="label">Notizen (optional)</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>{saving ? 'Speichert...' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
