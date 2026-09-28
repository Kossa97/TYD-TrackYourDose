import type { ReactNode } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { FEATURES } from '../../../config/features'
import { type CycleTimeline } from '../../../lib/planTimeline'
import { type Peptide } from './model'

/**
 * Plan & Verlauf eines Eintrags (Plan-Zeitleiste): alle Zyklen mit ihren Stufen, Pausen und Aktionen.
 */
export function PlanOverviewSheet({
  currentCycleManagerPeptide,
  setCycleManagerPeptide,
  planManagementSections,
  timelinesOf,
}: {
  currentCycleManagerPeptide: Peptide | null
  setCycleManagerPeptide: Dispatch<SetStateAction<Peptide | null>>
  planManagementSections: (p: Peptide, timelines: CycleTimeline[]) => ReactNode
  timelinesOf: (stackItemId: string) => CycleTimeline[]
}) {
  const { t } = useTranslation()
  return (
    <>
      {currentCycleManagerPeptide && FEATURES.planTimelineV2 && (
        <div className="fixed inset-0 z-50 flex justify-center bg-slate-950" data-app-modal>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-slate-950">
            <div className="shrink-0 border-b border-slate-800 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                    {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-bold text-white">{currentCycleManagerPeptide.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCycleManagerPeptide(null)}
                  data-app-back-close
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                  aria-label={t('close')}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {planManagementSections(
                currentCycleManagerPeptide,
                timelinesOf(currentCycleManagerPeptide.id)
                  .filter(timeline => currentCycleManagerPeptide.configuration_status !== 'needs_review' || timeline.cycle.timezone_review_required || timeline.cycle.ended_at === null || new Date(timeline.cycle.ended_at) > new Date()),
              )}
              {timelinesOf(currentCycleManagerPeptide.id).length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                  <p className="text-sm font-semibold text-white">{t('noch_kein_zyklus')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('noch_kein_zyklus_desc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
