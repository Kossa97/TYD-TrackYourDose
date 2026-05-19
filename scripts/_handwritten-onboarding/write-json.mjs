import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OB_EN } from '../onboarding-i18n-source.mjs'
import { es, fr, it, pt } from './es-fr-it-pt.mjs'
import { ru, tr, ar, hi } from './ru-tr-ar-hi.mjs'
import { id, zh, ja, ko } from './id-zh-ja-ko.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', '..', 'src', 'i18n', 'data', 'onboarding-i18n.json')

const data = { es, fr, it, pt, ru, tr, ar, hi, id, zh, ja, ko }
const keys = Object.keys(OB_EN)

for (const [loc, block] of Object.entries(data)) {
  const missing = keys.filter((k) => block[k] === undefined)
  const extra = Object.keys(block).filter((k) => !keys.includes(k))
  if (missing.length) {
    console.error(`${loc} missing keys:`, missing.join(', '))
    process.exit(1)
  }
  if (extra.length) {
    console.error(`${loc} extra keys:`, extra.join(', '))
    process.exit(1)
  }
}

writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log('Wrote', outPath, `(${keys.length} keys × ${Object.keys(data).length} locales)`)
