create table if not exists dose_escalations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  cycle_id uuid references cycles on delete cascade not null,
  increase_amount numeric(10,3) not null,
  unit text not null,
  start_type text not null default 'date', -- 'date' | 'after_days' | 'after_weeks'
  start_date date,
  start_after_days integer,
  notes text,
  created_at timestamptz default now()
);

alter table dose_escalations enable row level security;
create policy "Own escalations" on dose_escalations for all using (auth.uid() = user_id);
