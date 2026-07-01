// Zentrale date-fns-Locale zur aktiven UI-Sprache — lazy geladen, damit nicht
// alle 14 Locales im Haupt-Bundle landen. Wird von src/i18n/index.ts beim Start
// und bei jedem Sprachwechsel aktualisiert; Komponenten lesen synchron via
// getDateLocale().

import type { Locale } from 'date-fns'
import { enUS } from 'date-fns/locale'

const LOADERS: Record<string, () => Promise<Locale>> = {
  de: () => import('date-fns/locale/de').then(m => m.de),
  en: () => import('date-fns/locale/en-US').then(m => m.enUS),
  es: () => import('date-fns/locale/es').then(m => m.es),
  fr: () => import('date-fns/locale/fr').then(m => m.fr),
  it: () => import('date-fns/locale/it').then(m => m.it),
  pt: () => import('date-fns/locale/pt').then(m => m.pt),
  ru: () => import('date-fns/locale/ru').then(m => m.ru),
  tr: () => import('date-fns/locale/tr').then(m => m.tr),
  ar: () => import('date-fns/locale/ar').then(m => m.ar),
  hi: () => import('date-fns/locale/hi').then(m => m.hi),
  id: () => import('date-fns/locale/id').then(m => m.id),
  zh: () => import('date-fns/locale/zh-CN').then(m => m.zhCN),
  ja: () => import('date-fns/locale/ja').then(m => m.ja),
  ko: () => import('date-fns/locale/ko').then(m => m.ko),
}

let current: Locale = enUS
let currentCode = 'en'

/** date-fns-Locale der aktiven Sprache (synchron; enUS bis zum ersten Laden). */
export function getDateLocale(): Locale {
  return current
}

/**
 * Lädt die date-fns-Locale für `lang` nach. Gibt true zurück, wenn sich die
 * Locale geändert hat (Aufrufer kann dann ein Re-Render anstoßen).
 */
export async function loadDateLocale(lang: string | undefined): Promise<boolean> {
  const code = (lang || 'en').split('-')[0].toLowerCase()
  if (code === currentCode) return false
  const loader = LOADERS[code]
  const next = loader ? await loader().catch(() => enUS) : enUS
  currentCode = code
  current = next
  return true
}
