/**
 * Deterministically merges the approved/manual and generated My Stack overlay
 * into all app locale files.
 *
 * Usage: node scripts/merge-my-stack-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MY_STACK_DE, MY_STACK_EN, MY_STACK_KEYS } from './my-stack-i18n-source.mjs'
import { mergeMyStackLocales } from './my-stack-i18n-merge-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '..', 'src', 'i18n', 'locales')
const generatedPath = join(__dirname, '..', 'src', 'i18n', 'data', 'my-stack-i18n.json')
const localeCodes = ['de', 'en', 'ar', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh']
const generated = JSON.parse(readFileSync(generatedPath, 'utf8'))

mergeMyStackLocales({
  localeCodes,
  keys: MY_STACK_KEYS,
  sourceByLocale: { de: MY_STACK_DE, en: MY_STACK_EN },
  generated,
  readLocale: code => JSON.parse(readFileSync(join(localesDir, `${code}.json`), 'utf8')),
  writeLocale: (code, locale) => {
    writeFileSync(join(localesDir, `${code}.json`), `${JSON.stringify(locale, null, 2)}\n`, 'utf8')
    console.log('Merged My Stack keys →', code)
  },
})
