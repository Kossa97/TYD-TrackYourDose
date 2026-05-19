export interface FaqUiStrings {
  pageTitle: string
  /** Use {{count}} placeholder */
  subtitle: string
  searchPlaceholder: string
  /** Use {{query}} for the user's search text */
  emptySearch: string
  footer: string
}

export interface FaqItem {
  q: string
  a: string | string[]
}

export interface FaqCategory {
  id: string
  title: string
  items: FaqItem[]
}

export interface FaqBundle {
  ui: FaqUiStrings
  categories: FaqCategory[]
}
