import { buildDuplicateFingerprint } from '../lib/duplicateFingerprint'
import { validateStackItemDraft } from '../lib/validation'
import type {
  DosageFormKey,
  StackCategory,
  StackItem,
  StackItemDraft,
  StackItemIngredient,
  SubstanceCatalogEntry,
} from '../types'

interface ServiceError {
  message: string
}

export type SavedStackItemRow = Omit<StackItem, 'ingredients'>

export interface LoadedStackItemIngredient extends StackItemIngredient {
  substance_catalog: SubstanceCatalogEntry | null
}

export type LoadedStackItem = SavedStackItemRow & {
  ingredients: LoadedStackItemIngredient[]
}

interface StackItemQueryResult {
  data: LoadedStackItem[] | null
  error: ServiceError | null
}

interface StackItemMutationResult {
  error: ServiceError | null
}

interface StackItemArchiveUpdate {
  archived: boolean
  archived_at: string | null
}

interface StackItemReconstitutionUpdate {
  reconstitution_date: string
  vials_in_stock: number
  vials_initial: number
}

export interface VialTrackingUpdate {
  display_name: string
  name: string
  default_method: string
  vial_amount_mg: number | null
  vial_amount_unit: string | null
  reconstitution_ml: number | null
  syringe_type: string | null
  notes: string | null
  vials_in_stock: number
  vials_initial: number
  reconstitution_date: string | null
  expiry_days: number | null
  batch_number: string | null
  batch_source: string | null
  batch_file_url: string | null
  inventory_item_id: string | null
  pk_profile_id: string | null
  color_hex: string | null
}

interface SaveStackItemIngredient {
  catalog_substance_id: string | null
  custom_name: string
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
  position: number
}

export interface SaveStackItemRpcParams {
  p_item: {
    id: string | null
    display_name: string
    category: StackCategory
    dosage_form: DosageFormKey
    brand: string | null
    color_hex: string | null
    notes: string | null
  }
  p_ingredients: SaveStackItemIngredient[]
}

export interface StackItemRpcClient {
  rpc(
    name: 'save_stack_item',
    params: SaveStackItemRpcParams,
  ): PromiseLike<{ data: SavedStackItemRow | null; error: ServiceError | null }>
}

export interface StackItemQueryClient {
  from(table: 'stack_items'): {
    select(columns: string): {
      eq(column: 'archived', value: boolean): {
        order(
          column: 'created_at',
          options: { ascending: false },
        ): PromiseLike<StackItemQueryResult>
      }
    }
  }
}

export interface StackItemMutationClient {
  from(table: 'stack_items'): {
    update(values: StackItemArchiveUpdate | StackItemReconstitutionUpdate | VialTrackingUpdate): {
      eq(column: 'id', value: string): PromiseLike<StackItemMutationResult>
    }
    delete(): {
      eq(column: 'id', value: string): PromiseLike<StackItemMutationResult>
    }
  }
}

const STACK_ITEM_COLUMNS = `
  *,
  ingredients:stack_item_ingredients(
    id,
    stack_item_id,
    catalog_substance_id,
    custom_name,
    amount_value,
    amount_unit,
    basis_value,
    basis_unit,
    position,
    substance_catalog(
      id,
      canonical_name,
      aliases,
      default_category,
      suggested_units,
      suggested_dosage_forms,
      pk_profile_id,
      active
    )
  )
`

function throwIfError(error: ServiceError | null): void {
  if (error) throw new Error(error.message)
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function ingredientForSave(ingredient: StackItemIngredient): SaveStackItemIngredient {
  return {
    catalog_substance_id: nullableText(ingredient.catalog_substance_id ?? ''),
    custom_name: ingredient.custom_name.trim(),
    amount_value: ingredient.amount_value,
    amount_unit: nullableText(ingredient.amount_unit ?? ''),
    basis_value: ingredient.basis_value,
    basis_unit: nullableText(ingredient.basis_unit ?? ''),
    position: ingredient.position,
  }
}

function stackItemAsDraft(item: StackItem): StackItemDraft {
  return {
    id: item.id,
    displayName: item.display_name,
    category: item.category,
    dosageForm: item.dosage_form,
    brand: item.brand ?? '',
    colorHex: item.color_hex ?? '',
    notes: item.notes ?? '',
    ingredients: item.ingredients,
  }
}

export async function loadStackItems(
  client: StackItemQueryClient,
  archived: boolean,
): Promise<LoadedStackItem[]> {
  const { data, error } = await client
    .from('stack_items')
    .select(STACK_ITEM_COLUMNS)
    .eq('archived', archived)
    .order('created_at', { ascending: false })

  throwIfError(error)
  return data ?? []
}

export async function saveStackItem(
  client: StackItemRpcClient,
  draft: StackItemDraft,
): Promise<SavedStackItemRow> {
  const validationErrors = validateStackItemDraft(draft)
  if (
    !draft.displayName.trim()
    || !draft.category
    || Object.keys(validationErrors).length > 0
    || !draft.dosageForm
  ) {
    throw new Error('Invalid stack item draft')
  }

  const params: SaveStackItemRpcParams = {
    p_item: {
      id: draft.id ?? null,
      display_name: draft.displayName.trim(),
      category: draft.category,
      dosage_form: draft.dosageForm,
      brand: nullableText(draft.brand),
      color_hex: nullableText(draft.colorHex),
      notes: nullableText(draft.notes),
    },
    p_ingredients: draft.ingredients.map(ingredientForSave),
  }

  const { data, error } = await client.rpc('save_stack_item', params)
  throwIfError(error)
  if (!data) throw new Error('save_stack_item returned no data')
  return data
}

export async function archiveStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)

  throwIfError(error)
}

export async function restoreStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ archived: false, archived_at: null })
    .eq('id', id)

  throwIfError(error)
}

export async function saveVialTracking(
  client: StackItemMutationClient,
  id: string,
  values: VialTrackingUpdate,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update(values)
    .eq('id', id)

  throwIfError(error)
}

export async function reconstituteStackItem(
  client: StackItemMutationClient,
  id: string,
  reconstitutionDate: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .update({ reconstitution_date: reconstitutionDate, vials_in_stock: 1, vials_initial: 1 })
    .eq('id', id)

  throwIfError(error)
}

export async function deleteStackItem(
  client: StackItemMutationClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('stack_items')
    .delete()
    .eq('id', id)

  throwIfError(error)
}

export function findDuplicate(
  items: StackItem[],
  draft: StackItemDraft,
): StackItem | undefined {
  const fingerprint = buildDuplicateFingerprint(draft)
  return items.find(item => (
    item.id !== draft.id
    && buildDuplicateFingerprint(stackItemAsDraft(item)) === fingerprint
  ))
}
