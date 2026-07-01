-- ============================================================
-- PK-Profile: Update Juli 2026 (Gruppen A + B + C)
-- Im Supabase SQL Editor ausführen (bypassed RLS).
--
-- A) 3 Korrekturen an Bestandsprofilen (Datenfehler laut reputabler Quellen)
-- B) 5 GLP-1 / Metabolic (klinische Phase-2/3-PK-Daten)
-- C) 7 Research-Peptide (Datenlage im notes-Feld dokumentiert)
--
-- Feldkonvention (wie Bestandsdaten):
--   half_life_hours = Eliminations-Halbwertszeit
--   tmax_hours      = Zeit bis Peak-Plasmaspiegel (time-to-peak)
--   bioavailability_sc = Skalierung des Peaks (1.0 = injizierbar/voll; <1 = oral)
--   notes           = Datenquelle + Belastbarkeit ("Schätzung", wenn extrapoliert)
-- ============================================================

-- notes-Spalte sicherstellen (in älteren Schemas evtl. nicht vorhanden)
alter table public.pk_profiles
  add column if not exists notes text;

insert into public.pk_profiles
  (name, aliases, half_life_hours, tmax_hours, bioavailability_sc, vd_l_kg, category, notes)
values
  -- ── A) Korrekturen ──────────────────────────────────────────────────────
  ('Melanotan II', ARRAY['MT-2','MT-II']::text[], 1.0, 1.25, 1.0, 0.3, 'peptide',
   'Korrigiert (war 24 h): Plasma-HWZ ~33 min (bi-exponentiell), Peak 60–90 min. Quelle: humane MT-II-PK-Studien.'),
  ('Testosterone Enanthate', ARRAY['Test E']::text[], 110, 48, 1.0, 0.3, 'hormone',
   'Korrigiert (war 192 h): Eliminations-HWZ ~4,5 Tage (IM-Depot). Quelle: PK-Literatur Testosteron-Ester.'),
  ('Tesamorelin', ARRAY['Egrifta']::text[], 0.3, 0.25, 1.0, 0.3, 'peptide',
   'Korrigiert (war 0,1 h): HWZ 8–11 min Einzeldosis, 26–38 min Steady-State (14 Tage SC). Quelle: FDA-Label Egrifta.'),

  -- ── B) GLP-1 / Metabolic (neu) ──────────────────────────────────────────
  ('Retatrutide', ARRAY['LY3437943','Reta','Triple-G']::text[], 156, 48, 1.0, 0.3, 'glp1',
   'HWZ ~144–165 h, tmax 24–72 h; wöchentlich SC. GIP/GLP-1/Glucagon-Triagonist. Quelle: Nature Medicine 2024 (Phase 2, Lilly).'),
  ('Cagrilintide', ARRAY['AM833','NN9838','Cagri']::text[], 175, 48, 1.0, 0.3, 'glp1',
   'HWZ ~7,3 Tage; wöchentlich SC. Langwirksames Amylin-Analogon (Basis von CagriSema). Quelle: Lancet 2021 (Phase 1b, Novo Nordisk).'),
  ('Survodutide', ARRAY['BI 456906']::text[], 144, 72, 1.0, 0.3, 'glp1',
   'HWZ ~6 Tage, Peak 60–96 h; wöchentlich SC. GCGR/GLP-1-Dualagonist. Quelle: J Hepatology 2024 (Boehringer Ingelheim).'),
  ('Mazdutide', ARRAY['IBI362','LY3305677']::text[], 175, 72, 1.0, 0.3, 'glp1',
   'HWZ ~7–8 Tage, tmax ~72 h; wöchentlich SC. GLP-1/Glucagon-Dualagonist. Quelle: Diabetes Obes Metab 2025 (Innovent/Lilly).'),
  ('Orforglipron', ARRAY['LY3502970']::text[], 48, 6, 0.35, 0.3, 'glp1',
   'Orales nicht-Peptid GLP-1; HWZ ~48 h (Steady-State), tmax 4–8 h, orale BV ~30–40 %. Quelle: Diabetes Obes Metab 2023 / NEJM 2023.'),

  -- ── C) Research-Peptide (neu) ───────────────────────────────────────────
  ('MOTS-c', ARRAY['Mitochondrial ORF 12S rRNA-c']::text[], 0.75, 0.5, 1.0, 0.3, 'peptide',
   'Plasma-HWZ ~30–60 min (SC); Wirkung hält deutlich länger an. Humane PK begrenzt — Schätzung aus Sekundärliteratur.'),
  ('AOD-9604', ARRAY['AOD9604','hGH 176-191 (Tyr)']::text[], 0.3, 0.4, 1.0, 0.3, 'peptide',
   'Plasma-HWZ ~4 min (IV, Metabolic Pharmaceuticals), SC-Peak 30–60 min. Sehr kurze HWZ — GH-Fragment.'),
  ('HGH Fragment 176-191', ARRAY['HGH Frag','Frag 176-191','Fragment 176-191']::text[], 0.4, 0.4, 1.0, 0.3, 'peptide',
   'HWZ ~15–30 min; humane Daten begrenzt, aus AOD-9604 extrapoliert. Schätzung.'),
  ('Thymosin Alpha-1', ARRAY['Tα1','Ta1','Thymalfasin','Zadaxin']::text[], 2, 0.5, 1.0, 0.3, 'peptide',
   'Plasma-HWZ ~2 h, Rückkehr zur Baseline <24 h. Quelle: PK-Studien Thymalfasin (Zadaxin, in mehreren Ländern zugelassen).'),
  ('Hexarelin', ARRAY['Examorelin']::text[], 1.3, 0.3, 1.0, 0.3, 'peptide',
   'Terminale HWZ ~76 min (Ratte) / ~120 min (Hund); GH-Effekt 3–4 h. Quelle: Drug Metab Dispos (Rattenkinetik).'),
  ('DSIP', ARRAY['Delta Sleep-Inducing Peptide']::text[], 0.35, 0.3, 1.0, 0.3, 'peptide',
   'Plasma-HWZ ~15–25 min (rasche Aminopeptidase-Spaltung). Schätzung aus DSIP-Degradationsstudien.'),
  ('Kisspeptin-10', ARRAY['KP-10','Metastin 45-54']::text[], 0.07, 0.1, 1.0, 0.3, 'peptide',
   'Plasma-HWZ ~3,8 min (Männer). Sehr kurze HWZ. Quelle: JCEM 2011 (Jayasena et al.).')
on conflict (name) do update set
  aliases            = excluded.aliases,
  half_life_hours    = excluded.half_life_hours,
  tmax_hours         = excluded.tmax_hours,
  bioavailability_sc = excluded.bioavailability_sc,
  vd_l_kg            = excluded.vd_l_kg,
  category           = excluded.category,
  notes              = excluded.notes,
  updated_at         = now();
