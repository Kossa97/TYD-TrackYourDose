import { useTranslation } from 'react-i18next'
import { Plus, CalendarPlus } from 'lucide-react'
import type { TrackingLevel } from '../types'
import { dosePlanCapabilities } from '../lib/dosePlan'

export function DosePlanActions({
  trackingLevel,
  onPermanent,
  onTitration,
}: {
  trackingLevel: TrackingLevel
  onPermanent: () => void
  onTitration: () => void
}) {
  const { t } = useTranslation()
  const capabilities = dosePlanCapabilities(trackingLevel)
  if (!capabilities.permanent) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={onPermanent}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <CalendarPlus size={13} aria-hidden="true" /> {t('dose_plan_new_standard', { defaultValue: 'Neue Standarddosis ab …' })}
      </button>
      <button
        type="button"
        onClick={onTitration}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-semibold text-orange-300 transition-colors hover:border-orange-400/50 hover:bg-orange-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        <Plus size={13} aria-hidden="true" /> {t('dose_plan_add_titration', { defaultValue: 'Titrationsschritt hinzufügen' })}
      </button>
    </div>
  )
}
