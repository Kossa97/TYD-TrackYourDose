-- ============================================================
-- PEPTIDE LIBRARY — Wissenschaftliche Referenzdatenbank
-- Ausführen im Supabase SQL Editor
-- Kein medizinischer Rat. Nur Forschungsdaten.
-- ============================================================

create table if not exists public.peptide_library (
  id              uuid default gen_random_uuid() primary key,
  slug            text unique not null,
  name            text not null,
  full_name       text,
  category        text not null,
  -- categories: 'heilung' | 'wachstumshormon' | 'nootropikum' | 'stoffwechsel' | 'anti_aging' | 'sexualgesundheit'
  tldr            text not null,
  mechanism       text not null,
  benefits        text[] not null default '{}',
  research_dosage text,
  half_life       text,
  administration  text[] not null default '{}',
  research_status text not null default 'preclinical',
  -- status: 'preclinical' | 'phase_1' | 'phase_2' | 'approved'
  side_effects    text[] not null default '{}',
  contraindications text[] not null default '{}',
  pubmed_query    text,
  sort_order      int not null default 0,
  created_at      timestamptz default now() not null
);

-- Indexes für schnelle Abfragen
create index if not exists peptide_library_slug_idx     on public.peptide_library(slug);
create index if not exists peptide_library_category_idx on public.peptide_library(category);
create index if not exists peptide_library_status_idx   on public.peptide_library(research_status);

-- RLS: öffentlich lesbar, niemand kann direkt schreiben
alter table public.peptide_library enable row level security;

drop policy if exists "peptide_library_public_read" on public.peptide_library;
create policy "peptide_library_public_read"
  on public.peptide_library for select using (true);

-- ============================================================
-- SEED DATA — 11 Peptide
-- ============================================================

insert into public.peptide_library
  (slug, name, full_name, category, tldr, mechanism, benefits,
   research_dosage, half_life, administration, research_status,
   side_effects, contraindications, pubmed_query, sort_order)
values

-- ── 1. BPC-157 ──────────────────────────────────────────────
('bpc-157',
 'BPC-157',
 'Body Protection Compound-157',
 'heilung',
 'Synthetisches 15-Aminosäuren-Peptid aus dem menschlichen Magenprotein BPC. Zeigt in präklinischen Studien ausgeprägte heilungsfördernde Eigenschaften für Muskeln, Sehnen, Darm und Nervengewebe.',
 'Stimuliert VEGF (vaskulärer endothelialer Wachstumsfaktor) und andere Wachstumsfaktoren. Fördert Angiogenese (Neubildung von Blutgefäßen), moduliert NO-Signalwege und aktiviert Wachstumsfaktorrezeptoren (EGF-R, FAK, Paxillin).',
 ARRAY[
   'Muskel- und Sehnenregeneration',
   'Darmschutz und -heilung (IBD, Magengeschwüre)',
   'Neuroprotektiv (Tiermodelle)',
   'Anti-inflammatorisch',
   'Angiogenese (Gefäßneubildung)',
   'Knochenregeneration'
 ],
 '1–10 µg/kg KG subkutan oder intraperitoneal in Nagetiermodellen. Gängige Protokolle: 250–500 µg/Tag.',
 '~4 Stunden (systemisch).',
 ARRAY['Subkutan (s.c.)', 'Intraperitoneal (i.p.) – Tiermodelle', 'Oral – in GI-Studien'],
 'preclinical',
 ARRAY['In Tierstudien gut verträglich', 'Einzelfälle: lokale Reizung an Injektionsstelle'],
 ARRAY['Keine humanen Sicherheitsstudien vorhanden', 'Nicht für Menschen zugelassen'],
 'BPC-157 regeneration tendon healing',
 1),

