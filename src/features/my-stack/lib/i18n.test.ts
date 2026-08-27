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
  'my_stack_add_item',
  'my_stack_edit_item',
  'my_stack_question',
  'my_stack_search_placeholder',
  'my_stack_catalog_results',
  'my_stack_catalog_unavailable',
  'my_stack_add_custom',
  'my_stack_category',
  'my_stack_category_select',
  'my_stack_category_required',
  'my_stack_product_name',
  'my_stack_name_required',
  'my_stack_add_ingredient',
  'my_stack_ingredient_1',
  'my_stack_ingredient_2',
  'my_stack_ingredient_required',
  'my_stack_dosage_form',
  'my_stack_dosage_form_required',
  'my_stack_recommended_dosage_forms',
  'my_stack_common_dosage_forms',
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
  'my_stack_brand_optional',
  'my_stack_color_optional',
  'my_stack_notes_optional',
  'my_stack_review',
  'my_stack_step_substance',
  'my_stack_step_ingredients',
  'my_stack_step_dosage_form',
  'my_stack_step_strength',
  'my_stack_step_details',
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
  'my_stack_tracking_intake_only_recorded',
  'my_stack_tracking_intake_only_omitted',
  'my_stack_tracking_intake_only_example',
  'my_stack_tracking_intake_only_next',
  'my_stack_tracking_with_amount_title',
  'my_stack_tracking_with_amount_recorded',
  'my_stack_tracking_with_amount_omitted',
  'my_stack_tracking_with_amount_example',
  'my_stack_tracking_with_amount_next',
  'my_stack_tracking_complete_title',
  'my_stack_tracking_complete_recorded',
  'my_stack_tracking_complete_omitted',
  'my_stack_tracking_complete_example',
  'my_stack_tracking_complete_next',
  'my_stack_tracking_pk_available',
  'my_stack_tracking_pk_unavailable',
  'my_stack_tracking_change_later',
  'my_stack_plan_method',
  'my_stack_plan_method_placeholder',
  'my_stack_plan_method_required',
  'my_stack_plan_frequency',
  'my_stack_plan_frequency_required',
  'my_stack_plan_start_date',
  'my_stack_plan_start_date_required',
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
  'dosage_form_vial',
  'dosage_form_ampoule',
  'dosage_form_pen',
  'dosage_form_tablet',
  'dosage_form_capsule',
  'dosage_form_drops',
  'dosage_form_liquid',
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
const MANUAL_OUTSIDE_OVERLAY_HASHES = {
  de: '258cc643a3bb558ee9a16f20d7a0bd6295e38def2ad9d9d926134eb7c751829d',
  en: '0f202b9ea6b8691b2a132c343d4370cce6ae30353b1c99a0bbd8c3e9d13aeba2',
} as const
const TRANSLATED_OUTSIDE_OVERLAY_HASHES = {
  ar: '47d5344e6b2132e3f01b5f34676ef2ed038f2d3fa075b4fc737caf3f60955af7',
  es: '91640876a543c84520c876db1e39e1927cb12822011223627cbb76a9384f602c',
  fr: '50c0c189ec48eab0cc972539715e47d9f342f5dd797d6a8c32622a827bac5732',
  hi: '0b18ee80cf3bdab20895e31418df4b9106a3668cba05b4300b8b012c71fb9c44',
  id: 'b809bfe4d2a3eaf32237947bdc3ed5b40fea252fe39c494eeeeefacd305356e8',
  it: 'f125dd3b1a9192fc7b862ace19e63637118d648f13e9afc6ee4a1c25171e3c8f',
  ja: '27cc7be0583af500e96e85ace97b0e7d90ab8d23ae94237e33e48667c91a90b4',
  ko: '3369b42b59420f70e780f4004c70e3a83d3edfbbe116d05d3b2ab2fcb6a4acc0',
  pt: '9b72cfc750c43c71e02962f324d14c6e2c8c831fc656f5a0976c2f35b4d2146e',
  ru: '6502048e718de1669b14a1b9a1a34d94e53ad19885e4b147800bda7b46c44f75',
  tr: '14b492940010acc2b4a6da47e72cc8da982a2c9819772443ea70cc3b2cde2a42',
  zh: 'eb50fbd256c08d05fa789078635b5e9398d471c8316bfeba958f3ca76110794f',
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
