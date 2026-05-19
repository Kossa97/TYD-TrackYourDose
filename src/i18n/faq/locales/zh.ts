import type { FaqBundle } from '../types'
import { zhCategories } from './zh.categories'

export default {
  ui: {
    pageTitle: '常见问题',
    subtitle: '关于全部功能的 {{count}} 个问答',
    searchPlaceholder: '搜索问题…',
    emptySearch: '没有找到与「{{query}}」相关的回答',
    footer: 'Peptid Tracker · 仅供研究用途',
  },
  categories: zhCategories,
} satisfies FaqBundle
