begin;

with catalog_dosage_forms (canonical_name, suggested_dosage_forms) as (
  values
    ('BPC-157', array['vial', 'capsule', 'nasal_spray', 'tube']::text[]),
    ('TB-500', array['vial']::text[]),
    ('Ipamorelin', array['vial', 'nasal_spray']::text[]),
    ('CJC-1295', array['vial', 'tablet']::text[]),
    ('GHRP-2', array['vial', 'nasal_spray']::text[]),
    ('Sermorelin', array['vial', 'ampoule']::text[]),
    ('Semaglutid', array['pen', 'tablet', 'vial']::text[]),
    ('Tirzepatid', array['pen', 'vial']::text[]),
    ('Selank', array['nasal_spray', 'drops']::text[]),
    ('Epithalon', array['vial', 'capsule', 'tablet']::text[]),
    ('GHK-Cu', array['vial', 'liquid', 'gel', 'tube']::text[]),
    ('Vitamin D3', array['capsule', 'drops', 'tablet', 'spray']::text[]),
    ('Vitamin K2', array['capsule', 'drops', 'tablet']::text[]),
    ('Magnesium', array['capsule', 'tablet', 'powder', 'liquid']::text[]),
    ('Omega-3', array['capsule', 'liquid']::text[]),
    ('Creatin', array['powder', 'capsule', 'tablet']::text[]),
    ('Testosteron', array['vial', 'ampoule', 'gel', 'capsule', 'pen']::text[]),
    ('Testosteron Enantat', array['vial', 'ampoule', 'pen']::text[]),
    ('Metformin', array['tablet', 'liquid']::text[]),
    ('Melatonin', array['tablet', 'capsule', 'drops', 'spray']::text[])
)
update public.substance_catalog catalog
set suggested_dosage_forms = catalog_dosage_forms.suggested_dosage_forms
from catalog_dosage_forms
where lower(catalog.canonical_name) = lower(catalog_dosage_forms.canonical_name);

commit;
