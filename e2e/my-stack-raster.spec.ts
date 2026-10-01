import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import type { MockSupabase } from './support/mockSupabase'
import { seedPeptide, stageObject } from './support/myStack'

/**
 * Das Raster im Vollbild: aus dem Karussell herausgezoomt, mit allen
 * Substanzen und nur einem X. Gemischte Formen und Kategorien.
 */
const FORMEN = ['vial', 'pen', 'tablet', 'capsule', 'nasal_spray', 'ampoule', 'drops', 'spray', 'patch', 'tube', 'gel', 'powder']

function seedSubstanzen(mock: MockSupabase, anzahl: number): string[] {
  const namen = (mock.table('substance_catalog') as Array<{ canonical_name: string }>)
    .map(row => row.canonical_name)
    .slice(0, anzahl)
  namen.forEach((name, i) => seedPeptide(mock, name, {
    startDate: '2026-09-01',
    dosageForm: FORMEN[i % FORMEN.length],
    // Jede dritte ist ein Medikament: das Raster zeigt trotzdem alle.
    category: i % 3 === 2 ? 'medication' : 'peptide',
  }))
  return namen
}

async function oeffneRaster(page: Page) {
  await page.getByRole('button', { name: 'Sortierung', exact: true }).click()
  await page.getByRole('button', { name: 'Raster' }).click()
  const raster = page.getByRole('dialog', { name: 'Raster' })
  await expect(raster).toBeVisible()
  // Die Animation ist durch, wenn das X ganz da ist.
  await expect.poll(() => raster.getByRole('button', { name: 'Schließen' }).evaluate(el => getComputedStyle(el.parentElement!).opacity)).toBe('1')
  return raster
}

test('Raster: zeigt alle Substanzen, auch aus anderen Reitern, ohne Kopf und Tableiste', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 9)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()
  await page.getByRole('tab', { name: /^Peptide/ }).click()

  const raster = await oeffneRaster(page)
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(9)
  for (const name of namen) await expect(raster.getByRole('button', { name, exact: true })).toBeVisible()

  // Die Reiter unten im Raster filtern; es oeffnet mit „Alle".
  const reiter = raster.getByRole('tablist')
  await expect(reiter.getByRole('tab', { name: /^Alle/ })).toHaveAttribute('aria-selected', 'true')
  const reiterUnten = await reiter.boundingBox()
  expect(reiterUnten!.y).toBeGreaterThan(page.viewportSize()!.height * 0.75)
  await reiter.getByRole('tab', { name: /^Medikamente/ }).click()
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(3)
  await expect(raster.getByRole('button', { name: namen[2], exact: true })).toHaveCSS('opacity', '1')
  await reiter.getByRole('tab', { name: /^Alle/ }).click()
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(9)

  // Neun teilen sich den Bildschirm als 3 × 3.
  const spalten = await raster.locator('[data-zoom-index]').evaluateAll(kacheln =>
    new Set(kacheln.map(k => Math.round(k.getBoundingClientRect().left))).size)
  expect(spalten).toBe(3)

  // Alles andere liegt darunter: das Raster deckt die Tableiste zu.
  const leiste = await page.getByRole('navigation', { name: 'Navigation' }).boundingBox()
  const oben = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-zoom-raster]') !== null,
    { x: leiste!.x + leiste!.width / 2, y: leiste!.y + leiste!.height / 2 })
  expect(oben).toBe(true)
})

test('Raster: Antippen öffnet das Vollbild, Schließen führt ins Raster, X ins Karussell', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 6)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()
  const raster = await oeffneRaster(page)

  await raster.getByRole('button', { name: namen[2], exact: true }).click()
  const vollbild = page.getByRole('dialog', { name: namen[2] })
  await expect(vollbild).toBeVisible()
  await vollbild.getByRole('button', { name: 'Schließen' }).click()
  await expect(vollbild).toBeHidden()
  await expect(raster).toBeVisible()

  // Escape schliesst nur das Oberste: das Vollbild, nicht das Raster darunter.
  await raster.getByRole('button', { name: namen[2], exact: true }).click()
  await expect(vollbild).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(vollbild).toBeHidden()
  // Laenger als die Schliess-Feder: schloesse Escape auch das Raster, waere
  // es bis dahin weg.
  await page.waitForTimeout(1200)
  await expect(raster).toBeVisible()

  await raster.getByRole('button', { name: 'Schließen' }).click()
  await expect(raster).toBeHidden()
  // Zurueck im Karussell, bei der zuletzt geoeffneten Substanz — und sie
  // ist wieder sichtbar (waehrend des Flugs war ihr Platz verdeckt).
  const slot = stageObject(page, namen[2])
  await expect(slot).toBeInViewport({ ratio: 0.9 })
  await expect(slot).toHaveCSS('visibility', 'visible')
})

test('Raster: ohne Bewegung erscheint es sofort, und die App startet danach im Karussell', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 4)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Ein gespeichertes „grid" aus der vorigen Version wird zum Karussell.
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'grid'))
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()

  const raster = await oeffneRaster(page)
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(4)
  await page.keyboard.press('Escape')
  await expect(raster).toBeHidden()
})

/** Zwei Finger, waagerecht um (x, y), von `von` auf `bis` Pixel Abstand. */
async function zweiFinger(
  page: Page,
  mitte: { x: number; y: number },
  von: number,
  bis: number,
  { loslassen = true, schritte = 12 } = {},
) {
  const cdp = await page.context().newCDPSession(page)
  const punkte = (abstand: number) => [
    { x: mitte.x - abstand / 2, y: mitte.y, id: 0 },
    { x: mitte.x + abstand / 2, y: mitte.y, id: 1 },
  ]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkte(von) })
  for (let i = 1; i <= schritte; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punkte(von + ((bis - von) * i) / schritte) })
    await page.waitForTimeout(16)
  }
  if (loslassen) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  return cdp
}

