import { createElement } from 'react'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PeptideVialVisual } from '../../../components/PeptideVialVisual'
import { AmpouleVisual } from '../extensions/ampoule/AmpouleVisual'
import { CapsuleVisual } from '../extensions/capsule/CapsuleVisual'
import { DropsVisual } from '../extensions/drops/DropsVisual'
import { GelVisual } from '../extensions/gel/GelVisual'
import { NasalSprayVisual } from '../extensions/nasal-spray/NasalSprayVisual'
import { PatchVisual } from '../extensions/patch/PatchVisual'
import { PenVisual } from '../extensions/pen/PenVisual'
import { PowderVisual } from '../extensions/powder/PowderVisual'
import { SprayVisual } from '../extensions/spray/SprayVisual'
import { TabletVisual } from '../extensions/tablet/TabletVisual'
import { TubeVisual } from '../extensions/tube/TubeVisual'

// Die Buehnenlampe steht in der MITTE der Buehne, die Form daneben. Das
// Karussell reicht ihre Lage als lightOffset durch (MyStackPage:
// `setStageLight(focus, -normalized)`), also: lightOffset +1 heisst, die Form
// steht links der Mitte und die Lampe damit rechts von ihr.
//
// Daraus folgt genau eine Regel, und sie gilt fuer jede Form gleich:
//
//   Der Schatten faellt VON der Lampe weg, der Glanz laeuft ZU ihr hin.
//
// Bei steigendem lightOffset wandert also jeder Bodenschatten nach links und
// jedes Glanzlicht nach rechts. Vier Formen liefen dagegen — Tube, Tropfen,
// Pulver und Gel schoben ihren Deckel- bzw. Kernglanz auf die Schattenseite,
// bei Tropfen, Pulver und Gel sogar entgegen dem eigenen Korpusglanz. Dieser
// Test haelt die Regel fest, damit die naechste Form nicht wieder raten muss.

const SCHATTEN = /shadow/
const GLANZ = /light|gloss|sheen|sweep|bloom|glint|core|crown|overhead/

interface Probe {
  cx?: number
  tx?: number
  rot?: number
}

function lies(html: string, form: string): Map<string, Probe> {
  const treffer = new Map<string, Probe>()
  const tags = html.matchAll(new RegExp(`<[a-zA-Z]+[^>]*data-${form}-detail="([^"]+)"[^>]*>`, 'g'))
  for (const tag of tags) {
    const [roh, name] = tag
    const probe: Probe = {}
    const cx = roh.match(/ cx="([-\d.]+)"/)
    const tx = roh.match(/ transform="translate\(([-\d.]+)/)
    const rot = roh.match(/ gradientTransform="rotate\(([-\d.]+)/)
    if (cx) probe.cx = Number(cx[1])
    if (tx) probe.tx = Number(tx[1])
    if (rot) probe.rot = Number(rot[1])
    if (probe.cx !== undefined || probe.tx !== undefined || probe.rot !== undefined) {
      treffer.set(name, probe)
    }
  }
  return treffer
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Visual = ComponentType<any>

const FORMEN: Array<{ form: string; Visual: Visual; props: Record<string, unknown> }> = [
  { form: 'vial', Visual: PeptideVialVisual, props: { name: 'Testvial', fillPct: 60, color: '#38bdf8' } },
  { form: 'ampoule', Visual: AmpouleVisual, props: { name: 'Testampulle', color: '#38bdf8' } },
  { form: 'pen', Visual: PenVisual, props: { name: 'Testpen', color: '#38bdf8' } },
  { form: 'tablet', Visual: TabletVisual, props: { name: 'Testtablette', color: '#38bdf8' } },
  { form: 'capsule', Visual: CapsuleVisual, props: { name: 'Testkapsel', color: '#38bdf8' } },
  { form: 'drops', Visual: DropsVisual, props: { name: 'Testtropfen', color: '#38bdf8' } },
  { form: 'nasal-spray', Visual: NasalSprayVisual, props: { name: 'Testspray', color: '#38bdf8' } },
  { form: 'tube', Visual: TubeVisual, props: { name: 'Testtube' } },
  { form: 'patch', Visual: PatchVisual, props: { name: 'Testpflaster' } },
  { form: 'powder', Visual: PowderVisual, props: { name: 'Testpulver', color: '#38bdf8' } },
  { form: 'gel', Visual: GelVisual, props: { name: 'Testgel', color: '#38bdf8' } },
  { form: 'spray', Visual: SprayVisual, props: { name: 'Testspray', color: '#38bdf8' } },
]

describe('Buehnenlicht: Richtung', () => {
  it.each(FORMEN)('$form schiebt Schatten und Glanz auseinander', ({ form, Visual, props }) => {
    const links = lies(renderToStaticMarkup(createElement(Visual, { ...props, lightOffset: -1 })), form)
    const rechts = lies(renderToStaticMarkup(createElement(Visual, { ...props, lightOffset: 1 })), form)

    let schattenBewegt = 0
    let glanzBewegt = 0

    for (const [name, a] of links) {
      const b = rechts.get(name)
      if (!b) continue
      for (const kanal of ['cx', 'tx', 'rot'] as const) {
        const von = a[kanal]
        const bis = b[kanal]
        if (von === undefined || bis === undefined) continue
        const weg = bis - von
        if (Math.abs(weg) < 0.01) continue
        if (SCHATTEN.test(name)) {
          expect(`${form}/${name}.${kanal} = ${weg}`).toBe(`${form}/${name}.${kanal} = ${-Math.abs(weg)}`)
          schattenBewegt += 1
        } else if (GLANZ.test(name)) {
          expect(`${form}/${name}.${kanal} = ${weg}`).toBe(`${form}/${name}.${kanal} = ${Math.abs(weg)}`)
          glanzBewegt += 1
        }
      }
    }

    // Eine Form darf die Regel nicht dadurch erfuellen, dass sie gar nicht auf
    // die Lampe reagiert.
    expect({ form, schattenBewegt: schattenBewegt > 0, glanzBewegt: glanzBewegt > 0 })
      .toEqual({ form, schattenBewegt: true, glanzBewegt: true })
  })
})
