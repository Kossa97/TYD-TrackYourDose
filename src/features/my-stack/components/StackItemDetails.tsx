import { useTranslation } from 'react-i18next'
import { getDosageForm } from '../lib/dosageForms'
import type { StackItem } from '../types'

export interface StackItemDetailsProps {
  item: StackItem
  className?: string
}

export function StackItemDetails({ item, className = '' }: StackItemDetailsProps) {
  const { t } = useTranslation()
  const form = getDosageForm(item.dosage_form)

  return (
    <section
      data-stack-item-details={item.id}
      aria-labelledby={`stack-item-details-${item.id}`}
      className={`rounded-xl border border-slate-800 bg-slate-950/60 p-3 ${className}`}
    >
      <h3 id={`stack-item-details-${item.id}`} className="font-semibold text-white">
        {item.display_name}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-slate-500">{t('my_stack_category', { defaultValue: 'Kategorie' })}</dt>
          <dd className="mt-1 text-slate-200">{t(`stack_category_${item.category}`)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}</dt>
          <dd className="mt-1 text-slate-200">{t(form.labelKey)}</dd>
        </div>
        {item.ingredients.map(ingredient => (
          <div key={ingredient.position} className="col-span-2 border-t border-slate-800 pt-2">
            <dt className="text-slate-500">{ingredient.custom_name || item.display_name}</dt>
            <dd className="mt-1 break-words text-slate-200">
              {ingredient.amount_value ?? '-'} {ingredient.amount_unit ?? ''} / {ingredient.basis_value ?? '-'} {ingredient.basis_unit ?? ''}
            </dd>
          </div>
        ))}
        {item.brand && <div className="col-span-2"><dt className="text-slate-500">{t('my_stack_brand_optional', { defaultValue: 'Marke' })}</dt><dd className="mt-1 text-slate-200">{item.brand}</dd></div>}
        {item.notes && <div className="col-span-2"><dt className="text-slate-500">{t('my_stack_notes_optional', { defaultValue: 'Notizen' })}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{item.notes}</dd></div>}
      </dl>
    </section>
  )
}
