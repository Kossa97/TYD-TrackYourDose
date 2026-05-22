-- ============================================================
-- PEPTIDE LIBRARY v3 — Tags hinzufügen
-- Nach v1 und v2 ausführen
-- ============================================================

alter table public.peptide_library
  add column if not exists tags text[] not null default '{}';

-- Tags für alle bestehenden Peptide
update public.peptide_library set tags = ARRAY['Heilung', 'Regeneration', 'Sehnen', 'Darm', 'Präklinisch'] where slug = 'bpc-157';
update public.peptide_library set tags = ARRAY['Heilung', 'Regeneration', 'Wundheilung', 'Präklinisch'] where slug = 'tb-500';
update public.peptide_library set tags = ARRAY['GH-Sekretagog', 'Wachstumshormon', 'Muskelaufbau', 'Schlaf', 'Phase 2'] where slug = 'ipamorelin';
update public.peptide_library set tags = ARRAY['GH-Sekretagog', 'GHRH-Analog', 'Wachstumshormon', 'IGF-1', 'Phase 2'] where slug = 'cjc-1295';
update public.peptide_library set tags = ARRAY['GH-Sekretagog', 'Wachstumshormon', 'Ghrelin', 'Appetit', 'Phase 1'] where slug = 'ghrp-2';
update public.peptide_library set tags = ARRAY['GHRH', 'Wachstumshormon', 'GH-Mangel', 'Zugelassen', 'Klinisch'] where slug = 'sermorelin';
update public.peptide_library set tags = ARRAY['GLP-1', 'Gewichtsverlust', 'Diabetes', 'Zugelassen', 'Kardiovaskulär'] where slug = 'semaglutide';
update public.peptide_library set tags = ARRAY['GLP-1', 'GIP', 'Gewichtsverlust', 'Diabetes', 'Zugelassen', 'Twincretin'] where slug = 'tirzepatide';
update public.peptide_library set tags = ARRAY['Nootropikum', 'Anxiolytikum', 'BDNF', 'Kognition', 'Phase 2'] where slug = 'selank';
update public.peptide_library set tags = ARRAY['Anti-Aging', 'Telomere', 'Telomerase', 'Longevity', 'Präklinisch'] where slug = 'epithalon';
update public.peptide_library set tags = ARRAY['Anti-Aging', 'Heilung', 'Kollagen', 'Haut', 'Kupfer-Peptid'] where slug = 'ghk-cu';
