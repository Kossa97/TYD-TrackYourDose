import { ChevronRight, FileUp, Package, X } from 'lucide-react'
import { format } from 'date-fns'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CycleTimeline } from '../../../lib/planTimeline'
import {
  anbruchArt,
  haltbarBis,
  reichweite,
  vorratTeile,
  type AnbruchArt,
  type Reichweite,
} from '../lib/bestand'
import { daysLabel, formatAmount, reichweiteLabel, stockAmountLabel, stockUnitChoices, stockUnitName, vorratZeilen } from '../lib/bestandLabels'
import { getDosageForm } from '../lib/dosageForms'
import { formatLocalDay } from '../lib/localDays'
import type { InventoryPatch } from '../services/stackInventory'
import type { DosageFormKey, StackItemIngredient, StackItemInventory } from '../types'

export interface BestandActions {
  start(input: { packageQuantity: number; packageUnit: string; remainingQuantity: number }): Promise<void>
  update(patch: InventoryPatch): Promise<void>
  addPackage(quantity: number): Promise<void>
  openContainer(input: { openedAt: string; discardRest: boolean; reconstitutionMl: number | null }): Promise<void>
  uploadDocument(file: File): Promise<string>
}

export interface BestandSheetProps {
  itemName: string
  dosageForm: DosageFormKey
  inventory: StackItemInventory | null
  ingredients: StackItemIngredient[]
  timelines: CycleTimeline[]
  timeZone: string
  /** Nur ohne Staerke bucht die Datenbank nicht ab — dann ein Hinweis. */
  deductsIntakes: boolean
  now?: Date
  onClose(): void
  actions: BestandActions
}

type Editor =
  | 'start' | 'correct' | 'add_package' | 'open_new'
  | 'opened_at' | 'reconstitution_ml' | 'use_within_days'
  | 'batch_number' | 'batch_source' | 'batch_file_url' | 'expires_at'

const HALTBAR_VORGABEN: Record<AnbruchArt, number[]> = {
  vial: [14, 21, 28, 42],
  pen: [14, 28, 30, 56],
  flasche: [30, 90, 180, 365],
}

