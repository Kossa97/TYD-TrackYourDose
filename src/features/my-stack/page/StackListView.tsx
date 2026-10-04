import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Package, Pencil, Trash2 } from 'lucide-react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { SloshProvider } from '../../../components/SloshContext'
import { StackStage } from '../components/StackStage'
import { type LoadedStackItemIngredient } from '../services/stackItems'
import { isStageRenderable } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { formatAmount, stockAmountLabel } from '../lib/bestandLabels'
import { GRUPPEN, gruppeVon, haltbarkeitFuer, istAktiv, type Gruppe, type Haltbarkeit } from '../lib/listRow'
import { HaltbarkeitChip } from './HaltbarkeitChip'
import { useMinuteClock } from '../lib/useMinuteClock'
import type { Translate } from '../lib/planLabels'
import { type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide, fuellstandFuer } from './model'

/**
 * Listenansicht: je Substanz eine Zeile — fuer jede Darreichungsform gleich:
 * Objekt, Name, aktiv/inaktiv, Zusammensetzung, Haltbarkeit. Mehr nicht. Ein
 * Tipp oeffnet das Vollbild wie im Karussell; dort stehen Plan, Bestand,
 * Bearbeiten und Loeschen. Nach links wischen zeigt Bearbeiten und Loeschen
 * direkt an der Zeile.
 *
 * Gegliedert nach Dringlichkeit: was abgelaufen ist oder bald ablaeuft
 * zuerst, dann die aktiven, dann die inaktiven — in jeder Gruppe in der
 * gewaehlten Sortierung. Ueberschriften nur, wenn es mehr als eine Gruppe gibt.
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
  openEdit,
  remove,
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
  /** Wischaktionen; Loeschen fragt wie im Vollbild noch einmal nach. */
  openEdit: (p: Peptide) => void
  remove: (id: string) => void
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
  const { t } = useTranslation()
  const tr = t as Translate
  const now = useMinuteClock()
  const listRef = useRef<HTMLUListElement | null>(null)
  // Hoechstens eine Zeile steht offen; ein Tipp irgendwo schliesst sie.
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null)

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

  // Ein Tipp ausserhalb der offenen Zeile schliesst sie wieder.
  useEffect(() => {
    if (!offeneZeile) return
    const schliessen = (event: PointerEvent) => {
      const ziel = event.target as Element | null
      if (ziel?.closest?.(`[data-list-row="${CSS.escape(offeneZeile)}"]`)) return
      setOffeneZeile(null)
    }
    document.addEventListener('pointerdown', schliessen)
    return () => document.removeEventListener('pointerdown', schliessen)
  }, [offeneZeile])

  // Einmal je Minute bzw. Datenstand — nicht bei jedem Wischen neu.
  const zeilen = useMemo(() => {
    const aktivVon = (p: Peptide): boolean | null => {
      if (aktivAlt) return aktivAlt.has(p.id)
      if (timelineState !== 'ready') return null
      return istAktiv(timelinesOf(p.id), now, timeZone)
    }
    const alle = listPeptides.map(p => {
      const aktiv = aktivVon(p)
      const haltbar = haltbarkeitFuer(p, now, timeZone)
      return { p, aktiv, haltbar, gruppe: gruppeVon(aktiv, haltbar) }
    })
    return GRUPPEN.flatMap(gruppe => alle.filter(zeile => zeile.gruppe === gruppe))
  }, [listPeptides, aktivAlt, timelineState, timelinesOf, now, timeZone])
  // Ueberschriften nur, wenn es mehr als eine Gruppe gibt — und erst, wenn
  // der Status feststeht; vorher stuende „Aktiv" ueber Unbekanntem.
  const mitUeberschrift = zeilen.every(zeile => zeile.aktiv !== null)
    && new Set(zeilen.map(zeile => zeile.gruppe)).size > 1

  return (
    // Eine einzige Liste, die Ueberschriften als eigene Eintraege dazwischen:
    // wechselt eine Zeile die Gruppe (die Plaene sind geladen, eine Frist
    // rueckt naeher), wandert sie nur — sie wird nicht neu aufgebaut, und
    // ihr Objekt fuellt sich nicht noch einmal.
    <ul
      ref={listRef}
      data-stack-list
      // `pb-14`: Platz fuer den schwebenden „?"-Knopf ueber der Tabbar —
      // ohne ihn lag er auf der letzten Zeile, und ihr Pfeil war verdeckt.
      className={`flex flex-col gap-2 pb-14 ${!loading && listPeptides.length > 0 ? '' : 'hidden'}`}
    >
      {/* Dieselbe Physik wie die Seite: die Oberflaeche atmet, schwappt aber
          nie — hier stoesst niemand etwas an. */}
      <SloshProvider engine={sloshEngine}>
        {zeilen.map(({ p, aktiv, haltbar, gruppe }, index) => {
          const ersteDerGruppe = index === 0 || zeilen[index - 1].gruppe !== gruppe
          return [
            mitUeberschrift && ersteDerGruppe && (
              <li key={`gruppe-${gruppe}`} role="presentation" className={index === 0 ? '' : 'pt-3'}>
                <h3
                  data-list-group-title={gruppe}
                  className={`px-1 text-[11px] font-bold uppercase tracking-wider ${gruppe === 'achtung' ? 'text-red-300' : 'text-slate-500'}`}
                >
                  {gruppenTitel(tr, gruppe)}
                </h3>
              </li>
            ),
            <StackListRow
              key={p.id}
              p={p}
              gruppe={gruppe}
              aktiv={aktiv}
              haltbar={haltbar}
              animationEpoch={animationEpoch}
              hervorgehoben={hervorgehobenId === p.id}
              offen={offeneZeile === p.id}
              onOffen={offen => setOffeneZeile(offen ? p.id : null)}
              onOpen={ursprung => openDetail(p, ursprung)}
              onEdit={() => { setOffeneZeile(null); openEdit(p) }}
              onRemove={() => { setOffeneZeile(null); remove(p.id) }}
            />,
          ]
        })}
      </SloshProvider>
    </ul>
  )
}

