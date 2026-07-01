import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { loadDateLocale } from './dateLocales'

export const LANGUAGES = [
  { code: 'de', name: 'Deutsch',            flag: '🇩🇪' },
  { code: 'en', name: 'English',            flag: '🇬🇧' },
  { code: 'es', name: 'Español',            flag: '🇪🇸' },
  { code: 'fr', name: 'Français',           flag: '🇫🇷' },
  { code: 'it', name: 'Italiano',           flag: '🇮🇹' },
  { code: 'pt', name: 'Português',          flag: '🇧🇷' },
  { code: 'ru', name: 'Русский',            flag: '🇷🇺' },
  { code: 'tr', name: 'Türkçe',             flag: '🇹🇷' },
  { code: 'ar', name: 'العربية',            flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी',             flag: '🇮🇳' },
  { code: 'id', name: 'Bahasa Indonesia',   flag: '🇮🇩' },
  { code: 'zh', name: '中文',               flag: '🇨🇳' },
  { code: 'ja', name: '日本語',             flag: '🇯🇵' },
  { code: 'ko', name: '한국어',             flag: '🇰🇷' },
]

// RTL-Sprachen
export const RTL_LANGUAGES = ['ar']

// Locale-JSONs als Lazy-Chunks: Es werden nur aktive Sprache + Fallback (de)
// geladen statt aller 14 Bundles (~600 kB) im Haupt-Bundle.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json')

const lazyJsonBackend = {
  type: 'backend' as const,
  init() {},
  read(lng: string, _ns: string, callback: (err: unknown, data?: unknown) => void) {
    const loader = localeModules[`./locales/${lng}.json`]
    if (!loader) {
      callback(new Error(`Kein Locale-Bundle für "${lng}"`))
      return
    }
    loader().then(m => callback(null, m.default)).catch(err => callback(err))
  },
}

/** Resolves, sobald aktive Sprache + Fallback + date-fns-Locale geladen sind. */
export const i18nReady = i18n
  .use(lazyJsonBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: LANGUAGES.map(l => l.code),
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',            // 'de-DE' → Bundle 'de'
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tyd_lang',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },   // Bundles laden asynchron; kein Suspense nötig
  })
  .then(() => loadDateLocale(i18n.language))

// Bei Sprachwechsel passende date-fns-Locale nachziehen. Das erneute Emit stößt
// ein Re-Render der useTranslation-Komponenten an, sobald die Locale da ist;
// beim zweiten Durchlauf ändert sich nichts mehr (loadDateLocale → false).
i18n.on('languageChanged', lng => {
  void loadDateLocale(lng).then(changed => {
    if (changed) i18n.emit('languageChanged', lng)
  })
})

// RTL-Richtung setzen
export function applyDirection(lang: string) {
  const dir = RTL_LANGUAGES.includes(lang.split('-')[0]) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

export default i18n
