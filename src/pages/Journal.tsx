import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, BookHeart, Zap, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Effect {
  id: string
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  occurred_at: string
  notes: string | null
  peptide_id: string | null
  peptides: { name: string } | null
}

interface Peptide { id: string; name: string }

const SEVERITY_LABELS: Record<number, string> = { 1: 'Sehr leicht', 2: 'Leicht', 3: 'Mittel', 4: 'Stark', 5: 'Sehr stark' }
const SEVERITY_COLORS: Record<number, string> = { 1: 'text-emerald-400', 2: 'text-lime-400', 3: 'text-amber-400', 4: 'text-orange-400', 5: 'text-red-400' }

export function Journal() {
  const { user } = useAuth()
  const [effects, setEffects] = useState<Effect[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [filter, setFilter] = useState<'all' | 'effect' | 'side_effect'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'effect' as 'effect' | 'side_effect', description: '', severity: 3, occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"), peptide_id: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('effects')
      .select('*, peptides(name)')
      .eq('user_id', user!.id)
      .order('occurred_at', { ascending: false })
    if (data) setEffects(data as Effect[])
  }

  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('id, name').eq('user_id', user!.id).order('name')
    if (data) setPeptides(data)
  }

  useEffect(() => { load(); loadPeptides() }, [])

  const save = async () => {
    if (!form.description.trim()) return toast.error('Beschreibung erforderlich')
    setSaving(true)
    const { error } = await supabase.from('effects').insert({
      user_id: user!.id,
      type: form.type,
      description: form.description,
      severity: form.severity,
      occurred_at: new Date(form.occurred_at).toISOString(),
      peptide_id: form.peptide_id || null,
      notes: form.notes || null,
    })
    if (error) toast.error('Fehler')
    else { toast.success('Eintrag gespeichert'); setShowForm(false); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Eintrag löschen?')) return
    await supabase.from('effects').delete().eq('id', id)
    toast.success('Gelöscht'); load()
  }

  const filtered = filter === 'all' ? effects : effects.filter(e => e.type === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Journal</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Neu
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4 gap-1">
        {[['all', 'Alle'], ['effect', 'Wirkungen'], ['side_effect', 'Nebenwirkungen']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val as typeof filter)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? 'bg-sky-500 text-white' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <BookHeart size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Einträge</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(e => (
          <div key={e.id} className={`card border ${e.type === 'effect' ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {e.type === 'effect'
                    ? <Zap size={14} className="text-emerald-400 shrink-0" />
                    : <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  }
                  <span className={`text-xs font-medium ${e.type === 'effect' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {e.type === 'effect' ? 'Wirkung' : 'Nebenwirkung'}
                  </span>
                  <span className={`text-xs font-medium ml-auto ${SEVERITY_COLORS[e.severity]}`}>
                    {SEVERITY_LABELS[e.severity]}
                  </span>
                </div>
                <p className="text-white font-medium">{e.description}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-slate-500 text-xs">
                  <span>{format(new Date(e.occurred_at), 'dd.MM.yyyy HH:mm', { locale: de })}</span>
                  {e.peptides && <span className="text-sky-400">{e.peptides.name}</span>}
                </div>
                {e.notes && <p className="text-slate-500 text-xs mt-1">{e.notes}</p>}
              </div>
              <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0" onClick={() => remove(e.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Neuer Journal-Eintrag</h2>

            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${form.type === 'effect' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                onClick={() => setForm(f => ({ ...f, type: 'effect' }))}>
                Wirkung
              </button>
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${form.type === 'side_effect' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                onClick={() => setForm(f => ({ ...f, type: 'side_effect' }))}>
                Nebenwirkung
              </button>
            </div>

            <div>
              <label className="label">Beschreibung *</label>
              <input className="input" placeholder="z.B. Besserer Schlaf, Schmerzen an Injektionsstelle..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div>
              <label className="label">Intensität: {SEVERITY_LABELS[form.severity]}</label>
              <input type="range" min={1} max={5} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: parseInt(e.target.value) }))}
                className="w-full accent-sky-500" />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Sehr leicht</span><span>Sehr stark</span>
              </div>
            </div>

            <div>
              <label className="label">Peptid (optional)</label>
              <select className="select" value={form.peptide_id} onChange={e => setForm(f => ({ ...f, peptide_id: e.target.value }))}>
                <option value="">— Kein Peptid —</option>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Zeitpunkt</label>
              <input className="input" type="datetime-local" value={form.occurred_at} onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} />
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
