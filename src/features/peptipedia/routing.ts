import type { PeptipediaLocale } from './content/types'

export type PeptipediaMode = 'public' | 'app'
export const peptipediaListPath = (locale: PeptipediaLocale, mode: PeptipediaMode = 'public') => mode === 'app' ? '/lab/peptipedia' : locale === 'en' ? '/en/peptipedia' : '/peptipedia'
export const peptipediaDetailPath = (locale: PeptipediaLocale, slug: string, mode: PeptipediaMode = 'public') => `${peptipediaListPath(locale, mode)}/${encodeURIComponent(slug)}`
export const legacySlug = (slug: string) => ({ semaglutide: 'semaglutid', tirzepatide: 'tirzepatid' })[slug] ?? slug
export const PEPTIPEDIA_TAB_IDS = ['overview', 'mechanism', 'protocols', 'calculator', 'safety', 'sources'] as const
export type PeptipediaTabId = typeof PEPTIPEDIA_TAB_IDS[number]
export const peptipediaTabs = (mode: PeptipediaMode) => PEPTIPEDIA_TAB_IDS.filter(id => mode === 'public' || id !== 'calculator')
export const TAB_HASHES: Record<PeptipediaLocale, Record<PeptipediaTabId, string>> = {
  de: { overview: 'ueberblick', mechanism: 'wirkung', protocols: 'studienprotokolle', calculator: 'rechner', safety: 'sicherheit', sources: 'quellen' },
  en: { overview: 'overview', mechanism: 'mechanism', protocols: 'study-protocols', calculator: 'calculator', safety: 'safety', sources: 'sources' },
}
export function tabFromHash(locale: PeptipediaLocale, hash: string): PeptipediaTabId {
  return PEPTIPEDIA_TAB_IDS.find(id => TAB_HASHES[locale][id] === hash.replace(/^#/, '')) ?? 'overview'
}
