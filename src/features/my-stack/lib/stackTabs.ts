import { STACK_CATEGORIES } from './categories'
import type { StackCategory } from '../types'

/**
 * Die Reiter ueber dem Karussell: „Alle" und die sechs Kategorien.
 *
 * ALLE sechs stehen immer da, auch die leeren. Ein leerer Reiter
 * „Medikamente" ist keine Luecke, sondern eine Auskunft: die App kann das
 * auch. Waeren nur die belegten zu sehen, erfuehre niemand, dass es die
 * anderen gibt — und der Platz jedes Reiters bliebe nicht, wo er war.
 */
export type StackTabKey = 'all' | StackCategory

export interface StackTab {
  key: StackTabKey
  labelKey: string
  defaultValue: string
}

const KATEGORIE_REITER: Record<StackCategory, { labelKey: string; defaultValue: string }> = {
  peptide: { labelKey: 'my_stack_tab_peptide', defaultValue: 'Peptide' },
  medication: { labelKey: 'my_stack_tab_medication', defaultValue: 'Medikamente' },
  hormone: { labelKey: 'my_stack_tab_hormone', defaultValue: 'Hormone' },
  supplement: { labelKey: 'my_stack_tab_supplement', defaultValue: 'Supplemente' },
  vitamin: { labelKey: 'my_stack_tab_vitamin', defaultValue: 'Vitamine' },
  other: { labelKey: 'my_stack_tab_other', defaultValue: 'Sonstiges' },
}

export const STACK_TABS: readonly StackTab[] = [
  { key: 'all', labelKey: 'alle', defaultValue: 'Alle' },
  ...STACK_CATEGORIES.map(kategorie => ({
    key: kategorie.key as StackTabKey,
    ...KATEGORIE_REITER[kategorie.key],
  })),
] as const

/** Zaehlt je Reiter, wie viel darin liegt — „Alle" traegt die Gesamtzahl. */
export function tabCounts(items: readonly { category: StackCategory }[]): Map<StackTabKey, number> {
  const zaehler = new Map<StackTabKey, number>([['all', items.length]])
  for (const reiter of STACK_CATEGORIES) zaehler.set(reiter.key, 0)
  for (const item of items) {
    zaehler.set(item.category, (zaehler.get(item.category) ?? 0) + 1)
  }
  return zaehler
}

export function filterByTab<T extends { category: StackCategory }>(
  items: readonly T[],
  tab: StackTabKey,
): T[] {
  return tab === 'all' ? [...items] : items.filter(item => item.category === tab)
}
