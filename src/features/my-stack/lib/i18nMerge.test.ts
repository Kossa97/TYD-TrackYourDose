import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const mergeLibraryPath = resolve('scripts/my-stack-i18n-merge-lib.mjs')

interface MergeOptions {
  localeCodes: string[]
  keys: string[]
  sourceByLocale: Record<string, Record<string, string>>
  generated: Record<string, Record<string, string>>
  readLocale: (code: string) => Record<string, unknown>
  writeLocale: (code: string, locale: Record<string, unknown>) => void
}

async function loadMergeLibrary() {
  return import(pathToFileURL(mergeLibraryPath).href) as Promise<{
    mergeMyStackLocales: (options: MergeOptions) => void
  }>
}

function validOptions(writeLocale = vi.fn()): MergeOptions {
  const keys = ['label', 'summary']
  return {
    localeCodes: ['de', 'en', 'fr', 'ru'],
    keys,
    sourceByLocale: {
      de: { label: 'Markieren', summary: '{{count}} Eintrag' },
      en: { label: 'Mark', summary: '{{count}} entry' },
    },
    generated: {
      fr: { label: 'Marquer', summary: '{{count}} entrée' },
      ru: { label: 'Отметить', summary: '{{count}} запись' },
    },
    readLocale: (code: string) => ({ outside: `${code}-kept`, label: 'old' }),
    writeLocale,
  }
}

describe('My Stack locale merge boundary', () => {
  it('provides an import-safe merge library', () => {
    expect(existsSync(mergeLibraryPath)).toBe(true)
  })

  it('rejects unexpected generated keys before writing any locale', async () => {
    if (!existsSync(mergeLibraryPath)) return
    const writeLocale = vi.fn()
    const options = validOptions(writeLocale)
    options.generated.fr.extra = 'unexpected'
    const { mergeMyStackLocales } = await loadMergeLibrary()

    expect(() => mergeMyStackLocales(options)).toThrow('Unexpected My Stack key: fr.extra')
    expect(writeLocale).not.toHaveBeenCalled()
  })

  it('validates the final locale completely before writing the first locale', async () => {
    if (!existsSync(mergeLibraryPath)) return
    const writeLocale = vi.fn()
    const options = validOptions(writeLocale)
    delete options.generated.ru.summary
    const { mergeMyStackLocales } = await loadMergeLibrary()

    expect(() => mergeMyStackLocales(options)).toThrow('Missing My Stack translation: ru.summary')
    expect(writeLocale).not.toHaveBeenCalled()
  })

  it('merges exactly the owned keys after all locale payloads pass validation', async () => {
    if (!existsSync(mergeLibraryPath)) return
    const writeLocale = vi.fn()
    const options = validOptions(writeLocale)
    const { mergeMyStackLocales } = await loadMergeLibrary()

    mergeMyStackLocales(options)

    expect(writeLocale).toHaveBeenCalledTimes(4)
    expect(writeLocale).toHaveBeenCalledWith('fr', {
      outside: 'fr-kept',
      label: 'Marquer',
      summary: '{{count}} entrée',
    })
  })
})
