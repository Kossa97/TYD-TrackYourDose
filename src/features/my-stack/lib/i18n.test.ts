import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve('scripts/my-stack-i18n-source.mjs')
const localeCodes = ['de', 'en', 'ar', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh'] as const
const manualLocaleCodes = ['de', 'en'] as const
const EXPECTED_MY_STACK_KEYS = [
  'my_stack_title',
  'my_stack_tab_peptide',
  'my_stack_tab_medication',
  'my_stack_tab_hormone',
  'my_stack_tab_supplement',
  'my_stack_tab_vitamin',
  'my_stack_tab_other',
  'my_stack_tab_empty',
  'my_stack_sort_created_desc',
  'my_stack_sort_created_asc',
  'my_stack_sort_group_created',
  'my_stack_add_item',
  'my_stack_edit_item',
  'my_stack_question',
  'my_stack_search_placeholder',
  'my_stack_catalog_results',
  'my_stack_browse_catalog',
  'my_stack_jump_to_letter',
  'my_stack_catalog_unavailable',
  'my_stack_add_custom',
  'my_stack_category',
  'my_stack_category_select',
  'my_stack_category_required',
  'my_stack_from_catalog',
  'my_stack_from_catalog_pk',
  'my_stack_combination',
  'my_stack_detach_catalog',
  'my_stack_name_required',
  'my_stack_add_ingredient',
  'my_stack_ingredient_1',
  'my_stack_ingredient_2',
  'my_stack_ingredient_required',
  'my_stack_ingredients_question',
  'my_stack_ingredients_intro',
  'my_stack_ingredients_next',
  'my_stack_dosage_form',
  'my_stack_dosage_form_required',
  'my_stack_common_dosage_forms',
  'my_stack_suggested_dosage_forms',
  'my_stack_current_dosage_form',
  'my_stack_show_more_dosage_forms',
  'my_stack_hide_more_dosage_forms',
  'my_stack_more_dosage_forms',
  'my_stack_strength',
  'my_stack_strength_value',
  'my_stack_strength_value_required',
  'my_stack_strength_unit',
  'my_stack_strength_unit_required',
  'my_stack_basis_value',
  'my_stack_basis_value_required',
  'my_stack_basis_unit',
  'my_stack_basis_unit_required',
  'my_stack_per',
  'my_stack_other_unit',
  'my_stack_no_dosage_advice',
  'my_stack_strength_hint_per_unit',
  'my_stack_strength_hint_per_volume',
  'my_stack_strength_hint_reconstituted',
  'my_stack_strength_hint_per_mass',
  'my_stack_strength_hint_vial_solution',
  'my_stack_strength_value_vial',
  'my_stack_basis_value_solvent',
  'my_stack_basis_unit_solvent',
  'my_stack_strength_concentration',
  'my_stack_brand_optional',
  'my_stack_color_optional',
  'my_stack_notes_optional',
  'my_stack_review',
  'my_stack_step_substance',
  'my_stack_step_ingredients',
  'my_stack_step_dosage_form',
  'my_stack_step_color',
  'my_stack_step_strength',
  'my_stack_step_review',
  'my_stack_identity_changed',
  'my_stack_existing_variant',
  'my_stack_update_existing',
  'my_stack_change_existing',
  'my_stack_create_variant',
  'my_stack_variant_choice_required',
  'my_stack_duplicate_found',
  'my_stack_open_existing',
  'my_stack_add_separately',
  'my_stack_add_anyway',
  'my_stack_needs_review',
  'my_stack_visual_pending',
  'my_stack_save_error',
  'my_stack_step_tracking_level',
  'my_stack_step_plan',
  'my_stack_this_substance',
  'my_stack_tracking_question',
  'my_stack_tracking_intro',
  'my_stack_tracking_level',
  'my_stack_tracking_level_required',
  'my_stack_tracking_intake_only_title',
  'my_stack_tracking_intake_only_subtitle',
  'my_stack_tracking_intake_only_recorded',
  'my_stack_tracking_entry_caption',
  'my_stack_tracking_with_amount_title',
  'my_stack_tracking_with_amount_subtitle',
  'my_stack_tracking_with_amount_recorded',
  'my_stack_tracking_with_amount_entry',
  'my_stack_tracking_complete_title',
  'my_stack_tracking_complete_subtitle',
  'my_stack_tracking_complete_recorded',
  'my_stack_tracking_complete_entry',
  'my_stack_intake_unit_syringe',
  'my_stack_intake_unit_dose',
  'my_stack_intake_unit_tablet',
  'my_stack_intake_unit_capsule',
  'my_stack_intake_unit_drop',
  'my_stack_intake_unit_portion',
  'my_stack_intake_unit_spray',
  'my_stack_intake_unit_application',
  'my_stack_intake_unit_patch',
  'my_stack_intake_unit_unit',
  'my_stack_tracking_curve_caption',
  'my_stack_tracking_curve_example',
  'my_stack_tracking_curve_explained',
  'my_stack_tracking_pk_available',
  'my_stack_tracking_pk_unavailable',
  'my_stack_tracking_promise',
  'my_stack_tracking_change_later',
  'my_stack_plan_method',
  'my_stack_plan_method_placeholder',
  'my_stack_plan_method_required',
  'my_stack_plan_frequency',
  'my_stack_plan_frequency_required',
  'my_stack_plan_start_date',
  'my_stack_plan_start_date_hint',
  'my_stack_plan_start_date_required',
  'my_stack_plan_end_date',
  'my_stack_plan_end_date_hint',
  'my_stack_plan_end_date_before_start',
  'my_stack_plan_end_open',
  'my_stack_plan_on_demand_hint',
  'my_stack_plan_rhythm',
  'my_stack_rhythm_daily',
  'my_stack_rhythm_weekdays',
  'my_stack_rhythm_interval',
  'my_stack_rhythm_cycle',
  'my_stack_rhythm_on_demand',
  'my_stack_rhythm_interval_value',
  'my_stack_rhythm_interval_unit',
  'my_stack_rhythm_unit_day',
  'my_stack_rhythm_unit_week',
  'my_stack_rhythm_unit_month',
  'my_stack_rhythm_interval_invalid',
  'my_stack_rhythm_cycle_on',
  'my_stack_rhythm_cycle_off',
  'my_stack_rhythm_cycle_invalid',
  'my_stack_plan_section_how',
  'my_stack_plan_steps',
  'my_stack_plan_step_from',
  'my_stack_plan_step_current',
  'my_stack_plan_step_remove',
  'my_stack_plan_step_removed',
  'my_stack_plan_step_remove_failed',
  'my_stack_plan_section_period',
  'my_stack_plan_section_when',
  'my_stack_plan_section_each',
  'my_stack_plan_summary',
  'my_stack_plan_summary_until',
  'my_stack_plan_reminders_on_demand',
  'my_stack_rhythm_summary_weekdays',
  'my_stack_rhythm_summary_interval',
  'my_stack_rhythm_summary_every_week',
  'my_stack_rhythm_summary_every_month',
  'my_stack_rhythm_summary_cycle',
  'my_stack_plan_remove_slot',
  'my_stack_plan_slot_duplicate',
  'my_stack_plan_daily_per_day',
  'my_stack_plan_day_question',
  'my_stack_weekday_mo',
  'my_stack_weekday_di',
  'my_stack_weekday_mi',
  'my_stack_weekday_do',
  'my_stack_weekday_fr',
  'my_stack_weekday_sa',
  'my_stack_weekday_so',
  'my_stack_plan_day_question_any',
  'my_stack_plan_slot_fewer',
  'my_stack_plan_slot_more',
  'my_stack_plan_day_tabs',
  'my_stack_plan_day_tab',
  'my_stack_plan_slot_unknown_day',
  'my_stack_plan_day_without_intake',
  'my_stack_plan_interval',
  'my_stack_plan_weekdays',
  'my_stack_plan_routine_group',
  'my_stack_plan_routine_required',
  'my_stack_plan_time',
  'my_stack_plan_quantity',
  'my_stack_plan_quantity_required',
  'my_stack_plan_unit',
  'my_stack_plan_unit_required',
  'my_stack_plan_reminders_optional',
  'my_stack_routine_morning',
  'my_stack_routine_midday',
  'my_stack_routine_evening',
  'my_stack_daily_behavior',
  'my_stack_daily_intake_only',
  'my_stack_daily_with_amount',
  'my_stack_daily_complete',
  'my_stack_plan_exact_time',
  'my_stack_no_exact_time',
  'my_stack_plan_quantity_summary',
  'my_stack_quantity_not_tracked',
  'my_stack_pk_method_title',
  'my_stack_pk_method_confirm',
  'my_stack_pk_method_confirm_copy',
  'my_stack_pk_method_choose_first',
  'my_stack_pk_requirements_missing',
  'my_stack_pk_status',
  'my_stack_pk_available',
  'my_stack_pk_unavailable',
  'my_stack_brand',
  'my_stack_inventory_summary',
  'my_stack_product_inventory',
  'my_stack_inventory_enabled',
  'my_stack_package_quantity',
  'my_stack_package_unit',
  'my_stack_remaining_quantity',
  'my_stack_batch_number_optional',
  'my_stack_expires_at_optional',
  'routine_confirmation_close',
  'routine_group_label',
  'routine_confirmation_title',
  'routine_confirmation_hint',
  'routine_confirmation_saved',
  'routine_inventory_committed_retry',
  'routine_inventory_retry',
  'routine_add_injection_label',
  'routine_add_injection',
  'routine_confirmation_done',
  'routine_select_item',
  'routine_planned_quantity',
  'routine_actual_override',
  'routine_amount_for',
  'routine_confirmation_save_error',
  'routine_confirmation_retry',
  'routine_confirmation_cancel',
  'routine_confirmation_saving',
  'routine_confirmation_confirm_all',
  'quantity_not_tracked',
  'dose_plan_new_standard',
  'dose_plan_add_titration',
  'dose_plan_titration_disclaimer',
  'dose_plan_intake_log',
  'dose_plan_planned',
  'dose_plan_permanent_backfill_failed',
  'dose_plan_titration_backfill_failed',
  'dose_plan_backfilled_one',
  'dose_plan_backfilled_other',
  'pk_status_label',
  'pk_missing_title',
  'pk_unavailable_title',
  'pk_missing_copy',
  'pk_complete_action',
  'pk_unsupported_unit',
  'pk_unsupported_profile',
  'pk_interrupted',
  'pk_planned',
  'pk_requirement_complete_tracking',
  'pk_requirement_method',
  'pk_requirement_dose',
  'pk_requirement_unit',
  'pk_requirement_time',
  'pk_no_ready_items',
  'pk_open_simulation',
  'inventory_update_failed',
  'inventory_committed_retry',
  'inventory_retry',
  'stack_category_peptide',
  'stack_category_medication',
  'stack_category_hormone',
  'stack_category_supplement',
  'stack_category_vitamin',
  'stack_category_other',
  'dosage_form_vial',
  'dosage_form_ampoule',
  'dosage_form_pen',
  'dosage_form_tablet',
  'dosage_form_capsule',
  'dosage_form_drops',
  'dosage_form_powder',
  'dosage_form_nasal_spray',
  'dosage_form_spray',
  'dosage_form_gel',
  'dosage_form_patch',
  'dosage_form_tube',
  'dosage_form_other',
  'nav_peptide',
  'stat_peptides',
  'tile_peptide',
  'tile_peptide_desc',
  'tile_bewertungen_desc',
  'keine_peptide',
  'zuerst_peptid',
  'peptid_label',
  'peptid_optional',
  'kein_peptid',
  'peptid_loeschen_confirm',
  'peptid_aktualisiert',
  'peptid_hinzugefuegt',
  'peptid_bearbeiten_title',
  'kein_peptid_gefunden_msg',
  'share_peptide_desc',
  'share_bewertungen_desc_t',
  'protokoll_effects_by_peptide',
  'protokoll_reviews_by_peptide',
  'calendar_plan_kicker',
  'due_intakes_hint',
] as const
// Die Pruefsumme ueber ALLES ausserhalb des My-Stack-Blocks. Sie soll eine
// unbeabsichtigte Aenderung dort auffallen lassen — und tut das auch: mit
// „Bei Bedarf" ist `freq_bei_bedarf` dazugekommen, ein Schluessel ausserhalb
// des Blocks, und die Zahlen mussten deshalb bewusst neu gesetzt werden.
const MANUAL_OUTSIDE_OVERLAY_HASHES = {
  de: '46212e2d24da60b387e5f3f80fe3887ae7ea53edd7d088a455e1847a6c7681b9',
  en: 'e340b56298e5bc47f368deb82cec55687d1ef5476f9c7e224fefb3e8755fd954',
} as const
const TRANSLATED_OUTSIDE_OVERLAY_HASHES = {
  ar: '45167d07462705a9d069e63944f685b3c9a7b9bfa353f552be75d9c74b41c48e',
  es: 'faf0fd45f1d334a588aba4c7a8c55a5943dc3333d69c18f60337d1d1dbd0f5e3',
  fr: '2b472e44e3b4e0d96d82536b4c9221731372d793349696ff1838fb85734a2ff2',
  hi: '5fe2321710a10bdf40b2b9a7a4a9091581359f6a8d5e8274608476263f2e131e',
  id: '4f2a8f808dc8d69179994c1c27ee2612433d1b5cc9800d997fbc4e1874bdb1f6',
  it: '35c08610e0d51cb491ac6e50644c513f02440341a81e26db8c5a1a3a639b166b',
  ja: 'f8ecf4c6adc7f837f3a436ba9132a90e7811ea3ef7fc7ef0ac38b494150d5291',
  ko: '6a4205088b21a4ae5fae9d1592712ab5531499bdc6281e07df3d80e48ecbb1bd',
  pt: '6820d77703529205004f9534c063b41428ec3b0677a4d31e75361bcebeceb4fb',
  ru: 'c89ace06851227e4400364ffd08fc4ae81d07a3cef63bf37e9e3a310abfa94a5',
  tr: 'f63e2d545afcd0c53c6e420c37e02cd49d11af71c741ce74a87f8da8b535b943',
  zh: '2d2e7b2da9ead8c442a8891e29c373016405f1a590972abe4048cf437a9080d2',
} as const
const expectedKeySet = new Set<string>(EXPECTED_MY_STACK_KEYS)

async function loadSource() {
  return import(pathToFileURL(sourcePath).href) as Promise<{
    MY_STACK_DE: Record<string, string>
    MY_STACK_EN: Record<string, string>
    MY_STACK_KEYS: string[]
  }>
}

function loadLocale(code: string) {
  return JSON.parse(readFileSync(
    resolve(`src/i18n/locales/${code}.json`),
    'utf8',
  )) as Record<string, unknown>
}

function canonicalHash(value: Record<string, unknown>) {
  const canonical = Object.fromEntries(
    Object.keys(value).sort().map(key => [key, value[key]]),
  )
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function withoutMyStackOverlay(locale: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(locale).filter(([key]) => !expectedKeySet.has(key)),
  )
}

function interpolationTokens(value: string) {
  return [...value.matchAll(/{{\s*[^{}]+\s*}}/g)].map(match => match[0]).sort()
}

describe('My Stack DE/EN locale contract', () => {
  it('pins the exact approved matching and protected manual source keys', async () => {
    expect(existsSync(sourcePath)).toBe(true)
    if (!existsSync(sourcePath)) return

    const { MY_STACK_DE, MY_STACK_EN, MY_STACK_KEYS } = await loadSource()

    expect(MY_STACK_KEYS).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(Object.keys(MY_STACK_DE)).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(Object.keys(MY_STACK_EN)).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(new Set(EXPECTED_MY_STACK_KEYS).size).toBe(EXPECTED_MY_STACK_KEYS.length)
    expect(MY_STACK_KEYS.filter(key =>
      key.startsWith('plib_') ||
      key.startsWith('lab_') ||
      key.startsWith('research_'),
    )).toEqual([])
    expect(MY_STACK_EN.stack_category_peptide).toBe('Peptide')
    expect(MY_STACK_DE.stack_category_peptide).toBe('Peptid')
    expect(MY_STACK_EN.routine_confirmation_confirm_all).toBe('Mark all as taken')
    expect(MY_STACK_DE.routine_confirmation_confirm_all).toBe('Alle als eingenommen markieren')
  })

  it.each(manualLocaleCodes)('keeps %s complete and changes nothing outside its overlay', async (code) => {
    const { MY_STACK_DE, MY_STACK_EN } = await loadSource()
    const source = code === 'de' ? MY_STACK_DE : MY_STACK_EN
    const locale = loadLocale(code)

    for (const key of EXPECTED_MY_STACK_KEYS) {
      expect(locale[key], `${code}.${key}`).toBe(source[key])
      expect(source[key].trim(), `${code}.${key}`).not.toBe('')
      expect(source[key], `${code}.${key}`).not.toBe(key)
    }
    expect(canonicalHash(withoutMyStackOverlay(locale))).toBe(MANUAL_OUTSIDE_OVERLAY_HASHES[code])
  })

  it('uses neutral substance copy for generic peptide-era keys', async () => {
    const { MY_STACK_DE, MY_STACK_EN } = await loadSource()
    const neutralKeys = [
      'nav_peptide', 'stat_peptides', 'tile_peptide', 'tile_peptide_desc',
      'tile_bewertungen_desc', 'keine_peptide', 'zuerst_peptid', 'peptid_label',
      'peptid_optional', 'kein_peptid', 'peptid_loeschen_confirm',
      'peptid_aktualisiert', 'peptid_hinzugefuegt', 'peptid_bearbeiten_title',
      'kein_peptid_gefunden_msg', 'share_peptide_desc',
      'share_bewertungen_desc_t', 'protokoll_effects_by_peptide',
      'protokoll_reviews_by_peptide', 'calendar_plan_kicker', 'due_intakes_hint',
    ]

    for (const source of [MY_STACK_DE, MY_STACK_EN]) {
      for (const key of neutralKeys) {
        expect(source[key], key).not.toMatch(/peptid(?:e|s)?/i)
      }
    }
    expect(MY_STACK_EN.kein_peptid).toBe('No substance assigned')
    expect(MY_STACK_DE.kein_peptid).toBe('Keine Substanz zugeordnet')
  })

  it.each(localeCodes)('keeps locale %s complete, token-safe, and unchanged outside the overlay', async (code) => {
    const { MY_STACK_EN } = await loadSource()
    const locale = loadLocale(code)

    for (const key of EXPECTED_MY_STACK_KEYS) {
      expect(locale[key], `${code}.${key}`).toEqual(expect.any(String))
      expect((locale[key] as string).trim(), `${code}.${key}`).not.toBe('')
      expect(locale[key], `${code}.${key}`).not.toBe(key)
      expect(interpolationTokens(locale[key] as string), `${code}.${key} tokens`)
        .toEqual(interpolationTokens(MY_STACK_EN[key]))
    }

    const expectedHash = code === 'de' || code === 'en'
      ? MANUAL_OUTSIDE_OVERLAY_HASHES[code]
      : TRANSLATED_OUTSIDE_OVERLAY_HASHES[code]
    expect(canonicalHash(withoutMyStackOverlay(locale))).toBe(expectedHash)
  })

  it.each(localeCodes)('resolves explicit backfill copy with the real %s i18next rules', async (code) => {
    const dosePlan = await import('./dosePlan') as typeof import('./dosePlan') & {
      backfillMessageKey?: (count: number) => 'dose_plan_backfilled_one' | 'dose_plan_backfilled_other'
    }
    expect(dosePlan.backfillMessageKey, 'MyStackPage needs an explicit one/other key boundary').toBeTypeOf('function')
    if (!dosePlan.backfillMessageKey) return

    const locale = loadLocale(code)
    const runtime = createInstance()
    await runtime.init({
      lng: code,
      fallbackLng: false,
      resources: { [code]: { translation: locale } },
      interpolation: { escapeValue: false },
    })

    const counts = code === 'ar' || code === 'ru' ? [1, 2, 3, 5] : [1, 2]
    for (const count of counts) {
      const key = dosePlan.backfillMessageKey(count)
      const message = runtime.t(key, { count })
      expect(key, `${code}/${count} key`).toBe(count === 1 ? 'dose_plan_backfilled_one' : 'dose_plan_backfilled_other')
      expect(message, `${code}/${count} message`).not.toBe(key)
      expect(message, `${code}/${count} count`).toContain(String(count))
    }
  })
})
