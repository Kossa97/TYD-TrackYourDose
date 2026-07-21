begin;

revoke execute on function public.save_stack_item(jsonb, jsonb) from authenticated;
drop function public.save_stack_item(jsonb, jsonb);

drop trigger stack_item_ingredients_set_updated_at on public.stack_item_ingredients;
drop trigger stack_items_set_updated_at on public.stack_items;
drop function public.set_stack_item_updated_at();

drop table public.stack_item_ingredients;
drop table public.substance_catalog;

alter policy "Own stack items" on public.stack_items rename to "Own peptides";
alter index public.stack_items_user_archived_idx rename to peptides_user_archived_idx;
alter index public.stack_items_pk_profile_idx rename to peptides_pk_profile_idx;
alter table public.stack_items
  rename constraint stack_items_pkey to peptides_pkey;

alter table public.injection_logs
  rename constraint injection_logs_stack_item_id_fkey to injection_logs_peptide_id_fkey;
alter table public.injection_logs rename column stack_item_id to peptide_id;

alter table public.reviews
  rename constraint reviews_stack_item_id_fkey to reviews_peptide_id_fkey;
alter table public.reviews rename column stack_item_id to peptide_id;

alter table public.effects
  rename constraint effects_stack_item_id_fkey to effects_peptide_id_fkey;
alter table public.effects rename column stack_item_id to peptide_id;

alter table public.cycles
  rename constraint cycles_stack_item_id_fkey to cycles_peptide_id_fkey;
alter table public.cycles rename column stack_item_id to peptide_id;

alter table public.dose_logs
  rename constraint dose_logs_stack_item_id_fkey to dose_logs_peptide_id_fkey;
alter table public.dose_logs rename column stack_item_id to peptide_id;

alter table public.vials
  rename constraint vials_stack_item_id_fkey to vials_peptide_id_fkey;
alter table public.vials rename column stack_item_id to peptide_id;

alter table public.stack_items
  drop column updated_at,
  drop column configuration_status,
  drop column color_hex,
  drop column brand,
  drop column dosage_form,
  drop column category;

alter table public.stack_items rename column display_name to name;
alter table public.stack_items rename to peptides;

commit;
