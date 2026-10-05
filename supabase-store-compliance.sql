-- Store-Konformitaet (Apple App Review Guidelines, Google Play Developer Policy)
--
--   0. Admin-Recht schuetzen   — bisher konnte jeder Nutzer `profiles.is_admin`
--                                selbst auf true setzen (Policy „Own profile"
--                                erlaubt die ganze Zeile). Jetzt nicht mehr.
--   1. Zustimmung              — 18+ und Nutzungsbedingungen mit Zeitpunkt
--                                (Apple 1.2 / Google UGC: Bedingungen vor dem
--                                Veroeffentlichen; Altersfreigabe).
--   2. Meldungen               — jeder kann eine oeffentliche Erfahrung melden;
--                                Admins sehen und bearbeiten die Meldungen
--                                (Apple 1.2, Google UGC).
--   3. Blockieren              — angemeldete Nutzer blockieren Profile
--                                (Apple 1.2, Google UGC).
--   4. Filter                  — oeffentliche Texte ohne Links, Verkaufs- und
--                                Kontaktwoerter und ohne Beleidigungen
--                                (Apple 1.2 „filtering", Apple 1.4.3 /
--                                Google „Unapproved Substances": kein Handel).
--   5. Konto loeschen          — in der App (Apple 5.1.1(v), Google Play).
--
-- Supabase gibt neuen Funktionen `anon` von selbst; wo nur Angemeldete
-- duerfen, wird es deshalb ausdruecklich entzogen.
--
-- Idempotent. Kein drop von Tabellen oder Spalten, keine bestehende Zeile wird
-- geaendert. Vorher im Container geprueft (siehe HANDOFF.md).

begin;

-- ── 0. Admin-Recht schuetzen ───────────────────────────────────────────────
-- Anfragen aus der App laufen als `anon`/`authenticated`: dort bleibt
-- `is_admin`, wie es war (neu: false). Der SQL-Editor (postgres) darf es
-- weiter setzen.
create or replace function public.protect_profile_admin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_protect_admin_flag
before insert or update on public.profiles
for each row execute function public.protect_profile_admin_flag();

-- ── 1. Zustimmung ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists age_confirmed_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

-- ── 2. Meldungen ───────────────────────────────────────────────────────────
-- Von der Moderation ausgeblendet: bleibt fuer den Eigentuemer sichtbar,
-- erscheint aber nicht mehr oeffentlich. Nur Admins (ueber die Funktion
-- unten) setzen es; der Eigentuemer kann es nicht zuruecknehmen.
alter table public.reviews add column if not exists hidden_by_moderation boolean not null default false;

create or replace function public.protect_review_moderation_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.hidden_by_moderation := false;
    else
      new.hidden_by_moderation := old.hidden_by_moderation;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger reviews_protect_moderation_flag
before insert or update on public.reviews
for each row execute function public.protect_review_moderation_flag();

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.reviews(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'werbung', 'beleidigung', 'gefaehrlich', 'sonstiges')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'abgelehnt')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

alter table public.content_reports enable row level security;

-- Lesen nur Admins; geschrieben wird ausschliesslich ueber die Funktionen.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_reports' and policyname = 'Admins lesen Meldungen') then
    create policy "Admins lesen Meldungen" on public.content_reports for select to authenticated using (public.is_admin());
  end if;
end $$;

-- Wer angemeldet ist, meldet dieselbe Erfahrung nur einmal.
create unique index if not exists content_reports_einmal_je_melder
  on public.content_reports (review_id, reporter_id) where reporter_id is not null;
create index if not exists content_reports_offen on public.content_reports (status, created_at);

