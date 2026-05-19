import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, BookHeart, Zap, AlertTriangle, Clock, Search } from 'lucide-react'
import { format } from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { useTranslation } from 'react-i18next'

const DATE_LOCALES: Record<string, Locale> = {
  de, en: enUS, es, fr, it, pt, ru, tr, ar, hi, id, zh: zhCN, ja, ko,
}

interface Effect {
  id: string
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  duration: string | null
  occurred_at: string
  notes: string | null
  peptide_id: string | null
  peptides: { name: string } | null
}

interface Peptide { id: string; name: string }

const SEVERITY_COLORS: Record<number, string> = {
  1: 'text-emerald-400', 2: 'text-lime-400', 3: 'text-amber-400',
  4: 'text-orange-400', 5: 'text-red-400',
}

const DURATION_KEYS = [
  'min_15', 'min_30', 'std_1', 'std_2', 'std_4', 'std_8', 'std_12',
  'tag_1', 'tage_2', 'woche_1', 'noch_anhaltend',
]

// Rück-Mapping: ältere DB-Werte auf deutschen Strings → Übersetzungs-Keys
const DURATION_DE_TO_KEY: Record<string, string> = {
  '15 Min': 'min_15', '30 Min': 'min_30',
  '1 Std': 'std_1', '2 Std': 'std_2', '4 Std': 'std_4',
  '8 Std': 'std_8', '12 Std': 'std_12',
  '1 Tag': 'tag_1', '2 Tage': 'tage_2', '1 Woche': 'woche_1',
  'Noch anhaltend': 'noch_anhaltend', 'Individuell': 'individuell',
  // English variants (stored if app was in EN)
  '15 min': 'min_15', '30 min': 'min_30',
  '1 hr': 'std_1', '2 hrs': 'std_2', '4 hrs': 'std_4',
  '8 hrs': 'std_8', '12 hrs': 'std_12',
  '1 day': 'tag_1', '2 days': 'tage_2', '1 week': 'woche_1',
  'Still ongoing': 'noch_anhaltend', 'Custom': 'individuell',
}

