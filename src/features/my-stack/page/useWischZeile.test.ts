import { describe, expect, it } from 'vitest'
import { OFFEN_BREITE, VOLL_ANTEIL, federSchritt, gummiband, lageAusStrecke, loslassGeschwindigkeit, zielBeimLoslassen } from './useWischZeile'

const breite = 360

describe('Wischen an der Zeile', () => {
  it('folgt dem Finger 1:1 im normalen Bereich', () => {
    expect(lageAusStrecke(-80, breite)).toBe(-80)
    expect(lageAusStrecke(-OFFEN_BREITE, breite)).toBe(-OFFEN_BREITE)
  })

  it('gibt nach rechts und ueber den Rand hinaus nur zaeh nach — nie weiter als die Grenze', () => {
    expect(lageAusStrecke(40, breite)).toBeGreaterThan(0)
    expect(lageAusStrecke(40, breite)).toBeLessThan(20)
    expect(lageAusStrecke(10_000, breite)).toBeLessThan(48)
    const ganz = breite * 0.92
    expect(lageAusStrecke(-(ganz + 200), breite)).toBeGreaterThan(-(ganz + 36))
    expect(gummiband(0, 48)).toBe(0)
  })

  it('beim Loslassen entscheidet der Schwung vor der Strecke', () => {
    // Kurz geschnippt nach links: offen, obwohl erst 30 px.
    expect(zielBeimLoslassen(-30, -0.8, breite)).toBe('offen')
    // Weit offen, aber nach rechts geschnippt: zu.
    expect(zielBeimLoslassen(-130, 0.8, breite)).toBe('zu')
    // Langsam: die halbe Strecke zaehlt.
    expect(zielBeimLoslassen(-80, 0, breite)).toBe('offen')
    expect(zielBeimLoslassen(-60, 0, breite)).toBe('zu')
  })

  it('Geschwindigkeit aus den letzten Proben; stillgehalten vor dem Abheben ist sie null', () => {
    const proben = [{ x: 300, t: 1000 }, { x: 260, t: 1040 }]
    expect(loslassGeschwindigkeit(proben, 1050)).toBe(-1)
    expect(loslassGeschwindigkeit(proben, 1200)).toBe(0)
    expect(loslassGeschwindigkeit([], 0)).toBe(0)
  })

  it('ganz durchgewischt: Loeschen', () => {
    expect(zielBeimLoslassen(-(breite * VOLL_ANTEIL + 1), 0, breite)).toBe('voll')
    expect(zielBeimLoslassen(-(breite * VOLL_ANTEIL - 1), 0, breite)).toBe('offen')
  })

  it('die Feder kommt an, mit hoechstens einem Hauch Nachschwingen', () => {
    let x = 0
    let v = -1200
    let tiefster = 0
    for (let i = 0; i < 240 * 1.5; i++) {
      ;[x, v] = federSchritt(x, v, -OFFEN_BREITE, 1 / 240)
      tiefster = Math.min(tiefster, x)
    }
    expect(Math.abs(x + OFFEN_BREITE)).toBeLessThan(0.5)
    expect(-tiefster - OFFEN_BREITE).toBeLessThan(OFFEN_BREITE * 0.12)
  })
})
