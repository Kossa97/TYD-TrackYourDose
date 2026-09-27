import { FileUp, Package, X } from 'lucide-react'
import { format } from 'date-fns'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CycleTimeline } from '../../../lib/planTimeline'
import {
  anbruchArt,
  bestandAufteilen,
  bestandZusammensetzen,
  reichweite,
  vorratTeile,
  type AnbruchArt,
} from '../lib/bestand'
import { daysLabel, reichweiteLabel, stockAmountLabel, stockUnitChoices, stockUnitName, vorratZeilen } from '../lib/bestandLabels'
import type { InventoryPatch } from '../services/stackInventory'
import type { DosageFormKey, StackItemIngredient, StackItemInventory } from '../types'

/**
 * Der Bestand im Vollbild: die Kurzfassung unter dem Plan (`BestandCard`) und
 * kleine Aenderungsfenster fuer einzelne Werte (`BestandEditorHost`). Ein
 * eigenes Bestand-Fenster gibt es nicht — Anmischen, Haltbarkeit und Charge
 * stehen bei „Zusammensetzung" und „Substanz" und oeffnen von dort ihr Feld.
 */

export interface BestandActions {
  start(input: { packageQuantity: number; packageUnit: string; remainingQuantity: number }): Promise<void>
  update(patch: InventoryPatch): Promise<void>
  openContainer(input: { openedAt: string; discardRest: boolean; reconstitutionMl: number | null }): Promise<void>
  uploadDocument(file: File): Promise<string>
}

export type BestandEditorArt =
  | 'start' | 'correct' | 'open_new'
  | 'opened_at' | 'reconstitution_ml' | 'use_within_days'
  | 'batch_number' | 'batch_source' | 'batch_file_url' | 'expires_at'

const HALTBAR_VORGABEN: Record<AnbruchArt, number[]> = {
  vial: [14, 21, 28, 42],
  pen: [14, 28, 30, 56],
  flasche: [30, 90, 180, 365],
}

function heute(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function zahl(text: string): number | null {
  if (text.trim() === '') return null
  const wert = Number(text.replace(',', '.'))
  return Number.isFinite(wert) ? wert : null
}

function BarFill({ fraction }: { fraction: number }) {
  const tone = fraction <= 0.1 ? 'bg-rose-400' : fraction <= 0.3 ? 'bg-amber-300' : 'bg-emerald-400'
  return (
    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }} />
    </div>
  )
}

interface EditorProps {
  editor: BestandEditorArt
  art: AnbruchArt | null
  inventory: StackItemInventory | null
  /** Ein ausgeschalteter Bestand: seine Zahlen fuellen „Bestand verfolgen" vor. */
  fallback: StackItemInventory | null
  choices: string[]
  busy: boolean
  language: string
  onClose(): void
  onSubmit(work: () => Promise<void>): void
  actions: BestandActions
}

