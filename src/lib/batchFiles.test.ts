import { describe, expect, it, vi } from 'vitest'
import { batchDateiPfad, signiereBatchDateien, type BatchSignClient } from './batchFiles'

const BASIS = 'https://xyz.supabase.co/storage/v1/object'

describe('Pfad im Speicher batch-files', () => {
  it('liest alte oeffentliche URLs, signierte Links und reine Pfade', () => {
    expect(batchDateiPfad(`${BASIS}/public/batch-files/u1/1730.pdf`)).toBe('u1/1730.pdf')
    expect(batchDateiPfad(`${BASIS}/public/batch-files/progress/u1/a%20b.jpg`)).toBe('progress/u1/a b.jpg')
    expect(batchDateiPfad(`${BASIS}/sign/batch-files/u1/1730.pdf?token=abc`)).toBe('u1/1730.pdf')
    expect(batchDateiPfad('u1/1730.pdf')).toBe('u1/1730.pdf')
    expect(batchDateiPfad('/u1/1730.pdf')).toBe('u1/1730.pdf')
  })

  it('kennt fremde Adressen und Leeres nicht', () => {
    expect(batchDateiPfad('https://example.com/zertifikat.pdf')).toBeNull()
    expect(batchDateiPfad(`${BASIS}/public/progress-photos/u1/a.jpg`)).toBeNull()
    expect(batchDateiPfad('')).toBeNull()
    expect(batchDateiPfad(null)).toBeNull()
  })
})

describe('signierte Links', () => {
  function client(antwort: Array<{ path: string; signedUrl: string | null }>) {
    const createSignedUrls = vi.fn(async () => ({ data: antwort.map(e => ({ ...e, error: null })), error: null }))
    const from = vi.fn(() => ({ createSignedUrls }))
    return { client: { storage: { from } } as unknown as BatchSignClient, from, createSignedUrls }
  }

  it('signiert jeden Pfad einmal, auch wenn alt und neu darauf zeigen', async () => {
    const { client: c, from, createSignedUrls } = client([{ path: 'u1/a.pdf', signedUrl: 'https://signiert/a' }])
    const alt = `${BASIS}/public/batch-files/u1/a.pdf`
    const links = await signiereBatchDateien(c, [alt, 'u1/a.pdf', 'https://example.com/x.pdf'])
    expect(from).toHaveBeenCalledWith('batch-files')
    expect(createSignedUrls).toHaveBeenCalledWith(['u1/a.pdf'], 3600)
    expect(links.get(alt)).toBe('https://signiert/a')
    expect(links.get('u1/a.pdf')).toBe('https://signiert/a')
    expect(links.get('https://example.com/x.pdf')).toBe('https://example.com/x.pdf')
  })

  it('laesst Dateien weg, die es nicht mehr gibt; fragt ohne Pfade nicht', async () => {
    const { client: c, createSignedUrls } = client([{ path: 'u1/weg.pdf', signedUrl: null }])
    expect((await signiereBatchDateien(c, ['u1/weg.pdf'])).size).toBe(0)
    createSignedUrls.mockClear()
    await signiereBatchDateien(c, [])
    expect(createSignedUrls).not.toHaveBeenCalled()
  })
})