/** „13.10." bzw. „10/13" — das Jahr ergibt sich aus dem Anmischdatum darueber. */
function kurzesDatum(day: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00.000Z`))
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

function Row({ label, value, muted, onClick }: { label: string; value: ReactNode; muted?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
    >
      <span className="flex-1 text-sm text-slate-300">{label}</span>
      <span className={`max-w-[60%] truncate text-sm font-semibold ${muted ? 'text-slate-500' : 'text-slate-100'}`}>{value}</span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-600" />
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-4 mt-4">
      <h3 className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{title}</h3>
      <div className="divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800 bg-slate-800/25">
        {children}
      </div>
    </section>
  )
}

export function BestandSheet({
  itemName,
  dosageForm,
  inventory,
  ingredients,
  timelines,
  timeZone,
  deductsIntakes,
  now,
  onClose,
  actions,
}: BestandSheetProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const titleId = useId()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [busy, setBusy] = useState(false)
  const art = anbruchArt(dosageForm)
  const aktiv = inventory?.enabled ? inventory : null
  const notSet = String(t('my_stack_stock_not_set'))

  const range: Reichweite | null = useMemo(() => (
    aktiv ? reichweite({ inventory: aktiv, ingredients, timelines, now: now ?? new Date(), timeZone }) : null
  ), [aktiv, ingredients, timelines, now, timeZone])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
      setEditor(null)
    } catch {
      // Die Meldung zeigt der Aufrufer; der Editor bleibt offen.
    } finally {
      setBusy(false)
    }
  }

  const formLabel = String(t(getDosageForm(dosageForm).labelKey))
  const zeilen = aktiv ? vorratZeilen(t, aktiv, art, language) : null
  const bis = aktiv ? haltbarBis(aktiv) : null

  const anbruchTitel = art ? String(t(`my_stack_stock_opened_${art === 'flasche' ? 'bottle' : art}`)) : ''
  const oeffnenText = art === 'vial'
    ? String(t('my_stack_stock_mix_new'))
    : art === 'pen'
      ? String(t('my_stack_stock_open_new_pen'))
      : String(t('my_stack_stock_open_new_bottle'))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80" data-app-modal onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-slate-900 pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[95vh] sm:max-w-lg sm:rounded-t-2xl sm:pt-0"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package size={18} aria-hidden="true" className="text-sky-400" />
            <div>
              <h2 id={titleId} className="text-lg font-bold text-white">{String(t('my_stack_stock_title'))}</h2>
              <p className="text-xs text-slate-400">{itemName} · {formLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-app-back-close
            aria-label={String(t('my_stack_stock_close'))}
            className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto pb-6">
          {!aktiv || !zeilen ? (
            <div className="mx-4 mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-base font-semibold text-white">{String(t('my_stack_stock_not_tracked'))}</p>
              <p className="mt-1 text-sm text-slate-400">{String(t('my_stack_stock_start_hint'))}</p>
              <button
                type="button"
                onClick={() => setEditor('start')}
                className="mt-3 min-h-11 w-full rounded-xl border border-sky-400/35 bg-sky-400/10 text-sm font-semibold text-sky-100"
              >
                {String(t('my_stack_stock_start'))}
              </button>
            </div>
          ) : (
            <>
              <div data-stock-summary className="mx-4 mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-[28px] font-bold leading-tight text-white">{zeilen.gross}</p>
                  {zeilen.klein && <p className="text-right text-xs text-slate-400">{zeilen.klein}</p>}
                </div>
                <BarFill fraction={zeilen.anteil} />
                {range && <p className="mt-2 text-xs text-slate-300">{reichweiteLabel(t, range, aktiv.package_unit, language)}</p>}
                {!deductsIntakes && <p className="mt-2 text-xs text-amber-200/90">{String(t('my_stack_stock_needs_strength'))}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditor('add_package')}
                    className="min-h-11 rounded-xl border border-sky-400/35 bg-sky-400/10 text-[13px] font-semibold text-sky-100"
                  >
                    {String(t('my_stack_stock_add_package'))}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor('correct')}
                    className="min-h-11 rounded-xl border border-slate-700 bg-slate-900/60 text-[13px] font-semibold text-slate-300"
                  >
                    {String(t('my_stack_stock_correct'))}
                  </button>
                </div>
              </div>

              {art && (
                <Group title={anbruchTitel}>
                  <Row
                    label={String(t(art === 'vial' ? 'my_stack_stock_mixed_on' : 'my_stack_stock_opened_on'))}
                    value={aktiv.opened_at ? formatLocalDay(aktiv.opened_at, language) : notSet}
                    muted={!aktiv.opened_at}
                    onClick={() => setEditor('opened_at')}
                  />
                  {art === 'vial' && (
                    <Row
                      label={String(t('my_stack_stock_liquid'))}
                      value={aktiv.reconstitution_ml ? `${formatAmount(aktiv.reconstitution_ml, language)} ml` : notSet}
                      muted={!aktiv.reconstitution_ml}
                      onClick={() => setEditor('reconstitution_ml')}
                    />
                  )}
                  <Row
                    label={String(t(art === 'vial' ? 'my_stack_stock_use_within_vial' : 'my_stack_stock_use_within'))}
                    value={aktiv.use_within_days
                      ? [daysLabel(t, aktiv.use_within_days), bis ? String(t('my_stack_stock_until', { date: kurzesDatum(bis, language) })) : null].filter(Boolean).join(' · ')
                      : notSet}
                    muted={!aktiv.use_within_days}
                    onClick={() => setEditor('use_within_days')}
                  />
                  <div className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setEditor('open_new')}
                      disabled={(aktiv.remaining_quantity ?? 0) <= 0}
                      className="min-h-11 w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-[13px] font-semibold text-emerald-100 disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-600"
                    >
                      {oeffnenText}
                    </button>
                  </div>
                </Group>
              )}

              <Group title={String(t('my_stack_stock_batch'))}>
                <Row label={String(t('my_stack_stock_batch_number'))} value={aktiv.batch_number || notSet} muted={!aktiv.batch_number} onClick={() => setEditor('batch_number')} />
                <Row label={String(t('my_stack_stock_source'))} value={aktiv.batch_source || notSet} muted={!aktiv.batch_source} onClick={() => setEditor('batch_source')} />
                <Row
                  label={String(t('my_stack_stock_document'))}
                  value={aktiv.batch_file_url ? decodeURIComponent(aktiv.batch_file_url.split('/').pop() ?? '') : notSet}
                  muted={!aktiv.batch_file_url}
                  onClick={() => setEditor('batch_file_url')}
                />
                <Row
                  label={String(t('my_stack_stock_expires'))}
                  value={aktiv.expires_at ? formatLocalDay(aktiv.expires_at, language) : notSet}
                  muted={!aktiv.expires_at}
                  onClick={() => setEditor('expires_at')}
                />
              </Group>

              <div className="mx-4 mt-6 text-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { void run(() => actions.update({ enabled: false })) }}
                  className="min-h-11 px-3 text-xs font-semibold text-slate-500 hover:text-slate-300"
                >
                  {String(t('my_stack_stock_stop'))}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {editor && (
        <BestandEditor
          editor={editor}
          art={art}
          inventory={aktiv}
          fallback={inventory}
          choices={stockUnitChoices(dosageForm, ingredients)}
          busy={busy}
          language={language}
          onClose={() => setEditor(null)}
          onSubmit={work => { void run(work) }}
          actions={actions}
        />
      )}
    </div>
  )
}

interface EditorProps {
  editor: Editor
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

  const [menge, setMenge] = useState(() => {
    switch (editor) {
      case 'correct': return String(inventory?.remaining_quantity ?? '')
      case 'add_package': return String(inventory?.package_quantity ?? '')
      case 'reconstitution_ml': return String(inventory?.reconstitution_ml ?? '')
      case 'use_within_days': return String(inventory?.use_within_days ?? '')
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
      case 'batch_number': return inventory?.batch_number ?? ''
      case 'batch_source': return inventory?.batch_source ?? ''
      case 'opened_at': return inventory?.opened_at ?? heute()
      case 'expires_at': return inventory?.expires_at ?? ''
      case 'open_new': return heute()
      default: return ''
    }
  })
  const [verwerfen, setVerwerfen] = useState(true)
  const [datei, setDatei] = useState<File | null>(null)

  const TITEL: Record<Editor, string> = {
    start: String(t('my_stack_stock_start')),
    correct: String(t('my_stack_stock_correct')),
    add_package: String(t('my_stack_stock_add_amount')),
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
      gueltig = zahlWert != null && zahlWert >= 0
      speichern = () => actions.update({ remaining_quantity: zahlWert! })
      break
    case 'add_package':
      gueltig = zahlWert != null && zahlWert > 0
      speichern = async () => {
        await actions.addPackage(zahlWert!)
        // Die Menge, die man zuletzt nachgekauft hat, ist die naechste Vorgabe.
        if (zahlWert !== inventory?.package_quantity) await actions.update({ package_quantity: zahlWert! })
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
      gueltig = menge.trim() === '' || (zahlWert != null && zahlWert > 0 && zahlWert <= 1000)
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
    case 'correct':
    case 'add_package':
      body = (
        <label className="grid gap-1.5 text-sm font-semibold text-slate-200">
          <span>{editor === 'correct' ? String(t('my_stack_stock_current')) : String(t('my_stack_stock_add_amount'))} · {stockUnitName(t, einheit)}</span>
          <input id={`${id}-menge`} className={eingabe} inputMode="decimal" value={menge} onChange={event => setMenge(event.target.value)} autoFocus />
        </label>
      )
      break
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
          {inventory?.batch_file_url && (
            <div className="flex items-center gap-3 text-xs">
              <a className="flex-1 truncate text-sky-400 hover:underline" href={inventory.batch_file_url} target="_blank" rel="noopener noreferrer">
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-end" onClick={event => { event.stopPropagation(); onClose() }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={TITEL[editor]}
        className="flex w-full flex-col rounded-t-2xl border-t border-slate-700/60 bg-slate-900 sm:max-w-lg"
        onClick={event => event.stopPropagation()}
        onSubmit={event => {
          event.preventDefault()
          if (gueltig && speichern && !busy) onSubmit(speichern)
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h3 className="text-base font-bold text-white">{TITEL[editor]}</h3>
          <button type="button" onClick={onClose} aria-label={String(t('my_stack_stock_close'))} className="grid h-11 w-11 place-items-center text-slate-400 hover:text-white">
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

export interface BestandCardProps {
  dosageForm: DosageFormKey
  inventory: StackItemInventory | null
  ingredients: StackItemIngredient[]
  timelines: CycleTimeline[]
  timeZone: string
  now?: Date
  onOpen(): void
}

/** Die Kurzfassung im Vollbild: was noch da ist und wie lange es reicht. */
export function BestandCard({ dosageForm, inventory, ingredients, timelines, timeZone, now, onOpen }: BestandCardProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const aktiv = inventory?.enabled ? inventory : null
  const range = useMemo(() => (
    aktiv ? reichweite({ inventory: aktiv, ingredients, timelines, now: now ?? new Date(), timeZone }) : null
  ), [aktiv, ingredients, timelines, now, timeZone])
  const zeilen = aktiv ? vorratZeilen(t, aktiv, anbruchArt(dosageForm), language) : null

  return (
    <button
      type="button"
      data-stack-detail="bestand"
      onClick={onOpen}
      className="mx-1 mt-2 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-3 text-left transition-colors hover:border-sky-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
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
          </>
        ) : (
          <span className="mt-0.5 block text-sm text-slate-400">{String(t('my_stack_stock_not_tracked'))}</span>
        )}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-600" />
    </button>
  )
}
