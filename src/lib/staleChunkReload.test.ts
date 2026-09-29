import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importWithReload, isChunkLoadError, reloadForStaleChunk } from './staleChunkReload'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => map.clear(),
  }
}

describe('veraltete Programmteile nach einem Deployment', () => {
  beforeEach(() => { vi.stubGlobal('sessionStorage', memoryStorage()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('erkennt gescheiterte Imports in Chrome, Safari und Firefox — und sonst nichts', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://app/assets/Dashboard-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://app/assets/Dashboard-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })

  it('lädt einmal neu, aber nicht in einer Schleife', () => {
    const reload = vi.fn()
    expect(reloadForStaleChunk(100_000, reload)).toBe(true)
    // Gleich danach scheitert es wieder: dann liegt es nicht am alten Stand.
    expect(reloadForStaleChunk(105_000, reload)).toBe(false)
    expect(reloadForStaleChunk(200_000, reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('lädt ohne Speicher nicht neu (kein Schutz gegen Schleifen)', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => {} })
    const reload = vi.fn()
    expect(reloadForStaleChunk(100_000, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reicht andere Fehler beim Import unverändert weiter', async () => {
    const fehler = new SyntaxError('Unexpected token')
    await expect(importWithReload(() => Promise.reject(fehler))()).rejects.toBe(fehler)
  })
})
