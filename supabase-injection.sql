-- Injektions-Tracker: Stellen-Rotation
-- In Supabase SQL-Editor ausführen

create table if not exists injection_logs (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users on delete cascade not null,
  dose_log_id uuid,                     -- optionale Verknüpfung zu dose_logs (kein FK)
  site        text        not null,
  notes       text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz default now()
);

alter table injection_logs enable row level security;

-- Policy: Nutzer kann nur eigene Zeilen sehen / schreiben
create policy "Own injection logs" on injection_logs
  for all
  using     (auth.uid() = user_id)
  with check(auth.uid() = user_id);

-- Index für schnelle Abfragen nach User + Stelle
create index if not exists injection_logs_user_site_idx
  on injection_logs (user_id, site, logged_at desc);
