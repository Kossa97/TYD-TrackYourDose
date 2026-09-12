-- Stand von public.substance_catalog vor der Katalog-Erweiterung.
-- Aufgenommen am 2026-09-12 aus dem Projekt peptid-tracker (xcskcojakolphtbuqfbw).
-- 26 Zeilen, mit ihren echten ids — eine Rueckspielung erhaelt damit alle
-- Verweise aus stack_item_ingredients.catalog_substance_id.
--
-- ZURUECKSPIELEN: diese Datei ausfuehren. Sie setzt die 26 Zeilen auf genau
-- diesen Stand zurueck und laesst alles, was spaeter dazukam, unberuehrt.
-- Sie loescht nichts.

begin;

with sicherung (id, canonical_name, aliases, default_category, suggested_dosage_forms, suggested_units, pk_profile_id, active) as (
  values
  ('29cb36ae-05de-4217-ae42-41e3ce625c81'::uuid, 'BPC-157', '{"Body Protection Compound-157"}'::text[], 'peptide', '{vial,capsule,nasal_spray,tube}'::text[], '{}'::text[], '61cc2763-f4a5-41c0-9f79-54893eaf0700'::uuid, 't'::boolean),
  ('379475b3-c6e9-4906-9083-4a08e091e53b'::uuid, 'CJC-1295', '{"CJC-1295 mit DAC (GHRH-Analogon)"}'::text[], 'peptide', '{vial,tablet}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('8a2d8c46-60f6-4569-bd04-11a7df34f6dc'::uuid, 'Creatin', '{Kreatin,Creatine}'::text[], 'supplement', '{powder,capsule,tablet}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('860372e9-5fc4-478d-9cb5-c87476544068'::uuid, 'Epithalon', '{"Epitalon (Ala-Glu-Asp-Gly, synthetisches Tetrapeptid)"}'::text[], 'peptide', '{vial,capsule,tablet}'::text[], '{}'::text[], 'c38e536c-2871-4a72-8543-86be51994293'::uuid, 't'::boolean),
  ('1a9dec01-cf31-400d-9cb5-c2493b9c0740'::uuid, 'GHK-Cu', '{"GHK-Cu (Glycyl-L-Histidyl-L-Lysin-Kupfer)"}'::text[], 'peptide', '{vial,liquid,gel,tube}'::text[], '{}'::text[], 'a6633642-1de0-4711-91ee-c752ca82c9e6'::uuid, 't'::boolean),
  ('6d96cd04-9bec-473e-a8ba-3772228d140b'::uuid, 'GHRP-2', '{"Growth Hormone Releasing Peptide-2"}'::text[], 'peptide', '{vial,nasal_spray}'::text[], '{}'::text[], '9f618abf-3722-4c34-ba25-e1ee7db3eef6'::uuid, 't'::boolean),
  ('ed327689-4fde-4252-a0e8-7a44b979e7bd'::uuid, 'IGF-1 LR3', '{"Insulin-like Growth Factor 1 Long Arg3 (Mechanogrowth Factor variant)"}'::text[], 'peptide', '{}'::text[], '{}'::text[], '803b3dbe-d5ad-4b67-93eb-feade361b76e'::uuid, 't'::boolean),
  ('553e80d8-49e7-4f3d-abd6-428fcface792'::uuid, 'Ipamorelin', '{"Ipamorelin (Penta-Peptid-GH-Sekretagog)"}'::text[], 'peptide', '{vial,nasal_spray}'::text[], '{}'::text[], '32103699-2089-4e55-b92f-a3069b2498eb'::uuid, 't'::boolean),
  ('87e5ec17-230f-45d6-819a-5e92457b932f'::uuid, 'Magnesium', '{}'::text[], 'supplement', '{capsule,tablet,powder,liquid}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('b293fc65-7275-441c-a65c-e14c3752ff23'::uuid, 'Melanotan II (MT2)', '{"α-Melanocyte-stimulating hormone (α-MSH) analog"}'::text[], 'peptide', '{}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('1a5cafa3-99d2-4642-9bea-f9d8f31dcf52'::uuid, 'Melatonin', '{}'::text[], 'supplement', '{tablet,capsule,drops,spray}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('1e8c8d84-bb2a-4bc6-8a60-992537587413'::uuid, 'Metformin', '{}'::text[], 'medication', '{tablet,liquid}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('9eec5426-771c-4330-98e7-dd7af322f6fb'::uuid, 'Omega-3', '{"Omega 3"}'::text[], 'supplement', '{capsule,liquid}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('2d1c9514-c18c-4419-a0ae-27b1ebb03e76'::uuid, 'Retatrutide', '{"Retatrutide (LY3437943)"}'::text[], 'peptide', '{}'::text[], '{}'::text[], 'a387877a-cbc0-4166-8121-7374456ebd15'::uuid, 't'::boolean),
  ('dca657be-d939-4106-ba77-528020e428c0'::uuid, 'Selank', '{"Selank (Tuftsin-Analogon, Heptapeptid)"}'::text[], 'peptide', '{nasal_spray,drops}'::text[], '{}'::text[], '82aa2cda-b79b-4489-bc73-5e03c41590f2'::uuid, 't'::boolean),
  ('0e4b11ec-2f1a-4476-85eb-fc17581dfde4'::uuid, 'Semaglutid', '{"Semaglutid (GLP-1-Rezeptoragonist)"}'::text[], 'peptide', '{pen,tablet,vial}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('1374cfd8-2ea5-495b-a997-69afd0f82bc6'::uuid, 'Semax', '{"Met-Glu-His-Phe-Pro-Gly-Pro (Heptapeptid)"}'::text[], 'peptide', '{}'::text[], '{}'::text[], 'a9655b9d-c16c-4b82-a4e6-9511a4077a0e'::uuid, 't'::boolean),
  ('f18fe008-bca7-4e50-8072-2eb36721dd36'::uuid, 'Sermorelin', '{"Sermorelin (GRF 1-29, GHRH-Fragment)"}'::text[], 'peptide', '{vial,ampoule}'::text[], '{}'::text[], '199d13d9-3591-4915-a9fc-6f1c8e02fa65'::uuid, 't'::boolean),
  ('96330d81-5888-4c1d-af89-cdafcc5fb9bb'::uuid, 'SLU-PP-332', '{}'::text[], 'peptide', '{}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('590a80f0-0b66-43ae-989e-6d1c6bd0e912'::uuid, 'TB-500', '{"Thymosin Beta-4 Peptid-Fragment"}'::text[], 'peptide', '{vial}'::text[], '{}'::text[], 'b5d7eb9a-ed56-446a-b71a-befaddd53f81'::uuid, 't'::boolean),
  ('835a20b9-3f2a-44c1-aecc-698a9bdf7d24'::uuid, 'Tesamorelin', '{"1-(3-(2-Ethyl-4,5-dihydro-4-oxo-1H-imidazol-2-yl)-phenylalanyl)-hexahydro-histidyl-D-tryptophyl-seryl-tyrosyl-D-leucyl-leucyl-arginyl-prolyl-glycinamid"}'::text[], 'peptide', '{}'::text[], '{}'::text[], '0b52183e-1b4a-4df4-99c8-d713706cf077'::uuid, 't'::boolean),
  ('e9cd20b3-df91-4895-8fe8-bc6eb21589a9'::uuid, 'Testosteron', '{Testosterone}'::text[], 'hormone', '{vial,ampoule,gel,capsule,pen}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('3b9052e8-8265-4f5f-85dc-96f99bf78de6'::uuid, 'Testosteron Enantat', '{"Testosterone Enanthate"}'::text[], 'hormone', '{vial,ampoule,pen}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('a44c8232-7a95-43b3-ace8-c41bb56efbf9'::uuid, 'Tirzepatid', '{"Tirzepatid (dualer GIP/GLP-1-Rezeptoragonist)"}'::text[], 'peptide', '{pen,vial}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('549e62b0-c804-451f-9edd-63e7b9305189'::uuid, 'Vitamin D3', '{Cholecalciferol}'::text[], 'vitamin', '{capsule,drops,tablet,spray}'::text[], '{}'::text[], NULL::uuid, 't'::boolean),
  ('a0fb8cdc-1e05-4a27-a94d-11c159402d93'::uuid, 'Vitamin K2', '{Menachinon-7,MK-7}'::text[], 'vitamin', '{capsule,drops,tablet}'::text[], '{}'::text[], NULL::uuid, 't'::boolean)
)
insert into public.substance_catalog as ziel
  (id, canonical_name, aliases, default_category, suggested_dosage_forms, suggested_units, pk_profile_id, active)
select * from sicherung
on conflict (id) do update set
  canonical_name = excluded.canonical_name,
  aliases = excluded.aliases,
  default_category = excluded.default_category,
  suggested_dosage_forms = excluded.suggested_dosage_forms,
  suggested_units = excluded.suggested_units,
  pk_profile_id = excluded.pk_profile_id,
  active = excluded.active,
  updated_at = now();

commit;