-- ── 2. TB-500 ───────────────────────────────────────────────
('tb-500',
 'TB-500',
 'Thymosin Beta-4 Peptid-Fragment',
 'heilung',
 'Synthetisches Fragment des körpereigenen Thymosin Beta-4 Proteins (AS 17–23). Fördert in Forschungsmodellen Geweberegeneration, Wundheilung und Angiogenese.',
 'Fördert Aktinpolymerisation und Zellmigration, stimuliert Proliferation von Endothel- und Muskelzellen. Wirkt anti-inflammatorisch über NF-kB-Hemmung.',
 ARRAY[
   'Muskel- und Sehnenheilung',
   'Herzschutz nach Ischämie (Tiermodelle)',
   'Wundheilung (Haut, Hornhaut)',
   'Entzündungshemmend',
   'Neuronale Regeneration'
 ],
 '2–2.5 mg 2x pro Woche in gängigen Protokollen. Humane Dosierung nicht durch klinische Studien belegt.',
 '~6–8 Stunden (geschätzt).',
 ARRAY['Subkutan (s.c.)', 'Intramuskulär (i.m.)'],
 'preclinical',
 ARRAY['Kein signifikantes Nebenwirkungsprofil aus Tiermodellen dokumentiert', 'Potenzielle Interaktion mit Krebswachstum (theoretisch, unbelegt)'],
 ARRAY['Keine humanen Sicherheitsstudien', 'Bei bekannten Krebserkrankungen kontraindiziert (theoretisch)'],
 'Thymosin beta-4 wound healing regeneration',
 2),

-- ── 3. Ipamorelin ───────────────────────────────────────────
('ipamorelin',
 'Ipamorelin',
 'Ipamorelin (Penta-Peptid-GH-Sekretagog)',
 'wachstumshormon',
 'Selektiver Ghrelin-Rezeptor-Agonist der 5. Generation. Stimuliert die pulsatile GH-Ausschüttung mit minimaler Wirkung auf Cortisol und Prolaktin – gilt als sauberstes GH-Sekretagogum seiner Klasse.',
 'Selektiver GHSR-1a (Ghrelin-Rezeptor) Agonist. Stimuliert pulsatile GH-Freisetzung aus der Hypophyse ohne signifikanten Anstieg von Cortisol, Prolaktin oder ACTH. In Kombination mit GHRH-Analoga synergistisch wirksam.',
 ARRAY[
   'Pulsatile GH-Ausschüttung',
   'Erhöhung von IGF-1',
   'Verbesserter Schlaf (NREM-Phase)',
   'Fettabbau (indirekt über GH)',
   'Muskelerhalt',
   'Geringere Nebenwirkungen als ältere GH-Sekretagoga'
 ],
 '200–300 µg subkutan, 1–3x täglich in Phase-1/2-Studien (Helsinn Healthcare, postoperativer Ileus, NCT00449761).',
 '~2 Stunden.',
 ARRAY['Subkutan (s.c.)', 'Intravenös (i.v.) – klinische Studien'],
 'phase_2',
 ARRAY['Transientes Flush-Gefühl', 'Leichte Übelkeit (selten)', 'Schwindel bei zu schneller i.v.-Gabe', 'Wassereinlagerungen (GH-Effekt)'],
 ARRAY['Aktive Malignome', 'Schwangerschaft und Stillzeit', 'Diabetiker (GH kann Insulinsensitivität beeinflussen)'],
 'Ipamorelin growth hormone secretagogue clinical',
 3),

-- ── 4. CJC-1295 ─────────────────────────────────────────────
('cjc-1295',
 'CJC-1295',
 'CJC-1295 mit DAC (GHRH-Analogon)',
 'wachstumshormon',
 'Modifiziertes GHRH-Analogon mit Drug Affinity Complex (DAC). Die Albumin-Bindung verlängert die Halbwertszeit auf ~8 Tage und ermöglicht wöchentliche Dosierung bei anhaltend erhöhter GH-Ausschüttung.',
 'Bindet an GHRH-Rezeptoren der Hypophyse und stimuliert GH-Synthese und -Sekretion. DAC-Modifikation (Cys-Maleimid-Gruppe) koppelt das Peptid kovalent an Albumin, was die renale Clearance erheblich reduziert.',
 ARRAY[
   'Anhaltend erhöhte IGF-1-Spiegel',
   'Muskelaufbau durch GH/IGF-1-Achse',
   'Fettabbau',
   'Verbesserte Regeneration',
   'Wöchentliches Dosierungsintervall (Compliance-Vorteil)'
 ],
 '1–2 mg/Woche s.c. in Phase-1/2-Studien (ConjuChem Inc.).',
 '6–10 Tage (mit DAC). CJC-1295 ohne DAC: ~30 Minuten.',
 ARRAY['Subkutan (s.c.)'],
 'phase_2',
 ARRAY['Flush und Schwindel nach Injektion', 'Wassereinlagerungen', 'Karpaltunnelsyndrom möglich (GH-Effekt)', 'Hypoglykämie-Risiko bei Kombination mit Insulin'],
 ARRAY['Aktive Malignome', 'Akromegalie', 'Schwangerschaft'],
 'CJC-1295 GHRH growth hormone analog',
 4),

