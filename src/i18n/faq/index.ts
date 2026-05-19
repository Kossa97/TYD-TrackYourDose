import type { FaqBundle } from './types'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import it from './locales/it'
import pt from './locales/pt'
import ru from './locales/ru'
import tr from './locales/tr'
import ar from './locales/ar'
import hi from './locales/hi'
import id from './locales/id'
import zh from './locales/zh'
import ja from './locales/ja'
import ko from './locales/ko'

const FAQ_BUNDLES: Record<string, FaqBundle> = {
  de,
  en,
  es,
  fr,
  it,
  pt,
  ru,
  tr,
  ar,
  hi,
  id,
  zh,
  ja,
  ko,
}

/** Resolves FAQ copy for the active UI language (matches `src/i18n` LANGUAGES). */
export function getFaqBundle(lang: string | undefined): FaqBundle {
  const code = (lang || 'de').split('-')[0].toLowerCase()
  return FAQ_BUNDLES[code] ?? en
}
