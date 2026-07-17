-- Blutwerte-Feinschliff: Befund-Gruppierung + Labor-Referenzbereiche
-- Im Supabase SQL Editor ausführen
--
-- Hinweis: Die Tabellen blood_tests/blood_values aus supabase-health.sql sind
-- Altlasten und werden vom Code nicht verwendet. Die App arbeitet ausschließlich
-- mit der Tabelle bloodwork, die hier erweitert wird.

create table if not exists bloodwork_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tested_at date not null,
  lab_name text,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_at timestamptz default now()
);

alter table bloodwork add column if not exists report_id uuid references bloodwork_reports on delete set null;
alter table bloodwork add column if not exists ref_min numeric(10,3);
alter table bloodwork add column if not exists ref_max numeric(10,3);

alter table bloodwork_reports enable row level security;

drop policy if exists "Own bloodwork reports" on bloodwork_reports;
create policy "Own bloodwork reports" on bloodwork_reports for all using (auth.uid() = user_id);

-- Zählt Importe pro Monat (Rate-Limit) und lädt Befunde eines Nutzers.
create index if not exists bloodwork_reports_user_created_idx
  on bloodwork_reports (user_id, source, created_at desc);

-- Lädt alle Werte eines Befunds.
create index if not exists bloodwork_report_idx on bloodwork (report_id);
