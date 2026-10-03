import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format, parseISO } from 'date-fns'
import { CalendarPlus, ChevronRight, Clock, Package, PauseCircle } from 'lucide-react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { NewDot } from '../../../components/NewDot'
import { SloshProvider } from '../../../components/SloshContext'
import { StackStage } from '../components/StackStage'
import { type LoadedStackItemIngredient } from '../services/stackItems'
import { getDosageForm, isStageRenderable } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { anbruchArt } from '../lib/bestand'
import { daysLabel, formatAmount, stockAmountLabel, vorratZeilen } from '../lib/bestandLabels'
import { zeilenPlanFuer, zeilenStand, type ZeilenHinweis, type ZeilenStand } from '../lib/listRow'
import { useMinuteClock } from '../lib/useMinuteClock'
import type { Translate } from '../lib/planLabels'
import { localDateTimeKey, type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide, getVialFillPct } from './model'

/**
 * Listenansicht: je Substanz eine Zeile — Objekt, Name, naechste Einnahme,
 * Reichweite, hoechstens ein Hinweis. Ein Tipp oeffnet das Vollbild wie im
 * Karussell; dort stehen Plan, Bestand, Bearbeiten und Loeschen.
 *
 * Steht auch unter dem Karussell: fuer die Substanzen ohne Buehnengrafik.
 */
export function StackListView({
  loading,
  listPeptides,
  sloshEngine,
  timelinesOf,
  timelineState,
  timeZone,
  animationEpoch,
  openDetail,
  openNewCycle,
  zyklusBtnNew,
  dismissZyklusBtn,
  hervorgehobenId,
  hervorhebungGesehen,
}: {
  loading: boolean
  listPeptides: Peptide[]
  sloshEngine: SloshEngine
  timelinesOf: (stackItemId: string) => CycleTimeline[]
  /** Solange die Plaene laden, sagt eine Zeile nichts ueber den Plan — statt „Kein Plan". */
  timelineState: 'ready' | 'loading' | 'error'
  timeZone: string
  animationEpoch: number
  /** Oeffnet das Vollbild; `ursprung` ist das Element, aus dem es auffliegt. */
  openDetail: (p: Peptide, ursprung: HTMLElement) => void
  openNewCycle: (p: Peptide) => void
  zyklusBtnNew: boolean
  dismissZyklusBtn: () => void
  /** Eine eben gespeicherte Substanz: die Zeile rueckt ins Bild und leuchtet kurz. */
  hervorgehobenId: string | null
  hervorhebungGesehen: () => void
}) {
  const now = useMinuteClock()
  const minute = now.getTime()
  const listRef = useRef<HTMLUListElement | null>(null)

  // Steht die Substanz gar nicht in der Liste (ein Vial unter dem
  // Karussell, ein anderer Reiter), gilt die Hervorhebung sofort als
  // gesehen — sonst leuchtete die Zeile Minuten spaeter beim Umschalten auf.
  const hervorgehobenSichtbar = hervorgehobenId !== null && listPeptides.some(p => p.id === hervorgehobenId)
  useEffect(() => {
    if (!hervorgehobenId) return
    const zeile = hervorgehobenSichtbar
      ? listRef.current?.querySelector<HTMLElement>(`[data-list-row="${CSS.escape(hervorgehobenId)}"]`)
      : null
    if (!zeile) {
      hervorhebungGesehen()
      return
    }
    zeile.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const timer = window.setTimeout(hervorhebungGesehen, 1800)
    return () => window.clearTimeout(timer)
  }, [hervorgehobenId, hervorgehobenSichtbar, hervorhebungGesehen])

  // Der Neu-Punkt am ERSTEN „Plan anlegen", nicht an jedem — nach derselben
  // Regel, nach der die Zeile den Knopf zeigt.
  const erstesOhnePlan = timelineState === 'ready' && zyklusBtnNew
    ? listPeptides.find(p => zeilenPlanFuer({ item: p, timelines: timelinesOf(p.id), now, timeZone }).art === 'kein_plan')?.id ?? null
    : null

  return (
    <ul
      ref={listRef}
      data-stack-list
      className={`flex flex-col gap-2 ${!loading && listPeptides.length > 0 ? '' : 'hidden'}`}
    >
      {/* Dieselbe Physik wie die Seite: die Oberflaeche atmet, schwappt aber
          nie — hier stoesst niemand etwas an. */}
      <SloshProvider engine={sloshEngine}>
        {listPeptides.map(p => (
          <StackListRow
            key={p.id}
            p={p}
            timelines={timelinesOf(p.id)}
            timelineState={timelineState}
            timeZone={timeZone}
            minute={minute}
            animationEpoch={animationEpoch}
            hervorgehoben={hervorgehobenId === p.id}
            neuPunkt={zyklusBtnNew && erstesOhnePlan === p.id}
            onOpen={ursprung => openDetail(p, ursprung)}
            onNewPlan={() => { openNewCycle(p); dismissZyklusBtn() }}
          />
        ))}
      </SloshProvider>
    </ul>
  )
}

