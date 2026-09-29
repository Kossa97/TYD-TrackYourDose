import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importWithReload, isChunkLoadError, markChunkLoaded, reloadForStaleChunk } from './staleChunkReload'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

describe('veraltete Programmteile nach einem Deployment', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { sessionStorage: memoryStorage(), setTimeout, location: { reload: vi.fn() } })
    vi.stubGlobal('navigator', { onLine: true })
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('erkennt gescheiterte Imports in Chrome, Safari und Firefox — und sonst nichts', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://app/assets/Dashboard-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://app/assets/Dashboard-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false)
  })

  it('lädt höchstens einmal neu, bis wieder etwas geladen hat', () => {
    const reload = vi.fn()
    expect(reloadForStaleChunk(reload)).toBe(true)
    // Scheitert es danach wieder — egal wann —, liegt es nicht am alten Stand.
    expect(reloadForStaleChunk(reload)).toBe(false)
    markChunkLoaded()
    expect(reloadForStaleChunk(reload)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('lädt ohne Netz oder ohne Speicher nicht neu', () => {
    const reload = vi.fn()
    vi.stubGlobal('navigator', { onLine: false })
    expect(reloadForStaleChunk(reload)).toBe(false)
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal('window', { get sessionStorage(): Storage { throw new Error('blocked') } })
    expect(reloadForStaleChunk(reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('reicht andere Fehler unverändert weiter', async () => {
    const fehler = new SyntaxError('Unexpected token')
    await expect(importWithReload(() => Promise.reject(fehler))()).rejects.toBe(fehler)
  })

  it('wartet nicht ewig, wenn das Neuladen nicht greift', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { sessionStorage: memoryStorage(), setTimeout: globalThis.setTimeout, location: { reload: () => {} } })
    const fehler = new TypeError('Importing a module script failed.')
    const laden = importWithReload(() => Promise.reject(fehler))()
    const ergebnis = expect(laden).rejects.toBe(fehler)
    await vi.advanceTimersByTimeAsync(8_000)
    await ergebnis
  })
})
