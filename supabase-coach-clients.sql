-- ============================================================
-- Coach ↔ Klient-Schicht (v1)
-- Im Supabase SQL Editor ausführen.
--
-- Entscheidungen (mit dem Owner abgestimmt):
--   • Ein Account, zwei Rollen: ein Coach ist ein normaler Nutzer mit
--     profiles.is_coach = true (kann selbst tracken UND Klienten verwalten).
--   • Freigabe PRO BEREICH einzeln wählbar (stack/adherence/bloodwork/
--     progress/diary) — der Klient steuert, was ein Coach sehen darf.
--   • Ein Klient darf mit MEHREREN Coaches gleichzeitig verbunden sein.
--
-- Schema-robust: Die Daten-Freigabe-Policies werden nur auf Tabellen
-- angewendet, die es aktuell gibt UND die eine user_id-Spalte haben
-- (self-adaptierend, bricht nicht, falls Codecs MyStack-Umbau eine
-- Tabelle umbenennt). Fehlt eine Tabelle, wird sie übersprungen und
-- kann später ergänzt werden.
-- ============================================================

-- ── Rolle ───────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_coach boolean not null default false;

-- ── Verknüpfung Coach ↔ Klient ──────────────────────────────────────────
create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id  uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('pending', 'active', 'revoked', 'declined')),
  initiated_by text not null default 'client'
    check (initiated_by in ('coach', 'client')),
  -- Freigabe pro Bereich (Klient steuert)
  perm_stack     boolean not null default false,
  perm_adherence boolean not null default false,
  perm_bloodwork boolean not null default false,
  perm_progress  boolean not null default false,
  perm_diary     boolean not null default false,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  unique (coach_id, client_id),
  check (coach_id <> client_id)
);

create index if not exists coach_clients_coach_idx  on public.coach_clients (coach_id);
create index if not exists coach_clients_client_idx on public.coach_clients (client_id);

alter table public.coach_clients enable row level security;

-- Beide Seiten sehen ihre eigenen Verknüpfungen
drop policy if exists "coach_clients_select" on public.coach_clients;
create policy "coach_clients_select"
  on public.coach_clients for select
  to authenticated
  using (coach_id = auth.uid() or client_id = auth.uid());

-- Anlegen nur, wenn man selbst beteiligt ist (Redemption läuft aber i. d. R.
-- über redeem_coach_invite(), das SECURITY DEFINER ist)
drop policy if exists "coach_clients_insert" on public.coach_clients;
create policy "coach_clients_insert"
  on public.coach_clients for insert
  to authenticated
  with check (client_id = auth.uid() or coach_id = auth.uid());

-- Beide Seiten dürfen ihre Verknüpfung ändern (Klient: Freigaben/Widerruf,
-- Coach: Widerruf). Spalten-genaue Restriktion ist v2.
drop policy if exists "coach_clients_update" on public.coach_clients;
create policy "coach_clients_update"
  on public.coach_clients for update
  to authenticated
  using (client_id = auth.uid() or coach_id = auth.uid())
  with check (client_id = auth.uid() or coach_id = auth.uid());

drop policy if exists "coach_clients_delete" on public.coach_clients;
create policy "coach_clients_delete"
  on public.coach_clients for delete
  to authenticated
  using (client_id = auth.uid() or coach_id = auth.uid());

-- ── Einladungen (wiederverwendbarer Link/Code, onboardet viele Klienten) ──
create table if not exists public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  label text,                        -- z. B. "Instagram", "Reha-Gruppe"
  expires_at timestamptz,            -- null = unbegrenzt
  used_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists coach_invites_coach_idx on public.coach_invites (coach_id);

alter table public.coach_invites enable row level security;

-- Nur der Coach verwaltet seine eigenen Einladungen. Klienten lesen NICHT
-- direkt (Vorschau/Redemption läuft über SECURITY-DEFINER-Funktionen unten).
drop policy if exists "coach_invites_all" on public.coach_invites;
create policy "coach_invites_all"
  on public.coach_invites for all
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- ── Zentraler Freigabe-Check (von den Daten-Policies genutzt) ────────────
create or replace function public.coach_can_view(p_client uuid, p_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_clients cc
    where cc.coach_id = auth.uid()
      and cc.client_id = p_client
      and cc.status = 'active'
      and case p_area
        when 'stack'     then cc.perm_stack
        when 'adherence' then cc.perm_adherence
        when 'bloodwork' then cc.perm_bloodwork
        when 'progress'  then cc.perm_progress
        when 'diary'     then cc.perm_diary
        else false
      end
  );
