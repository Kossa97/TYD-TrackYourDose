import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AMPOULE_BODY, AMPOULE_LABEL_INSET_PCT, AMPOULE_VIEWBOX } from '../extensions/ampoule/ampouleShape'
import { GEL_LABEL_INSET_PCT } from '../extensions/gel/gelShape'
import { SPRAY_LABEL_INSET_PCT } from '../extensions/spray/sprayShape'
import { VIAL_BODY, VIAL_LABEL_INSET_PCT, VIAL_VIEWBOX } from '../extensions/peptide/vialShape'

// Das Glasband sitzt auf dem KOERPER, nicht auf der ganzen Buehne — und sein
// seitlicher Einzug wird aus dem Koerper hergeleitet, nicht getippt. Genau
// daran scheiterte die Ampulle: `left-[4%]` gegen einen Zylinder, der bei
// 2,78 % beginnt, liess auf jeder Seite einen hellen Streifen Glas stehen.
//
// Dieser Test haelt die Regel fuer alle Formen fest, die ein Band tragen.
// Die sechs uebrigen (Pen, Tablette, Kapsel, Pflaster, Tube, Pulver) haben
// keines: ihr Name steht direkt auf dem Objekt.

function quelle(pfad: string): string {
  return readFileSync(resolve(pfad), 'utf8')
}

describe('Etikettband: Einzug kommt aus dem Koerper', () => {
  it('leitet den Einzug der Ampulle aus ihrem Zylinder her', () => {
    expect(AMPOULE_LABEL_INSET_PCT).toBeCloseTo(
      (AMPOULE_BODY.x - AMPOULE_VIEWBOX.x) / AMPOULE_VIEWBOX.width,
      10,
    )
    // Und nicht mehr die alten 4 %.
    expect(AMPOULE_LABEL_INSET_PCT).toBeCloseTo(0.027778, 5)
  })

  it('leitet den Einzug des Vials aus seinem Glaskoerper her', () => {
    expect(VIAL_LABEL_INSET_PCT).toBeCloseTo(
      (VIAL_BODY.x - VIAL_VIEWBOX.x) / VIAL_VIEWBOX.width,
      10,
    )
    // Und nicht mehr die alten 3,5 %.
    expect(VIAL_LABEL_INSET_PCT).toBeCloseTo(0.033333, 5)
  })

  it('haelt Gel und Spray bei ihrer schon hergeleiteten Regel', () => {
    for (const [name, wert] of [['gel', GEL_LABEL_INSET_PCT], ['spray', SPRAY_LABEL_INSET_PCT]] as const) {
      expect(Number.isFinite(wert), name).toBe(true)
      expect(wert, name).toBeGreaterThanOrEqual(0)
      expect(wert, name).toBeLessThan(0.2)
    }
  })

  it('laesst Tropfen und Nasenspray buendig, weil ihr Koerper die viewBox fuellt', () => {
    // Beide setzen `left-0 right-0`. Das ist nur richtig, solange der
    // Koerperpfad an den viewBox-Kanten endet — genau das wird hier geprueft.
    const tropfen = quelle('src/features/my-stack/extensions/drops/dropsShape.ts')
    expect(tropfen).toContain('DROPS_VIEWBOX = { x: 14, y: 16, width: 72')
    expect(tropfen).toContain('M28 100') // Koerper laeuft von x=14 bis x=86
    expect(tropfen).toContain('L14 114')

    const nasal = quelle('src/features/my-stack/extensions/nasal-spray/nasalSprayShape.ts')
    expect(nasal).toContain('viewBox: { x: 21, y: 6, width: 78')
    expect(nasal).toContain('M21 156') // Koerper laeuft von x=21 bis x=99
    expect(nasal).toContain('L99 280')
  })

  it('haelt getippte Prozentwerte aus den Bandkanten heraus', () => {
    // Der Rueckfall, gegen den dieser Test steht: ein `left-[n%]` im
    // Klassennamen des BANDES statt einer hergeleiteten Zahl. Geprueft wird
    // nur der `<StageLabel …>`-Aufruf — anderswo im Objekt sind feste
    // Prozentwerte voellig in Ordnung (der Glanzstreifen des Vials etwa sitzt
    // zu Recht auf `left-[24%]`).
    const dateien = [
      'src/features/my-stack/extensions/ampoule/AmpouleVisual.tsx',
      'src/components/PeptideVialVisual.tsx',
      'src/features/my-stack/extensions/gel/GelVisual.tsx',
      'src/features/my-stack/extensions/spray/SprayVisual.tsx',
      'src/features/my-stack/extensions/drops/DropsVisual.tsx',
      'src/features/my-stack/extensions/nasal-spray/NasalSprayVisual.tsx',
    ]
    for (const datei of dateien) {
      const text = quelle(datei)
      const start = text.indexOf('<StageLabel')
      expect(start, `${datei}: kein StageLabel gefunden`).toBeGreaterThan(-1)
      const aufruf = text.slice(start, text.indexOf('/>', start))
      expect(aufruf, datei).not.toMatch(/left-\[\d/)
      expect(aufruf, datei).not.toMatch(/right-\[\d/)
    }
  })
})
