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
  'my_stack_course_timezone_review',
  'my_stack_course_timezone',
  'my_stack_course_timezone_error',
  'my_stack_course_timezone_confirm',
  'pk_data_load_error',
  'inj_plan_load_error',
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
  'my_stack_plan_management',
  'my_stack_plan_status_planned',
  'my_stack_plan_status_active',
  'my_stack_plan_status_paused',
  'my_stack_plan_status_ended',
  'my_stack_plan_restart',
  'my_stack_plan_next_intake',
  'my_stack_plan_next_intake_none',
  'my_stack_plan_open_end',
  'my_stack_plan_day',
  'my_stack_plan_day_of',
  'my_stack_plan_duration_single',
  'my_stack_plan_duration_multiple',
  'my_stack_plan_now',
  'my_stack_plan_valid_since',
  'my_stack_plan_from_date',
  'my_stack_plan_last_plan',
  'my_stack_plan_slot_count_single',
  'my_stack_plan_slot_count_multiple',
  'my_stack_plan_dose_history',
  'my_stack_plan_planned_count',
  'my_stack_plan_step_planned',
  'my_stack_plan_step_start',
  'my_stack_plan_step_dose',
  'my_stack_plan_step_schedule',
  'my_stack_plan_step_titration',
  'my_stack_plan_change_same',
  'my_stack_plan_change_increased',
  'my_stack_plan_change_decreased',
  'my_stack_plan_change_changed',
  'my_stack_plan_change_new',
  'my_stack_plan_change_removed',
  'my_stack_plan_adjust_dose',
  'my_stack_plan_adjust_schedule',
  'my_stack_plan_edit_future',
  'my_stack_plan_remove_future',
  'my_stack_plan_pause',
  'my_stack_plan_resume',
  'my_stack_plan_pause_end',
  'my_stack_plan_end',
  'my_stack_plan_action_error',
  'my_stack_plan_load_error',
  'my_stack_calendar_timezone_review',
  'my_stack_calendar_timezone_review_action',
  'my_stack_plan_restart_error',
  'my_stack_plan_pause_title',
  'my_stack_plan_pause_end_title',
  'my_stack_plan_remove_future_title',
  'my_stack_plan_end_title',
  'my_stack_plan_pause_confirm',
  'my_stack_plan_pause_end_confirm',
  'my_stack_plan_remove_future_confirm',
  'my_stack_plan_end_confirm',
  'my_stack_plan_pause_neutral',
  'my_stack_plan_conflict_title',
  'my_stack_plan_conflict_copy',
  'my_stack_plan_conflict_started',
  'my_stack_plan_conflict_keep',
  'my_stack_plan_conflict_error',
  'my_stack_plan_pause_until_optional',
  'my_stack_plan_pause_until',
  'my_stack_plan_end_copy',
  'my_stack_plan_remove_future_copy',
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
// Diese Hashes nageln alles AUSSERHALB des My-Stack-Bereichs fest: der
// Overlay-Generator soll nichts anderes anfassen. Sie aendern sich, wenn
// jemand bewusst einen Schluessel daneben ergaenzt — zuletzt
// die Texte des Bestaetigungs-Sheets (`confirm_sheet_*`, `verpasst`,
// `dose_mark_taken`), zuletzt das Mengenfeld darin (`confirm_sheet_dose_label`).
const MANUAL_OUTSIDE_OVERLAY_HASHES = {
  de: '9c85c83e31329e7b8bab29ee867af94ea4b43f16e9a4cf96378f524f18a3077e',
  en: '1f2a2f59cd3b3e3b24c7172f4d24d922cedbebfca0f81e8862796441228e130b',
} as const
const TRANSLATED_OUTSIDE_OVERLAY_HASHES = {
  ar: 'a04902a2d0e44c1980f76c4553a49ce36c5515a7aebf911a3c05a82402db73ad',
  es: 'f20faa270a577ffe66badcf89a18c7ffdf5e8dfd6f9016c44dc86fa4dbba0e9f',
  fr: '069b7d6c1fddd07cc52bb90415dd800a2c5e027ee0190d3003ea69bcdf4ee60f',
  hi: 'e634aae0209c67dcd307509e366168494aef9d0eb53689d951fe40366cd4b34b',
  id: '58ae229d837c4a3c9974659fb5502511de0edb03537e68554b185a1d304f47cb',
  it: '86934330176be0ca86fc4b0c8abde3c4e1719b33ae645865b60b7bd7211fb2d1',
  ja: '56ad4a222b4e492b692dadc65f9f793d54722553ce21a415898c74c459ce1faa',
  ko: '51ed2aec69875b632a3c2856307715c53c27b4d8ef24aba4295c5df60b63e626',
  pt: '3f87ebce0d6f965eddc2d0be23392816ab663c0ef5811f3fecef1119cf5adde2',
  ru: '8c4a827c042d28448371d80ee7b89d449922a35d861ddcf907057f0320b548c4',
  tr: '02f430a719ea43a1810389c7cf87ec2e97b481ac0764350506f55078bce0cfe7',
  zh: 'bb68ba8c47ee999d7099a2d8bb898eb9e77c821e7b563577c51e6c9a424bbdd8',
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

  it('ships polished German and English plan lifecycle copy', async () => {
    const { MY_STACK_DE, MY_STACK_EN } = await loadSource()

    expect(MY_STACK_DE.my_stack_plan_adjust_dose).toBe('Dosis anpassen')
    expect(MY_STACK_DE.my_stack_plan_adjust_schedule).toBe('Plan anpassen')
    expect(MY_STACK_DE.my_stack_plan_pause_neutral).toBe('Während der Pause ist keine Einnahme fällig.')
    expect(MY_STACK_DE.my_stack_plan_end_copy).toContain('Verlauf bleibt erhalten')
    expect(MY_STACK_DE.my_stack_plan_action_error).toContain('Bitte versuche es erneut')
    expect(MY_STACK_DE.my_stack_plan_load_error).toContain('nicht geladen')
    expect(MY_STACK_EN.my_stack_plan_adjust_dose).toBe('Adjust dose')
    expect(MY_STACK_EN.my_stack_plan_adjust_schedule).toBe('Adjust schedule')
    expect(MY_STACK_EN.my_stack_plan_pause_neutral).toBe('No intake is due while the plan is paused.')
    expect(MY_STACK_EN.my_stack_plan_conflict_title).toBe('Which plan is actually running?')
    expect(MY_STACK_EN.my_stack_plan_conflict_copy).toContain('complete history will be preserved')
    expect(MY_STACK_EN.my_stack_plan_end_copy).toContain('history remains available')
    expect(MY_STACK_EN.my_stack_plan_action_error).toContain('Please try again')
    expect(MY_STACK_EN.my_stack_plan_load_error).toContain('could not be loaded')
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
