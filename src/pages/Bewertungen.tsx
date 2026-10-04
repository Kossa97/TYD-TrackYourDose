import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { Globe, Pencil, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { CycleTimeline } from '../lib/planTimeline'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import type { Translate } from '../features/my-stack/lib/planLabels'
import { useMinuteClock } from '../features/my-stack/lib/useMinuteClock'
import { useWischZeile } from '../features/my-stack/page/useWischZeile'
import { ReviewSheet, type ReviewSubstanz } from '../features/reviews/components/ReviewSheet'
import { ReviewDeleteSheet } from '../features/reviews/components/ReviewDeleteSheet'
import {
  entwurfAus,
  gruppiereBewertungen,
  leererEntwurf,
  passtZurSuche,
  vorgeschlagenerZyklus,
  zyklusKurz,
  zyklusZumDatum,
  type Reihenfolge,
  type Review,
  type ReviewDraft,
} from '../features/reviews/lib/reviewModel'
import { ladeBewertungen, loescheBewertung, speichereBewertung } from '../features/reviews/services/reviews'

/**
 * Bewertungen: je Substanz eine Gruppe, darin je Zyklus eine Karte — so
 * stehen mehrere Zyklen derselben Substanz nebeneinander. Antippen
 * bearbeitet, nach links wischen zeigt Bearbeiten und Loeschen (wie in My
 * Stack); Loeschen fragt in einem eigenen Sheet nach.
 */
export function Bewertungen() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const now = useMinuteClock()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const [reviews, setReviews] = useState<Review[]>([])
  const [ladeZustand, setLadeZustand] = useState<'laedt' | 'fertig' | 'fehler'>('laedt')
  const [stackItems, setStackItems] = useState<ReviewSubstanz[]>([])
  const [timelines, setTimelines] = useState<CycleTimeline[]>([])
  const [suche, setSuche] = useState('')
  const [reihenfolge, setReihenfolge] = useState<Reihenfolge>('neueste')
  // Offenes Sheet: neu (id null) oder eine bestehende Bewertung.
  const [sheet, setSheet] = useState<{ id: string | null; start: ReviewDraft } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loeschen, setLoeschen] = useState<Review | null>(null)
  const [loescht, setLoescht] = useState(false)
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null)

  const load = async () => {
    try {
      setReviews(await ladeBewertungen(supabase, user!.id))
      setLadeZustand('fertig')
    } catch {
      setLadeZustand('fehler')
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

  // Ein Tipp ausserhalb der offenen Zeile schliesst sie wieder.
  useEffect(() => {
    if (!offeneZeile) return
    const schliessen = (event: PointerEvent) => {
      const ziel = event.target as Element | null
      if (ziel?.closest?.(`[data-review-row="${CSS.escape(offeneZeile)}"]`)) return
      setOffeneZeile(null)
    }
    document.addEventListener('pointerdown', schliessen)
    return () => document.removeEventListener('pointerdown', schliessen)
  }, [offeneZeile])

  const zyklusVon = useMemo(() => new Map(timelines.map(timeline => [timeline.cycle.id, timeline])), [timelines])
  /** Zyklen mit Bewertung — ohne die gerade bearbeitete. */
  const bewertet = useMemo(() => new Set(
    reviews.filter(r => r.cycle_id && r.id !== sheet?.id).map(r => r.cycle_id!),
  ), [reviews, sheet?.id])
  const gruppen = useMemo(
    () => gruppiereBewertungen(reviews.filter(r => passtZurSuche(r, suche)), timelines, reihenfolge),
    [reviews, suche, timelines, reihenfolge],
  )

  const openNew = () => {
    const erste = stackItems.find(item => !item.archived)
    if (!erste) return toast.error(t('zuerst_peptid'))
    const belegt = new Set(reviews.filter(r => r.cycle_id).map(r => r.cycle_id!))
    setSheet({ id: null, start: leererEntwurf(erste.id, vorgeschlagenerZyklus(timelines, erste.id, belegt)) })
  }

  const openEdit = (r: Review) => {
    setOffeneZeile(null)
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

  const remove = async (r: Review) => {
    setLoescht(true)
    try {
      await loescheBewertung(supabase, r.id)
      toast.success(t('deleted'))
      setLoeschen(null)
      await load()
    } catch {
      toast.error(t('error'))
    } finally {
      setLoescht(false)
    }
  }

  const zyklusText = (r: Review) => {
    const timeline = r.cycle_id ? zyklusVon.get(r.cycle_id) : undefined
    return timeline ? zyklusKurz(timeline, timeZone, language, tr) : String(t('review_cycle_none'))
  }

  return (
    <div className="pb-14">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('bewertungen_title')}</h1>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} aria-hidden="true" /> {t('new')}
        </button>
      </div>

      {ladeZustand === 'fehler' && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-300">{t('review_load_error')}</p>
          <button type="button" onClick={() => { setLadeZustand('laedt'); void load() }} className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-red-200">
            <RefreshCw size={14} aria-hidden="true" /> {t('review_retry')}
          </button>
        </div>
      )}

      {/* Erst ab vier Bewertungen — aber nie verschwinden, solange eine Suche
          filtert: sonst bliebe der Filter unsichtbar aktiv. */}
      {(reviews.length > 3 || suche !== '') && (
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9 text-sm"
              aria-label={String(t('bewertung_suchen'))}
              placeholder={String(t('bewertung_suchen'))}
              value={suche}
              onChange={e => setSuche(e.target.value)}
            />
          </div>
          <select
            className="select w-auto shrink-0 pr-8 text-sm"
            aria-label={String(t('review_order'))}
            value={reihenfolge}
            onChange={e => setReihenfolge(e.target.value as Reihenfolge)}
          >
            <option value="neueste">{t('neueste')}</option>
            <option value="beste">{t('review_order_best')}</option>
          </select>
        </div>
      )}

      {ladeZustand === 'fertig' && reviews.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-10 text-center">
          <Star size={32} aria-hidden="true" className="mx-auto mb-3 text-slate-600" />
          <p className="font-semibold text-white">{t('noch_keine_bewertungen')}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">{t('review_empty_hint')}</p>
        </div>
      )}

      {suche && gruppen.length === 0 && reviews.length > 0 && (
        <p className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-500">
          {t('nichts_gefunden', { search: suche })}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {gruppen.map(gruppe => (
          <section key={gruppe.stackItemId} data-review-group={gruppe.stackItemId} aria-labelledby={`review-group-${gruppe.stackItemId}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <h2 id={`review-group-${gruppe.stackItemId}`} className="min-w-0 truncate text-base font-bold text-white">
                {gruppe.name}
                {gruppe.archiviert && <span className="ml-2 text-xs font-medium text-slate-500">{t('review_archived')}</span>}
              </h2>
              <p className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-slate-400">
                <Star size={12} aria-hidden="true" className="text-amber-400" fill="currentColor" />
                {gruppe.schnitt.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                <span className="font-medium text-slate-500">
                  · {gruppe.bewertungen.length === 1 ? t('review_count_one') : t('review_count_many', { n: gruppe.bewertungen.length })}
                </span>
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {gruppe.bewertungen.map(r => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  zyklus={zyklusText(r)}
                  datum={new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(r.created_at))}
                  offen={offeneZeile === r.id}
                  onOffen={offen => setOffeneZeile(offen ? r.id : null)}
                  onEdit={() => openEdit(r)}
                  onRemove={() => { setOffeneZeile(null); setLoeschen(r) }}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

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

      {loeschen && (
        <ReviewDeleteSheet
          name={loeschen.stack_items?.display_name ?? ''}
          zyklus={zyklusText(loeschen)}
          busy={loescht}
          onCancel={() => setLoeschen(null)}
          onConfirm={() => void remove(loeschen)}
        />
      )}
    </div>
  )
}

/** Symbol und Text der Wischaktionen kommen mit dem Wischen (wie in My Stack). */
const AKTION_SYMBOL: CSSProperties = {
  opacity: 'var(--wisch-fortschritt, 0)',
  transform: 'scale(calc(0.6 + 0.4 * var(--wisch-fortschritt, 0)))',
}
const AKTION_TEXT: CSSProperties = {
  opacity: 'clamp(0, calc((var(--wisch-fortschritt, 0) - 0.8) * 5), 1)',
}

function ReviewRow({ review: r, zyklus, datum, offen, onOffen, onEdit, onRemove }: {
  review: Review
  zyklus: string
  datum: string
  offen: boolean
  onOffen: (offen: boolean) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { zeileRef, vorneRef, aktionenRef, klickVerschlucken } = useWischZeile({ offen, onOffen, onVoll: onRemove })
  const kriterien = [
    r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
    r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
    r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
  ].filter(Boolean)

  return (
    <li
      ref={zeileRef}
      data-review-row={r.id}
      data-list-open={offen || undefined}
      className="relative touch-pan-y select-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
    >
      <div
        ref={aktionenRef}
        aria-hidden={!offen || undefined}
        className="group/aktionen invisible absolute inset-y-0 right-0 flex w-0 overflow-hidden"
      >
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onEdit() }}
          aria-label={String(t('bearbeiten'))}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-sky-600 text-[11px] font-semibold text-white transition-[flex-grow] duration-300 ease-out group-data-[voll]/aktionen:grow-0"
        >
          <Pencil size={17} aria-hidden="true" style={AKTION_SYMBOL} />
          <span style={AKTION_TEXT}>{t('bearbeiten')}</span>
        </button>
        <button
          type="button"
          tabIndex={offen ? 0 : -1}
          onClick={() => { if (!klickVerschlucken()) onRemove() }}
          aria-label={String(t('loeschen'))}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap bg-red-600 text-[11px] font-semibold text-white group-data-[voll]/aktionen:items-start group-data-[voll]/aktionen:pl-7"
        >
          <Trash2 size={17} aria-hidden="true" style={AKTION_SYMBOL} />
          <span style={AKTION_TEXT}>{t('loeschen')}</span>
        </button>
      </div>

      <button
        ref={vorneRef}
        type="button"
        aria-label={String(t('review_open', { name: r.stack_items?.display_name ?? '', cycle: zyklus }))}
        onClick={() => {
          if (klickVerschlucken()) return
          if (offen) { onOffen(false); return }
          onEdit()
        }}
        className="relative block w-full touch-pan-y select-none bg-slate-950 px-4 py-3 text-left [-webkit-touch-callout:none] active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        <span className="flex items-center justify-between gap-3">
          <span data-review-cycle className="min-w-0 truncate text-xs font-semibold text-slate-400">{zyklus}</span>
          <span className="flex shrink-0 items-center gap-2">
            {r.is_public && <Globe size={13} className="text-slate-500" aria-label={String(t('review_public'))} />}
            <Sterne wert={r.rating} />
          </span>
        </span>
        {r.title && <span className="mt-1 block font-semibold text-white">{r.title}</span>}
        {kriterien.length > 0 && (
          <span data-review-criteria className="mt-1 block text-xs text-slate-400">{kriterien.join(' · ')}</span>
        )}
        {r.body && <span className="mt-1.5 line-clamp-2 block text-sm text-slate-300">{r.body}</span>}
        {(r.pros || r.cons) && (
          <span className="mt-2 flex flex-col gap-1 text-xs">
            {r.pros && <span className="line-clamp-1"><span className="font-semibold text-emerald-400">+ </span><span className="text-slate-300">{r.pros}</span></span>}
            {r.cons && <span className="line-clamp-1"><span className="font-semibold text-red-400">− </span><span className="text-slate-300">{r.cons}</span></span>}
          </span>
        )}
        <span className="mt-2 block text-[11px] text-slate-600">{datum}</span>
      </button>
    </li>
  )
}

function Sterne({ wert }: { wert: number }) {
  const { t } = useTranslation()
  return (
    <span className="flex gap-0.5" role="img" aria-label={String(t(wert === 1 ? 'review_star_one' : 'review_star_many', { n: wert }))}>
      {[1, 2, 3, 4, 5].map(stern => (
        <Star
          key={stern}
          size={13}
          aria-hidden="true"
          className={stern <= wert ? 'text-amber-400' : 'text-slate-700'}
          fill={stern <= wert ? 'currentColor' : 'transparent'}
        />
      ))}
    </span>
  )
}
