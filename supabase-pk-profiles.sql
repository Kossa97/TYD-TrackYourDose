-- PK-Profile (Pharmakokinetik) für TYD
-- Im Supabase SQL Editor ausführen (Schema + RLS + Seed).
-- Alternativ danach: npm run seed:pk

create table if not exists public.pk_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  half_life_hours numeric not null,
  tmax_hours numeric not null,
  bioavailability_sc numeric not null default 1.0,
  vd_l_kg numeric not null default 0.3,
  notes text,
  category text not null check (category in ('glp1', 'peptide', 'hormone', 'sarm', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pk_profiles
  add column if not exists bioavailability_sc numeric not null default 1.0,
  add column if not exists vd_l_kg numeric not null default 0.3,
  add column if not exists notes text;

create index if not exists pk_profiles_category_idx on public.pk_profiles (category);

alter table public.pk_profiles enable row level security;

drop policy if exists "pk_profiles_select" on public.pk_profiles;
create policy "pk_profiles_select"
  on public.pk_profiles for select
  using (true);

drop policy if exists "pk_profiles_insert" on public.pk_profiles;
create policy "pk_profiles_insert"
  on public.pk_profiles for insert
  with check (true);

drop policy if exists "pk_profiles_update" on public.pk_profiles;
create policy "pk_profiles_update"
  on public.pk_profiles for update
  using (true)
  with check (true);

-- Referenzdaten (Upsert per name)
insert into public.pk_profiles (name, aliases, half_life_hours, tmax_hours, category)
values
  ('Semaglutide', ARRAY['Ozempic','Wegovy']::text[], 168, 24, 'glp1'),
  ('Tirzepatide', ARRAY['Mounjaro','Zepbound']::text[], 120, 8, 'glp1'),
  ('Liraglutide', ARRAY['Victoza','Saxenda']::text[], 13, 8, 'glp1'),
  ('Exenatide', ARRAY['Byetta']::text[], 2.4, 2, 'glp1'),
  ('BPC-157', ARRAY['Body Protection Compound']::text[], 4, 0.5, 'peptide'),
  ('TB-500', ARRAY['Thymosin Beta-4']::text[], 72, 2, 'peptide'),
  ('GHK-Cu', ARRAY['Copper Peptide']::text[], 1, 0.5, 'peptide'),
  ('KPV', '{}'::text[], 2, 0.5, 'peptide'),
  ('CJC-1295 DAC', ARRAY['CJC-1295 with DAC']::text[], 192, 2, 'peptide'),
  ('CJC-1295 no DAC', ARRAY['Modified GRF 1-29']::text[], 0.5, 0.25, 'peptide'),
  ('Ipamorelin', '{}'::text[], 2, 0.25, 'peptide'),
  ('GHRP-2', ARRAY['Pralmorelin']::text[], 1, 0.25, 'peptide'),
  ('GHRP-6', '{}'::text[], 2, 0.25, 'peptide'),
  ('Sermorelin', '{}'::text[], 0.17, 0.17, 'peptide'),
  ('Tesamorelin', ARRAY['Egrifta']::text[], 0.1, 0.1, 'peptide'),
  ('MK-677', ARRAY['Ibutamoren','Nutrobal']::text[], 6, 1, 'peptide'),
  ('Semax', '{}'::text[], 0.5, 0.25, 'peptide'),
  ('Selank', '{}'::text[], 1, 0.25, 'peptide'),
  ('Dihexa', '{}'::text[], 24, 2, 'peptide'),
  ('Cerebrolysin', '{}'::text[], 1, 0.5, 'peptide'),
  ('NA-Semax Amidate', '{}'::text[], 0.75, 0.25, 'peptide'),
  ('PT-141', ARRAY['Bremelanotide']::text[], 2.7, 1, 'peptide'),
  ('Melanotan II', ARRAY['MT-2']::text[], 24, 1, 'peptide'),
  ('Epithalon', ARRAY['Epitalon']::text[], 1, 0.5, 'peptide'),
  ('SS-31', ARRAY['Elamipretide']::text[], 2, 0.5, 'peptide'),
  ('Humanin', '{}'::text[], 3, 1, 'peptide'),
  ('Testosterone Enanthate', ARRAY['Test E']::text[], 192, 48, 'hormone'),
  ('Testosterone Cypionate', ARRAY['Test C']::text[], 192, 48, 'hormone'),
  ('Testosterone Propionate', ARRAY['Test P']::text[], 20, 12, 'hormone'),
  ('HCG', ARRAY['Human Chorionic Gonadotropin']::text[], 36, 6, 'hormone'),
  ('IGF-1 LR3', ARRAY['Long R3 IGF-1']::text[], 20, 2, 'hormone'),
  ('HGH', ARRAY['Somatropin','Human Growth Hormone']::text[], 3.8, 3, 'hormone')
on conflict (name) do update set
  aliases = excluded.aliases,
  half_life_hours = excluded.half_life_hours,
  tmax_hours = excluded.tmax_hours,
  category = excluded.category,
  updated_at = now();
