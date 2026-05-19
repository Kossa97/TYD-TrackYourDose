import type { FaqBundle } from '../types'
import { koCategories } from './ko.categories'

export default {
  ui: {
    pageTitle: 'FAQ',
    subtitle: '모든 기능에 대한 질문과 답변 {{count}}개',
    searchPlaceholder: '질문 검색…',
    emptySearch: '“{{query}}”에 대한 답변을 찾지 못했습니다',
    footer: 'Peptid Tracker · 연구 목적으로만 사용',
  },
  categories: koCategories,
} satisfies FaqBundle
