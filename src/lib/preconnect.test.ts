import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Verbindungsaufbau zu Supabase', () => {
  it('baut die Verbindung auf, bevor die erste Abfrage sie braucht', () => {
    // Im Netzwerkprofil eines Kaltstarts brauchten die ersten drei
    // Datenabfragen 840 bis 865 ms, waehrend der Server dafuer 180 ms
    // meldete. Die Differenz war DNS, TCP und TLS: den Handschlag beginnt
    // der Browser erst, wenn die erste Abfrage losgeht -- also nachdem die
    // Skripte geladen und ausgewertet sind. Der Hinweis laesst ihn parallel
    // dazu laufen.
    const html = readFileSync('index.html', 'utf8')
    const client = readFileSync('src/lib/supabase.ts', 'utf8')

    const url = client.match(/const supabaseUrl = '([^']+)'/)?.[1]
    expect(url, 'die Supabase-URL steht nicht mehr, wo dieser Test sie sucht').toBeTruthy()
    // Genau die Adresse, die der Client spaeter anspricht -- ein Hinweis auf
    // eine andere Herkunft waere wirkungslos.
    expect(html).toContain(`<link rel="preconnect" href="${url}" crossorigin>`)
    expect(html).toContain(`<link rel="dns-prefetch" href="${url}">`)
  })
})
