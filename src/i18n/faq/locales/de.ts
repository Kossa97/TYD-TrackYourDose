import type { FaqBundle } from '../types'
import { deCategories } from './de.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} Fragen & Antworten zu allen Funktionen',
    searchPlaceholder: 'Frage suchen…',
    emptySearch: 'Keine Antwort gefunden für „{{query}}“',
    footer: 'Peptid Tracker · Nur für Forschungszwecke',
  },
  categories: deCategories,
} satisfies FaqBundle
