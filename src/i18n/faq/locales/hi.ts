import type { FaqBundle } from '../types'
import { hiCategories } from './hi.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: 'सभी सुविधाओं पर {{count}} प्रश्न और उत्तर',
    searchPlaceholder: 'प्रश्न खोजें…',
    emptySearch: '«{{query}}» के लिए कोई उत्तर नहीं मिला',
    footer: 'Peptid Tracker · केवल शोध उद्देश्यों के लिए',
  },
  categories: hiCategories,
} satisfies FaqBundle
