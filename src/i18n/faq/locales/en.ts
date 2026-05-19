import type { FaqBundle } from '../types'
import { enCategories } from './en.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} questions & answers about every feature',
    searchPlaceholder: 'Search questions…',
    emptySearch: 'No answer found for “{{query}}”',
    footer: 'Peptid Tracker · For research use only',
  },
  categories: enCategories,
} satisfies FaqBundle
