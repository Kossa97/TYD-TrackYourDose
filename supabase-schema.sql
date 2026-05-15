-- Peptid Tracker - Datenbank Schema
-- Dieses SQL in Supabase SQL Editor ausführen

-- Profiles (Benutzerprofile)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  age integer,
  weight_kg numeric(5,1),
  height_cm numeric(5,1),
  gender text,
  notes text,
  created_at timestamptz default now()
);

-- Peptide (Peptid-Verwaltung)
create table if not exists peptides (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  default_unit text not null default 'mcg',
  default_dose numeric(10,3),
  default_method text not null default 'Subkutan',
  notes text,
  created_at timestamptz default now()
);

-- Vials (Inventar)
create table if not exists vials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  peptide_id uuid references peptides on delete cascade not null,
  total_amount numeric(10,3) not null,
  remaining_amount numeric(10,3) not null,
  unit text not null default 'mg',
  batch_label text,
  reconstituted_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Dose Logs (Protokollierung)
create table if not exists dose_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  peptide_id uuid references peptides on delete set null,
  vial_id uuid references vials on delete set null,
  dose numeric(10,3) not null,
  unit text not null,
  method text not null,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Cycles (Zyklen & Pläne)
create table if not exists cycles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  peptide_id uuid references peptides on delete cascade not null,
  name text not null,
  dose numeric(10,3) not null,
  unit text not null,
  method text not null,
  frequency text not null,
  start_date date not null,
  end_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Effects (Wirkungen & Nebenwirkungen)
create table if not exists effects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  peptide_id uuid references peptides on delete set null,
  dose_log_id uuid references dose_logs on delete set null,
  type text not null check (type in ('effect', 'side_effect')),
  description text not null,
  severity integer not null check (severity between 1 and 5),
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Reviews (Bewertungen)
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  peptide_id uuid references peptides on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  title text not null,
  body text,
  pros text,
  cons text,
  would_recommend boolean not null default true,
  created_at timestamptz default now()
);

-- Row Level Security (jeder sieht nur seine eigenen Daten)
alter table profiles enable row level security;
alter table peptides enable row level security;
alter table vials enable row level security;
alter table dose_logs enable row level security;
alter table cycles enable row level security;
alter table effects enable row level security;
alter table reviews enable row level security;

create policy "Own profile" on profiles for all using (auth.uid() = id);
create policy "Own peptides" on peptides for all using (auth.uid() = user_id);
create policy "Own vials" on vials for all using (auth.uid() = user_id);
create policy "Own logs" on dose_logs for all using (auth.uid() = user_id);
create policy "Own cycles" on cycles for all using (auth.uid() = user_id);
create policy "Own effects" on effects for all using (auth.uid() = user_id);
create policy "Own reviews" on reviews for all using (auth.uid() = user_id);
