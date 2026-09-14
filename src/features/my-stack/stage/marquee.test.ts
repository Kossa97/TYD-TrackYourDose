import { describe, expect, it } from 'vitest'
import { buildMarqueeMotion, marqueeRestOffset, MARQUEE_MIN_OVERFLOW } from './marquee'

function verschiebungen(keyframes: Keyframe[]): number[] {
  return keyframes.map(bild => {
    const treffer = /translateX\((-?[\d.]+)px\)/.exec(String(bild.transform))
    return treffer ? Number(treffer[1]) : 0
  })
}

describe('marquee', () => {
  it('ruht am ANFANG des Namens, nicht in seiner Mitte', () => {
    // Vorher ruhte ein zu langer Name mittig. In der Ansicht hiess das: was
    // man im Ruhezustand sieht, ist ein Stueck aus der MITTE des Wortes, vorn
    // und hinten abgeschnitten („Semagluti" auf der Ampulle). Ein Etikett
    // liest man von vorne.
    expect(marqueeRestOffset()).toBe(0)
  })

  it('faehrt beide Enden des Etiketts voll aus', () => {
    // Bei 0 steht der erste Buchstabe an der linken Etikettkante, bei
    // -overflow der letzte an der rechten. Dazwischen laeuft der Name durch.
    const ueberlauf = 120
    const werte = verschiebungen(buildMarqueeMotion(ueberlauf).keyframes)

    expect(Math.max(...werte)).toBe(0)
    expect(Math.min(...werte)).toBe(-ueberlauf)
    // Und nichts dazwischen: kein Halt auf halber Strecke.
    for (const wert of werte) {
      expect([0, -ueberlauf]).toContain(wert)
    }
  })

  it('faengt vorne an und kommt vorne wieder heraus', () => {
    // Eine Schleife, die woanders endet als sie beginnt, springt bei jedem
    // Durchlauf.
    const werte = verschiebungen(buildMarqueeMotion(80).keyframes)
    expect(werte[0]).toBe(0)
    expect(werte[werte.length - 1]).toBe(0)
  })

  it('laeuft laenger, je weiter der Name ueberhaengt', () => {
    const kurz = buildMarqueeMotion(20).options.duration as number
    const lang = buildMarqueeMotion(400).options.duration as number
    expect(lang).toBeGreaterThan(kurz)
  })

  it('nennt eine Untergrenze, unter der ein Ueberhang kein Lauf ist', () => {
    // Darunter waere die Bewegung ein Zittern, kein Lauf.
    expect(MARQUEE_MIN_OVERFLOW).toBeGreaterThan(0)
  })
})
