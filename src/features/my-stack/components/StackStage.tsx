import { useTranslation } from 'react-i18next'
import type { StackItem } from '../types'
import { isStageRenderable } from '../lib/dosageForms'
import { VialRenderer } from '../extensions/peptide/VialRenderer'
import type { VialRendererProps } from '../extensions/peptide/VialRenderer'

export interface StackStageProps extends Omit<VialRendererProps, 'item'> {
  item: StackItem
}

export function StackStage({ item, ...visualProps }: StackStageProps) {
  const { t } = useTranslation()

  if (isStageRenderable(item.dosage_form)) {
    return <VialRenderer item={item} {...visualProps} />
  }

  return (
    <div
      data-stack-renderer="unsupported"
      className="flex min-h-28 flex-col justify-center rounded-2xl border border-slate-700/70 bg-slate-950/80 px-5 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.32)]"
    >
      <p className="font-semibold text-white">{item.display_name}</p>
      <p className="mt-1 text-sm text-slate-400">{t('my_stack_visual_pending')}</p>
    </div>
  )
}
