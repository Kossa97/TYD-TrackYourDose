import type { FaqBundle } from '../types'
import { jaCategories } from './ja.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '全機能についての Q&A {{count}} 件',
    searchPlaceholder: '質問を検索…',
    emptySearch: '「{{query}}」に一致する回答がありません',
    footer: 'Peptid Tracker · 研究目的のみ',
  },
  categories: jaCategories,
} satisfies FaqBundle
