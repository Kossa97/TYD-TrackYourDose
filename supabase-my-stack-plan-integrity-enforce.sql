begin;

do $$
begin
  if exists (
    select 1
    from public.cycle_migration_conflicts
    where resolved_at is null
  ) then
    raise exception 'Unresolved cycle migration conflicts remain';
  end if;
end
$$;

create unique index if not exists cycles_one_open_per_stack_item
  on public.cycles(stack_item_id)
  where ended_at is null;

revoke insert, update, delete on public.cycles from authenticated;
revoke insert, update, delete on public.dose_escalations from authenticated;

do $$
begin
  if to_regprocedure('public.save_stack_item_with_plan(jsonb,jsonb,jsonb)') is not null then
    execute 'revoke execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb) from authenticated';
  end if;
  if to_regprocedure('public.remove_plan_segment(uuid,date)') is not null then
    execute 'revoke execute on function public.remove_plan_segment(uuid, date) from authenticated';
  end if;
end
$$;

commit;
