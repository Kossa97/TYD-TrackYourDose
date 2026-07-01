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
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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
-- Feldkonvention: half_life_hours = Eliminations-HWZ, tmax_hours = Zeit bis Peak,
-- bioavailability_sc = Peak-Skalierung (1.0 = injizierbar/voll, <1 = oral),
-- notes = Datenquelle + Belastbarkeit ("Schätzung" wenn extrapoliert).
insert into public.pk_profiles
  (name, aliases, half_life_hours, tmax_hours, bioavailability_sc, notes, category)
values
  -- GLP-1 / Metabolic
  ('Semaglutide', ARRAY['Ozempic','Wegovy']::text[], 168, 24, 1.0, null, 'glp1'),
  ('Tirzepatide', ARRAY['Mounjaro','Zepbound']::text[], 120, 8, 1.0, null, 'glp1'),
  ('Liraglutide', ARRAY['Victoza','Saxenda']::text[], 13, 8, 1.0, null, 'glp1'),
  ('Exenatide', ARRAY['Byetta']::text[], 2.4, 2, 1.0, null, 'glp1'),
  ('Retatrutide', ARRAY['LY3437943','Reta','Triple-G']::text[], 156, 48, 1.0,
   'HWZ ~144–165 h, tmax 24–72 h; wöchentlich SC. GIP/GLP-1/Glucagon-Triagonist. Quelle: Nature Medicine 2024 (Phase 2, Lilly).', 'glp1'),
  ('Cagrilintide', ARRAY['AM833','NN9838','Cagri']::text[], 175, 48, 1.0,
   'HWZ ~7,3 Tage; wöchentlich SC. Langwirksames Amylin-Analogon (CagriSema). Quelle: Lancet 2021 (Phase 1b, Novo Nordisk).', 'glp1'),
  ('Survodutide', ARRAY['BI 456906']::text[], 144, 72, 1.0,
   'HWZ ~6 Tage, Peak 60–96 h; wöchentlich SC. GCGR/GLP-1-Dualagonist. Quelle: J Hepatology 2024 (Boehringer Ingelheim).', 'glp1'),
  ('Mazdutide', ARRAY['IBI362','LY3305677']::text[], 175, 72, 1.0,
   'HWZ ~7–8 Tage, tmax ~72 h; wöchentlich SC. GLP-1/Glucagon-Dualagonist. Quelle: Diabetes Obes Metab 2025 (Innovent/Lilly).', 'glp1'),
  ('Orforglipron', ARRAY['LY3502970']::text[], 48, 6, 0.35,
   'Orales nicht-Peptid GLP-1; HWZ ~48 h, tmax 4–8 h, orale BV ~30–40 %. Quelle: Diabetes Obes Metab 2023 / NEJM 2023.', 'glp1'),
  -- Research-Peptide
  ('BPC-157', ARRAY['Body Protection Compound']::text[], 4, 0.5, 1.0, null, 'peptide'),
  ('TB-500', ARRAY['Thymosin Beta-4']::text[], 72, 2, 1.0, null, 'peptide'),
  ('GHK-Cu', ARRAY['Copper Peptide']::text[], 1, 0.5, 1.0, null, 'peptide'),
  ('KPV', '{}'::text[], 2, 0.5, 1.0, null, 'peptide'),
  ('CJC-1295 DAC', ARRAY['CJC-1295 with DAC']::text[], 192, 2, 1.0, null, 'peptide'),
  ('CJC-1295 no DAC', ARRAY['Modified GRF 1-29']::text[], 0.5, 0.25, 1.0, null, 'peptide'),
  ('Ipamorelin', '{}'::text[], 2, 0.25, 1.0, null, 'peptide'),
  ('GHRP-2', ARRAY['Pralmorelin']::text[], 1, 0.25, 1.0, null, 'peptide'),
  ('GHRP-6', '{}'::text[], 2, 0.25, 1.0, null, 'peptide'),
  ('Hexarelin', ARRAY['Examorelin']::text[], 1.3, 0.3, 1.0,
   'Terminale HWZ ~76 min (Ratte) / ~120 min (Hund); GH-Effekt 3–4 h. Quelle: Drug Metab Dispos.', 'peptide'),
  ('Sermorelin', '{}'::text[], 0.17, 0.17, 1.0, null, 'peptide'),
  ('Tesamorelin', ARRAY['Egrifta']::text[], 0.3, 0.25, 1.0,
   'HWZ 8–11 min Einzeldosis, 26–38 min Steady-State (14 Tage SC). Quelle: FDA-Label Egrifta.', 'peptide'),
  ('MK-677', ARRAY['Ibutamoren','Nutrobal']::text[], 6, 1, 1.0, null, 'peptide'),
  ('MOTS-c', ARRAY['Mitochondrial ORF 12S rRNA-c']::text[], 0.75, 0.5, 1.0,
   'Plasma-HWZ ~30–60 min (SC). Humane PK begrenzt — Schätzung aus Sekundärliteratur.', 'peptide'),
  ('AOD-9604', ARRAY['AOD9604','hGH 176-191 (Tyr)']::text[], 0.3, 0.4, 1.0,
   'Plasma-HWZ ~4 min (IV, Metabolic Pharmaceuticals), SC-Peak 30–60 min. Sehr kurze HWZ.', 'peptide'),
  ('HGH Fragment 176-191', ARRAY['HGH Frag','Frag 176-191','Fragment 176-191']::text[], 0.4, 0.4, 1.0,
   'HWZ ~15–30 min; humane Daten begrenzt, aus AOD-9604 extrapoliert. Schätzung.', 'peptide'),
  ('Thymosin Alpha-1', ARRAY['Tα1','Ta1','Thymalfasin','Zadaxin']::text[], 2, 0.5, 1.0,
   'Plasma-HWZ ~2 h. Quelle: PK-Studien Thymalfasin (Zadaxin, in mehreren Ländern zugelassen).', 'peptide'),
  ('DSIP', ARRAY['Delta Sleep-Inducing Peptide']::text[], 0.35, 0.3, 1.0,
   'Plasma-HWZ ~15–25 min (Aminopeptidase-Spaltung). Schätzung aus Degradationsstudien.', 'peptide'),
  ('Kisspeptin-10', ARRAY['KP-10','Metastin 45-54']::text[], 0.07, 0.1, 1.0,
   'Plasma-HWZ ~3,8 min (Männer). Sehr kurze HWZ. Quelle: JCEM 2011 (Jayasena et al.).', 'peptide'),
  ('Semax', '{}'::text[], 0.5, 0.25, 1.0, null, 'peptide'),
  ('Selank', '{}'::text[], 1, 0.25, 1.0, null, 'peptide'),
  ('Dihexa', '{}'::text[], 24, 2, 1.0, null, 'peptide'),
  ('Cerebrolysin', '{}'::text[], 1, 0.5, 1.0, null, 'peptide'),
  ('NA-Semax Amidate', '{}'::text[], 0.75, 0.25, 1.0, null, 'peptide'),
  ('PT-141', ARRAY['Bremelanotide']::text[], 2.7, 1, 1.0, null, 'peptide'),
  ('Melanotan II', ARRAY['MT-2','MT-II']::text[], 1.0, 1.25, 1.0,
   'HWZ ~33 min (bi-exponentiell), Peak 60–90 min. Quelle: humane MT-II-PK-Studien.', 'peptide'),
  ('Epithalon', ARRAY['Epitalon']::text[], 1, 0.5, 1.0, null, 'peptide'),
  ('SS-31', ARRAY['Elamipretide']::text[], 2, 0.5, 1.0, null, 'peptide'),
  ('Humanin', '{}'::text[], 3, 1, 1.0, null, 'peptide'),
  -- Hormone
  ('Testosterone Enanthate', ARRAY['Test E']::text[], 110, 48, 1.0,
   'Eliminations-HWZ ~4,5 Tage (IM-Depot). Quelle: PK-Literatur Testosteron-Ester.', 'hormone'),
  ('Testosterone Cypionate', ARRAY['Test C']::text[], 192, 48, 1.0,
   'HWZ ~8 Tage (IM-Depot). Quelle: FDA-Label Testosteron-Cypionat.', 'hormone'),
  ('Testosterone Propionate', ARRAY['Test P']::text[], 20, 12, 1.0, null, 'hormone'),
  ('HCG', ARRAY['Human Chorionic Gonadotropin']::text[], 36, 6, 1.0, null, 'hormone'),
  ('IGF-1 LR3', ARRAY['Long R3 IGF-1']::text[], 20, 2, 1.0, null, 'hormone'),
  ('HGH', ARRAY['Somatropin','Human Growth Hormone']::text[], 3.8, 3, 1.0, null, 'hormone')
on conflict (name) do update set
  aliases = excluded.aliases,
  half_life_hours = excluded.half_life_hours,
  tmax_hours = excluded.tmax_hours,
  bioavailability_sc = excluded.bioavailability_sc,
  notes = excluded.notes,
  category = excluded.category,
  updated_at = now();
