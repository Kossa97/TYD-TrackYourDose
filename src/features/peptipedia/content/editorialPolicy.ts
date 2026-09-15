import type { EditorialReview } from './types'

// This remains pending until real, external reviewers are documented.
export const PEPTIPEDIA_EDITORIAL_POLICY = Object.freeze({
  medical: 'pending',
  legal: 'pending',
} satisfies EditorialReview)
