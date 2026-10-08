import { expect, test } from './support/fixtures'
import { seedBpc157 } from './support/myStack'

test('Blutspiegel: Werte links, Wischen blaettert zurueck, „Jetzt" springt ans Ende', async ({ page, mock }) => {
  const profil = mock.insert('pk_profiles', {
    name: 'BPC-157', half_life_hours: 4, tmax_hours: 0.5, bioavailability_sc: 1, iu_per_mg: null, vd_l_kg: null, category: 'peptide',
  })
  mock.table('substance_catalog').find(row => row.canonical_name === 'BPC-157')!.pk_profile_id = profil.id
  seedBpc157(mock, { startDate: '2026-08-01' })
  mock.table('stack_items')[0].pk_profile_method = 'Subkutan'
  const zyklus = mock.table('cycles')[0]
  // jeden Morgen eingenommen, seit Zyklusbeginn
  for (let tag = new Date('2026-08-01T06:00:00Z'); tag < new Date('2026-09-28T06:00:00Z'); tag = new Date(tag.getTime() + 864e5)) {
    mock.insert('dose_logs', {
      logged_at: tag.toISOString(), dose: 250, unit: 'mcg', method: 'Subkutan', taken: true,
      cycle_id: zyklus.id, plan_version_id: zyklus.plan_version_id ?? null, stack_item_id: zyklus.stack_item_id,
    })
  }
  await page.goto('/simulation')
  const graph = page.getByRole('img', { name: /BPC-157/ })
  await expect(graph).toBeVisible()
  await page.getByRole('radio', { name: '1 W.' }).click()
  await page.waitForTimeout(800)
  if (process.env.SCREENSHOT_DIR) await graph.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pk-jetzt.png` })
  await expect(page.locator('[data-chart-jump-now]')).toHaveCount(0)

  // mit der Maus nach rechts ziehen = in die Vergangenheit
  await graph.scrollIntoViewIfNeeded()
  const box = (await graph.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
  const jetzt = page.locator('[data-chart-jump-now]')
  await expect(jetzt).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await graph.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pk-zurueck.png` })
  await jetzt.click()
  await expect(jetzt).toHaveCount(0)
})