-- ── 5. GHRP-2 ───────────────────────────────────────────────
('ghrp-2',
 'GHRP-2',
 'Growth Hormone Releasing Peptide-2',
 'wachstumshormon',
 'Synthetisches Hexapeptid-GH-Sekretagogum. Stärkstes der klassischen GHRPs bezüglich GH-Ausschüttung, jedoch mit gleichzeitigem Cortisol- und Prolaktinanstieg. Häufig in Kombination mit GHRH-Analoga eingesetzt.',
 'Agonist am Ghrelin/GHSR-1a-Rezeptor. Stimuliert GH-Freisetzung und hemmt Somatostatin. Im Gegensatz zu Ipamorelin aktiviert GHRP-2 auch die Cortisol- und Prolaktinachse.',
 ARRAY[
   'Starke GH-Ausschüttung',
   'Appetitsteigerung (Ghrelin-Effekt)',
   'Muskelaufbau (via GH/IGF-1)',
   'Fettabbau',
   'Herzschutz (Tiermodelle)'
 ],
 '100–300 µg s.c., 2–3x täglich. Klinisch: 1–10 µg/kg für GH-Stimulationstests.',
 '~15–30 Minuten.',
 ARRAY['Subkutan (s.c.)', 'Intravenös (i.v.) – diagnostisch'],
 'phase_1',
 ARRAY['Cortisol-Anstieg', 'Prolaktin-Erhöhung', 'Appetitsteigerung (Ghrelin)', 'Wassereinlagerungen', 'Taubheit/Kribbeln möglich'],
 ARRAY['Aktive Malignome', 'Diabetiker (GH-Insulinresistenz)', 'Schilddrüsendysfunktion (Vorsicht)'],
 'GHRP-2 growth hormone releasing peptide ghrelin',
 5),

-- ── 6. Sermorelin ───────────────────────────────────────────
('sermorelin',
 'Sermorelin',
 'Sermorelin (GRF 1-29, GHRH-Fragment)',
 'wachstumshormon',
 'Synthetisches 29-Aminosäuren-Fragment des körpereigenen GHRH. Klinisch zugelassenes Peptid für Wachstumshormonmangel bei Kindern (Geref®). Gilt als physiologischster Ansatz zur GH-Stimulation.',
 'Bindet an hypophysäre GHRH-Rezeptoren und stimuliert Synthese und pulsatile Sekretion von GH – funktional identisch mit körpereigenem GHRH, jedoch kürzer und stabiler als natives GHRH(1-44).',
 ARRAY[
   'Physiologische GH-Stimulation',
   'Geringeres Risiko als exogenes GH',
   'Erhöhung von IGF-1',
   'Ausgleich des altersbedingten GH-Rückgangs',
   'Verbesserter Schlaf'
 ],
 'Klinisch: 0.2–0.3 mg/Tag s.c. abends. Kinder (Wachstumshormonmangel): 0.03 mg/kg/Tag s.c.',
 '~12–15 Minuten.',
 ARRAY['Subkutan (s.c.) – abends für maximalen GH-Puls'],
 'approved',
 ARRAY['Flush und Rötung nach Injektion', 'Kopfschmerzen (selten)', 'Antikörperbildung bei Langzeitanwendung möglich'],
 ARRAY['Hypophysentumore', 'Aktive Malignome'],
 'Sermorelin GHRH growth hormone deficiency clinical',
 6),