export function Tagebuch() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = DATE_LOCALES[i18n.language] ?? enUS

  const severityLabel = (n: number) =>
    [t('sehr_leicht'), t('leicht'), t('mittel'), t('stark'), t('sehr_stark')][n - 1]
  const [effects, setEffects]   = useState<Effect[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [filter, setFilter]     = useState<'all' | 'effect' | 'side_effect'>('all')
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState<'date_new' | 'date_old' | 'sev_high' | 'sev_low'>('date_new')
  const [showForm, setShowForm] = useState(false)
  const [customDuration, setCustomDuration] = useState(false)
  const [form, setForm] = useState({
    type: 'effect' as 'effect' | 'side_effect',
    description: '',
    severity: 3,
    duration: '',
    occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    peptide_id: '',
    notes: '',
  })
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

  const resetForm = () => {
    setForm({
      type: 'effect', description: '', severity: 3,
      duration: '', occurred_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      peptide_id: '', notes: '',
    })
    setCustomDuration(false)
  }

  const save = async () => {
    if (!form.description.trim()) return toast.error(t('beschreibung_erforderlich'))
    setSaving(true)
    const { error } = await supabase.from('effects').insert({
      user_id:     user!.id,
      type:        form.type,
      description: form.description,
      severity:    form.severity,
      status:      'eingetreten',
      duration:    form.duration || null,
      occurred_at: new Date(form.occurred_at).toISOString(),
      peptide_id:  form.peptide_id || null,
      notes:       form.notes || null,
    })
    if (error) toast.error(t('fehler_speichern'))
    else { toast.success(t('eintrag_gespeichert')); setShowForm(false); resetForm(); load() }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm(t('eintrag_loeschen'))) return
    await supabase.from('effects').delete().eq('id', id)
    toast.success(t('deleted')); load()
  }

  const filtered = effects
    .filter(e => filter === 'all' || e.type === filter)
    .filter(e => !search || e.description.toLowerCase().includes(search.toLowerCase())
      || (e.peptides?.name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date_new') return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      if (sortBy === 'date_old') return new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      if (sortBy === 'sev_high') return b.severity - a.severity
      if (sortBy === 'sev_low')  return a.severity - b.severity
      return 0
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('tagebuch_title')}</h1>
        <button className="btn-primary flex items-center gap-2"
          onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} /> {t('new')}
        </button>
      </div>

      {/* Filter */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4 gap-1">
        {([['all', t('alle')], ['effect', t('wirkungen')], ['side_effect', t('nebenwirkungen')]] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val as typeof filter)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === val ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Suche + Sortierung */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-9 text-sm" placeholder={t('suchen_placeholder')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select text-sm shrink-0 w-auto pr-8" value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}>
          <option value="date_new">{t('neueste')}</option>
          <option value="date_old">{t('aelteste')}</option>
          <option value="sev_high">{t('intensitaet_ab')}</option>
          <option value="sev_low">{t('intensitaet_auf')}</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <BookHeart size={32} className="mx-auto mb-2 opacity-40" />
          <p>{search ? t('nichts_gefunden', { search }) : t('noch_keine_eintraege')}</p>
        </div>
      )}

      {/* ── Eintrags-Liste ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map(e => (
          <div key={e.id} className={`card border ${
            e.type === 'effect' ? 'border-emerald-500/20' : 'border-amber-500/20'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Typ + Intensität */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {e.type === 'effect'
                    ? <Zap size={13} className="text-emerald-400 shrink-0" />
                    : <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                  <span className={`text-xs font-medium ${e.type === 'effect' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {e.type === 'effect' ? t('wirkung') : t('nebenwirkung')}
                  </span>
                  <span className={`text-xs font-medium ml-auto ${SEVERITY_COLORS[e.severity]}`}>
                    {severityLabel(e.severity)}
                  </span>
                </div>

                <p className="text-white font-medium">{e.description}</p>

                {/* Meta */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-slate-500 text-xs">
                  <span>{format(new Date(e.occurred_at), 'dd.MM.yyyy HH:mm', { locale })}</span>
                  {e.peptides && <span className="text-sky-400">{e.peptides.name}</span>}
                  {e.duration && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {DURATION_DE_TO_KEY[e.duration] ? t(DURATION_DE_TO_KEY[e.duration]) : e.duration}
                    </span>
                  )}
                </div>

                {e.notes && <p className="text-slate-500 text-xs mt-1">{e.notes}</p>}
              </div>

              <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                onClick={() => remove(e.id)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ══ FORMULAR ══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4
            overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{t('neuer_tagebuch_eintrag')}</h2>

            {/* 1. Wirkung / Nebenwirkung */}
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  form.type === 'effect' ? 'bg-emerald-500 text-white' : 'text-slate-400'
                }`}
                onClick={() => setForm(f => ({ ...f, type: 'effect' }))}>
                {t('wirkung')}
              </button>
              <button
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  form.type === 'side_effect' ? 'bg-amber-500 text-white' : 'text-slate-400'
                }`}
                onClick={() => setForm(f => ({ ...f, type: 'side_effect' }))}>
                {t('nebenwirkung')}
              </button>
            </div>

            {/* 2. Beschreibung */}
            <div>
              <label className="label">{t('beschreibung_required')}</label>
              <input className="input"
                placeholder={t('beschreibung_placeholder')}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* 3. Peptid */}
            <div>
              <label className="label">{t('peptid_optional')}</label>
              <select className="select" value={form.peptide_id}
                onChange={e => setForm(f => ({ ...f, peptide_id: e.target.value }))}>
                <option value="">{t('kein_peptid')}</option>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* 4. Intensität */}
            <div>
              <label className="label">{t('intensitaet_label', { value: severityLabel(form.severity) })}</label>
              <input type="range" min={1} max={5} value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: parseInt(e.target.value) }))}
                className="w-full accent-sky-500" />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>{t('sehr_leicht')}</span><span>{t('sehr_stark')}</span>
              </div>
            </div>

            {/* 5. Zeitpunkt */}
            <div>
              <label className="label">{t('zeitpunkt')}</label>
              <input className="input" type="datetime-local" value={form.occurred_at}
                onChange={e => setForm(f => ({ ...f, occurred_at: e.target.value }))} />
            </div>

            {/* 6. Dauer */}
            <div>
              <label className="label">{t('dauer')}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {DURATION_KEYS.map(key => (
                  <button key={key}
                    onClick={() => { setForm(f => ({ ...f, duration: t(key) })); setCustomDuration(false) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.duration === t(key) && !customDuration
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {t(key)}
                  </button>
                ))}
                <button
                  onClick={() => { setCustomDuration(true); setForm(f => ({ ...f, duration: '' })) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    customDuration ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}>
                  {t('individuell')}
                </button>
              </div>
              {customDuration && (
                <input className="input" placeholder={t('dauer_placeholder')}
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
              )}
            </div>

            {/* 7. Notizen */}
            <div>
              <label className="label">{t('notizen_optional')}</label>
              <textarea className="input resize-none" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
