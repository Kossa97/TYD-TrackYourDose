import { ChevronDown, Package } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InventoryDraft } from '../types'

interface ProductInventorySectionProps {
  brand: string
  inventory: InventoryDraft
  onBrandChange: (brand: string) => void
  onInventoryChange: (changes: Partial<InventoryDraft>) => void
}

function numberValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function ProductInventorySection({
  brand,
  inventory,
  onBrandChange,
  onInventoryChange,
}: ProductInventorySectionProps) {
  const { t } = useTranslation()
  const contentId = useId()
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(current => !current)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-100 transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
      >
        <span className="flex items-center gap-2">
          <Package size={17} aria-hidden="true" className="text-sky-300" />
          {t('my_stack_product_inventory', { defaultValue: 'Produkt & Bestand' })}
        </span>
        <ChevronDown
          size={17}
          aria-hidden="true"
          className={`text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id={contentId} className="space-y-4 border-t border-white/10 p-4">
          <div>
            <label htmlFor={`${contentId}-brand`} className="mb-2 block text-sm font-semibold text-slate-200">
              {t('my_stack_brand_optional', { defaultValue: 'Marke (optional)' })}
            </label>
            <input
              id={`${contentId}-brand`}
              value={brand}
              onChange={event => onBrandChange(event.target.value)}
              className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-slate-200">
            <input
              type="checkbox"
              aria-label={String(t('my_stack_inventory_enabled', { defaultValue: 'Bestand mitverfolgen' }))}
              checked={inventory.enabled}
              onChange={event => onInventoryChange({ enabled: event.target.checked })}
              className="h-5 w-5 cursor-pointer accent-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            />
            {t('my_stack_inventory_enabled', { defaultValue: 'Bestand mitverfolgen' })}
          </label>

          {inventory.enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${contentId}-package-quantity`} className="mb-2 block text-sm font-semibold text-slate-200">
                  {t('my_stack_package_quantity', { defaultValue: 'Packungsgröße' })}
                </label>
                <input
                  id={`${contentId}-package-quantity`}
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={inventory.packageQuantity ?? ''}
                  onChange={event => onInventoryChange({ packageQuantity: numberValue(event.target.value) })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-package-unit`} className="mb-2 block text-sm font-semibold text-slate-200">
                  {t('my_stack_package_unit', { defaultValue: 'Packungseinheit' })}
                </label>
                <input
                  id={`${contentId}-package-unit`}
                  required
                  value={inventory.packageUnit ?? ''}
                  onChange={event => onInventoryChange({ packageUnit: event.target.value })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-remaining`} className="mb-2 block text-sm font-semibold text-slate-200">
                  {t('my_stack_remaining_quantity', { defaultValue: 'Aktueller Bestand' })}
                </label>
                <input
                  id={`${contentId}-remaining`}
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={inventory.remainingQuantity ?? ''}
                  onChange={event => onInventoryChange({ remainingQuantity: numberValue(event.target.value) })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div>
                <label htmlFor={`${contentId}-batch`} className="mb-2 block text-sm font-semibold text-slate-200">
                  {t('my_stack_batch_number_optional', { defaultValue: 'Chargennummer (optional)' })}
                </label>
                <input
                  id={`${contentId}-batch`}
                  value={inventory.batchNumber}
                  onChange={event => onInventoryChange({ batchNumber: event.target.value })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${contentId}-expires`} className="mb-2 block text-sm font-semibold text-slate-200">
                  {t('my_stack_expires_at_optional', { defaultValue: 'Ablaufdatum (optional)' })}
                </label>
                <input
                  id={`${contentId}-expires`}
                  type="date"
                  value={inventory.expiresAt ?? ''}
                  onChange={event => onInventoryChange({ expiresAt: event.target.value || null })}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