async function bildschirmMitte(page: Page) {
  const { width, height } = page.viewportSize()!
  return { x: width / 2, y: height / 2 }
}

test('Zoom-Geste: zusammenziehen im Karussell öffnet das Raster, die Seite zoomt nicht mit', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 6)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()

  await zweiFinger(page, await bildschirmMitte(page), 260, 100)
  const raster = page.getByRole('dialog', { name: 'Raster' })
  await expect(raster).toBeVisible()
  await expect.poll(() => raster.getByRole('button', { name: 'Schließen' }).evaluate(el => getComputedStyle(el.parentElement!).opacity)).toBe('1')
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)
})

test('Zoom-Geste: der Übergang folgt den Fingern, zu wenig gezogen springt zurück', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 6)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()

  // Halb zusammen, Finger bleiben liegen: das Raster steht halb da.
  const cdp = await zweiFinger(page, await bildschirmMitte(page), 260, 235, { loslassen: false })
  const raster = page.getByRole('dialog', { name: 'Raster' })
  await expect(raster).toBeAttached()
  const hintergrund = Number(await raster.locator('> div').first().evaluate(el => getComputedStyle(el).opacity))
  expect(hintergrund).toBeGreaterThan(0.2)
  expect(hintergrund).toBeLessThan(1)

  // Kurz ruhig halten, dann loslassen — so wenig Weg und kein Schwung:
  // zurueck ins Karussell.
  await page.waitForTimeout(200)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(raster).toBeHidden()
  await expect(stageObject(page, namen[0])).toHaveCSS('visibility', 'visible')
})

test('Raster passt sich an: wenige groß, viele auf Seiten, zwei Zoomstufen, auseinander zurück ins Karussell', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 20)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()
  const raster = await oeffneRaster(page)

  // 20 in der ersten Stufe: 4 × 4 und eine zweite Seite, mit Seitenpunkten.
  await expect(raster.locator('[data-zoom-seite]')).toHaveCount(2)
  await expect(raster.locator('[data-zoom-seitenpunkt]')).toHaveCount(2)
  await expect(raster.locator('[data-zoom-seite="0"] [data-zoom-id]')).toHaveCount(16)

  // Zusammenziehen: dichtere Stufe, alles auf einer Seite.
  await zweiFinger(page, await bildschirmMitte(page), 240, 150)
  await expect(raster).toHaveAttribute('data-zoom-stufe', '1')
  await expect(raster.locator('[data-zoom-seite]')).toHaveCount(1)

  // Auseinander: zurueck auf die erste Stufe.
  await zweiFinger(page, await bildschirmMitte(page), 150, 240)
  await expect(raster).toHaveAttribute('data-zoom-stufe', '0')

  // Ein Reiter mit wenigen: die Kacheln werden gross (hoechstens 3 Spalten).
  await raster.getByRole('tablist').getByRole('tab', { name: /^Medikamente/ }).click()
  const spalten = await raster.locator('[data-zoom-id]').evaluateAll(kacheln =>
    new Set(kacheln.map(k => Math.round(k.getBoundingClientRect().left))).size)
  expect(spalten).toBeLessThanOrEqual(3)
  await raster.getByRole('tablist').getByRole('tab', { name: /^Alle/ }).click()

  // Auseinander ueber einer Substanz: zurueck ins Karussell, genau zu ihr.
  const ziel = raster.getByRole('button', { name: namen[5], exact: true })
  const kasten = (await ziel.boundingBox())!
  await zweiFinger(page, { x: kasten.x + kasten.width / 2, y: kasten.y + kasten.height / 2 }, 60, 200)
  await expect(raster).toBeHidden()
  await expect(stageObject(page, namen[5])).toBeInViewport({ ratio: 0.9 })
})

test('Zoom-Geste im Vollbild einer Substanz öffnet kein Raster', async ({ page, mock }) => {
  // Eine einzige: sie steht in der Mitte, ein Tipp oeffnet ihr Vollbild.
  const namen = seedSubstanzen(mock, 1)
  await page.goto('/my-stack')
  const objekt = stageObject(page, namen[0])
  await expect(objekt).toBeVisible()
  await objekt.click()
  const vollbild = page.getByRole('dialog', { name: namen[0] })
  await expect(vollbild).toBeVisible()

  await zweiFinger(page, await bildschirmMitte(page), 260, 100)
  await page.waitForTimeout(600)
  await expect(page.getByRole('dialog', { name: 'Raster' })).toHaveCount(0)
  await expect(vollbild).toBeVisible()
})

test('Zoom-Geste: die Substanz fliegt in ihrer echten Größe los, auch eine Tablette', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01', dosageForm: 'tablet' })
  await page.goto('/my-stack')
  const objekt = stageObject(page, 'BPC-157')
  await expect(objekt).toBeVisible()
  const imKarussell = (await objekt.locator('[data-stage-fit-box]').boundingBox())!

  // Ein wenig zusammen, Finger bleiben liegen: der Flieger hat uebernommen.
  await zweiFinger(page, await bildschirmMitte(page), 260, 245, { loslassen: false })
  const flieger = page.locator('[data-zoom-flieger]')
  await expect(flieger).toHaveCSS('visibility', 'visible')
  const kasten = (await flieger.locator('[data-stage-fit-box]').boundingBox())!
  // Kaum geschrumpft, also fast gleich gross — nicht halb so gross.
  expect(kasten.width / imKarussell.width).toBeGreaterThan(0.85)
})
