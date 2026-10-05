-- Store-Konformitaet: der Rest fuer den Supabase-SQL-Editor.
--
-- Diese zwei Teile liessen sich ueber den Supabase-Connector nicht ausfuehren
-- (Zeitueberschreitung, nichts angewendet). Alles andere aus
-- supabase-store-compliance.sql und supabase-store-compliance-2.sql ist in
-- der Produktion. Inhalt identisch mit dort; im Container zweimal geprobt.
--
-- Ausfuehren: Supabase → SQL Editor → diese Datei einfuegen → Run.
-- Danach pruefen:
--   select count(*) from pg_proc where proname = 'delete_my_account';   -- 1
--   select count(*) from public.moderation_terms;                        -- 8

begin;

-- 1. „retard" aus der Wortliste: im Deutschen die Retard-Tablette.
delete from public.moderation_terms where term = 'retard';

-- 2. Konto loeschen (Apple 5.1.1(v), Google Play „Account deletion").
create or replace function public.delete_my_account(p_nur_pruefen boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'anmeldung_noetig' using errcode = '42501';
  end if;
  if p_nur_pruefen then
    return true;
  end if;
  delete from public.bloodwork where user_id = ich;
  delete from public.weight_logs where user_id = ich;
  delete from auth.users where id = ich;
  return true;
end;
$$;

revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;

commit;
