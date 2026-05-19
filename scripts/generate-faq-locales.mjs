/**
 * Generates localized FAQ category files from data/en.json.
 * Requires: npm install @vitalets/google-translate-api (dev)
 * Usage: node scripts/generate-faq-locales.mjs [lang...]
 *        node scripts/generate-faq-locales.mjs   (all targets)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'src', 'i18n', 'faq', 'data')
const localesDir = join(__dirname, '..', 'src', 'i18n', 'faq', 'locales')

const TARGETS = {
  es: 'es',
  fr: 'fr',
  it: 'it',
  pt: 'pt',
  ru: 'ru',
  tr: 'tr',
  ar: 'ar',
  hi: 'hi',
  id: 'id',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function collectStrings(node, out = [], key = '') {
  if (typeof node === 'string') {
    if (key !== 'id') out.push(node)
    return out
  }
  if (Array.isArray(node)) {
    for (const v of node) collectStrings(v, out, key)
    return out
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collectStrings(v, out, k)
  }
  return out
}

function applyTranslations(node, map, key = '') {
  if (typeof node === 'string') {
    if (key === 'id') return node
    return map.get(node) ?? node
  }
  if (Array.isArray(node)) return node.map((v) => applyTranslations(v, map, key))
  if (node && typeof node === 'object') {
    const next = {}
    for (const [k, v] of Object.entries(node)) next[k] = applyTranslations(v, map, k)
    return next
  }
  return node
}

function escapeTsString(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
}

function formatAnswer(a, indent) {
  const pad = ' '.repeat(indent)
  if (typeof a === 'string') return `'${escapeTsString(a)}'`
  const inner = a.map((line) => `${pad}  '${escapeTsString(line)}',`).join('\n')
  return `[\n${inner}\n${pad}]`
}

function toCategoriesTs(exportName, categories) {
  const lines = [
    "import type { FaqCategory } from '../types'",
    '',
    `export const ${exportName}: FaqCategory[] = [`,
  ]
  for (const cat of categories) {
    lines.push('  {')
    lines.push(`    id: '${cat.id}',`)
    lines.push(`    title: '${escapeTsString(cat.title)}',`)
    lines.push('    items: [')
    for (const item of cat.items) {
      lines.push('      {')
      lines.push(`        q: '${escapeTsString(item.q)}',`)
      lines.push(`        a: ${formatAnswer(item.a, 8)},`)
      lines.push('      },')
    }
    lines.push('    ],')
    lines.push('  },')
  }
  lines.push(']', '')
  return lines.join('\n')
}

const CACHE_PATH = join(dataDir, 'translation-cache.json')

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {}
  return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
}

async function translateOne(translate, text, to, cache, delayMs) {
  const cacheKey = `${to}::${text}`
  if (cache[cacheKey]) return cache[cacheKey]

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await translate(text, { to })
      cache[cacheKey] = res.text
      saveCache(cache)
      await sleep(delayMs)
      return res.text
    } catch (err) {
      const isRate = /too many|429|rate/i.test(String(err.message))
      if (isRate && attempt < 4) {
        const wait = delayMs * (attempt + 2) * 3
        console.warn(`  rate limited (${to}), wait ${wait}ms…`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
  return text
}

async function translateBatch(translate, texts, to, delayMs, cache) {
  const unique = [...new Set(texts)]
  const map = new Map()
  let done = 0
  for (const text of unique) {
    try {
      map.set(text, await translateOne(translate, text, to, cache, delayMs))
    } catch (err) {
      console.error(`  translate failed (${to}):`, text.slice(0, 60), err.message)
      map.set(text, text)
    }
    done++
    if (done % 20 === 0 || done === unique.length) {
      console.log(`  ${to}: ${done}/${unique.length}`)
    }
  }
  return map
}

async function main() {
  const enPath = join(dataDir, 'en.json')
  if (!existsSync(enPath)) {
    console.error('Missing', enPath, '— run: npx tsx scripts/export-faq-en.ts')
    process.exit(1)
  }

  let translateFn
  try {
    const mod = await import('@vitalets/google-translate-api')
    translateFn = mod.translate ?? mod.default?.translate ?? mod.default
  } catch {
    console.error('Install dependency: npm install -D @vitalets/google-translate-api')
    process.exit(1)
  }

  const { categories } = JSON.parse(readFileSync(enPath, 'utf8'))
  const allStrings = collectStrings(categories)
  const cache = loadCache()
  const argLangs = process.argv.slice(2)
  const langs = argLangs.length ? argLangs : Object.keys(TARGETS)
  const delayMs = Number(process.env.FAQ_DELAY_MS || 400)

  for (const lang of langs) {
    const googleCode = TARGETS[lang]
    if (!googleCode) {
      console.warn('Unknown lang:', lang)
      continue
    }
    const outFile = join(localesDir, `${lang}.categories.ts`)
    if (existsSync(outFile) && process.env.FAQ_FORCE !== '1') {
      console.log(`Skip ${lang} (exists, set FAQ_FORCE=1 to overwrite)`)
      continue
    }
    console.log(`Translating → ${lang} (${googleCode})…`)
    const map = await translateBatch(translateFn, allStrings, googleCode, delayMs, cache)
    const translated = applyTranslations(categories, map)
    const exportName = `${lang}Categories`
    writeFileSync(outFile, toCategoriesTs(exportName, translated), 'utf8')
    console.log('Wrote', outFile)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
