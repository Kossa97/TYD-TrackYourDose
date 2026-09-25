import type { Translate } from './planLabels'
import { formatLocalDay } from './localDays'
import type { Reichweite } from './bestand'

/** Texte zum Bestand — Zahlen mit Einheit, Reichweite. */

const BEKANNTE_EINHEITEN = new Set([
  'vial', 'tablet', 'capsule', 'drop', 'ml', 'spray', 'dose', 'patch',
  'g', 'portion', 'application', 'ampoule', 'unit', 'hour',
])

export function formatAmount(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)
}

/**
 * „3 Vials", „1 Tablette", „30 ml". Einzahl nur bei genau 1; eine unbekannte
 * Einheit (frei eingegeben) steht, wie sie gespeichert ist.
 */
export function stockAmountLabel(t: Translate, value: number, unit: string | null, language: string): string {
  const count = formatAmount(value, language)
  if (!unit) return count
  if (!BEKANNTE_EINHEITEN.has(unit)) return `${count} ${unit}`
  const form = value === 1 ? 'single' : 'multiple'
  return String(t(`my_stack_stock_unit_${unit}_${form}`, { n: count }))
}

/** Nur das Wort der Einheit, in der Mehrzahl: „Vials", „Tabletten". */
export function stockUnitName(t: Translate, unit: string): string {
  if (!BEKANNTE_EINHEITEN.has(unit)) return unit
  return String(t(`my_stack_stock_unit_${unit}_multiple`, { n: '' })).trim()
}

export function daysLabel(t: Translate, days: number): string {
  return String(t(days === 1 ? 'my_stack_stock_days_single' : 'my_stack_stock_days_multiple', { n: days }))
}

export function reichweiteLabel(
  t: Translate,
  range: Reichweite,
  unit: string | null,
  language: string,
): string {
  switch (range.art) {
    case 'tage':
      return String(t(range.tage === 1 ? 'my_stack_stock_range_days_single' : 'my_stack_stock_range_days_multiple', {
        n: range.tage,
        date: formatLocalDay(range.bis, language),
      }))
    case 'laenger':
      return String(t('my_stack_stock_range_longer', { n: range.tage }))
    case 'kein_plan':
      return String(t('my_stack_stock_range_no_plan'))
    case 'unbekannt':
      return String(t('my_stack_stock_range_unknown', { unit: unit ?? '' }))
    case 'leer':
      return String(t('my_stack_stock_empty'))
  }
}
