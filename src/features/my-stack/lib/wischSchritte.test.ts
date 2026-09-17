import { describe, expect, it } from 'vitest'
import { wischSchritte } from './wischSchritte'

// Ein Standplatz ist 240 px breit, die Lücke 8 px.
const schrittweite = 248

describe('wischSchritte', () => {
  it('macht aus einem kurzen, schnellen Stups genau einen Schritt', () => {
    // Genau der Fall, der vorher über drei, vier Objekte hinauslief: wenig
    // Strecke, viel Tempo.
    expect(wischSchritte({ strecke: -40, tempo: -2.4, schrittweite })).toBe(1)
    expect(wischSchritte({ strecke: 40, tempo: 2.4, schrittweite })).toBe(-1)
  })

  it('bleibt stehen, wenn der Finger nur gezittert hat', () => {
    expect(wischSchritte({ strecke: -12, tempo: -0.05, schrittweite })).toBe(0)
  })

  it('zählt bei einem getragenen Wisch die Fingerstrecke', () => {
    // Zwei Standplätze weit gezogen, dann losgelassen ohne Schwung.
    expect(wischSchritte({ strecke: -496, tempo: 0, schrittweite })).toBe(2)
  })

  it('legt den Schwung auf die getragene Strecke obendrauf', () => {
    // Einen Standplatz gezogen und mit 1 px/ms losgelassen: 1 + 120/248 ≈ 1,48
    // rundet auf 1; bei 2 px/ms sind es 1 + 0,97 ≈ 1,97 und damit 2.
    expect(wischSchritte({ strecke: -248, tempo: -1, schrittweite })).toBe(1)
    expect(wischSchritte({ strecke: -248, tempo: -2, schrittweite })).toBe(2)
  })

  it('federt nicht zurück, wenn jemand über einen halben Schritt gezogen hat', () => {
    // 130 px sind mehr als ein halber Schritt, gerundet wäre es trotzdem 0.
    expect(wischSchritte({ strecke: -130, tempo: 0, schrittweite })).toBe(1)
    expect(wischSchritte({ strecke: 130, tempo: 0, schrittweite })).toBe(-1)
  })

  it('verträgt eine unbrauchbare Schrittweite', () => {
    expect(wischSchritte({ strecke: -200, tempo: -1, schrittweite: 0 })).toBe(0)
    expect(wischSchritte({ strecke: -200, tempo: -1, schrittweite: NaN })).toBe(0)
  })
})