create or replace function public.report_public_review(p_review_id uuid, p_reason text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  besitzer uuid;
begin
  -- Nur, was gerade oeffentlich zu sehen ist, laesst sich melden.
  select r.user_id into besitzer
    from public.reviews r
    join public.profiles p on p.id = r.user_id
   where r.id = p_review_id and r.is_public and not r.hidden_by_moderation and p.is_public;
  if besitzer is null then
    raise exception 'meldung_nicht_moeglich' using errcode = 'P0001';
  end if;
  insert into public.content_reports (review_id, reported_user_id, reporter_id, reason, details)
  values (p_review_id, besitzer, auth.uid(), p_reason, nullif(left(trim(coalesce(p_details, '')), 1000), ''))
  on conflict do nothing;
end;
$$;

revoke all on function public.report_public_review(uuid, text, text) from public;
grant execute on function public.report_public_review(uuid, text, text) to anon, authenticated;

-- Fuer Admins: offene Meldungen mit dem gemeldeten Text.
create or replace function public.open_content_reports()
returns table (
  report_id uuid, reason text, details text, created_at timestamptz,
  review_id uuid, username text, substanz text, title text, body text, pros text, cons text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'nur_admins' using errcode = '42501';
  end if;
  return query
    select c.id, c.reason, c.details, c.created_at,
           r.id, p.username, s.display_name, r.title, r.body, r.pros, r.cons
      from public.content_reports c
      left join public.reviews r on r.id = c.review_id
      left join public.profiles p on p.id = c.reported_user_id
      left join public.stack_items s on s.id = r.stack_item_id
     where c.status = 'offen'
     order by c.created_at;
end;
$$;

revoke all on function public.open_content_reports() from public, anon;
grant execute on function public.open_content_reports() to authenticated;

-- Admin entscheidet: ausblenden (die Erfahrung verschwindet oeffentlich, alle
-- offenen Meldungen dazu gelten als erledigt) oder ablehnen.
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
    update public.reviews set hidden_by_moderation = true where id = meldung.review_id;
    update public.content_reports
       set status = 'erledigt', resolved_at = now(), resolved_by = auth.uid()
     where review_id = meldung.review_id and status = 'offen';
  elsif p_action = 'ablehnen' then
    update public.content_reports
       set status = 'abgelehnt', resolved_at = now(), resolved_by = auth.uid()
     where id = p_report_id;
  else
    raise exception 'aktion_unbekannt' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.resolve_content_report(uuid, text) from public, anon;
grant execute on function public.resolve_content_report(uuid, text) to authenticated;

-- ── 3. Blockieren ──────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_blocks' and policyname = 'Eigene Blockierungen') then
    create policy "Eigene Blockierungen" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
  end if;
end $$;

-- Blockiert wird ueber den Nutzernamen; die ID des anderen bleibt verborgen.
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
  select id into ziel from public.profiles where lower(username) = lower(trim(p_username)) limit 1;
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

revoke all on function public.set_profile_block(text, boolean) from public, anon;
grant execute on function public.set_profile_block(text, boolean) to authenticated;

create or replace function public.my_blocked_profiles()
returns table (username text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, b.created_at
    from public.user_blocks b
    join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

revoke all on function public.my_blocked_profiles() from public, anon;
grant execute on function public.my_blocked_profiles() to authenticated;

-- Oeffentliches Profil: blockierte Profile und ausgeblendete Erfahrungen
-- erscheinen nicht. Sonst wie supabase-reviews-public.sql.
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
   limit 1;

  if profil.id is null then
    return null;
  end if;

  if auth.uid() is not null and exists (
    select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = profil.id
  ) then
    return jsonb_build_object('username', profil.username, 'blocked', true);
  end if;

  return jsonb_build_object(
    'username', profil.username,
    'display_name', profil.display_name,
    'public_bio', profil.public_bio,
    'blocked', false,
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

revoke all on function public.public_profile_reviews(text) from public;
grant execute on function public.public_profile_reviews(text) to anon, authenticated;

-- ── 4. Filter fuer oeffentliche Texte ──────────────────────────────────────
-- Admins pflegen die Liste; sie wird nie an die App ausgeliefert.
create table if not exists public.moderation_terms (
  term text primary key check (term = lower(term) and char_length(term) between 3 and 60)
);
alter table public.moderation_terms enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'moderation_terms' and policyname = 'Admins pflegen Filterwoerter') then
    create policy "Admins pflegen Filterwoerter" on public.moderation_terms for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

insert into public.moderation_terms (term) values
  ('arschloch'), ('hurensohn'), ('wichser'), ('fotze'), ('missgeburt'),
  ('fuck you'), ('motherfucker'), ('cunt'), ('retard')
on conflict do nothing;

-- Nur oeffentliche Erfahrungen werden geprueft — private Notizen nie.
-- `security definer`: die Wortliste ist fuer Nutzer unlesbar (nur Admins),
-- der Filter muss sie trotzdem sehen.
create or replace function public.check_public_review_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  text_gesamt text;
begin
  if not new.is_public then
    return new;
  end if;
  -- Unveraenderter Text bei schon oeffentlicher Erfahrung (etwa wenn ein
  -- Admin sie ausblendet): nicht pruefen — sonst liesse sich ein Text, der
  -- vor dem Filter entstand, nicht mehr moderieren.
  if tg_op = 'UPDATE' and old.is_public
     and new.title is not distinct from old.title and new.body is not distinct from old.body
     and new.pros is not distinct from old.pros and new.cons is not distinct from old.cons then
    return new;
  end if;
  text_gesamt := lower(concat_ws(' ', new.title, new.body, new.pros, new.cons));
  -- Links und Kontaktwege: kein Weg zu Anbietern.
  if text_gesamt ~ '(https?://|www\.|\m[a-z0-9-]+\.(com|de|net|org|io|shop|store|eu|co|me|at|ch|nl|ru)\M|@[a-z0-9_]{3,})' then
    raise exception 'oeffentlicher_text_link' using errcode = 'P0001';
  end if;
  -- Handel und Bezugsquellen.
  if text_gesamt ~ '\m(kaufen|kauft|gekauft|bestellen|bestellt|verkaufe|verkauf|bezugsquelle|lieferant|rabatt|rabattcode|gutscheincode|buy|bought|sell|selling|vendor|supplier|discount|promo|telegram|whatsapp|wickr|threema)\M' then
    raise exception 'oeffentlicher_text_handel' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.moderation_terms m where position(m.term in text_gesamt) > 0) then
    raise exception 'oeffentlicher_text_beleidigung' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace trigger reviews_check_public_text
before insert or update on public.reviews
for each row execute function public.check_public_review_text();

-- ── 5. Konto loeschen ──────────────────────────────────────────────────────
-- Loescht den angemeldeten Nutzer. Fast alles haengt mit `on delete cascade`
-- an auth.users; Blutwerte und Gewicht nicht — die gehen vorher. Dateien im
-- Speicher (Fortschrittsfotos, Chargen) loescht die App vorher selbst; SQL
-- darf sie nicht anfassen.
--
-- `p_nur_pruefen = true` loescht nichts und sagt nur „geht". Die App fragt
-- so zuerst, bevor sie Dateien entfernt — fehlt die Funktion oder das
-- Recht, bleibt alles, wie es ist.
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
