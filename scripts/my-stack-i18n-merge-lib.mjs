function interpolationTokens(text) {
  return [...text.matchAll(/{{\s*[^{}]+\s*}}/g)].map(match => match[0]).sort()
}

function validateBlock(code, block, keys, reference) {
  if (!block) throw new Error(`Missing generated My Stack locale: ${code}`)
  const ownedKeys = new Set(keys)

  for (const key of Object.keys(block)) {
    if (!ownedKeys.has(key)) throw new Error(`Unexpected My Stack key: ${code}.${key}`)
  }
  for (const key of keys) {
    if (typeof block[key] !== 'string' || !block[key].trim()) {
      throw new Error(`Missing My Stack translation: ${code}.${key}`)
    }
    if (JSON.stringify(interpolationTokens(block[key])) !== JSON.stringify(interpolationTokens(reference[key]))) {
      throw new Error(`Interpolation token mismatch: ${code}.${key}`)
    }
  }
}

export function mergeMyStackLocales({
  localeCodes,
  keys,
  sourceByLocale,
  generated,
  readLocale,
  writeLocale,
}) {
  const reference = sourceByLocale.en
  if (!reference) throw new Error('Missing English My Stack source')

  const prepared = localeCodes.map(code => {
    const block = sourceByLocale[code] ?? generated[code]
    validateBlock(code, block, keys, reference)
    const overlay = Object.fromEntries(keys.map(key => [key, block[key]]))
    return [code, { ...readLocale(code), ...overlay }]
  })

  for (const [code, locale] of prepared) writeLocale(code, locale)
}
