import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Star, Pencil, Search } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Review {
  id: string
  peptide_id: string
  rating: number
  title: string
  body: string | null
  pros: string | null
  cons: string | null
  experience: 'gut' | 'mittel' | 'schlecht'
  created_at: string
  peptides: { name: string }
}

interface Peptide { id: string; name: string }

const EXPERIENCE_CONFIG = {
  gut:     { label: 'Gut',    emoji: '😊', color: 'bg-emerald-500 text-white', inactive: 'bg-slate-800 text-slate-400' },
  mittel:  { label: 'Mittel', emoji: '😐', color: 'bg-amber-500 text-white',   inactive: 'bg-slate-800 text-slate-400' },
  schlecht:{ label: 'Schlecht',emoji:'😞', color: 'bg-red-500 text-white',     inactive: 'bg-slate-800 text-slate-400' },
}

const EXPERIENCE_BADGE = {
  gut:     'bg-emerald-500/10 text-emerald-400',
  mittel:  'bg-amber-500/10 text-amber-400',
  schlecht:'bg-red-500/10 text-red-400',
}

const StarRating = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
  <div className="flex gap-1">
    {[1,2,3,4,5].map(i => (
      <button key={i} type="button" onClick={() => onChange?.(i)}
        className={onChange ? 'cursor-pointer' : 'cursor-default'}>
        <Star size={20} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
      </button>
    ))}
  </div>
)

interface Form {
  peptide_id: string; rating: number; title: string
  body: string; pros: string; cons: string
  experience: 'gut' | 'mittel' | 'schlecht'
}

const emptyForm = (firstPeptideId = ''): Form => ({
  peptide_id: firstPeptideId, rating: 4, title: '',
  body: '', pros: '', cons: '', experience: 'gut',
})

