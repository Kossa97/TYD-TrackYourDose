/**
 * Translates the manually approved English My Stack source into the remaining
 * app languages. Interpolation tokens are protected and checked before output.
 *
 * Usage: node scripts/generate-my-stack-i18n.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MY_STACK_EN } from './my-stack-i18n-source.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'src', 'i18n', 'data')
const outPath = join(outDir, 'my-stack-i18n.json')
const TARGETS = {
  ar: 'ar', es: 'es', fr: 'fr', hi: 'hi', id: 'id', it: 'it',
  ja: 'ja', ko: 'ko', pt: 'pt', ru: 'ru', tr: 'tr', zh: 'zh-CN',
}
const MAX_BATCH_CHARS = 3000
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const sourceEntries = Object.entries(MY_STACK_EN)

function interpolationTokens(text) {
  return [...text.matchAll(/{{\s*[^{}]+\s*}}/g)].map(match => match[0])
}

function protectTokens(text) {
  const tokens = interpolationTokens(text)
  return {
    protectedText: tokens.reduce(
      (value, token, index) => value.replace(token, `XQZTOKEN${index}ZXQ`),
      text,
    ),
    tokens,
  }
}

function restoreTokens(text, tokens, key, language) {
  let restored = text
  tokens.forEach((token, index) => {
    restored = restored.replace(new RegExp(`XQZTOKEN\\s*${index}\\s*ZXQ`, 'i'), token)
  })
  const actual = interpolationTokens(restored).sort()
  const expected = [...tokens].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Interpolation token mismatch for ${language}.${key}`)
  }
  return restored.trim()
}

function batches(entries) {
  const result = []
  let current = []
  let chars = 0
  for (const entry of entries) {
    const nextChars = entry[1].length + 20
    if (current.length > 0 && chars + nextChars > MAX_BATCH_CHARS) {
      result.push(current)
      current = []
      chars = 0
    }
    current.push(entry)
    chars += nextChars
  }
  if (current.length > 0) result.push(current)
  return result
}

async function translateBatch(translate, entries, target) {
  const protectedEntries = entries.map(([key, value]) => {
    const protectedValue = protectTokens(value)
    return { key, ...protectedValue }
  })
  const input = protectedEntries
    .map((entry, index) => `⟦${String(index).padStart(3, '0')}⟧ ${entry.protectedText}`)
    .join('\n')
  const response = await translate(input, { from: 'en', to: target })
  const marker = /⟦\s*(\d{3})\s*⟧/g
  const matches = [...response.text.matchAll(marker)]
  if (matches.length !== protectedEntries.length) {
    throw new Error(`Expected ${protectedEntries.length} batch markers, received ${matches.length}`)
  }

  return Object.fromEntries(matches.map((match, index) => {
    const entryIndex = Number(match[1])
    const entry = protectedEntries[entryIndex]
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? response.text.length
    return [entry.key, restoreTokens(response.text.slice(start, end), entry.tokens, entry.key, target)]
  }))
}

async function translateOne(translate, [key, value], target) {
  const { protectedText, tokens } = protectTokens(value)
  const response = await translate(protectedText, { from: 'en', to: target })
  return [key, restoreTokens(response.text, tokens, key, target)]
}

async function main() {
  const { translate } = await import('@vitalets/google-translate-api')
  const delayMs = Number(process.env.MY_STACK_TRANSLATE_DELAY_MS ?? 100)
  const result = {}

  for (const [language, target] of Object.entries(TARGETS)) {
    const translated = {}
    console.log(`Translating My Stack → ${language}…`)
    for (const batch of batches(sourceEntries)) {
      try {
        Object.assign(translated, await translateBatch(translate, batch, target))
      } catch (error) {
        console.warn(`Batch fallback for ${language}: ${error.message}`)
        for (const entry of batch) {
          const [key, value] = await translateOne(translate, entry, target)
          translated[key] = value
          await sleep(delayMs)
        }
      }
      await sleep(delayMs)
    }
    result[language] = translated
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log('Wrote', outPath)
  console.log('Run: node scripts/merge-my-stack-i18n.mjs')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
