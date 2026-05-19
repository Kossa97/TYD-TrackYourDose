import type { FaqBundle } from '../types'
import { frCategories } from './fr.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} questions et réponses sur toutes les fonctionnalités',
    searchPlaceholder: 'Rechercher une question…',
    emptySearch: 'Aucune réponse pour « {{query}} »',
    footer: 'Peptid Tracker · Uniquement à des fins de recherche',
  },
  categories: frCategories,
} satisfies FaqBundle
