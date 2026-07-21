begin;

drop function if exists public.save_stack_item(jsonb, jsonb);

do $$
begin
  if to_regclass('public.stack_item_ingredients') is not null then
    execute 'drop trigger if exists stack_item_ingredients_completeness_check on public.stack_item_ingredients';
    execute 'drop trigger if exists stack_item_ingredients_set_updated_at on public.stack_item_ingredients';
  end if;

  if to_regclass('public.stack_items') is not null then
    execute 'drop trigger if exists stack_items_completeness_check on public.stack_items';
    execute 'drop trigger if exists stack_items_review_status_check on public.stack_items';
    execute 'drop trigger if exists stack_items_set_updated_at on public.stack_items';
  end if;
end;
$$;

drop function if exists public.enforce_stack_item_completeness();
drop function if exists public.enforce_stack_item_review_status();
drop function if exists public.set_stack_item_updated_at();

drop table if exists public.stack_item_ingredients;
drop table if exists public.substance_catalog;

do $$
begin
  if to_regclass('public.stack_items') is not null then
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

    if to_regclass('public.peptides') is null then
      alter table public.stack_items rename to peptides;
    end if;
  end if;
end;
$$;

commit;
