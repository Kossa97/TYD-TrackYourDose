import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/**
 * Bewertungen v2: eine Bewertung haengt an einem Zyklus. Zeitraum, Dauer
 * und Dosis stehen von selbst da; nichts ist vorbelegt; Teilen ist aus.
 */

function bewertung(mock: MockSupabase, name: string, felder: Record<string, unknown>) {
  const item = mock.table('stack_items').find(row => row.display_name === name)!
  return mock.insert('reviews', {
    user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: null, rating: 4, title: '', body: null, pros: null, cons: null,
    experience: 'gut', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: false,
    created_at: '2026-09-01T10:00:00.000Z', updated_at: null, ...felder,
  })
}

/** Den Zyklus der Substanz beenden — so, wie „Zyklus beenden" ihn hinterlaesst. */
function beende(mock: MockSupabase, name: string, endeExklusiv: string): string {
  const item = mock.table('stack_items').find(row => row.display_name === name)!
  const cycle = mock.table('cycles').find(row => row.stack_item_id === item.id)!
  Object.assign(cycle, { active: false, ended_at: `${endeExklusiv}T00:00:00.000Z`, end_local_date: endeExklusiv })
  return String(cycle.id)
}

test('Bewerten: der beendete Zyklus ist vorgewählt, ohne Sterne kein Speichern, dann alles gespeichert', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  await page.goto('/bewertungen')

  await page.getByRole('button', { name: 'Neu' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neue Bewertung' })
  await expect(sheet).toBeVisible()

  // Vorgewaehlt: der beendete Zyklus — mit allem, was dabei war.
  await expect(sheet.getByRole('radiogroup', { name: 'Zyklus' }).getByRole('radio', { checked: true })).toContainText('2026')
  const kontext = sheet.locator('[data-review-context]')
  await expect(kontext).toContainText('12.08.2026 – 19.09.2026')
  await expect(kontext).toContainText('6 Wochen')
  await expect(kontext).toContainText('250 mcg')

  // Nichts vorbelegt: kein Stern gewaehlt, Speichern gesperrt.
  await expect(sheet.getByRole('radiogroup', { name: 'Gesamt' }).getByRole('radio', { checked: true })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Speichern' })).toHaveAttribute('aria-disabled', 'true')
  await expect(sheet.getByText('Zum Speichern Sterne wählen.')).toBeVisible()
  await expect(sheet.locator('[data-review-public]')).not.toBeChecked()

  await sheet.getByRole('radio', { name: '4 Sterne' }).click()
  await sheet.getByRole('radio', { name: 'Wirkung: 5 / 5' }).click()
  await sheet.getByRole('radio', { name: 'Verträglichkeit: 4 / 5' }).click()
  await sheet.getByRole('radio', { name: 'Ja' }).click()
  await sheet.getByLabel('Erfahrung').fill('Schnell gemerkt.')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()

  expect(mock.table('reviews')).toHaveLength(1)
  expect(mock.table('reviews')[0]).toMatchObject({
    cycle_id: zyklus, rating: 4, experience: 'gut', wirkung: 5, vertraeglichkeit: 4, wieder_nehmen: 'ja',
    title: '', body: 'Schnell gemerkt.', is_public: false,
  })
  await expect(page.locator('[data-review-criteria]')).toHaveText('Wirkung 5/5 · Verträglichkeit 4/5 · Wieder nehmen? Ja')
  await expect(page.locator('[data-review-cycle]')).toContainText('2026')

  // Fuer denselben Zyklus gibt es keine zweite: er steht als „bewertet" gesperrt.
  await page.getByRole('button', { name: 'Neu' }).click()
  const zweites = page.getByRole('dialog', { name: 'Neue Bewertung' })
  await expect(zweites.getByRole('radiogroup', { name: 'Zyklus' }).getByRole('radio', { name: /bewertet/ })).toBeDisabled()
  await expect(zweites.getByRole('radio', { name: 'Ohne Zyklus' })).toHaveAttribute('aria-checked', 'true')
})

test('Bewerten: eine alte Bewertung ohne Zyklus bekommt den passenden vorgeschlagen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  mock.insert('reviews', {
    user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: null, rating: 3, title: 'Alt', body: null, pros: null, cons: null,
    experience: 'mittel', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: false,
    created_at: '2026-09-01T10:00:00.000Z', updated_at: null,
  })
  await page.goto('/bewertungen')
  await expect(page.getByText('Alt', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /^Bewertung bearbeiten: BPC-157/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Bewertung bearbeiten' })
  // Die alten Sterne sind da; der Zyklus vom 01.09. ist vorgeschlagen.
  await expect(sheet.getByRole('radio', { name: '3 Sterne' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.locator('[data-review-context]')).toContainText('12.08.2026')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('reviews')[0]).toMatchObject({ cycle_id: zyklus, rating: 3, title: 'Alt' })
})

test('Übersicht: je Substanz gruppiert, mit Schnitt; Wischen und eigenes Lösch-Sheet', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  bewertung(mock, 'BPC-157', { cycle_id: zyklus, rating: 5, title: 'Stark', created_at: '2026-09-21T10:00:00.000Z' })
  bewertung(mock, 'BPC-157', { rating: 2, title: 'Frueher', created_at: '2026-03-01T10:00:00.000Z' })
  bewertung(mock, 'TB-500', { rating: 4, title: 'Solide' })
  await page.goto('/bewertungen')

  const bpc = page.locator('section[data-review-group]', { has: page.getByRole('heading', { name: 'BPC-157' }) })
  await expect(bpc).toContainText('3,5')
  await expect(bpc).toContainText('2 Bewertungen')
  // Der Zyklus zuerst, die alte ohne Zyklus dahinter.
  await expect(bpc.locator('[data-review-cycle]')).toHaveText([/2026/, 'Ohne Zyklus'])

  // Nach links wischen: Loeschen fragt im eigenen Sheet — kein Browser-Fenster.
  page.on('dialog', () => { throw new Error('Browser-Dialog statt Sheet') })
  const zeile = bpc.locator('[data-review-row]').first()
  const box = (await zeile.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width * 0.7 - 30 * i, box.y + box.height / 2)
  await page.mouse.up()
  await zeile.getByRole('button', { name: 'Löschen' }).click()
  const frage = page.getByRole('alertdialog', { name: 'Bewertung löschen?' })
  await expect(frage).toContainText('BPC-157')
  // Abbrechen hat den Fokus: Enter loescht nichts.
  await expect(frage.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await frage.getByRole('button', { name: 'Löschen' }).click()
  await expect(frage).toBeHidden()
  expect(mock.table('reviews').map(row => row.title).sort()).toEqual(['Frueher', 'Solide'])
  await expect(bpc).toContainText('1 Bewertung')
})

test('Übersicht: Ladefehler steht da, mit „Erneut versuchen"', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  bewertung(mock, 'BPC-157', { title: 'Da' })
  await page.route('**/rest/v1/reviews*', route => route.fulfill({ status: 500, json: { message: 'kaputt' } }), { times: 1 })
  await page.goto('/bewertungen')
  const fehler = page.getByRole('alert')
  await expect(fehler).toContainText('Bewertungen konnten nicht geladen werden')
  await fehler.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(fehler).toBeHidden()
  await expect(page.getByText('Da', { exact: true })).toBeVisible()
})

test('My Stack: endgültig löschen sagt, wie viele Bewertungen mitgehen', async ({ page, mock }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  bewertung(mock, 'BPC-157', { title: 'Eins' })
  bewertung(mock, 'BPC-157', { title: 'Zwei' })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  await page.getByRole('dialog', { name: 'BPC-157' }).getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByRole('dialog', { name: 'Substanz entfernen' }).locator('[data-delete-reviews]'))
    .toHaveText('Auch 2 Bewertungen dieser Substanz werden gelöscht.')
})
