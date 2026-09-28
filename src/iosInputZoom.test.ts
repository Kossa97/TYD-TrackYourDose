import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Unter 16 px Schrift zoomt Safari beim Fokus auf ein Eingabefeld — in der
// Home-Screen-App bleibt die Seite danach vergroessert, und Knoepfe (etwa das
// X der My-Stack-Suche) liegen ausserhalb des Bildes.
describe('iOS-Eingabezoom', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
  const start = css.indexOf('@supports (-webkit-touch-callout: none)')
  const block = css.slice(start, css.indexOf('\n}\n', start))

  it('hebt Eingabefelder auf iOS auf mindestens 16 px', () => {
    expect(start).toBeGreaterThan(-1)
    expect(block).toMatch(/select/)
    expect(block).toMatch(/textarea/)
    expect(block).toMatch(/font-size:\s*16px\s*!important/)
  })

  it('verkleinert ausdruecklich grosse Felder nicht', () => {
    expect(block).toMatch(/:not\([^)]*\.text-lg/)
  })
})