$$;

revoke all on function public.coach_can_view(uuid, text) from public, anon;
grant execute on function public.coach_can_view(uuid, text) to authenticated;

-- ── Einladungs-Vorschau: "Mit Coach X verbinden?" ───────────────────────
create or replace function public.coach_invite_info(p_code text)
returns table (coach_id uuid, coach_name text)
language sql
stable
security definer
set search_path = public
as $$
  select ci.coach_id,
         coalesce(p.display_name, p.username, 'Coach') as coach_name
  from public.coach_invites ci
  join public.profiles p on p.id = ci.coach_id
  where ci.code = p_code
    and (ci.expires_at is null or ci.expires_at > now());
$$;

revoke all on function public.coach_invite_info(text) from public, anon;
grant execute on function public.coach_invite_info(text) to authenticated;

-- ── Einladung einlösen (Klient bestätigt + wählt Freigaben) ─────────────
create or replace function public.redeem_coach_invite(
  p_code text,
  p_perm_stack     boolean default false,
  p_perm_adherence boolean default false,
  p_perm_bloodwork boolean default false,
  p_perm_progress  boolean default false,
  p_perm_diary     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.coach_invites;
  v_link_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_invite
  from public.coach_invites
  where code = p_code
  for update;

  if not found then
    raise exception 'Ungültiger Einladungscode';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Einladung abgelaufen';
  end if;
  if v_invite.coach_id = auth.uid() then
    raise exception 'Eigener Einladungscode kann nicht eingelöst werden';
  end if;

  insert into public.coach_clients as cc (
    coach_id, client_id, status, initiated_by,
    perm_stack, perm_adherence, perm_bloodwork, perm_progress, perm_diary,
    accepted_at
  )
  values (
    v_invite.coach_id, auth.uid(), 'active', 'client',
    p_perm_stack, p_perm_adherence, p_perm_bloodwork, p_perm_progress, p_perm_diary,
    now()
  )
  on conflict (coach_id, client_id) do update set
    status         = 'active',
    perm_stack     = excluded.perm_stack,
    perm_adherence = excluded.perm_adherence,
    perm_bloodwork = excluded.perm_bloodwork,
    perm_progress  = excluded.perm_progress,
    perm_diary     = excluded.perm_diary,
    accepted_at    = now(),
    revoked_at     = null
  returning id into v_link_id;

  update public.coach_invites
    set used_count = used_count + 1
    where id = v_invite.id;

  return v_link_id;
end;
$$;

revoke all on function public.redeem_coach_invite(text, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.redeem_coach_invite(text, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ── Daten-Freigabe: coach-lesbare SELECT-Policies (schema-robust) ────────
-- Fügt je (Tabelle, Bereich) eine zusätzliche SELECT-Policy hinzu, die einem
-- Coach Lesezugriff gibt, WENN coach_can_view(user_id, bereich) true ist.
-- Nur für Tabellen, die existieren UND eine user_id-Spalte haben.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('stack_items',     'stack'),
      ('dose_logs',       'adherence'),
      ('bloodwork',       'bloodwork'),
      ('weight_logs',     'progress'),
      ('progress_photos', 'progress'),
      ('effects',         'diary'),
      ('daily_logs',      'diary')
    ) as x(tbl, area)
  loop
    if to_regclass('public.' || r.tbl) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = r.tbl
           and column_name = 'user_id'
       )
    then
      execute format('drop policy if exists %I on public.%I', 'coach_read_' || r.tbl, r.tbl);
      execute format(
        'create policy %I on public.%I for select to authenticated using (public.coach_can_view(user_id, %L))',
        'coach_read_' || r.tbl, r.tbl, r.area
      );
    end if;
  end loop;
end $$;

-- HINWEIS: stack_item_ingredients (Zutaten eines Stack-Items) hat keine
-- eigene user_id — die coach-Freigabe dafür kommt in v2 über einen Join auf
-- stack_items. Für v1 sieht der Coach die Item-Kopfdaten (Name/Kategorie/Dosis).