// Rot fuer das, was schon eingetreten ist, Gelb fuer das, was droht. Die
// Farben fuer das helle Design stehen in index.css (`data-list-chip`).
const HINWEIS_TON: Record<ZeilenHinweis['art'], 'rot' | 'gelb'> = {
  abgelaufen: 'rot',
  leer: 'rot',
  pruefen: 'gelb',
  knapp: 'gelb',
  laeuft_ab: 'gelb',
}
const CHIP_KLASSE = {
  rot: 'border-red-400/30 bg-red-500/10 text-red-300',
  gelb: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
} as const

function hinweisText(t: Translate, hinweis: ZeilenHinweis): string {
  switch (hinweis.art) {
    case 'abgelaufen': return String(t('my_stack_list_expired'))
    case 'leer': return String(t('my_stack_stock_empty'))
    case 'pruefen': return String(t('my_stack_list_review'))
    case 'knapp': return String(t('my_stack_list_low'))
    case 'laeuft_ab':
      if (hinweis.tage === 0) return String(t('my_stack_expires_today'))
      return String(t(hinweis.tage === 1 ? 'my_stack_list_expires_in_single' : 'my_stack_list_expires_in_multiple', { n: hinweis.tage }))
  }
}

/** „Heute, 08:00", „Morgen, 20:00", sonst „Mo., 5.10., 08:00" — mit Menge. */
function naechsteText(
  t: Translate,
  plan: Extract<ZeilenStand['plan'], { art: 'naechste' }>,
  heute: string,
  language: string,
): string {
  const morgen = format(addDays(parseISO(heute), 1), 'yyyy-MM-dd')
  const wann = plan.localDate === heute
    ? String(t('my_stack_list_today', { time: plan.time }))
    : plan.localDate === morgen
      ? String(t('my_stack_list_tomorrow', { time: plan.time }))
      : `${new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${plan.localDate}T12:00:00.000Z`))}, ${plan.time}`
  const menge = plan.dose != null ? `${formatAmount(plan.dose, language)} ${plan.unit ?? ''}`.trim() : null
  return menge ? `${wann} · ${menge}` : wann
}

/**
 * Die Staerke in einem Stueck: „5 mg" fuer ein Vial, eine Tablette, eine
 * Kapsel — die Packungseinheit versteht sich dort von selbst —, sonst mit
 * Bezug („10 mg / 3 ml"). Mischungen nennen ihre Wirkstoffe.
 */
function staerkeText(t: Translate, p: Peptide, language: string): string | null {
  const zutaten = p.ingredients as LoadedStackItemIngredient[]
  if (zutaten.length > 1) {
    return zutaten
      .map(zutat => zutat.custom_name || zutat.substance_catalog?.canonical_name)
      .filter(Boolean)
      .join(' + ') || null
  }
  const zutat = zutaten[0]
  if (zutat?.amount_value != null && zutat.amount_unit) {
    const menge = `${formatAmount(zutat.amount_value, language)} ${zutat.amount_unit}`
    const selbstverstaendlich = zutat.basis_value === 1 && zutat.basis_unit === getDosageForm(p.dosage_form).basisUnits[0]
    if (selbstverstaendlich || zutat.basis_value == null || !zutat.basis_unit) return menge
    return `${menge} / ${stockAmountLabel(t, zutat.basis_value, zutat.basis_unit, language)}`
  }
  // Aeltere Eintraege kennen nur die Vial-Spalten.
  if (p.vial_amount_mg) return `${formatAmount(p.vial_amount_mg, language)} ${p.vial_amount_unit ?? 'mg'}`
  return null
}

/**
 * Was rechts steht: wie lange es reicht — oder, ohne Rechnung, was noch da
 * ist. `reicht` sagt, welches der beiden es ist.
 */
function vorratText(t: Translate, p: Peptide, stand: ZeilenStand, language: string): { text: string; reicht: boolean } | null {
  const range = stand.reichweite
  if (!range || !p.inventory?.enabled) return null
  switch (range.art) {
    case 'tage': return { text: daysLabel(t, range.tage), reicht: true }
    case 'laenger': return { text: String(t('my_stack_list_range_long', { n: range.tage })), reicht: true }
    case 'leer': return null
    case 'kein_plan':
    case 'unbekannt':
      return { text: vorratZeilen(t, p.inventory, anbruchArt(p.dosage_form), language).gross, reicht: false }
  }
}

/**
 * Passt das Objekt in die Zeile. Die Formen haben in der Mini-Groesse sehr
 * verschiedene Masse — ein Pen ist fast 100 px hoch, ein Pflaster 18 px —,
 * also wird gemessen und verkleinert, nie vergroessert. Direkt am Element
 * statt ueber den Zustand: das Messen loest kein zweites Rendern aus.
 */
function Eingepasst({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLSpanElement | null>(null)
  const innenRef = useRef<HTMLSpanElement | null>(null)
  useLayoutEffect(() => {
    const box = boxRef.current
    const innen = innenRef.current
    if (!box || !innen) return
    const einpassen = () => {
      const breite = innen.offsetWidth
      const hoehe = innen.offsetHeight
      if (!breite || !hoehe) return
      const faktor = Math.min(1, box.clientWidth / breite, box.clientHeight / hoehe)
      innen.style.transform = faktor < 1 ? `scale(${faktor})` : ''
    }
    einpassen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(einpassen)
    ro.observe(innen)
    return () => ro.disconnect()
  }, [])
  return (
    <span ref={boxRef} className="flex h-full w-full items-center justify-center">
      <span ref={innenRef} className="inline-flex shrink-0">{children}</span>
    </span>
  )
}

function StackListRow({
  p,
  timelines,
  timelineState,
  timeZone,
  minute,
  animationEpoch,
  hervorgehoben,
  neuPunkt,
  onOpen,
  onNewPlan,
}: {
  p: Peptide
  timelines: CycleTimeline[]
  timelineState: 'ready' | 'loading' | 'error'
  timeZone: string
  minute: number
  animationEpoch: number
  hervorgehoben: boolean
  neuPunkt: boolean
  onOpen: (ursprung: HTMLElement) => void
  onNewPlan: () => void
}) {
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const objektRef = useRef<HTMLSpanElement | null>(null)

  // Die Plaene kommen als stabile Liste je Substanz (`timelinesOf`), also
  // rechnet die Zeile nur neu, wenn sich Plan, Eintrag oder Minute aendern.
  const stand = useMemo(
    () => zeilenStand({ item: p, timelines, now: new Date(minute), timeZone }),
    [p, timelines, minute, timeZone],
  )

  const heute = localDateTimeKey(new Date(minute), timeZone).slice(0, 10)
  const stageRenderable = isStageRenderable(p.dosage_form)
  const fillPct = getVialFillPct(p)
  const farbe = p.color_hex ?? getStableStackItemColor(p.id)
  const plaeneBereit = timelineState === 'ready'
  const keinPlan = plaeneBereit && stand.plan.art === 'kein_plan'
  const vorrat = vorratText(tr, p, stand, language)
  const staerke = staerkeText(tr, p, language)
  const detail = [String(t(`dosage_form_${p.dosage_form}`)), staerke].filter(Boolean).join(' · ')

  const planZeile = (() => {
    if (!plaeneBereit) return null
    const plan = stand.plan
    switch (plan.art) {
      case 'naechste':
        return (
          <span className="flex min-w-0 items-center gap-1 text-slate-200">
            <Clock size={12} aria-hidden="true" data-list-uhr className="shrink-0 text-cyan-300" />
            <span className="truncate">{naechsteText(tr, plan, heute, language)}</span>
          </span>
        )
      case 'pausiert':
        return (
          <span className="flex min-w-0 items-center gap-1 text-slate-400">
            <PauseCircle size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t('my_stack_plan_status_paused')}</span>
          </span>
        )
      case 'ohne_termin':
        return <span className="truncate text-slate-400">{t('my_stack_plan_next_intake_none')}</span>
      case 'pruefen':
        return <span className="truncate text-slate-400">{t('my_stack_list_review_locked')}</span>
      case 'kein_plan':
        return <span className="truncate text-slate-500">{t(plan.hatteZyklen ? 'kein_aktiver_zyklus' : 'noch_kein_zyklus')}</span>
    }
  })()

  return (
    <li
      data-list-row={p.id}
      data-list-hint={stand.hinweis?.art ?? undefined}
      // Keine `bg-slate-900/…`-Klasse, auch nicht als hover-Variante: das
      // helle Design faerbt jede Klasse mit diesem Wortlaut dauerhaft ein.
      className={`flex items-stretch overflow-hidden rounded-2xl border bg-slate-950 transition-[border-color,box-shadow] duration-500 ${hervorgehoben
        ? 'border-cyan-300/60 shadow-[0_0_0_3px_rgba(103,232,249,0.15)]'
        : 'border-slate-800'}`}
    >
      <button
        type="button"
        aria-label={String(t('my_stack_list_open', { name: p.name }))}
        onClick={event => onOpen(objektRef.current ?? event.currentTarget)}
        className="flex min-w-0 flex-1 items-center gap-3 bg-transparent py-2 pl-2 pr-1 text-left transition-colors active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        <span className="flex w-11 shrink-0 flex-col items-center gap-0.5">
          {/* Feste Flaeche: das Objekt wird hineingepasst, nicht umgekehrt. */}
          <span ref={objektRef} data-list-object className="flex h-14 w-11">
            {stageRenderable ? (
              <Eingepasst>
                <StackStage
                  key={animationEpoch}
                  item={{ ...p, color_hex: farbe }}
                  fillPct={fillPct ?? 100}
                  animateOnMount={true}
                  isActive={false}
                  size="mini"
                  showLabel={false}
                />
              </Eingepasst>
            ) : (
              <span className="m-auto grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-800 text-slate-500">
                <Package size={18} aria-hidden="true" />
              </span>
            )}
          </span>
          {fillPct !== null && (
            <span className="text-[10px] font-bold tabular-nums leading-none text-slate-500">
              {Math.round(fillPct)}%
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-white">{p.name}</span>
            {stand.hinweis && (
              <span
                data-list-chip={HINWEIS_TON[stand.hinweis.art]}
                className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight ${CHIP_KLASSE[HINWEIS_TON[stand.hinweis.art]]}`}
              >
                {hinweisText(tr, stand.hinweis)}
              </span>
            )}
          </span>
          {/* Die naechste Einnahme bekommt die ganze Breite — sie ist das,
              wonach man in der Liste sucht. */}
          {planZeile && <span className="flex min-w-0 text-xs">{planZeile}</span>}
          {(detail || vorrat) && (
            <span className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="truncate">{detail}</span>
              {vorrat && (
                <span
                  title={vorrat.reicht ? String(t('my_stack_list_range_title', { range: vorrat.text })) : undefined}
                  className="flex shrink-0 items-center gap-1 font-semibold tabular-nums text-slate-400"
                >
                  <Package size={11} aria-hidden="true" />
                  {vorrat.text}
                </span>
              )}
            </span>
          )}
        </span>

        {!keinPlan && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-600" />}
      </button>

      {/* Ohne Plan der eine Schritt, der fehlt — neben der Zeile, nicht in
          ihr: ein Knopf im Knopf waere fuer Tastatur und Vorleser keiner.
          Nur ein Symbol, damit der Name nicht schrumpft; die Zeile sagt
          daneben „Noch kein Zyklus". */}
      {keinPlan && (
        <button
          type="button"
          data-ob="btn-zyklus-add"
          data-list-plan-add
          onClick={onNewPlan}
          aria-label={String(t('my_stack_list_add_plan'))}
          title={String(t('my_stack_list_add_plan'))}
          className="relative my-auto mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-violet-500/35 bg-violet-500/15 text-violet-200 transition-colors hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <CalendarPlus size={17} aria-hidden="true" />
          {/* NewDot setzt selbst `relative` — die Lage gibt ihm deshalb eine Huelle. */}
          {neuPunkt && <span className="absolute right-0 top-0"><NewDot /></span>}
        </button>
      )}
    </li>
  )
}