function BestandEditor({ editor, art, inventory, fallback, choices, busy, language, onClose, onSubmit, actions }: EditorProps) {
  const { t } = useTranslation()
  const id = useId()
  const inv = inventory ?? fallback
  const einheit = inv?.package_unit ?? choices[0] ?? 'unit'
  const teile = inventory ? vorratTeile(inventory) : null
  // „Bestand aendern": ungeoeffnet + angebrochen in Prozent, wo die Form
  // Behaelter anbricht; sonst die eine Menge.
  const aufteilung = inventory ? bestandAufteilen(inventory, art) : null
  const [geteilt, setGeteilt] = useState(() => ({
    voll: String(aufteilung?.voll ?? ''),
    prozent: String(aufteilung?.prozent ?? ''),
  }))

  const [menge, setMenge] = useState(() => {
    switch (editor) {
      case 'correct': return String(inventory?.remaining_quantity ?? '')
      case 'reconstitution_ml': return String(inv?.reconstitution_ml ?? '')
      case 'use_within_days': return String(inv?.use_within_days ?? '')
      case 'open_new': return String(inventory?.reconstitution_ml ?? '')
      default: return ''
    }
  })
  const [start, setStart] = useState({
    packung: String(fallback?.package_quantity ?? ''),
    einheit: fallback?.package_unit ?? choices[0] ?? '',
    rest: String(fallback?.remaining_quantity ?? ''),
  })
  const [text, setText] = useState(() => {
    switch (editor) {
      case 'batch_number': return inv?.batch_number ?? ''
      case 'batch_source': return inv?.batch_source ?? ''
      case 'opened_at': return inv?.opened_at ?? heute()
      case 'expires_at': return inv?.expires_at ?? ''
      case 'open_new': return heute()
      default: return ''
    }
  })
  const [verwerfen, setVerwerfen] = useState(true)
  const [datei, setDatei] = useState<File | null>(null)

  const TITEL: Record<BestandEditorArt, string> = {
    start: String(t('my_stack_stock_start')),
    correct: String(t('my_stack_stock_edit')),
    open_new: art === 'vial' ? String(t('my_stack_stock_mix_new')) : art === 'pen' ? String(t('my_stack_stock_open_new_pen')) : String(t('my_stack_stock_open_new_bottle')),
    opened_at: String(t(art === 'vial' ? 'my_stack_stock_mixed_on' : 'my_stack_stock_opened_on')),
    reconstitution_ml: String(t('my_stack_stock_liquid')),
    use_within_days: String(t(art === 'vial' ? 'my_stack_stock_use_within_vial' : 'my_stack_stock_use_within')),
    batch_number: String(t('my_stack_stock_batch_number')),
    batch_source: String(t('my_stack_stock_source')),
    batch_file_url: String(t('my_stack_stock_document')),
    expires_at: String(t('my_stack_stock_expires')),
  }

  const zahlWert = zahl(menge)
  let gueltig = true
  let speichern: (() => Promise<void>) | null = null
  switch (editor) {
    case 'start': {
      const packung = zahl(start.packung)
      const rest = zahl(start.rest)
      gueltig = packung != null && packung > 0 && rest != null && rest >= 0 && Boolean(start.einheit)
      speichern = () => actions.start({ packageQuantity: packung!, packageUnit: start.einheit, remainingQuantity: rest! })
      break
    }
    case 'correct':
      if (aufteilung && inventory) {
        const voll = zahl(geteilt.voll)
        const prozent = zahl(geteilt.prozent.replace('%', ''))
        gueltig = voll != null && Number.isInteger(voll) && voll >= 0 && prozent != null && prozent >= 0 && prozent <= 100
        speichern = () => actions.update({
          remaining_quantity: bestandZusammensetzen(aufteilung, voll!, prozent!, inventory),
        })
      } else {
        gueltig = zahlWert != null && zahlWert >= 0
        speichern = () => actions.update({ remaining_quantity: zahlWert! })
      }
      break
    case 'open_new':
      gueltig = Boolean(text) && (art !== 'vial' || menge.trim() === '' || (zahlWert != null && zahlWert > 0))
      speichern = () => actions.openContainer({
        openedAt: text,
        discardRest: Boolean(teile?.angebrochen) && verwerfen,
        reconstitutionMl: art === 'vial' ? zahlWert : null,
      })
      break
    case 'reconstitution_ml':
      // Nicht leeren: beim Vial mit Altdaten kaeme sonst der alte Wert wieder
      // zum Vorschein (`withVialInventory`), und die Spritzeneinheiten mit ihm.
      gueltig = zahlWert != null && zahlWert > 0 && zahlWert <= 1000
      speichern = () => actions.update({ reconstitution_ml: zahlWert })
      break
    case 'use_within_days':
      gueltig = menge.trim() === '' || (zahlWert != null && Number.isInteger(zahlWert) && zahlWert >= 1 && zahlWert <= 3650)
      speichern = () => actions.update({ use_within_days: zahlWert })
      break
    case 'opened_at':
      speichern = () => actions.update({ opened_at: text || null })
      break
    case 'expires_at':
      speichern = () => actions.update({ expires_at: text || null })
      break
    case 'batch_number':
      speichern = () => actions.update({ batch_number: text.trim() || null })
      break
    case 'batch_source':
      speichern = () => actions.update({ batch_source: text.trim() || null })
      break
    case 'batch_file_url':
      gueltig = datei != null
      speichern = async () => {
        const url = await actions.uploadDocument(datei!)
        await actions.update({ batch_file_url: url })
      }
      break
  }

  const eingabe = 'input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
  const einheitText = (wert: number) => stockAmountLabel(t, wert, einheit, language)

  let body: ReactNode = null
  switch (editor) {
    case 'start':
      body = (
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
            {String(t('my_stack_stock_package_size'))}
            <input className={eingabe} inputMode="decimal" value={start.packung} onChange={event => setStart(s => ({ ...s, packung: event.target.value }))} autoFocus />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
            {String(t('my_stack_stock_unit'))}
            <select className={`select ${eingabe}`} value={start.einheit} onChange={event => setStart(s => ({ ...s, einheit: event.target.value }))}>
              {choices.map(unit => <option key={unit} value={unit}>{stockUnitName(t, unit)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
            {String(t('my_stack_stock_current'))}
            <input className={eingabe} inputMode="decimal" value={start.rest} onChange={event => setStart(s => ({ ...s, rest: event.target.value }))} />
          </label>
        </div>
      )
      break
    case 'correct': {
      const behaelter = art === 'vial' ? 'vial' : art === 'pen' ? 'pen' : 'bottle'
      body = (
        <div className="grid gap-4">
          {aufteilung ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
                {String(t(`my_stack_stock_unopened_${behaelter}`))}
                <input id={`${id}-voll`} className={eingabe} inputMode="numeric" value={geteilt.voll} onChange={event => setGeteilt(g => ({ ...g, voll: event.target.value }))} autoFocus />
              </label>
              <div className="grid gap-1.5">
                <label htmlFor={`${id}-prozent`} className="text-sm font-semibold text-slate-200">
                  {String(t(`my_stack_stock_opened_${behaelter}`))}
                </label>
                <span className="relative">
                  <input id={`${id}-prozent`} className={`${eingabe} pr-8`} inputMode="decimal" value={geteilt.prozent} onChange={event => setGeteilt(g => ({ ...g, prozent: event.target.value }))} />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </span>
              </div>
            </div>
          ) : (
            <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
              <span>{String(t('my_stack_stock_current'))} · {stockUnitName(t, einheit)}</span>
              <input id={`${id}-menge`} className={eingabe} inputMode="decimal" value={menge} onChange={event => setMenge(event.target.value)} autoFocus />
            </label>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(() => actions.update({ enabled: false }))}
            className="min-h-11 justify-self-center px-3 text-xs font-semibold text-slate-500 hover:text-slate-300"
          >
            {String(t('my_stack_stock_stop'))}
          </button>
        </div>
      )
      break
    }
    case 'reconstitution_ml':
      body = <input aria-label={TITEL[editor]} className={eingabe} inputMode="decimal" value={menge} onChange={event => setMenge(event.target.value)} autoFocus />
      break
    case 'use_within_days':
      body = (
        <div className="grid gap-3">
          <div className="grid grid-cols-4 gap-2">
            {(art ? HALTBAR_VORGABEN[art] : HALTBAR_VORGABEN.flasche).map(tage => (
              <button
                key={tage}
                type="button"
                aria-pressed={zahlWert === tage}
                onClick={() => setMenge(String(tage))}
                className={`min-h-11 rounded-xl border text-sm font-semibold ${zahlWert === tage ? 'border-sky-400/60 bg-sky-400/15 text-sky-100' : 'border-slate-700 text-slate-300'}`}
              >
                {daysLabel(t, tage)}
              </button>
            ))}
          </div>
          <input aria-label={TITEL[editor]} className={eingabe} inputMode="numeric" value={menge} onChange={event => setMenge(event.target.value)} />
        </div>
      )
      break
    case 'opened_at':
    case 'expires_at':
      body = <input aria-label={TITEL[editor]} type="date" className={eingabe} value={text} onChange={event => setText(event.target.value)} autoFocus />
      break
    case 'batch_number':
    case 'batch_source':
      body = <input aria-label={TITEL[editor]} className={eingabe} value={text} onChange={event => setText(event.target.value)} autoFocus />
      break
    case 'batch_file_url':
      body = (
        <div className="grid gap-3">
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 ${datei ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700'}`}>
            <FileUp size={20} aria-hidden="true" className={datei ? 'text-sky-400' : 'text-slate-500'} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{datei ? datei.name : String(t('my_stack_stock_document_pick'))}</span>
            <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={event => setDatei(event.target.files?.[0] ?? null)} />
          </label>
          {inv?.batch_file_url && (
            <div className="flex items-center gap-3 text-xs">
              <a className="flex-1 truncate text-sky-400 hover:underline" href={inv.batch_file_url} target="_blank" rel="noopener noreferrer">
                {String(t('my_stack_stock_document_show'))}
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSubmit(() => actions.update({ batch_file_url: null }))}
                className="min-h-11 px-2 text-rose-300"
              >
                {String(t('my_stack_stock_document_remove'))}
              </button>
            </div>
          )}
        </div>
      )
      break
    case 'open_new':
      body = (
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
            {String(t(art === 'vial' ? 'my_stack_stock_mixed_on' : 'my_stack_stock_opened_on'))}
            <input type="date" className={eingabe} value={text} onChange={event => setText(event.target.value)} />
          </label>
          {art === 'vial' && (
            <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
              {String(t('my_stack_stock_liquid'))} (ml)
              <input className={eingabe} inputMode="decimal" value={menge} onChange={event => setMenge(event.target.value)} />
            </label>
          )}
          {teile && teile.angebrochen > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 text-sm text-slate-200">
              <input type="checkbox" checked={verwerfen} onChange={event => setVerwerfen(event.target.checked)} className="h-5 w-5 accent-sky-400" />
              {String(t('my_stack_stock_discard_rest', {
                amount: teile.angebrochenAnteil != null && art === 'vial'
                  ? `${Math.round(teile.angebrochenAnteil * 100)} %`
                  : einheitText(teile.angebrochen),
              }))}
            </label>
          )}
        </div>
      )
      break
  }

  return (
    // Liegt ueber dem Vollbild: Zurueck (Geste, Android) und Escape schliessen
    // nur dieses Fenster, nicht das Vollbild darunter.
    <div data-app-modal className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-end" onClick={event => { event.stopPropagation(); onClose() }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={TITEL[editor]}
        className="flex w-full flex-col rounded-t-2xl border-t border-slate-700/60 bg-slate-900 sm:max-w-lg"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }}
        onSubmit={event => {
          event.preventDefault()
          if (gueltig && speichern && !busy) onSubmit(speichern)
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h3 className="text-base font-bold text-white">{TITEL[editor]}</h3>
          <button type="button" onClick={onClose} data-app-back-close aria-label={String(t('my_stack_stock_close'))} className="grid h-11 w-11 place-items-center text-slate-400 hover:text-white">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5">{body}</div>
        <div className="border-t border-slate-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="submit" className="btn-primary w-full" disabled={!gueltig || busy}>
            {String(t('my_stack_stock_save'))}
          </button>
        </div>
      </form>
    </div>
  )
}

export interface BestandEditorHostProps {
  editor: BestandEditorArt
  dosageForm: DosageFormKey
  inventory: StackItemInventory | null
  ingredients: StackItemIngredient[]
  onClose(): void
  actions: BestandActions
}

/**
 * Ein einzelnes Aenderungsfenster zum Bestand — aus der Bestand-Anzeige
 * („Bestand aendern") oder aus einer Angabe bei Zusammensetzung/Substanz.
 * Nach dem Speichern schliesst es; bei einem Fehler bleibt es offen (die
 * Meldung zeigt der Aufrufer).
 */
export function BestandEditorHost({ editor, dosageForm, inventory, ingredients, onClose, actions }: BestandEditorHostProps) {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const [busy, setBusy] = useState(false)
  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
      onClose()
    } catch {
      // Der Editor bleibt offen.
    } finally {
      setBusy(false)
    }
  }
  return (
    <BestandEditor
      editor={editor}
      art={anbruchArt(dosageForm)}
      inventory={inventory?.enabled ? inventory : null}
      fallback={inventory}
      choices={stockUnitChoices(dosageForm, ingredients)}
      busy={busy}
      language={language}
      onClose={onClose}
      onSubmit={work => { void run(work) }}
      actions={actions}
    />
  )
}

