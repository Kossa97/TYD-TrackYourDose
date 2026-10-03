import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Hourglass, Package } from 'lucide-react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { SloshProvider } from '../../../components/SloshContext'
import { StackStage } from '../components/StackStage'
import { type LoadedStackItemIngredient } from '../services/stackItems'
import { isStageRenderable } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { formatAmount, stockAmountLabel } from '../lib/bestandLabels'
import { formatLocalDay } from '../lib/localDays'
import { ABLAUF_BALD_TAGE, haltbarkeitFuer, istAktiv, type Haltbarkeit } from '../lib/listRow'
import { useMinuteClock } from '../lib/useMinuteClock'
import type { Translate } from '../lib/planLabels'
import { type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide, getVialFillPct } from './model'

/**
 * Listenansicht: je Substanz eine Zeile — fuer jede Darreichungsform gleich:
 * Objekt, Name, aktiv/inaktiv, Zusammensetzung, Haltbarkeit. Mehr nicht. Ein
 * Tipp oeffnet das Vollbild wie im Karussell; dort stehen Plan, Bestand,
 * Bearbeiten und Loeschen.
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
  aktivAlt,
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
  /**
   * Ohne Plan-Zeitleiste (alter Datenpfad): die Substanzen mit aktivem
   * Zyklus. Mit Zeitleiste null — dann entscheidet der Plan selbst, und
   * pausiert zaehlt als inaktiv.
   */
  aktivAlt: ReadonlySet<string> | null
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

  const aktivVon = (p: Peptide): boolean | null => {
    if (aktivAlt) return aktivAlt.has(p.id)
    if (timelineState !== 'ready') return null
    return istAktiv(timelinesOf(p.id), now, timeZone)
  }

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
            aktiv={aktivVon(p)}
            timeZone={timeZone}
            minute={minute}
            animationEpoch={animationEpoch}
            hervorgehoben={hervorgehobenId === p.id}
            onOpen={ursprung => openDetail(p, ursprung)}
          />
        ))}
      </SloshProvider>
    </ul>
  )
}

/**
 * Wann es ablaeuft: weit weg ruhig, bald gelb, vorbei rot. Die Farben fuer
 * das helle Design stehen in index.css (`data-list-haltbar`, `data-list-status`).
 */
function haltbarText(t: Translate, haltbar: Haltbarkeit, language: string): string {
  if (haltbar.tage < 0) return String(t('my_stack_list_expired_since', { date: formatLocalDay(haltbar.bis, language) }))
  if (haltbar.tage === 0) return String(t('my_stack_expires_today'))
  if (haltbar.tage <= ABLAUF_BALD_TAGE) {
    return String(t(haltbar.tage === 1 ? 'my_stack_list_expires_in_single' : 'my_stack_list_expires_in_multiple', { n: haltbar.tage }))
  }
  return String(t('my_stack_list_keeps_until', { date: formatLocalDay(haltbar.bis, language) }))
}

function haltbarTon(haltbar: Haltbarkeit): 'rot' | 'gelb' | 'ruhig' {
  if (haltbar.tage < 0) return 'rot'
  if (haltbar.tage <= ABLAUF_BALD_TAGE) return 'gelb'
  return 'ruhig'
}

const HALTBAR_KLASSE = {
  rot: 'text-red-300',
  gelb: 'text-amber-200',
  ruhig: 'text-slate-500',
} as const

/**
 * Woraus die Substanz besteht, fuer jede Form gleich: Menge je Bezug
 * („5 mg / 1 Vial", „500 mg / 1 Tablette", „10 mg / 3 ml"). Eine Mischung
 * nennt jeden Wirkstoff mit Namen; ein einzelner Wirkstoff, der so heisst
 * wie der Eintrag, braucht seinen Namen nicht noch einmal.
 */
