import type { FaqBundle } from './types'

// FAQ-Bundles als Lazy-Chunks (Pattern '??' = genau die 2-Buchstaben-Codes,
// schließt die *.categories.ts-Dateien aus). Vorher lagen alle 14 Bundles
// (~300 kB) zusammen im FAQ-Chunk; jetzt lädt nur die aktive Sprache.
const FAQ_LOADERS = import.meta.glob<{ default: FaqBundle }>('./locales/??.ts')

/** Lädt das FAQ-Bundle der aktiven UI-Sprache (Fallback: en). */
export async function loadFaqBundle(lang: string | undefined): Promise<FaqBundle> {
  const code = (lang || 'de').split('-')[0].toLowerCase()
  const loader = FAQ_LOADERS[`./locales/${code}.ts`] ?? FAQ_LOADERS['./locales/en.ts']
  const mod = await loader()
  return mod.default
}
