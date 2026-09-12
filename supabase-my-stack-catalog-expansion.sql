-- GENERIERT von scripts/generate-substance-catalog-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/substance-catalog-source.mjs.
-- Neu erzeugen mit: npm run catalog:sql
--
-- 52 Substanzen. Der Upsert trifft den Unique-Index auf
-- lower(canonical_name): bekannte Zeilen werden aktualisiert, neue angelegt.
-- Ein zweiter Lauf aendert nichts.

begin;

with quelle (canonical_name, aliases, default_category, suggested_dosage_forms, suggested_units, pk_profile_name) as (
  values
    ('Semaglutid', array['Semaglutide', 'Ozempic', 'Wegovy', 'Rybelsus']::text[], 'peptide', array['pen', 'vial', 'tablet']::text[], array['mg', 'mcg']::text[], 'Semaglutide'),
    ('Tirzepatid', array['Tirzepatide', 'Mounjaro', 'Zepbound']::text[], 'peptide', array['pen', 'vial']::text[], array['mg', 'mcg']::text[], 'Tirzepatide'),
    ('Liraglutid', array['Liraglutide', 'Victoza', 'Saxenda']::text[], 'peptide', array['pen']::text[], array['mg']::text[], 'Liraglutide'),
    ('Exenatid', array['Exenatide', 'Byetta', 'Bydureon']::text[], 'peptide', array['pen', 'vial']::text[], array['mcg', 'mg']::text[], 'Exenatide'),
    ('Retatrutid', array['Retatrutide', 'LY3437943', 'Reta', 'Triple-G']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Retatrutide'),
    ('Cagrilintid', array['Cagrilintide', 'AM833', 'NN9838', 'Cagri']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Cagrilintide'),
    ('Survodutid', array['Survodutide', 'BI 456906']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Survodutide'),
    ('Mazdutid', array['Mazdutide', 'IBI362', 'LY3305677']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Mazdutide'),
    ('Orforglipron', array['LY3502970']::text[], 'peptide', array['tablet', 'capsule']::text[], array['mg']::text[], 'Orforglipron'),
    ('BPC-157', array['Body Protection Compound', 'Body Protection Compound 157', 'PL-14736']::text[], 'peptide', array['vial', 'capsule', 'nasal_spray', 'tube']::text[], array['mg', 'mcg']::text[], 'BPC-157'),
    ('TB-500', array['Thymosin Beta-4', 'TB4']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'TB-500'),
    ('GHK-Cu', array['Copper Peptide', 'Kupferpeptid']::text[], 'peptide', array['vial', 'gel', 'tube']::text[], array['mg']::text[], 'GHK-Cu'),
    ('KPV', array['Lysin-Prolin-Valin']::text[], 'peptide', array['vial', 'capsule']::text[], array['mg', 'mcg']::text[], 'KPV'),
    ('CJC-1295', array['CJC-1295 DAC', 'CJC-1295 with DAC']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'CJC-1295 DAC'),
    ('CJC-1295 ohne DAC', array['CJC-1295 no DAC', 'Modified GRF 1-29', 'Mod GRF 1-29']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'CJC-1295 no DAC'),
    ('Ipamorelin', '{}'::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'Ipamorelin'),
    ('GHRP-2', array['Pralmorelin']::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'GHRP-2'),
    ('GHRP-6', '{}'::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'GHRP-6'),
    ('Hexarelin', array['Examorelin']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'Hexarelin'),
    ('Sermorelin', '{}'::text[], 'peptide', array['vial', 'ampoule']::text[], array['mcg', 'mg']::text[], 'Sermorelin'),
    ('Tesamorelin', array['Egrifta']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Tesamorelin'),
    ('MK-677', array['Ibutamoren', 'Nutrobal']::text[], 'peptide', array['capsule', 'tablet', 'drops']::text[], array['mg']::text[], 'MK-677'),
    ('MOTS-c', array['Mitochondrial ORF 12S rRNA-c']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'MOTS-c'),
    ('AOD-9604', array['AOD9604', 'hGH 176-191 (Tyr)']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'AOD-9604'),
    ('HGH Fragment 176-191', array['HGH Frag', 'Frag 176-191', 'Fragment 176-191']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'HGH Fragment 176-191'),
    ('Thymosin Alpha-1', array['Thymalfasin', 'Zadaxin', 'Ta1']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Thymosin Alpha-1'),
    ('DSIP', array['Delta Sleep-Inducing Peptide', 'Delta-Schlaf-induzierendes Peptid']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'DSIP'),
    ('Kisspeptin-10', array['KP-10', 'Metastin 45-54']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'Kisspeptin-10'),
    ('Semax', '{}'::text[], 'peptide', array['nasal_spray', 'vial', 'drops']::text[], array['mg', 'mcg']::text[], 'Semax'),
    ('Selank', '{}'::text[], 'peptide', array['nasal_spray', 'vial', 'drops']::text[], array['mg', 'mcg']::text[], 'Selank'),
    ('Dihexa', '{}'::text[], 'peptide', array['capsule', 'vial']::text[], array['mg', 'mcg']::text[], 'Dihexa'),
    ('Cerebrolysin', '{}'::text[], 'peptide', array['ampoule', 'vial']::text[], array['ml', 'mg']::text[], 'Cerebrolysin'),
    ('NA-Semax Amidat', array['NA-Semax Amidate', 'N-Acetyl Semax Amidate', 'NA-Semax']::text[], 'peptide', array['nasal_spray', 'drops', 'vial']::text[], array['mg', 'mcg']::text[], 'NA-Semax Amidate'),
    ('PT-141', array['Bremelanotid', 'Bremelanotide', 'Vyleesi']::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mg', 'mcg']::text[], 'PT-141'),
    ('Melanotan II', array['Melanotan 2', 'MT-2', 'MT-II']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Melanotan II'),
    ('Epithalon', array['Epitalon', 'Epithalone']::text[], 'peptide', array['vial', 'capsule', 'tablet']::text[], array['mg', 'mcg']::text[], 'Epithalon'),
    ('SS-31', array['Elamipretid', 'Elamipretide', 'MTP-131']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'SS-31'),
    ('Humanin', '{}'::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Humanin'),
    ('Testosteron', array['Testosterone']::text[], 'hormone', array['vial', 'ampoule', 'gel', 'patch', 'capsule', 'pen']::text[], array['mg']::text[], null),
    ('Testosteron Enantat', array['Testosterone Enanthate', 'Test E']::text[], 'hormone', array['vial', 'ampoule', 'pen']::text[], array['mg']::text[], 'Testosterone Enanthate'),
    ('Testosteron Cypionat', array['Testosterone Cypionate', 'Test C']::text[], 'hormone', array['vial', 'ampoule']::text[], array['mg']::text[], 'Testosterone Cypionate'),
    ('Testosteron Propionat', array['Testosterone Propionate', 'Test P']::text[], 'hormone', array['vial', 'ampoule']::text[], array['mg']::text[], 'Testosterone Propionate'),
    ('HCG', array['Human Chorionic Gonadotropin', 'Humanes Choriongonadotropin', 'Choriongonadotropin']::text[], 'hormone', array['vial', 'ampoule']::text[], array['IU', 'mg']::text[], 'HCG'),
    ('IGF-1 LR3', array['Long R3 IGF-1', 'LR3']::text[], 'hormone', array['vial']::text[], array['mcg', 'mg']::text[], 'IGF-1 LR3'),
    ('HGH', array['Somatropin', 'Human Growth Hormone', 'Wachstumshormon']::text[], 'hormone', array['vial', 'pen']::text[], array['IU', 'mg']::text[], 'HGH'),
    ('Vitamin D3', array['Cholecalciferol', 'Colecalciferol']::text[], 'vitamin', array['capsule', 'drops', 'tablet', 'spray']::text[], array['IU', 'mcg']::text[], null),
    ('Vitamin K2', array['Menachinon-7', 'MK-7', 'Menaquinon']::text[], 'vitamin', array['capsule', 'drops', 'tablet']::text[], array['mcg']::text[], null),
    ('Magnesium', array['Magnesiumcitrat', 'Magnesium citrate']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg']::text[], null),
    ('Omega-3', array['Omega 3', 'Fischöl', 'Fish oil', 'EPA/DHA']::text[], 'supplement', array['capsule']::text[], array['mg', 'g']::text[], null),
    ('Creatin', array['Kreatin', 'Creatine', 'Creatin-Monohydrat']::text[], 'supplement', array['powder', 'capsule', 'tablet']::text[], array['g', 'mg']::text[], null),
    ('Metformin', array['Metformin HCl', 'Glucophage']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Melatonin', '{}'::text[], 'supplement', array['tablet', 'capsule', 'drops', 'spray']::text[], array['mg', 'mcg']::text[], null)
),
aufgeloest as (
  select
    quelle.canonical_name,
    quelle.aliases,
    quelle.default_category,
    quelle.suggested_dosage_forms,
    quelle.suggested_units,
    -- Das PK-Profil wird ueber Name ODER Alias gesucht, wie schon im
    -- Foundation-Seed: der Katalog schreibt "Semaglutid", das Profil
    -- "Semaglutide".
    (
      select profil.id
      from public.pk_profiles profil
      where quelle.pk_profile_name is not null
        and (
          lower(profil.name) = lower(quelle.pk_profile_name)
          or exists (
            select 1
            from unnest(profil.aliases) profil_alias
            where lower(profil_alias) = lower(quelle.pk_profile_name)
          )
        )
      order by (lower(profil.name) = lower(quelle.pk_profile_name)) desc, profil.id
      limit 1
    ) as pk_profile_id
  from quelle
)
insert into public.substance_catalog as ziel (
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  active
)
select
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  true
from aufgeloest
on conflict (lower(canonical_name)) do update set
  aliases = excluded.aliases,
  default_category = excluded.default_category,
  suggested_dosage_forms = excluded.suggested_dosage_forms,
  suggested_units = excluded.suggested_units,
  -- Eine bestehende Verknuepfung wird nicht geloescht, nur ergaenzt: steht in
  -- der Quelle kein Profil, bleibt das gefundene stehen.
  pk_profile_id = coalesce(excluded.pk_profile_id, ziel.pk_profile_id),
  active = true,
  updated_at = now();

commit;
