/**
 * Translates onboarding strings to all app languages.
 * npm run i18n:onboarding:generate
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OB_EN } from './onboarding-i18n-source.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'i18n', 'data')
const outPath = join(outDir, 'onboarding-i18n.json')

const TARGETS = {
  es: 'es', fr: 'fr', it: 'it', pt: 'pt', ru: 'ru', tr: 'tr',
  ar: 'ar', hi: 'hi', id: 'id', zh: 'zh-CN', ja: 'ja', ko: 'ko',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let translate
  try {
    const mod = await import('@vitalets/google-translate-api')
    translate = mod.translate ?? mod.default?.translate ?? mod.default
  } catch {
    console.error('Run: npm install -D @vitalets/google-translate-api')
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })
  const result = { de: null, en: OB_EN }
  const keys = Object.keys(OB_EN)
  const delay = Number(process.env.FAQ_DELAY_MS || 500)

  for (const [lang, googleCode] of Object.entries(TARGETS)) {
    console.log(`Translating onboarding → ${lang}…`)
    const block = {}
    for (const key of keys) {
      const text = OB_EN[key]
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await translate(text, { to: googleCode })
          block[key] = res.text
          break
        } catch (err) {
          if (/too many|429/i.test(String(err.message)) && attempt < 4) {
            await sleep(delay * (attempt + 3))
            continue
          }
          console.warn(`  fallback EN for ${lang}.${key}`)
          block[key] = text
          break
        }
      }
      await sleep(delay)
    }
    result[lang] = block
  }

  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8')
  console.log('Wrote', outPath)
  console.log('Run: node scripts/merge-onboarding-i18n.mjs')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
