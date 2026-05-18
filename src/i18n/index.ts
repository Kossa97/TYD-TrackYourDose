import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'
import pt from './locales/pt.json'
import ar from './locales/ar.json'
import ru from './locales/ru.json'
import id from './locales/id.json'
import hi from './locales/hi.json'
import tr from './locales/tr.json'
import it from './locales/it.json'

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      ja: { translation: ja },
      ko: { translation: ko },
      zh: { translation: zh },
      pt: { translation: pt },
      ar: { translation: ar },
      ru: { translation: ru },
      id: { translation: id },
      hi: { translation: hi },
      tr: { translation: tr },
      it: { translation: it },
    },
    fallbackLng: 'de',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tyd_lang',
    },
    interpolation: { escapeValue: false },
  })

// RTL-Richtung setzen
export function applyDirection(lang: string) {
  const dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

export default i18n
