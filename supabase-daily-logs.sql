-- Täglicher Stimmungs-/Energie-Log (Energie, Schlaf, Libido je 1–5)
-- Im Supabase SQL Editor ausführen

create table if not exists daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  log_date date not null,
  energie int check (energie between 1 and 5),
  schlaf int check (schlaf between 1 and 5),
  libido int check (libido between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  unique (user_id, log_date)
);

alter table daily_logs enable row level security;

create policy "Own daily logs" on daily_logs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