function zusammensetzungText(t: Translate, p: Peptide, language: string): string | null {
  const zutaten = p.ingredients as LoadedStackItemIngredient[]
  const teile = zutaten.map(zutat => {
    const name = zutat.custom_name || zutat.substance_catalog?.canonical_name || null
    const menge = zutat.amount_value != null && zutat.amount_unit
      ? [
        `${formatAmount(zutat.amount_value, language)} ${zutat.amount_unit}`,
        zutat.basis_value != null && zutat.basis_unit ? stockAmountLabel(t, zutat.basis_value, zutat.basis_unit, language) : null,
      ].filter(Boolean).join(' / ')
      : null
    const mitNamen = zutaten.length > 1 || (name !== null && name.toLowerCase() !== p.name.toLowerCase())
    return [mitNamen ? name : null, menge].filter(Boolean).join(' ')
  }).filter(Boolean)
  if (teile.length > 0) return teile.join(' · ')
  // Aeltere Eintraege kennen nur die Vial-Spalten.
  if (p.vial_amount_mg) return `${formatAmount(p.vial_amount_mg, language)} ${p.vial_amount_unit ?? 'mg'}`
  return null
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
  aktiv,
  timeZone,
  minute,
  animationEpoch,
  hervorgehoben,
  onOpen,
}: {
  p: Peptide
  /** null, solange die Plaene laden — dann sagt die Zeile nichts dazu. */
  aktiv: boolean | null
  timeZone: string
  minute: number
  animationEpoch: number
  hervorgehoben: boolean
  onOpen: (ursprung: HTMLElement) => void
}) {
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const objektRef = useRef<HTMLSpanElement | null>(null)

  const haltbar = useMemo(() => haltbarkeitFuer(p, new Date(minute), timeZone), [p, minute, timeZone])
  const stageRenderable = isStageRenderable(p.dosage_form)
  const farbe = p.color_hex ?? getStableStackItemColor(p.id)
  const zusammensetzung = zusammensetzungText(tr, p, language)
  const ton = haltbar ? haltbarTon(haltbar) : null

  return (
    <li
      data-list-row={p.id}
      data-list-active={aktiv === null ? undefined : String(aktiv)}
      // Keine `bg-slate-900/…`-Klasse, auch nicht als hover-Variante: das
      // helle Design faerbt jede Klasse mit diesem Wortlaut dauerhaft ein.
      className={`overflow-hidden rounded-2xl border bg-slate-950 transition-[border-color,box-shadow] duration-500 ${hervorgehoben
        ? 'border-cyan-300/60 shadow-[0_0_0_3px_rgba(103,232,249,0.15)]'
        : 'border-slate-800'}`}
    >
      <button
        type="button"
        aria-label={String(t('my_stack_list_open', { name: p.name }))}
        onClick={event => onOpen(objektRef.current ?? event.currentTarget)}
        className="flex w-full min-w-0 items-center gap-3 bg-transparent py-2.5 pl-2 pr-2 text-left transition-colors active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
      >
        {/* Feste Flaeche: das Objekt wird hineingepasst, nicht umgekehrt. */}
        <span ref={objektRef} data-list-object className="flex h-14 w-11 shrink-0">
          {stageRenderable ? (
            <Eingepasst>
              <StackStage
                key={animationEpoch}
                item={{ ...p, color_hex: farbe }}
                fillPct={getVialFillPct(p) ?? 100}
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

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-white">{p.name}</span>
            {aktiv !== null && (
              <span
                data-list-status={aktiv ? 'aktiv' : 'inaktiv'}
                className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold leading-tight ${aktiv
                  ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'}`}
              >
                {aktiv ? t('aktiv_badge') : t('inaktiv_badge')}
              </span>
            )}
          </span>
          {zusammensetzung && (
            <span className="line-clamp-2 text-xs text-slate-300">{zusammensetzung}</span>
          )}
          {haltbar && ton && (
            <span data-list-haltbar={ton} className={`flex min-w-0 items-center gap-1 text-[11px] ${HALTBAR_KLASSE[ton]}`}>
              <Hourglass size={11} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{haltbarText(tr, haltbar, language)}</span>
            </span>
          )}
        </span>

        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-600" />
      </button>
    </li>
  )
}
