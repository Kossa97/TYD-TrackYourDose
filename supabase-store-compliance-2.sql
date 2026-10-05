-- Store-Konformitaet, Teil 2: Korrekturen aus dem Code-Review.
--
--   A. Ein gemeinsamer Textfilter fuer alles Oeffentliche
--      - Woerter der Liste nur als ganze Woerter (kein „Scunthorpe"-Problem)
--      - „retard" raus: im Deutschen ist das die Retard-Tablette
--      - Handel nur an eindeutigen Woertern (Verkauf, Bezugsquelle, Vendor,
--        Messenger) — „wuerde ich wieder kaufen" bleibt erlaubt
--      - geprueft werden Titel/Texte der Erfahrung UND der Substanzname, der
--        oeffentlich mit erscheint; ausserdem Nutzername, Anzeigename und Bio
--        oeffentlicher Profile
--   B. Melden
--      - nur angemeldet (sonst greift die Doppel-Sperre nicht) und hoechstens
--        20 Meldungen pro Stunde je Nutzer
--      - auch ganze Profile lassen sich melden
--      - die Meldung haelt fest, was gemeldet wurde (Schnappschuss); loescht
--        der Verfasser die Erfahrung, bleibt die Meldung erhalten
--      - Ablehnen aendert nur offene Meldungen
--      - Admins koennen Profile ausblenden (`profiles.hidden_by_moderation`,
--        vom Eigentuemer nicht aenderbar)
--      - neue Admin-Liste `moderation_queue()` (jsonb); `open_content_reports`
--        bleibt unbenutzt stehen — sie zu entfernen waere ein drop
--   C. Blockieren und oeffentliches Profil
--      - bei gleichem Namen in anderer Schreibweise gewinnt die exakte
--      - blockiert werden nur oeffentliche Profile
--      - `public_profile_reviews` meldet `own`, wenn man sich selbst ansieht
--
-- Idempotent, kein drop, kein Loeschen ausser einer Zeile der Wortliste
-- (`delete … where term = 'retard'`). Probelauf im Container (HANDOFF.md).

begin;

-- ── A. Textfilter ──────────────────────────────────────────────────────────
delete from public.moderation_terms where term = 'retard';

-- Liefert den Fehlercode fuer einen oeffentlichen Text, sonst null.
create or replace function public.oeffentlicher_text_fehler(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text := lower(coalesce(p_text, ''));
begin
  if t ~ '(https?://|www\.|\m[a-z0-9-]+\.(com|de|net|org|io|shop|store|eu|co|me|at|ch|nl|ru)\M|@[a-z0-9_]{3,})' then
    return 'oeffentlicher_text_link';
  end if;
  if t ~ '\m(verkaufe|verkaufen|verkauf|bezugsquelle|bezugsquellen|lieferant|rabattcode|gutscheincode|vendor|supplier|sell|selling|telegram|whatsapp|wickr|threema)\M' then
    return 'oeffentlicher_text_handel';
  end if;
  if exists (
    select 1 from public.moderation_terms m
     where t ~ ('\m' || regexp_replace(m.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  ) then
    return 'oeffentlicher_text_beleidigung';
  end if;
  return null;
end;
$$;

revoke all on function public.oeffentlicher_text_fehler(text) from public, anon, authenticated;

create or replace function public.check_public_review_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fehler text;
begin
  if not new.is_public then
    return new;
  end if;
  -- Unveraenderter Text bei schon oeffentlicher Erfahrung (etwa wenn ein
  -- Admin sie ausblendet): nicht pruefen.
  if tg_op = 'UPDATE' and old.is_public
     and new.title is not distinct from old.title and new.body is not distinct from old.body
     and new.pros is not distinct from old.pros and new.cons is not distinct from old.cons
     and new.stack_item_id is not distinct from old.stack_item_id then
    return new;
  end if;
  fehler := public.oeffentlicher_text_fehler(concat_ws(' ',
    new.title, new.body, new.pros, new.cons,
    (select s.display_name from public.stack_items s where s.id = new.stack_item_id)));
  if fehler is not null then
    raise exception '%', fehler using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Der Substanzname erscheint oeffentlich neben der Erfahrung: umbenennen
-- nur, wenn der neue Name den Filter besteht — sofern etwas oeffentlich ist.
create or replace function public.check_public_stack_item_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fehler text;
begin
  if new.display_name is not distinct from old.display_name then
    return new;
  end if;
  if not exists (select 1 from public.reviews r where r.stack_item_id = new.id and r.is_public) then
    return new;
  end if;
  fehler := public.oeffentlicher_text_fehler(new.display_name);
  if fehler is not null then
    raise exception '%', fehler using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger stack_items_check_public_name
before update on public.stack_items
for each row execute function public.check_public_stack_item_name();

-- Oeffentliche Profile: Nutzername, Anzeigename und Bio.
create or replace function public.check_public_profile_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fehler text;
begin
  if not coalesce(new.is_public, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.is_public, false)
     and new.username is not distinct from old.username
     and new.display_name is not distinct from old.display_name
     and new.public_bio is not distinct from old.public_bio then
    return new;
  end if;
  fehler := public.oeffentlicher_text_fehler(concat_ws(' ', new.username, new.display_name, new.public_bio));
  if fehler is not null then
    raise exception '%', replace(fehler, 'oeffentlicher_text_', 'oeffentliches_profil_') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_check_public_text
before insert or update on public.profiles
for each row execute function public.check_public_profile_text();

-- ── B. Melden ──────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists hidden_by_moderation boolean not null default false;
alter table public.content_reports add column if not exists snapshot jsonb;

-- Admin-Recht und Moderations-Flag des Profils: aus der App unveraenderbar.
create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.hidden_by_moderation := false;
    else
      new.is_admin := old.is_admin;
      new.hidden_by_moderation := old.hidden_by_moderation;
    end if;
  end if;
  return new;
end;
$$;

-- Loescht der Verfasser eine gemeldete Erfahrung, bleibt die Meldung: die
-- Verknuepfung wird geloest, bevor die Kaskade sie mitnehmen koennte.
create or replace function public.keep_reports_on_review_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.content_reports set review_id = null where review_id = old.id;
  return old;
end;
$$;

create or replace trigger reviews_keep_reports
before delete on public.reviews
for each row execute function public.keep_reports_on_review_delete();

-- Gemeinsame Pruefung: angemeldet und nicht mehr als 20 Meldungen pro Stunde.
create or replace function public.melde_grenze_pruefen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'anmeldung_noetig' using errcode = '42501';
  end if;
  if (select count(*) from public.content_reports c
       where c.reporter_id = auth.uid() and c.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'zu_viele_meldungen' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.melde_grenze_pruefen() from public, anon, authenticated;

create or replace function public.report_public_review(p_review_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  perform public.melde_grenze_pruefen();
  select rv.user_id, rv.title, rv.body, rv.pros, rv.cons, s.display_name as substanz, p.username
    into r
    from public.reviews rv
    join public.profiles p on p.id = rv.user_id
    left join public.stack_items s on s.id = rv.stack_item_id
   where rv.id = p_review_id and rv.is_public and not rv.hidden_by_moderation
     and p.is_public and not p.hidden_by_moderation;
  if r.user_id is null or r.user_id = auth.uid() then
    raise exception 'meldung_nicht_moeglich' using errcode = 'P0001';
  end if;
  insert into public.content_reports (review_id, reported_user_id, reporter_id, reason, details, snapshot)
  values (p_review_id, r.user_id, auth.uid(), p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''),
          jsonb_build_object('art', 'erfahrung', 'username', r.username, 'substanz', r.substanz,
                             'title', r.title, 'body', r.body, 'pros', r.pros, 'cons', r.cons))
  on conflict do nothing;
end;
$$;

revoke all on function public.report_public_review(uuid, text, text) from public, anon;
grant execute on function public.report_public_review(uuid, text, text) to authenticated;

-- Ein ganzes Profil melden (Name, Bio). Je Melder einmal je offenem Fall.
create or replace function public.report_public_profile(p_username text, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  perform public.melde_grenze_pruefen();
  select pr.id, pr.username, pr.display_name, pr.public_bio into p
    from public.profiles pr
   where lower(pr.username) = lower(trim(p_username)) and pr.is_public and not pr.hidden_by_moderation
   order by (pr.username = trim(p_username)) desc
   limit 1;
  if p.id is null or p.id = auth.uid() then
    raise exception 'meldung_nicht_moeglich' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.content_reports c
              where c.review_id is null and c.reported_user_id = p.id and c.reporter_id = auth.uid() and c.status = 'offen'
                and c.snapshot ->> 'art' = 'profil') then
    return;
  end if;
  insert into public.content_reports (review_id, reported_user_id, reporter_id, reason, details, snapshot)
  values (null, p.id, auth.uid(), p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''),
          jsonb_build_object('art', 'profil', 'username', p.username, 'display_name', p.display_name, 'public_bio', p.public_bio));
end;
$$;

revoke all on function public.report_public_profile(text, text, text) from public, anon;
grant execute on function public.report_public_profile(text, text, text) to authenticated;

-- Fuer Admins: offene Meldungen mit Schnappschuss und, wo noch vorhanden,
-- dem aktuellen Stand.
create or replace function public.moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'nur_admins' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'report_id', c.id,
        'reason', c.reason,
        'details', c.details,
        'created_at', c.created_at,
        'art', coalesce(c.snapshot ->> 'art', case when c.review_id is null then 'profil' else 'erfahrung' end),
        'review_id', c.review_id,
        'review_exists', r.id is not null,
        'username', coalesce(p.username, c.snapshot ->> 'username'),
        'snapshot', coalesce(c.snapshot, jsonb_build_object(
          'substanz', s.display_name, 'title', r.title, 'body', r.body, 'pros', r.pros, 'cons', r.cons))
      ) order by c.created_at)
      from public.content_reports c
      left join public.reviews r on r.id = c.review_id
      left join public.stack_items s on s.id = r.stack_item_id
      left join public.profiles p on p.id = c.reported_user_id
     where c.status = 'offen'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.moderation_queue() from public, anon;
grant execute on function public.moderation_queue() to authenticated;

-- Admin entscheidet. Ausblenden: Erfahrung bzw. ganzes Profil verschwindet
-- oeffentlich, alle offenen Meldungen dazu sind erledigt. Ablehnen: nur
-- diese Meldung, und nur solange sie offen ist.
create or replace function public.resolve_content_report(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  meldung record;
begin
  if not public.is_admin() then
    raise exception 'nur_admins' using errcode = '42501';
  end if;
  select * into meldung from public.content_reports where id = p_report_id;
  if meldung.id is null then
    raise exception 'meldung_unbekannt' using errcode = 'P0001';
  end if;
  if p_action = 'ausblenden' then
    if meldung.review_id is not null then
      update public.reviews set hidden_by_moderation = true where id = meldung.review_id;
      update public.content_reports
         set status = 'erledigt', resolved_at = now(), resolved_by = auth.uid()
       where review_id = meldung.review_id and status = 'offen';
    elsif coalesce(meldung.snapshot ->> 'art', '') = 'profil' then
      update public.profiles set hidden_by_moderation = true where id = meldung.reported_user_id;
      update public.content_reports
         set status = 'erledigt', resolved_at = now(), resolved_by = auth.uid()
       where reported_user_id = meldung.reported_user_id and review_id is null and status = 'offen'
         and snapshot ->> 'art' = 'profil';
    else
      -- Die Erfahrung gibt es nicht mehr: nichts auszublenden.
      update public.content_reports
         set status = 'erledigt', resolved_at = now(), resolved_by = auth.uid()
       where id = p_report_id and status = 'offen';
    end if;
  elsif p_action = 'ablehnen' then
    update public.content_reports
       set status = 'abgelehnt', resolved_at = now(), resolved_by = auth.uid()
     where id = p_report_id and status = 'offen';
  else
    raise exception 'aktion_unbekannt' using errcode = 'P0001';
  end if;
end;
$$;

-- ── C. Blockieren und oeffentliches Profil ────────────────────────────────
create or replace function public.set_profile_block(p_username text, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ziel uuid;
begin
  if auth.uid() is null then
    raise exception 'anmeldung_noetig' using errcode = '42501';
  end if;
  if p_blocked then
    -- Blockiert wird, was man gesehen hat: ein oeffentliches Profil.
    select id into ziel from public.profiles
     where lower(username) = lower(trim(p_username)) and is_public
     order by (username = trim(p_username)) desc
     limit 1;
  else
    -- Freigeben geht immer, auch wenn das Profil inzwischen privat ist.
    select b.blocked_id into ziel from public.user_blocks b
      join public.profiles p on p.id = b.blocked_id
     where b.blocker_id = auth.uid() and lower(p.username) = lower(trim(p_username))
     order by (p.username = trim(p_username)) desc
     limit 1;
  end if;
  if ziel is null or ziel = auth.uid() then
    return;
  end if;
  if p_blocked then
    insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), ziel) on conflict do nothing;
  else
    delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = ziel;
  end if;
end;
$$;

create or replace function public.public_profile_reviews(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profil record;
begin
  select p.id, p.username, p.display_name, p.public_bio
    into profil
    from public.profiles p
   where lower(p.username) = lower(trim(p_username))
     and p.is_public = true
     and p.hidden_by_moderation = false
   order by (p.username = trim(p_username)) desc
   limit 1;

  if profil.id is null then
    return null;
  end if;

  if auth.uid() is not null and exists (
    select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = profil.id
  ) then
    return jsonb_build_object('username', profil.username, 'blocked', true, 'own', false);
  end if;

  return jsonb_build_object(
    'username', profil.username,
    'display_name', profil.display_name,
    'public_bio', profil.public_bio,
    'blocked', false,
    'own', profil.id = auth.uid(),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'substanz', s.display_name,
          'rating', r.rating,
          'title', nullif(r.title, ''),
          'body', r.body,
          'pros', r.pros,
          'cons', r.cons,
          'wirkung', r.wirkung,
          'vertraeglichkeit', r.vertraeglichkeit,
          'wieder_nehmen', r.wieder_nehmen,
          'monat', to_char(r.created_at at time zone 'UTC', 'YYYY-MM')
        ) order by r.created_at desc)
        from public.reviews r
        join public.stack_items s on s.id = r.stack_item_id
       where r.user_id = profil.id
         and r.is_public = true
         and r.hidden_by_moderation = false
    ), '[]'::jsonb)
  );
end;
$$;

commit;
