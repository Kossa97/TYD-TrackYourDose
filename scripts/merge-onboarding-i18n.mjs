/**
 * Merges onboarding + language-gate strings into src/i18n/locales/*.json
 * Usage: node scripts/merge-onboarding-i18n.mjs
 * Optional: node scripts/generate-onboarding-i18n.mjs  (translate from EN first)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OB_DE, OB_EN } from './onboarding-i18n-source.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '..', 'src', 'i18n', 'locales')
const generatedPath = join(__dirname, '..', 'src', 'i18n', 'data', 'onboarding-i18n.json')

const LOCALES = ['de', 'en', 'es', 'fr', 'it', 'pt', 'ru', 'tr', 'ar', 'hi', 'id', 'zh', 'ja', 'ko']

function loadGenerated() {
  try {
    return JSON.parse(readFileSync(generatedPath, 'utf8'))
  } catch {
    return null
  }
}

const generated = loadGenerated()

for (const code of LOCALES) {
  const path = join(localesDir, `${code}.json`)
  const locale = JSON.parse(readFileSync(path, 'utf8'))
  const block =
    code === 'de' ? OB_DE :
    code === 'en' ? OB_EN :
    { ...OB_EN, ...(generated?.[code] ?? {}) }

  const merged = { ...locale, ...block }
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  console.log('Merged onboarding keys →', code)
}
