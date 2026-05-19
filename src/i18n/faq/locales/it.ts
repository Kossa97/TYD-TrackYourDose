import type { FaqBundle } from '../types'
import { itCategories } from './it.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} domande e risposte su tutte le funzioni',
    searchPlaceholder: 'Cerca una domanda…',
    emptySearch: 'Nessuna risposta per «{{query}}»',
    footer: 'Peptid Tracker · Solo per scopi di ricerca',
  },
  categories: itCategories,
} satisfies FaqBundle