export interface BestandCardProps {
  dosageForm: DosageFormKey
  inventory: StackItemInventory | null
  ingredients: StackItemIngredient[]
  timelines: CycleTimeline[]
  timeZone: string
  now?: Date
  /** Bucht die Datenbank bestaetigte Einnahmen hier ab? Sonst ein Hinweis. */
  deductsIntakes?: boolean
  /** „Bestand aendern" bzw. „Bestand verfolgen", wenn noch keiner gefuehrt wird. */
  onEdit(editor: Extract<BestandEditorArt, 'correct' | 'start'>): void
}

/** Die Kurzfassung im Vollbild: was noch da ist und wie lange es reicht. */
export function BestandCard({ dosageForm, inventory, ingredients, timelines, timeZone, now, deductsIntakes = true, onEdit }: BestandCardProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const aktiv = inventory?.enabled ? inventory : null
  const range = useMemo(() => (
    aktiv ? reichweite({ inventory: aktiv, ingredients, timelines, now: now ?? new Date(), timeZone }) : null
  ), [aktiv, ingredients, timelines, now, timeZone])
  const zeilen = aktiv ? vorratZeilen(t, aktiv, anbruchArt(dosageForm), language) : null

  return (
    <div
      data-stack-detail="bestand"
      className="mx-1 mt-2 w-[calc(100%-0.5rem)] rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3"
    >
      <div className="flex items-center gap-3">
        <Package size={18} aria-hidden="true" className="shrink-0 text-sky-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{String(t('my_stack_stock_title'))}</span>
          {zeilen && aktiv ? (
            <>
              <span className="mt-0.5 block truncate text-sm font-semibold text-white">
                {zeilen.gross}{zeilen.klein ? <span className="font-normal text-slate-400"> · {zeilen.klein}</span> : null}
              </span>
              {range && <span className="mt-0.5 block truncate text-xs text-slate-400">{reichweiteLabel(t, range, aktiv.package_unit, language)}</span>}
              <BarFill fraction={zeilen.anteil} />
              {!deductsIntakes && <span className="mt-2 block text-xs text-amber-200/90">{String(t('my_stack_stock_needs_strength'))}</span>}
            </>
          ) : (
            <span className="mt-0.5 block text-sm text-slate-400">{String(t('my_stack_stock_not_tracked'))}</span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onEdit(aktiv ? 'correct' : 'start')}
        className="mt-3 min-h-11 w-full rounded-xl border border-sky-400/35 bg-sky-400/10 text-[13px] font-semibold text-sky-100 transition-colors hover:border-sky-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {String(t(aktiv ? 'my_stack_stock_edit' : 'my_stack_stock_start'))}
      </button>
    </div>
  )
}
