import type { FaqBundle } from '../types'
import { ruCategories } from './ru.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} вопросов и ответов обо всех функциях',
    searchPlaceholder: 'Поиск по вопросам…',
    emptySearch: 'Нет ответа для «{{query}}»',
    footer: 'Peptid Tracker · Только для исследовательских целей',
  },
  categories: ruCategories,
} satisfies FaqBundle