-- ── 7. Semaglutid ───────────────────────────────────────────
('semaglutide',
 'Semaglutid',
 'Semaglutid (GLP-1-Rezeptoragonist)',
 'stoffwechsel',
 'GLP-1-Rezeptoragonist mit wöchentlichem Dosierungsintervall. FDA- und EMA-zugelassen für Typ-2-Diabetes (Ozempic) und Adipositas (Wegovy). Klinisch bewiesene Gewichtsreduktion bis -17% in STEP-Studien.',
 'Ahmt körpereigenes GLP-1 nach. Stimuliert glukoseabhängige Insulinsekretion, hemmt Glukagon, verlangsamt Magenentleerung und wirkt zentral im Hypothalamus appetitregulierend. Zusätzlich kardioprotektive Effekte (SUSTAIN-6 Trial).',
 ARRAY[
   'Gewichtsreduktion bis -17% (STEP-Studien)',
   'Blutzuckerkontrolle bei Typ-2-Diabetes',
   'Kardiovaskulärer Schutz (SUSTAIN-6)',
   'Reduktion von Fettleber (NASH)',
   'Blutdrucksenkung'
 ],
 'Ozempic (T2D): 0.25 mg/Woche Steigerung auf 0.5–2 mg/Woche s.c. | Wegovy (Adipositas): Titration bis 2.4 mg/Woche über 20 Wochen.',
 '~1 Woche.',
 ARRAY['Subkutan (s.c.) – wöchentlich', 'Oral – Rybelsus (14 mg/Tag, niedrigere Bioverfügbarkeit)'],
 'approved',
 ARRAY['Sehr häufig: Übelkeit (44%), Erbrechen, Durchfall, Verstopfung', 'Selten: Pankreatitis, Gallenblasensteine', 'Sehr selten: Diabetische Retinopathie-Verschlechterung'],
 ARRAY['Medulläres Schilddrüsenkarzinom (persönlich/familiär)', 'MEN2', 'Schwangerschaft und Stillzeit', 'Schwere Gastroparese'],
 'Semaglutide weight loss cardiovascular GLP-1 STEP',
 7),

-- ── 8. Tirzepatid ───────────────────────────────────────────
('tirzepatide',
 'Tirzepatid',
 'Tirzepatid (dualer GIP/GLP-1-Rezeptoragonist)',
 'stoffwechsel',
 'Erster dualer GIP- und GLP-1-Rezeptoragonist ("Twincretin"). Zugelassen für Typ-2-Diabetes (Mounjaro) und Adipositas (Zepbound). Zeigt in SURMOUNT-Studien mit -22.5% die stärkste klinisch dokumentierte Gewichtsreduktion eines Medikaments.',
 'Aktiviert sowohl GIP- als auch GLP-1-Rezeptoren synergistisch. GIP fördert Insulinsekretion, reduziert Glukagon und wirkt direkt auf Fettgewebe (Lipolyse, Fettsäureoxidation). Synergismus übertrifft Einzelagonisten deutlich.',
 ARRAY[
   'Stärkste klinische Gewichtsreduktion (-22.5% in SURMOUNT-1)',
   'Überlegene Blutzuckerkontrolle vs. Semaglutid (SURPASS-2)',
   'Steatohepatitis-Rückbildung (SURMOUNT-NASH)',
   'Nierenprotektiv (SURPASS-CVOT)'
 ],
 '5, 10 oder 15 mg/Woche s.c. (Startdosis: 2.5 mg/Woche, Steigerung alle 4 Wochen).',
 '~5 Tage.',
 ARRAY['Subkutan (s.c.) – wöchentlich'],
 'approved',
 ARRAY['Sehr häufig: Übelkeit, Erbrechen, Durchfall (meist transient)', 'Ähnliches Profil wie Semaglutid', 'Selten: Pankreatitis, Gallenblasensteine'],
 ARRAY['Medulläres Schilddrüsenkarzinom (persönlich/familiär)', 'MEN2', 'Schwangerschaft', 'Schwere Niereninsuffizienz (Vorsicht)'],
 'Tirzepatide GIP GLP-1 obesity weight loss SURMOUNT',
 8),

-- ── 9. Selank ───────────────────────────────────────────────
('selank',
 'Selank',
 'Selank (Tuftsin-Analogon, Heptapeptid)',
 'nootropikum',
 'Synthetisches Anxiolytikum basierend auf dem Immunopeptid Tuftsin. In russischen klinischen Studien zeigt es anxiolytische und kognitive Effekte ohne Sedierung oder Abhängigkeitspotenzial.',
 'Moduliert GABA-A-Rezeptoren, erhöht BDNF (Brain-Derived Neurotrophic Factor), beeinflusst Enkephalin-Abbau und moduliert Serotonin- sowie Dopaminsysteme. Immunmodulatorische Effekte über Tuftsin-Mechanismus.',
 ARRAY[
   'Angstreduktion ohne Sedierung',
   'Kognitive Verbesserung (Gedächtnis, Konzentration)',
   'Neuroprotektiv',
   'Immunmodulation',
   'Kein Abhängigkeitspotenzial'
 ],
 '250–500 µg/Tag intranasal in russischen klinischen Studien (14-tägige Kuren).',
 '~2 Minuten (systemisch). Intranasal: direkte ZNS-Wirkung, systemische HWZ sekundär.',
 ARRAY['Intranasal (primär)', 'Subkutan (s.c.)'],
 'phase_2',
 ARRAY['Mild und vorübergehend: Schläfrigkeit (selten)', 'Nasale Irritation bei intranasaler Anwendung', 'In klinischen Studien gut verträglich'],
 ARRAY['Schwangerschaft und Stillzeit', 'Kombination mit MAO-Hemmern nicht untersucht'],
 'Selank anxiolytic nootropic BDNF anxiety',
 9),

