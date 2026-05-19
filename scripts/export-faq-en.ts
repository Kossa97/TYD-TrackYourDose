/** One-off: exports English FAQ categories to JSON for translation scripts. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { enCategories } from '../src/i18n/faq/locales/en.categories'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = join(root, '..', 'src', 'i18n', 'faq', 'data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'en.json'), JSON.stringify({ categories: enCategories }, null, 2), 'utf8')
console.log('Wrote', join(outDir, 'en.json'))
