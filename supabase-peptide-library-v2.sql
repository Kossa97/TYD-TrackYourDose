-- ============================================================
-- PEPTIDE LIBRARY v2 — Schema-Erweiterung
-- Nach supabase-peptide-library.sql ausführen
-- Fügt Evidence-Breakdown und Research-Gaps hinzu
-- ============================================================

alter table public.peptide_library
  add column if not exists evidence_human    text not null default 'none',
  add column if not exists evidence_animal   text not null default 'none',
  add column if not exists evidence_clinical text not null default 'none',
  add column if not exists evidence_score    smallint not null default 1,
  add column if not exists research_gaps     text[] not null default '{}';

-- ── Evidence updates für alle 11 Peptide ─────────────────────────────────────
-- evidence_human:    'none' | 'limited' | 'moderate' | 'strong'
-- evidence_animal:   'none' | 'limited' | 'moderate' | 'strong'
-- evidence_clinical: 'none' | 'sparse'  | 'moderate' | 'extensive'
-- evidence_score:    1–10

update public.peptide_library set
  evidence_human    = 'limited',
  evidence_animal   = 'strong',
  evidence_clinical = 'none',
  evidence_score    = 4,
  research_gaps     = ARRAY[
    'Keine klinischen Studien am Menschen durchgeführt',
    'Optimale humane Dosierung unbekannt',
    'Unbekannte Langzeitwirkungen und Sicherheitsprofil',
    'Mechanismen größtenteils nur in Nagetiermodellen untersucht'
  ]
where slug = 'bpc-157';

update public.peptide_library set
  evidence_human    = 'none',
  evidence_animal   = 'moderate',
  evidence_clinical = 'none',
  evidence_score    = 2,
  research_gaps     = ARRAY[
    'Praktisch keine kontrollierten Humanstudien',
    'Sicherheitsprofil beim Menschen unbekannt',
    'Keine klinische Entwicklung durch pharmazeutische Unternehmen',
    'Bioverfügbarkeit nach subkutaner Injektion beim Menschen unklar'
  ]
where slug = 'tb-500';

update public.peptide_library set
  evidence_human    = 'moderate',
  evidence_animal   = 'strong',
  evidence_clinical = 'sparse',
  evidence_score    = 6,
  research_gaps     = ARRAY[
    'Klinische Studie für postoperativen Ileus nicht abgeschlossen',
    'Langzeiteffekte auf Wachstumshormon-Achse unbekannt',
    'Dosisoptimierung für Anti-Aging-Kontext nicht belegt',
    'Vergleichsdaten zu anderen GH-Sekretagoga fehlen'
  ]
where slug = 'ipamorelin';

update public.peptide_library set
  evidence_human    = 'moderate',
  evidence_animal   = 'moderate',
  evidence_clinical = 'sparse',
  evidence_score    = 5,
  research_gaps     = ARRAY[
    'Klinisches Entwicklungsprogramm (ConjuChem) wurde eingestellt',
    'Langzeitsicherheit bei chronischer Anwendung unklar',
    'Vergleichsdaten zu natürlichem GHRH fehlen',
    'Kombinationswirkung mit anderen GH-Sekretagoga wenig untersucht'
  ]
where slug = 'cjc-1295';

update public.peptide_library set
  evidence_human    = 'limited',
  evidence_animal   = 'strong',
  evidence_clinical = 'sparse',
  evidence_score    = 4,
  research_gaps     = ARRAY[
    'Wird primär für diagnostische GH-Stimulationstests verwendet',
    'Cortisol-Nebenwirkungen limitieren therapeutisches Potenzial',
    'Wenige randomisierte kontrollierte Studien',
    'Keine Langzeitdaten bei gesunden Erwachsenen'
  ]
where slug = 'ghrp-2';

update public.peptide_library set
  evidence_human    = 'strong',
  evidence_animal   = 'strong',
  evidence_clinical = 'moderate',
  evidence_score    = 8,
  research_gaps     = ARRAY[
    'Für Erwachsene Off-Label ohne explizite Indikation',
    'Neuere Vergleichsdaten zu CJC-1295 fehlen',
    'Langzeitdaten bei Erwachsenen über 10+ Jahre begrenzt'
  ]
where slug = 'sermorelin';

update public.peptide_library set
  evidence_human    = 'strong',
  evidence_animal   = 'strong',
  evidence_clinical = 'extensive',
  evidence_score    = 10,
  research_gaps     = ARRAY[
    'Langzeitwirkungen über 5 Jahre in breiter Population begrenzt',
    'Vergleichsdaten mit Tirzepatid in echten Populationen laufen noch',
    'Langfristige kardiovaskuläre Effekte nach Absetzen unbekannt'
  ]
where slug = 'semaglutide';

update public.peptide_library set
  evidence_human    = 'strong',
  evidence_animal   = 'strong',
  evidence_clinical = 'extensive',
  evidence_score    = 10,
  research_gaps     = ARRAY[
    'Erst seit 2022/2023 zugelassen — Langzeitdaten (>3 Jahre) entstehen erst',
    'Vergleich mit GLP-1-Monotherapie in realen klinischen Settings begrenzt',
    'Wirkung nach Absetzen und Rebound-Effekte nicht vollständig charakterisiert'
  ]
where slug = 'tirzepatide';

update public.peptide_library set
  evidence_human    = 'moderate',
  evidence_animal   = 'strong',
  evidence_clinical = 'sparse',
  evidence_score    = 6,
  research_gaps     = ARRAY[
    'Russische Studien bislang kaum unabhängig reproduziert',
    'Keine westlichen Phase-3-Studien durchgeführt',
    'Intranasal-Bioverfügbarkeit und Dosiskonsistenz variieren stark',
    'Mechanismus im Detail noch nicht vollständig aufgeklärt'
  ]
where slug = 'selank';

update public.peptide_library set
  evidence_human    = 'limited',
  evidence_animal   = 'moderate',
  evidence_clinical = 'none',
  evidence_score    = 3,
  research_gaps     = ARRAY[
    'Nahezu ausschließlich eine russische Forschungsgruppe (Khavinson)',
    'Telomerdaten am Menschen nicht unabhängig reproduziert',
    'Wirksamkeit am Menschen klinisch nicht belegt',
    'Unsicherheit über optimale Dosierung und Kurzeitplan'
  ]
where slug = 'epithalon';

update public.peptide_library set
  evidence_human    = 'moderate',
  evidence_animal   = 'moderate',
  evidence_clinical = 'sparse',
  evidence_score    = 5,
  research_gaps     = ARRAY[
    'Systemische Wirkung beim Menschen kaum durch RCTs belegt',
    'Topische vs. systemische Effekte nicht klar getrennt untersucht',
    'Dosisfindung für systemische Anwendung fehlt vollständig',
    'Absorption und Bioverfügbarkeit nach s.c. Injektion unklar'
  ]
where slug = 'ghk-cu';

-- Ergebnis prüfen:
-- select slug, evidence_human, evidence_animal, evidence_clinical, evidence_score
-- from peptide_library order by sort_order;
