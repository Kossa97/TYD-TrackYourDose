import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Star, Pencil, Search, Smile, Meh, Frown, Globe, type LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { getDateLocale } from '../i18n/dateLocales'
import type { CycleTimeline } from '../lib/planTimeline'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import type { Translate } from '../features/my-stack/lib/planLabels'
import { useMinuteClock } from '../features/my-stack/lib/useMinuteClock'
import { ReviewSheet, type ReviewSubstanz } from '../features/reviews/components/ReviewSheet'
import {
  entwurfAus,
  leererEntwurf,
  vorgeschlagenerZyklus,
  zyklusKurz,
  zyklusZumDatum,
  type Review,
  type ReviewDraft,
} from '../features/reviews/lib/reviewModel'
import { ladeBewertungen, loescheBewertung, speichereBewertung } from '../features/reviews/services/reviews'

type ExperienceCfg = { icon: LucideIcon }
const EXPERIENCE_CONFIG: { gut: ExperienceCfg; mittel: ExperienceCfg; schlecht: ExperienceCfg } = {
  gut:     { icon: Smile },
  mittel:  { icon: Meh },
  schlecht:{ icon: Frown },
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
        className={onChange ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
        style={{ transition: 'transform 0.15s ease' }}>
        <Star
          size={20}
          style={i <= value ? {
            color: '#f5a800',
            fill: '#f5a800',
            filter: 'drop-shadow(0 0 5px rgba(245,168,0,0.65)) drop-shadow(0 0 2px rgba(255,200,0,0.4))',
          } : {
            color: 'var(--border)',
            fill: 'transparent',
          }}
        />
      </button>
    ))}
  </div>
)

