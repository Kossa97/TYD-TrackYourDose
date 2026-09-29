import type { ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { InventoryItem } from './model'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Minus,
  Trash2,
  Pencil,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Bell,
  SlidersHorizontal,
  FileText,
  RefreshCw,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { NewDot } from '../../../components/NewDot'
import { format, parseISO } from 'date-fns'
import { SloshProvider } from '../../../components/SloshContext'
import { expiryDaysLeft } from '../../../lib/peptideExpiry'
import { StackStage } from '../components/StackStage'
import { type LoadedStackItemIngredient } from '../services/stackItems'
import { isStageRenderable } from '../lib/dosageForms'
import { methodLabel } from '../../../lib/intakeMethods'
import { denyProps } from '../../../lib/denyFeedback'
import { getStableStackItemColor } from '../lib/colors'
import { dosePlanCapabilities } from '../lib/dosePlan'
import { FEATURES } from '../../../config/features'
import { type CycleTimeline } from '../../../lib/planTimeline'
import {
  type Peptide,
  getVialFillPct,
  INTAKE_TIME_CONFIG,
  presentedTimelines,
  type CycleView,
} from './model'
import { DosePlanActions } from './DosePlanActions'

/**
 * Listenansicht: je Substanz eine aufklappbare Karte mit Zyklen, Bestand und Aktionen — und die Substanzen ohne Buehnengrafik neben dem Karussell.
 */
export function StackListView({
  cycleView,
  loading,
  listPeptides,
  sloshEngine,
  timelinesOf,
  expandedId,
  inventory,
  animationEpoch,
  setExpandedId,
  adjustInventoryCount,
  setInfoPeptide,
  dismissInfoBtn,
  infoBtnNew,
  openEditPeptide,
  handleRekonstitution,
  removePeptide,
  zyklusBtnNew,
  planManagementSections,
}: {
  cycleView: CycleView
  loading: boolean
  listPeptides: Peptide[]
  sloshEngine: SloshEngine
  timelinesOf: (stackItemId: string) => CycleTimeline[]
  expandedId: string | null
  inventory: InventoryItem[]
  animationEpoch: number
  setExpandedId: Dispatch<SetStateAction<string | null>>
  adjustInventoryCount: (id: string, delta: number, current: number) => Promise<void>
  setInfoPeptide: Dispatch<SetStateAction<Peptide | null>>
  dismissInfoBtn: () => void
  infoBtnNew: boolean
  openEditPeptide: (p: Peptide) => void
  handleRekonstitution: (p: Peptide) => void
  removePeptide: (id: string) => void
  zyklusBtnNew: boolean
  planManagementSections: (p: Peptide, timelines: CycleTimeline[]) => ReactNode
}) {
  const { t } = useTranslation()
  const {
    cyclesOf,
    escalationsOf,
    openNewCycle,
    dismissZyklusBtn,
    openEditCycle,
    removeCycle,
    toggleCycleActive,
    currentQuantityLabel,
    freqLabel,
    intakeLabel,
    plannedQuantityRows,
    doseAdjustmentIcon,
    escalationQuantityLabel,
    escalationIsActive,
    escLabel,
    openEditEsc,
    removeEsc,
    openNewEsc,
    reminderLabel,
  } = cycleView
  return (
    <>
      <div className={`space-y-3 ${!loading && listPeptides.length > 0 ? '' : 'hidden'}`}>
        {/* Share the page slosh engine so list vials get the ambient living
            surface ripple. No impulses are pushed here, so the liquid never
            tilts/sloshes — only the surface breathes at rest. */}
        <SloshProvider engine={sloshEngine}>
        {listPeptides.map(p => {
          const pCycles   = cyclesOf(p.id)
          const pTimelines = timelinesOf(p.id)
          const shownTimelines = presentedTimelines(p, pTimelines)
          const planCount = FEATURES.planTimelineV2 ? pTimelines.length : pCycles.length
          const isOpen    = expandedId === p.id
          const hasActive = pCycles.some(c => c.active)
          const stageRenderable = isStageRenderable(p.dosage_form)
          const vialPct = getVialFillPct(p)
          const peptideColor = p.color_hex ?? getStableStackItemColor(p.id)
          const invItem = p.inventory_item_id ? inventory.find(i => i.id === p.inventory_item_id) : null

          return (
            <div key={p.id} className="card bg-slate-950">
              {/* Kopfzeile */}
              <div className="flex items-start gap-3">
                {stageRenderable && (
                  <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
                    <StackStage
                      key={animationEpoch}
                      item={{ ...p, color_hex: peptideColor }}
                      fillPct={vialPct ?? 100}
                      animateOnMount={true}
                      isActive={false}
                      size="mini"
                      showLabel={false}
                    />
                    {vialPct !== null && (
                      <span className="text-[10px] font-bold tabular-nums leading-none text-slate-500">
                        {Math.round(vialPct)}%
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isOpen ? null : p.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isOpen ? null : p.id) } }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{p.name}</p>
                      {hasActive && <span className="badge bg-emerald-500/10 text-emerald-400">{t('aktiv_badge')}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-1">
                      {stageRenderable ? (
                        <>
                          <span>{methodLabel(t, p.default_method)}</span>
                          {p.vial_amount_mg && <span>Vial: {p.vial_amount_mg} {p.vial_amount_unit ?? 'mg'}</span>}
                        </>
                      ) : (
                        <>
                          <span>{t(`dosage_form_${p.dosage_form}`)}</span>
                          {p.ingredients.map(ingredient => {
                            const loadedIngredient = ingredient as LoadedStackItemIngredient
                            const ingredientName = ingredient.custom_name || loadedIngredient.substance_catalog?.canonical_name || p.name
                            return (
                              <span key={ingredient.id ?? ingredient.position}>
                                {ingredientName}: {ingredient.amount_value ?? '-'} {ingredient.amount_unit ?? ''} / {ingredient.basis_value ?? '-'} {ingredient.basis_unit ?? ''}
                              </span>
                            )
                          })}
                        </>
                      )}
                    </div>

                    {(() => {
                      const days = expiryDaysLeft(p)
                      if (days === null) return null
                      const cls  = days > 7 ? 'text-emerald-400' : days >= 0 ? 'text-amber-400' : 'text-red-400'
                      return (
                        <p className={`text-xs mt-0.5 ${cls}`}>
                          {days > 0 ? (days === 1 ? t('haltbar_noch_1') : t('haltbar_noch_n', { n: days })) : days === 0 ? t('my_stack_expires_today') : t('abgelaufen_warn')}
                        </p>
                      )
                    })()}

                    {invItem && (
                      <div
                        className="mt-0.5 flex items-center gap-2"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {t('vials_vorratig', { n: invItem.vials_count })}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); if (invItem.vials_count > 0) adjustInventoryCount(invItem.id, -1, invItem.vials_count) }}
                            {...denyProps(invItem.vials_count <= 0)}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 aria-disabled:opacity-25 aria-disabled:hover:bg-transparent"
                          >
                            <Minus size={10} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); adjustInventoryCount(invItem.id, +1, invItem.vials_count) }}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                            style={{ color: peptideColor }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="relative p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                      title="Infos" onClick={() => { setInfoPeptide(p); dismissInfoBtn() }}>
                      <FileText size={15} />
                      {infoBtnNew && <NewDot className="absolute -top-0.5 -right-0.5" />}
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                      aria-label={t('bearbeiten')}
                      onClick={() => openEditPeptide(p)}><Pencil size={15} /></button>
                    {p.inventory_item_id && (
                      <button
                        className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                        title={t('rekonstitution_wdh')}
                        onClick={(e) => { e.stopPropagation(); handleRekonstitution(p) }}
                      >
                        <RefreshCw size={15} />
                      </button>
                    )}
                    <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                      aria-label={t('loeschen')}
                      onClick={() => removePeptide(p.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>

              {/* Zyklus-Zeile */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {planCount > 0 ? (planCount === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: planCount })) : t('keine_zyklen')}
                </button>
                <button
                  data-ob="btn-zyklus-add"
                  onClick={() => { openNewCycle(p); dismissZyklusBtn() }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors text-xs font-medium">
                  {t('zyklus_hinzufuegen')}
                  {zyklusBtnNew && <NewDot />}
                </button>
              </div>

              {/* Ausgeklappt: Zyklen */}
              {isOpen && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <CalendarDays size={14} className="text-violet-400" /> {t('zyklen_header')}
                    </span>
                  </div>
                  {planCount === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">
                      {t('noch_kein_zyklus')}
                    </p>
                  )}
                  {FEATURES.planTimelineV2 && planManagementSections(p, shownTimelines)}
                  {!FEATURES.planTimelineV2 && pCycles.map(c => {
                    const pEscs = escalationsOf(c.id)
                    return (
                      <div data-cycle-id={c.id} key={c.id} className={`rounded-xl border ${c.active ? 'border-violet-500/30 bg-violet-500/5' : 'border-slate-800 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-2 p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{c.name}</p>
                            <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-0.5">
                              {dosePlanCapabilities(p.tracking_level).permanent && (
                                <span className="font-medium text-slate-300">{currentQuantityLabel(c)}</span>
                              )}
                              <span>{methodLabel(t, c.method)}</span>
                              <span>{freqLabel(c)}</span>
                              {(() => { const lbl = intakeLabel(c); const firstKey = c.intake_time?.split(',')[0] ?? ''; const SlotIcon = (INTAKE_TIME_CONFIG as Record<string,{icon:LucideIcon}>)[firstKey]?.icon ?? Clock; return lbl ? <span className="text-amber-400 inline-flex items-center gap-1"><SlotIcon size={12} /> {lbl}</span> : null })()}
                              <span>{t('ab_datum', { date: format(parseISO(c.start_date), 'dd.MM.yyyy') })}</span>
                              {c.end_date && <span>{t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}</span>}
                            </div>
                            {reminderLabel(c) && (
                              <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap text-sky-400">
                                <Bell size={10} className="shrink-0" />
                                {reminderLabel(c)}
                              </p>
                            )}
                            {dosePlanCapabilities(p.tracking_level).permanent && plannedQuantityRows(c)}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleCycleActive(c)} title={c.active ? t('deaktivieren_title') : t('aktivieren_title')}
                              className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium transition-colors ${c.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {c.active ? t('aktiv_badge') : t('inaktiv_badge')}
                              </span>
                              <div className={`relative w-9 h-5 rounded-full transition-colors ${c.active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${c.active ? 'left-4' : 'left-0.5'}`} />
                              </div>
                            </button>
                            <button
                              className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                              aria-label={t('bearbeiten')}
                              onClick={() => openEditCycle(p, c.id)}
                            ><Pencil size={13} /></button>
                            <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                              onClick={() => removeCycle(c.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>

                        {dosePlanCapabilities(p.tracking_level).titration && (
                        /* Dosisanpassungen */
                        <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                              <SlidersHorizontal size={12} className="text-orange-400" /> {t('dosiserhoehungen')}
                            </span>
                          </div>
                          {pEscs.length === 0 && (
                            <p className="text-slate-600 text-xs italic">{t('keine_dosiserhoehungen')}</p>
                          )}
                          <div className="space-y-1.5">
                            {pEscs.map((e, idx) => {
                              const AdjustmentIcon = doseAdjustmentIcon(c, e)
                              return (
                                <div key={e.id} className="flex items-center justify-between gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-orange-400 text-xs font-bold shrink-0">#{idx + 1}</span>
                                    <div className="min-w-0">
                                      <span className="inline-flex items-center gap-1 text-white text-xs font-medium">
                                        <AdjustmentIcon size={11} /> {escalationQuantityLabel(c, e)}
                                      </span>
                                      {!escalationIsActive(c, e) && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('dose_plan_planned', { defaultValue: 'Geplant' })}</span>}
                                      <span className="text-slate-400 text-xs ml-2">{escLabel(e)}</span>
                                      {e.notes && <p className="text-slate-500 text-xs truncate">{e.notes}</p>}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <button className="p-1 text-slate-500 hover:text-sky-400 transition-colors"
                                      onClick={() => openEditEsc(c, e)}><Pencil size={11} /></button>
                                    <button className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                      onClick={() => removeEsc(e.id)}><Trash2 size={11} /></button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="mt-2">
                            <DosePlanActions
                              trackingLevel={p.tracking_level}
                              onPermanent={() => openEditCycle(p, c.id)}
                              onTitration={() => openNewEsc(c)}
                            />
                          </div>
                        </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        </SloshProvider>
      </div>
    </>
  )
}
