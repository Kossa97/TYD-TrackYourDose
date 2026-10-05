import { describe, expect, it, vi } from 'vitest'
import { loescheKonto, loescheNutzerDateien, type AccountClient } from './account'

function nachbild(dateien: Record<string, string[]>, rpcFehler: string | null = null) {
  const aufrufe: string[] = []
  const client: AccountClient = {
    storage: {
      from(bucket) {
        return {
          async list(path, { limit, offset }) {
            aufrufe.push(`list ${bucket} ${path}`)
            const namen = (dateien[bucket] ?? []).slice(offset, offset + limit)
            return { data: namen.map(name => ({ name })), error: null }
          },
          async remove(paths) {
            aufrufe.push(`remove ${bucket} ${paths.length}`)
            dateien[bucket] = (dateien[bucket] ?? []).filter(name => !paths.includes(`u1/${name}`))
            return { error: null }
          },
        }
      },
    },
    rpc: async fn => {
      aufrufe.push(`rpc ${fn}`)
      return { error: rpcFehler ? { message: rpcFehler } : null }
    },
    auth: { signOut: vi.fn(async () => { aufrufe.push('signOut') }) },
  }
  return { client, aufrufe, dateien }
}

describe('Konto loeschen', () => {
  it('loescht erst die Dateien, dann das Konto, dann meldet es ab', async () => {
    const { client, aufrufe, dateien } = nachbild({ 'progress-photos': ['a.jpg', 'b.jpg'], 'batch-files': ['c.pdf'] })
    await loescheKonto(client, 'u1')
    expect(dateien['progress-photos']).toEqual([])
    expect(dateien['batch-files']).toEqual([])
    expect(aufrufe.indexOf('rpc delete_my_account')).toBeGreaterThan(aufrufe.lastIndexOf('remove batch-files 1'))
    expect(aufrufe.at(-1)).toBe('signOut')
  })

  it('arbeitet viele Dateien seitenweise ab', async () => {
    const namen = Array.from({ length: 250 }, (_, i) => `${i}.jpg`)
    const { client, dateien } = nachbild({ 'progress-photos': namen })
    expect(await loescheNutzerDateien(client, 'progress-photos', 'u1')).toBe(250)
    expect(dateien['progress-photos']).toEqual([])
  })

  it('meldet nicht ab, wenn das Konto nicht geloescht werden konnte', async () => {
    const { client, aufrufe } = nachbild({}, 'anmeldung_noetig')
    await expect(loescheKonto(client, 'u1')).rejects.toThrow('anmeldung_noetig')
    expect(aufrufe).not.toContain('signOut')
  })
})
