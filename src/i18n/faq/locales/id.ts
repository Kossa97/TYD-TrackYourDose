import type { FaqBundle } from '../types'
import { idCategories } from './id.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '{{count}} pertanyaan & jawaban tentang semua fitur',
    searchPlaceholder: 'Cari pertanyaan…',
    emptySearch: 'Tidak ada jawaban untuk “{{query}}”',
    footer: 'Peptid Tracker · Hanya untuk tujuan penelitian',
  },
  categories: idCategories,
} satisfies FaqBundle