-- ── 10. Epithalon ───────────────────────────────────────────
('epithalon',
 'Epithalon',
 'Epitalon (Ala-Glu-Asp-Gly, synthetisches Tetrapeptid)',
 'anti_aging',
 'Synthetisches Tetrapeptid basierend auf Epitalamin aus der Zirbeldrüse. Entwickelt von Prof. Vladimir Khavinson. Zeigt in russischen Studien telomeraseaktivierende und lebensverlängernde Eigenschaften.',
 'Stimuliert die Telomerase-Produktion (hTERT-Transkription) in menschlichen Somazellen, verlängert Telomere in Zellkulturen. Reguliert die Zirbeldrüse und Melatonin-Ausschüttung, wirkt antioxidativ.',
 ARRAY[
   'Telomerverlängerung in vitro',
   'Lebensverlängerung in Nagetiermodellen (bis +24%)',
   'Verbesserter Melatonin-Rhythmus',
   'Antioxidativ',
   'Onkostatische Eigenschaften (Tiermodelle)',
   'Verbesserter Immunstatus'
 ],
 '5–10 mg/Tag s.c. oder i.v., 10–20 Tage, 1–2x/Jahr (Khavinson-Protokoll).',
 'Kurz. Mehrfache Dosierung oder längere Kuren erforderlich.',
 ARRAY['Subkutan (s.c.)', 'Intravenös (i.v.)', 'Intramuskulär (i.m.)'],
 'preclinical',
 ARRAY['Keine signifikanten Nebenwirkungen in Studien dokumentiert', 'Einzelfälle: lokale Reaktionen an der Injektionsstelle'],
 ARRAY['Keine robusten humanen Sicherheitsdaten', 'Theoretisch: Vorsicht bei Krebserkrankungen (telomeraseabhängiges Krebswachstum)'],
 'Epithalon epitalon telomere aging Khavinson',
 10),

-- ── 11. GHK-Cu ──────────────────────────────────────────────
('ghk-cu',
 'GHK-Cu',
 'GHK-Cu (Glycyl-L-Histidyl-L-Lysin-Kupfer)',
 'anti_aging',
 'Natürlich vorkommender Kupfer-Peptid-Komplex aus menschlichem Plasma, Urin und Speichel. Spiegel sinken mit dem Alter. Zeigt wundheilende, kollagenstimulierende und antioxidative Eigenschaften in Studien.',
 'Bindet und transportiert Kupferionen in Zellen. Stimuliert Kollagen-, Elastin- und Proteoglykan-Synthese, aktiviert Wachstumsfaktoren (TGF-b, VEGF, FGF). Reguliert über 4.000 Gene, wirkt antioxidativ über Superoxid-Dismutase.',
 ARRAY[
   'Wundheilung (topisch und systemisch)',
   'Kollagen- und Elastinsynthese',
   'Haarwachstum (5a-Reduktase-Hemmung)',
   'Antioxidativ',
   'Neuroprotektiv (BDNF, NGF)',
   'Anti-aging Hautpflege (klinisch belegt topisch)'
 ],
 'Topisch: 1–3% in Cremes/Seren (gut belegt). Systemisch: 1–2 mg/Tag s.c. (aus Protokollberichten, keine robusten klinischen Daten).',
 'Kurz systemisch. Topisch: lokale Wirkung dominant.',
 ARRAY['Topisch (Cremes, Seren)', 'Subkutan (s.c.) – systemisch', 'Intradermal'],
 'preclinical',
 ARRAY['Topisch: sehr gut verträglich, selten Hautreizung', 'Systemisch: keine robusten Sicherheitsdaten'],
 ARRAY['Keine klinischen Kontraindikationen bekannt', 'Kupferüberdosierung bei exzessiver Anwendung theoretisch möglich'],
 'GHK-Cu copper peptide wound healing collagen aging',
 11);

-- ============================================================
-- FERTIG. Tabelle prüfen:
-- select name, category, research_status from peptide_library order by sort_order;
-- ============================================================