function gruppenTitel(t: Translate, gruppe: Gruppe): string {
  if (gruppe === 'achtung') return String(t('my_stack_list_group_attention'))
  return String(t(gruppe === 'aktiv' ? 'aktiv_badge' : 'inaktiv_badge'))
}

/** So weit schiebt sich die Zeile auf, um die zwei Aktionen zu zeigen. */
const AKTIONEN_BREITE = 144
/** Erst ab dieser Strecke ist ein Ziehen ein Wischen — darunter ein Tipp oder Scrollen. */
const WISCH_SCHWELLE = 10

/**
 * Wischen nach links an einer Zeile. Waagerecht und deutlich genug, dann
 * folgt die Zeile dem Finger; beim Loslassen rastet sie offen oder zu.
 * Senkrecht bleibt Scrollen — `touch-pan-y` laesst es dem Browser.
 */
function useWischen(offen: boolean, onOffen: (offen: boolean) => void) {
  const start = useRef<{ x: number; y: number; basis: number } | null>(null)
  const wischt = useRef(false)
  const gewischt = useRef(false)
  // Der letzte Stand fuer das Loslassen — der State kaeme bei einem
  // schnellen Schnippen noch nicht an.
  const letzterVersatz = useRef<number | null>(null)
  const [versatz, setVersatz] = useState<number | null>(null)

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    start.current = { x: event.clientX, y: event.clientY, basis: offen ? -AKTIONEN_BREITE : 0 }
    wischt.current = false
    gewischt.current = false
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    const s = start.current
    if (!s) return
    // Maus ausserhalb losgelassen: kein pointerup hier — dann ist Schluss.
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      ende()
      return
    }
    const dx = event.clientX - s.x
    const dy = event.clientY - s.y
    if (!wischt.current) {
      if (Math.abs(dx) < WISCH_SCHWELLE || Math.abs(dx) < Math.abs(dy)) {
        if (Math.abs(dy) > WISCH_SCHWELLE) start.current = null
        return
      }
      wischt.current = true
      gewischt.current = true
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    }
    const neu = Math.min(0, Math.max(-AKTIONEN_BREITE - 24, s.basis + dx))
    letzterVersatz.current = neu
    setVersatz(neu)
  }
  function ende() {
    const zuletzt = letzterVersatz.current
    if (wischt.current && zuletzt !== null) onOffen(zuletzt < -AKTIONEN_BREITE / 2)
    start.current = null
    wischt.current = false
    letzterVersatz.current = null
    setVersatz(null)
  }
  return {
    versatz: versatz ?? (offen ? -AKTIONEN_BREITE : 0),
    zieht: versatz !== null,
    /** Nach einem Wischen kommt noch ein Klick — der oeffnet nichts. */
    klickVerschlucken: () => {
      const war = gewischt.current
      gewischt.current = false
      return war
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp: ende, onPointerCancel: ende },
  }
}

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
  gruppe,
  aktiv,
  haltbar,
  animationEpoch,
  hervorgehoben,
  offen,
  onOffen,
  onOpen,
  onEdit,
  onRemove,
}: {
  p: Peptide
  gruppe: Gruppe
  /** null, solange die Plaene laden — dann sagt die Zeile nichts dazu. */
  aktiv: boolean | null
  haltbar: Haltbarkeit | null
  animationEpoch: number
  hervorgehoben: boolean
  /** Ob die Wischaktionen offen stehen. */
  offen: boolean
  onOffen: (offen: boolean) => void
  onOpen: (ursprung: HTMLElement) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const tr = t as Translate
  const language = i18n.resolvedLanguage ?? i18n.language
  const objektRef = useRef<HTMLSpanElement | null>(null)
  const wischen = useWischen(offen, onOffen)

  const stageRenderable = isStageRenderable(p.dosage_form)
  const farbe = p.color_hex ?? getStableStackItemColor(p.id)
  const zusammensetzung = zusammensetzungText(tr, p, language)
  const aktionSichtbar = offen || wischen.zieht

  return (
    <li
      data-list-row={p.id}
      data-list-group={gruppe}
      data-list-active={aktiv === null ? undefined : String(aktiv)}
      data-list-open={offen || undefined}
      // Keine `bg-slate-900/…`-Klasse, auch nicht als hover-Variante: das
      // helle Design faerbt jede Klasse mit diesem Wortlaut dauerhaft ein.
      className={`relative overflow-hidden rounded-2xl border bg-slate-950 transition-[border-color,box-shadow] duration-500 ${hervorgehoben
        ? 'border-cyan-300/60 shadow-[0_0_0_3px_rgba(103,232,249,0.15)]'
        : 'border-slate-800'}`}
    >
      {/* Unter der Zeile: die beiden Aktionen. Erreichbar nur, wenn sie
          offen steht — sonst ist das Vollbild der Weg dorthin. */}
      <div
        aria-hidden={!aktionSichtbar || undefined}
        className="absolute inset-y-0 right-0 flex"
        style={{ width: AKTIONEN_BREITE }}
      >
        <button
          type="button"
          tabIndex={aktionSichtbar ? 0 : -1}
          onClick={onEdit}
          aria-label={String(t('bearbeiten'))}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-sky-600 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          <Pencil size={17} aria-hidden="true" />
          {t('bearbeiten')}
        </button>
        <button
          type="button"
          tabIndex={aktionSichtbar ? 0 : -1}
          onClick={onRemove}
          aria-label={String(t('loeschen'))}
          data-list-delete
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-red-600 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          <Trash2 size={17} aria-hidden="true" />
          {t('loeschen')}
        </button>
      </div>

      <button
        type="button"
        aria-label={String(t('my_stack_list_open', { name: p.name }))}
        {...wischen.handlers}
        onClick={event => {
          if (wischen.klickVerschlucken()) return
          // Offen: ein Tipp schliesst nur — kein Vollbild aus Versehen.
          if (offen) { onOffen(false); return }
          onOpen(objektRef.current ?? event.currentTarget)
        }}
        style={{ transform: `translateX(${wischen.versatz}px)` }}
        className={`relative flex w-full min-w-0 touch-pan-y items-center gap-3 bg-slate-950 py-2.5 pl-2 pr-2 text-left active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 ${wischen.zieht ? '' : 'transition-transform duration-200 ease-out'}`}
      >        {/* Feste Flaeche: das Objekt wird hineingepasst, nicht umgekehrt. */}
        <span ref={objektRef} data-list-object className="flex h-14 w-11 shrink-0">
          {stageRenderable ? (
            <Eingepasst>
              <StackStage
                key={animationEpoch}
                item={{ ...p, color_hex: farbe }}
                fillPct={fuellstandFuer(p) ?? 100}
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
          {/* Wie im Karussell: dasselbe Abzeichen, dieselbe Frist. */}
          <span className="mt-1 flex text-xs">
            <HaltbarkeitChip tage={haltbar?.tage ?? null} substanzId={p.id} />
          </span>
        </span>

        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-600" />
      </button>
    </li>
  )
}