export function Bewertungen() {
  const { user } = useAuth()
  const [reviews, setReviews]   = useState<Review[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState<'date_new' | 'date_old' | 'rating_high' | 'rating_low'>('date_new')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase
      .from('reviews').select('*, peptides(name)')
      .eq('user_id', user!.id).order('created_at', { ascending: false })
    if (data) setReviews(data as Review[])
  }

  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('id, name')
      .eq('user_id', user!.id).order('name')
    if (data) setPeptides(data)
  }

  useEffect(() => { load(); loadPeptides() }, [])

  const openNew = () => {
    if (peptides.length === 0) return toast.error('Zuerst ein Peptid anlegen!')
    setEditingId(null)
    setForm(emptyForm(peptides[0].id))
    setShowForm(true)
  }

  const openEdit = (r: Review) => {
    setEditingId(r.id)
    setForm({
      peptide_id: r.peptide_id, rating: r.rating, title: r.title,
      body: r.body ?? '', pros: r.pros ?? '', cons: r.cons ?? '',
      experience: r.experience ?? 'gut',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) return toast.error('Titel erforderlich')
    setSaving(true)
    const payload = {
      user_id: user!.id,
      peptide_id: form.peptide_id,
      rating: form.rating,
      title: form.title,
      body: form.body || null,
      pros: form.pros || null,
      cons: form.cons || null,
      experience: form.experience,
    }
    const { error } = editingId
      ? await supabase.from('reviews').update(payload).eq('id', editingId)
      : await supabase.from('reviews').insert(payload)
    if (error) toast.error('Fehler')
    else { toast.success(editingId ? 'Bewertung aktualisiert' : 'Bewertung gespeichert'); setShowForm(false); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Bewertung löschen?')) return
    await supabase.from('reviews').delete().eq('id', id)
    toast.success('Gelöscht'); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Bewertungen</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} /> Neu
        </button>
      </div>

      {/* Suche + Sortierung */}
      {reviews.length > 0 && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input className="input pl-9 text-sm" placeholder="Bewertung suchen..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select text-sm shrink-0 w-auto pr-8" value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="date_new">Neueste</option>
            <option value="date_old">Älteste</option>
            <option value="rating_high">Bewertung ↓</option>
            <option value="rating_low">Bewertung ↑</option>
          </select>
        </div>
      )}

      {reviews.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <Star size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Bewertungen</p>
        </div>
      )}

      {(() => {
        const displayed = reviews
          .filter(r => !search
            || r.title.toLowerCase().includes(search.toLowerCase())
            || (r.peptides?.name ?? '').toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => {
            if (sortBy === 'date_new')    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            if (sortBy === 'date_old')    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            if (sortBy === 'rating_high') return b.rating - a.rating
            if (sortBy === 'rating_low')  return a.rating - b.rating
            return 0
          })
        if (search && displayed.length === 0) return (
          <div className="card text-center py-8 text-slate-500 text-sm">
            Nichts gefunden für „{search}"
          </div>
        )
        return (
      <div className="space-y-4">
        {displayed.map(r => {
          const exp = EXPERIENCE_CONFIG[r.experience ?? 'gut']
          return (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sky-400 text-sm font-medium">{r.peptides?.name}</p>
                  <p className="font-semibold text-white">{r.title}</p>
                  <StarRating value={r.rating} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge ${EXPERIENCE_BADGE[r.experience ?? 'gut']}`}>
                    {exp.emoji} {exp.label}
                  </span>
                  <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                    onClick={() => openEdit(r)}>
                    <Pencil size={15} />
                  </button>
                  <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    onClick={() => remove(r.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {r.body && <p className="text-slate-300 text-sm mb-2">{r.body}</p>}

              {(r.pros || r.cons) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {r.pros && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                      <p className="text-emerald-400 text-xs font-medium mb-1">Vorteile</p>
                      <p className="text-slate-300 text-xs">{r.pros}</p>
                    </div>
                  )}
                  {r.cons && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                      <p className="text-red-400 text-xs font-medium mb-1">Nachteile</p>
                      <p className="text-slate-300 text-xs">{r.cons}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-slate-600 text-xs mt-2">
                {format(new Date(r.created_at), 'dd. MMMM yyyy', { locale: de })}
              </p>
            </div>
          )
        })}
      </div>
        )
      })()}

      {/* ══ FORMULAR ══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4
            overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>

            <h2 className="text-lg font-bold">
              {editingId ? 'Bewertung bearbeiten' : 'Neue Bewertung'}
            </h2>

            <div>
              <label className="label">Peptid</label>
              <select className="select" value={form.peptide_id}
                onChange={e => setForm(f => ({ ...f, peptide_id: e.target.value }))}>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Sterne-Bewertung</label>
              <StarRating value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
            </div>

            {/* Erfahrung */}
            <div>
              <label className="label">Wie war deine Erfahrung?</label>
              <div className="flex gap-2">
                {(Object.entries(EXPERIENCE_CONFIG) as [keyof typeof EXPERIENCE_CONFIG, typeof EXPERIENCE_CONFIG[keyof typeof EXPERIENCE_CONFIG]][]).map(([key, cfg]) => (
                  <button key={key}
                    onClick={() => setForm(f => ({ ...f, experience: key }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex flex-col items-center gap-1 ${
                      form.experience === key ? cfg.color : cfg.inactive
                    }`}>
                    <span className="text-xl">{cfg.emoji}</span>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Titel *</label>
              <input className="input" placeholder="Kurze Zusammenfassung..."
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <label className="label">Erfahrungsbericht (optional)</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Detaillierte Erfahrungen..." value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Vorteile</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Was hat gut funktioniert?" value={form.pros}
                  onChange={e => setForm(f => ({ ...f, pros: e.target.value }))} />
              </div>
              <div>
                <label className="label">Nachteile</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Was war negativ?" value={form.cons}
                  onChange={e => setForm(f => ({ ...f, cons: e.target.value }))} />
              </div>
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
