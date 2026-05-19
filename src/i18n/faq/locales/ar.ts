import type { FaqBundle } from '../types'
import { arCategories } from './ar.categories'

export default {
  ui: {
    pageTitle: 'الأسئلة الشائعة',
    subtitle: '{{count}} أسئلة وأجوبة حول كل الميزات',
    searchPlaceholder: 'ابحث في الأسئلة…',
    emptySearch: 'لا توجد إجابة لـ «{{query}}»',
    footer: 'Peptid Tracker · للأغراض البحثية فقط',
  },
  categories: arCategories,
} satisfies FaqBundle