export function Bewertungen() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const locale = getDateLocale()
  const [reviews, setReviews]   = useState<Review[]>([])
  const [stackItems, setStackItems] = useState<ReviewSubstanz[]>([])
  const [timelines, setTimelines] = useState<CycleTimeline[]>([])
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState<'date_new' | 'date_old' | 'rating_high' | 'rating_low'>('date_new')
  // Offenes Sheet: neu (id null) oder eine bestehende Bewertung.
  const [sheet, setSheet] = useState<{ id: string | null; start: ReviewDraft } | null>(null)
  const [saving, setSaving] = useState(false)
  const now = useMinuteClock()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language

  const load = async () => {
    try {
      setReviews(await ladeBewertungen(supabase, user!.id))
    } catch {
      toast.error(t('review_load_error'))
    }
  }

  const loadKontext = async () => {
    const [items, zyklen] = await Promise.allSettled([
      supabase.from('stack_items').select('id, display_name, archived').eq('user_id', user!.id).order('display_name'),
      loadCycleTimelines(supabase as never, user!.id, { includeUnavailable: true }),
    ])
    if (items.status === 'fulfilled' && items.value.data) setStackItems(items.value.data as ReviewSubstanz[])
    if (zyklen.status === 'fulfilled') setTimelines(zyklen.value)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); void loadKontext() }, [])

  const zyklusVon = useMemo(() => new Map(timelines.map(timeline => [timeline.cycle.id, timeline])), [timelines])
  /** Zyklen mit Bewertung — ohne die gerade bearbeitete. */
  const bewertet = useMemo(() => new Set(
    reviews.filter(r => r.cycle_id && r.id !== sheet?.id).map(r => r.cycle_id!),
  ), [reviews, sheet?.id])

  const openNew = () => {
    const erste = stackItems.find(item => !item.archived)
    if (!erste) return toast.error(t('zuerst_peptid'))
    const belegt = new Set(reviews.filter(r => r.cycle_id).map(r => r.cycle_id!))
    setSheet({ id: null, start: leererEntwurf(erste.id, vorgeschlagenerZyklus(timelines, erste.id, belegt)) })
  }

  const openEdit = (r: Review) => {
    const start = entwurfAus(r)
    // Alte Bewertung ohne Zyklus: den passenden vorschlagen (nach Datum).
    if (!start.cycle_id) {
      const vorschlag = zyklusZumDatum(timelines, r.stack_item_id, r.created_at, timeZone)
      const belegt = reviews.some(other => other.id !== r.id && other.cycle_id === vorschlag)
      if (vorschlag && !belegt) start.cycle_id = vorschlag
    }
    setSheet({ id: r.id, start })
  }

  const save = async (draft: ReviewDraft) => {
    if (!sheet) return
    setSaving(true)
    try {
      await speichereBewertung(supabase, draft, user!.id, reviews.find(r => r.id === sheet.id) ?? null)
      toast.success(sheet.id ? t('bewertung_aktualisiert') : t('bewertung_gespeichert'))
      setSheet(null)
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(t('bewertung_loeschen'))) return
    try {
      await loescheBewertung(supabase, id)
      toast.success(t('deleted'))
      await load()
    } catch {
      toast.error(t('error'))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('bewertungen_title')}</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} /> {t('new')}
        </button>
      </div>

      {/* Suche + Sortierung */}
      {reviews.length > 0 && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input className="input pl-9 text-sm" placeholder={t('bewertung_suchen')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select text-sm shrink-0 w-auto pr-8" value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="date_new">{t('neueste')}</option>
            <option value="date_old">{t('aelteste')}</option>
            <option value="rating_high">{t('bewertung_ab')}</option>
            <option value="rating_low">{t('bewertung_auf')}</option>
          </select>
        </div>
      )}

      {reviews.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <Star size={32} className="mx-auto mb-2 opacity-40" />
          <p>{t('noch_keine_bewertungen')}</p>
        </div>
      )}

      {(() => {
        const displayed = reviews
          .filter(r => !search
            || (r.title ?? '').toLowerCase().includes(search.toLowerCase())
            || (r.stack_items?.display_name ?? '').toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => {
            if (sortBy === 'date_new')    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            if (sortBy === 'date_old')    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            if (sortBy === 'rating_high') return b.rating - a.rating
            if (sortBy === 'rating_low')  return a.rating - b.rating
            return 0
          })
        if (search && displayed.length === 0) return (
          <div className="card text-center py-8 text-slate-500 text-sm">
            {t('nichts_gefunden', { search })}
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
                  <p className="text-sky-400 text-sm font-medium">{r.stack_items?.display_name}</p>
                  {r.title && <p className="font-semibold text-white">{r.title}</p>}
                  <StarRating value={r.rating} />
                  {r.cycle_id && zyklusVon.get(r.cycle_id) && (
                    <p data-review-cycle className="mt-1 text-xs text-slate-400">
                      {zyklusKurz(zyklusVon.get(r.cycle_id)!, timeZone, language, t as Translate)}
                    </p>
                  )}
                  {(r.wirkung || r.vertraeglichkeit || r.wieder_nehmen) && (
                    <p data-review-criteria className="mt-1 text-xs text-slate-400">
                      {[
                        r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
                        r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
                        r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.is_public && <Globe size={14} className="text-slate-400" aria-label={String(t('review_public'))} />}
                  <span className={`badge ${EXPERIENCE_BADGE[r.experience ?? 'gut']}`}>
                    <exp.icon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> {t(r.experience ?? 'gut')}
                  </span>
                  <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                    aria-label={String(t('bewertung_bearbeiten'))}
                    onClick={() => openEdit(r)}>
                    <Pencil size={15} />
                  </button>
                  <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    aria-label={String(t('loeschen'))}
                    onClick={() => remove(r.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {r.body && <p className="text-slate-300 text-sm mb-2">{r.body}</p>}

              {(r.pros || r.cons) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {r.pros && (
                    <div style={{
                      background: 'rgba(0,180,100,0.05)',
                      border: '1px solid rgba(0,200,120,0.16)',
                      borderRadius: '10px',
                      padding: '8px',
                      boxShadow: 'inset 0 1px 0 rgba(0,200,120,0.06)',
                    }}>
                      <p style={{ color: '#00d488', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {t('vorteile')}
                      </p>
                      <p className="text-slate-300 text-xs">{r.pros}</p>
                    </div>
                  )}
                  {r.cons && (
                    <div style={{
                      background: 'rgba(200,0,60,0.05)',
                      border: '1px solid rgba(220,0,60,0.16)',
                      borderRadius: '10px',
                      padding: '8px',
                      boxShadow: 'inset 0 1px 0 rgba(220,0,60,0.06)',
                    }}>
                      <p style={{ color: '#ff4060', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                        {t('nachteile')}
                      </p>
                      <p className="text-slate-300 text-xs">{r.cons}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-slate-600 text-xs mt-2">
                {format(new Date(r.created_at), 'dd. MMMM yyyy', { locale })}
              </p>
            </div>
          )
        })}
      </div>
        )
      })()}

      {sheet && (
        <ReviewSheet
          key={sheet.id ?? 'neu'}
          titel={String(sheet.id ? t('bewertung_bearbeiten') : t('neue_bewertung'))}
          start={sheet.start}
          substanzen={stackItems}
          timelines={timelines}
          bewertet={bewertet}
          now={now}
          timeZone={timeZone}
          busy={saving}
          onClose={() => setSheet(null)}
          onSave={save}
        />
      )}
    </div>
  )
}
