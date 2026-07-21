import type { StackCategory } from '../types'

export interface StackCategoryDefinition {
  readonly key: StackCategory
  readonly labelKey: string
}

export const STACK_CATEGORIES: readonly StackCategoryDefinition[] = [
  { key: 'peptide', labelKey: 'stack_category_peptide' },
  { key: 'medication', labelKey: 'stack_category_medication' },
  { key: 'hormone', labelKey: 'stack_category_hormone' },
  { key: 'supplement', labelKey: 'stack_category_supplement' },
  { key: 'vitamin', labelKey: 'stack_category_vitamin' },
] as const
