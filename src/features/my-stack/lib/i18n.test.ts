import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourcePath = resolve('scripts/my-stack-i18n-source.mjs')
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
const DEFERRED_LOCALE_HASHES = {
  ar: 'afd4aa71634ac834d2b185a3b837f6176fd88b68df6409141c9a15d60561c438',
  es: '39c03cb7a7cdf71c8d1189a0b6fb06518cc652ee9afcd9cd45b73fc7b885bf30',
  fr: '1b30fe05934dee975dce693b911fbc5cbcc25289c75cd3a6dab48f42462dea8b',
  hi: 'cf86b1259f69d34d77f57258fceb2ad4fae555c05c19f5a8fc7dc706cd526c9f',
  id: '0d519fc5353b955b5190528046d84b56e0a8d60651f33352e8bf5d9e812b7fe8',
  it: 'c0e8fd19cc69c16990f29ba1b85e744ab32e87dada9bf4a74cfe4051ae93ee84',
  ja: '5c747ce03319e3e75745281ef7f0d225577f20d829318922d5ffd6ac82852254',
  ko: '9f330ed6e0aa3f06db5f0e9cedda7ac05f415c508050b8a386f53357b5ba4b5f',
  pt: '05cf92a8ff84c346c9a699bd24823e939a3dc8a972df81387204165e5cd3c738',
  ru: '199f6fcfd749a7d0023745eb624a330ecd672641168b937b33182dcc3983c5f9',
  tr: '9cb9d14020b2a3d015fcf5880936cfc115e5d8cbf39d7b9055489a05002ab7f8',
  zh: 'ac72e3e0be5e3d4807559670cd51e44feb8fc08dc006fe0dadf2a069cd3717e3',
} as const
const deferredLocaleCodes = Object.keys(DEFERRED_LOCALE_HASHES) as Array<keyof typeof DEFERRED_LOCALE_HASHES>
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

describe('My Stack DE/EN locale contract', () => {
  it('pins the exact approved matching and protected manual source keys', async () => {
    expect(existsSync(sourcePath)).toBe(true)
    if (!existsSync(sourcePath)) return

    const { MY_STACK_DE, MY_STACK_EN, MY_STACK_KEYS } = await loadSource()

    expect(MY_STACK_KEYS).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(Object.keys(MY_STACK_DE)).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(Object.keys(MY_STACK_EN)).toEqual([...EXPECTED_MY_STACK_KEYS])
    expect(EXPECTED_MY_STACK_KEYS).toHaveLength(94)
    expect(MY_STACK_KEYS.filter(key =>
      key.startsWith('plib_') ||
      key.startsWith('lab_') ||
      key.startsWith('research_') ||
      key.startsWith('pk_'),
    )).toEqual([])
    expect(MY_STACK_EN.stack_category_peptide).toBe('Peptide')
    expect(MY_STACK_DE.stack_category_peptide).toBe('Peptid')
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

  it.each(deferredLocaleCodes)('keeps deferred locale %s byte-independent and namespace-free', async (code) => {
    const locale = loadLocale(code)
    const newNamespaceKeys = EXPECTED_MY_STACK_KEYS.filter(key =>
      key.startsWith('my_stack_') ||
      key.startsWith('stack_category_') ||
      key.startsWith('dosage_form_'),
    )

    expect(canonicalHash(locale)).toBe(DEFERRED_LOCALE_HASHES[code])
    expect(newNamespaceKeys.filter(key => Object.hasOwn(locale, key))).toEqual([])
  })
})
