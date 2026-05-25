-- Gesundheitsdaten: Blutwerte + Körpermessungen
-- Im Supabase SQL Editor ausführen

create table if not exists blood_tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  test_date date not null,
  lab_name text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists blood_values (
  id uuid default gen_random_uuid() primary key,
  test_id uuid references blood_tests on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  marker text not null,
  value numeric(10,3) not null,
  unit text not null,
  normal_min numeric(10,3),
  normal_max numeric(10,3),
  created_at timestamptz default now()
);

create table if not exists body_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null unique,
  weight_kg numeric(5,1),
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,1),
  bp_systolic integer,
  bp_diastolic integer,
  heart_rate integer,
  hrv_ms integer,
  sleep_quality integer check (sleep_quality between 1 and 10),
  energy_level integer check (energy_level between 1 and 10),
  notes text,
  created_at timestamptz default now()
);

alter table blood_tests  enable row level security;
alter table blood_values enable row level security;
alter table body_metrics enable row level security;

create policy "Own blood tests"  on blood_tests  for all using (auth.uid() = user_id);
create policy "Own blood values" on blood_values for all using (auth.uid() = user_id);
create policy "Own body metrics" on body_metrics for all using (auth.uid() = user_id);
