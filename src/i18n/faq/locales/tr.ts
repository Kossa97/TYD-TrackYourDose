import type { FaqBundle } from '../types'
import { trCategories } from './tr.categories'

export default {
  ui: {
    pageTitle: 'SSS',
    subtitle: 'Tüm özellikler hakkında {{count}} soru ve yanıt',
    searchPlaceholder: 'Soru ara…',
    emptySearch: '“{{query}}” için yanıt bulunamadı',
    footer: 'Peptid Tracker · Yalnızca araştırma amaçlıdır',
  },
  categories: trCategories,
} satisfies FaqBundle
