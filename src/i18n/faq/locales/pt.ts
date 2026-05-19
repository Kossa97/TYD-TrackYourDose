import type { FaqBundle } from '../types'
import { ptCategories } from './pt.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} perguntas e respostas sobre todos os recursos',
    searchPlaceholder: 'Pesquisar pergunta…',
    emptySearch: 'Nenhuma resposta para «{{query}}»',
    footer: 'Peptid Tracker · Apenas para fins de pesquisa',
  },
  categories: ptCategories,
} satisfies FaqBundle
