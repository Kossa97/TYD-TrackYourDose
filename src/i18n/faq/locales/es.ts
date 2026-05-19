import type { FaqBundle } from '../types'
import { esCategories } from './es.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} preguntas y respuestas sobre todas las funciones',
    searchPlaceholder: 'Buscar pregunta…',
    emptySearch: 'No hay respuesta para «{{query}}»',
    footer: 'Peptid Tracker · Solo para fines de investigación',
  },
  categories: esCategories,
} satisfies FaqBundle
