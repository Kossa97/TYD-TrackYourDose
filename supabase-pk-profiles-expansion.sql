-- GENERIERT von scripts/generate-pk-profiles-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-source.mjs.
-- Neu erzeugen mit: npm run pk:sql
--
-- 93 PK-Profile fuer den Live-Blutspiegel: 44 aus
-- scripts/seed-pk-profiles.ts (dessen Upsert seit der RLS-Haertung nicht mehr
-- laeuft) und 49 aus scripts/pk-profile-source.mjs. Dazu die
-- Verknuepfung mit den Katalogzeilen gleichen Namens.
-- Ein zweiter Lauf aendert nichts.

begin;

with quelle (name, aliases, half_life_hours, tmax_hours, bioavailability_sc, category, notes) as (
  values
    ('Semaglutide', array['Ozempic', 'Wegovy']::text[], 168, 24, 1, 'glp1', 'Werte fuer die subkutane Gabe. Die Tablette (Rybelsus) hat unter einem Prozent Bioverfuegbarkeit und braucht ein eigenes Profil — diese Kurve passt nicht auf sie.'),
    ('Tirzepatide', array['Mounjaro', 'Zepbound']::text[], 120, 8, 1, 'glp1', 'Fachinformation, subkutan. Subkutan injiziert, daher volle Peak-Skalierung.'),
    ('Liraglutide', array['Victoza', 'Saxenda']::text[], 13, 8, 1, 'glp1', 'Fachinformation, subkutan. Subkutan injiziert, daher volle Peak-Skalierung.'),
    ('Exenatide', array['Byetta']::text[], 2.4, 2, 1, 'glp1', 'Werte fuer die schnell freisetzende Form (Byetta). Die Wochendepot-Form (Bydureon) verlaeuft voellig anders.'),
    ('Retatrutide', array['LY3437943', 'Reta', 'Triple-G']::text[], 156, 48, 1, 'glp1', 'HWZ ~144–165 h, tmax 24–72 h; wöchentlich SC. GIP/GLP-1/Glucagon-Triagonist. Quelle: Nature Medicine 2024 (Phase 2, Lilly).'),
    ('Cagrilintide', array['AM833', 'NN9838', 'Cagri']::text[], 175, 48, 1, 'glp1', 'HWZ ~7,3 Tage; wöchentlich SC. Langwirksames Amylin-Analogon (CagriSema). Quelle: Lancet 2021 (Phase 1b, Novo Nordisk).'),
    ('Survodutide', array['BI 456906']::text[], 144, 72, 1, 'glp1', 'HWZ ~6 Tage, Peak 60–96 h; wöchentlich SC. GCGR/GLP-1-Dualagonist. Quelle: J Hepatology 2024 (Boehringer Ingelheim).'),
    ('Mazdutide', array['IBI362', 'LY3305677']::text[], 175, 72, 1, 'glp1', 'HWZ ~7–8 Tage, tmax ~72 h; wöchentlich SC. GLP-1/Glucagon-Dualagonist. Quelle: Diabetes Obes Metab 2025 (Innovent/Lilly).'),
    ('Orforglipron', array['LY3502970']::text[], 48, 6, 0.35, 'glp1', 'Orales nicht-Peptid GLP-1; HWZ ~48 h (Steady-State), tmax 4–8 h, orale BV ~30–40 %. Quelle: Diabetes Obes Metab 2023 / NEJM 2023.'),
    ('BPC-157', array['Body Protection Compound']::text[], 4, 0.5, 1, 'peptide', 'Im Serum tatsaechlich nur Minuten nachweisbar; der Wert hier bildet die laenger anhaltende Wirkung ab, nicht eine gemessene Elimination. Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung.'),
    ('TB-500', array['Thymosin Beta-4']::text[], 72, 2, 1, 'peptide', 'Die 72 Stunden sind ein in der Anwenderliteratur gebraeuchlicher Wert, keine belastbare Messung am Menschen. Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung.'),
    ('GHK-Cu', array['Copper Peptide']::text[], 1, 0.5, 1, 'peptide', 'Sehr kurz im Blut. Subkutan; topisch aufgetragen gilt die Kurve nicht.'),
    ('KPV', '{}'::text[], 2, 0.5, 1, 'peptide', 'Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung. Subkutan.'),
    ('CJC-1295 DAC', array['CJC-1295 with DAC']::text[], 192, 2, 1, 'peptide', 'Die acht Tage kommen von der Bindung an Albumin (Drug Affinity Complex) — ohne DAC ist es ein anderer Stoff mit Minuten statt Tagen.'),
    ('CJC-1295 no DAC', array['Modified GRF 1-29']::text[], 0.5, 0.25, 1, 'peptide', 'Ohne Albuminbindung im Minutenbereich. Wirkt ueber die ausgeloeste GH-Ausschuettung, die laenger anhaelt als der Spiegel.'),
    ('Ipamorelin', '{}'::text[], 2, 0.25, 1, 'peptide', 'Kurz im Blut; die ausgeloeste GH-Ausschuettung haelt laenger an als die Kurve zeigt. Subkutan.'),
    ('GHRP-2', array['Pralmorelin']::text[], 1, 0.25, 1, 'peptide', 'Wie Ipamorelin: kurz im Blut, laengere GH-Antwort. Subkutan.'),
    ('GHRP-6', '{}'::text[], 2, 0.25, 1, 'peptide', 'Wie Ipamorelin: kurz im Blut, laengere GH-Antwort. Subkutan.'),
    ('Hexarelin', array['Examorelin']::text[], 1.3, 0.3, 1, 'peptide', 'Terminale HWZ ~76 min (Ratte) / ~120 min (Hund); GH-Effekt 3–4 h. Quelle: Drug Metab Dispos.'),
    ('Sermorelin', '{}'::text[], 0.17, 0.1, 1, 'peptide', 'Sehr kurz im Blut: Gipfel und Halbwertszeit liegen beide im Minutenbereich. Die ausgeloeste GH-Ausschuettung haelt deutlich laenger an.'),
    ('Tesamorelin', array['Egrifta']::text[], 0.3, 0.25, 1, 'peptide', 'HWZ 8–11 min Einzeldosis, 26–38 min Steady-State (14 Tage SC). Quelle: FDA-Label Egrifta.'),
    ('MK-677', array['Ibutamoren', 'Nutrobal']::text[], 6, 1, 0.6, 'peptide', 'Oral, nicht injiziert — Bioverfuegbarkeit rund 60 Prozent. Kein Peptid, sondern ein kleines Molekuel; steht hier nur der Nachbarschaft wegen unter den Peptiden.'),
    ('MOTS-c', array['Mitochondrial ORF 12S rRNA-c']::text[], 0.75, 0.5, 1, 'peptide', 'Plasma-HWZ ~30–60 min (SC). Humane PK begrenzt — Schätzung aus Sekundärliteratur.'),
    ('AOD-9604', array['AOD9604', 'hGH 176-191 (Tyr)']::text[], 0.3, 0.4, 1, 'peptide', 'Plasma-HWZ ~4 min (IV, Metabolic Pharmaceuticals), SC-Peak 30–60 min. Sehr kurze HWZ.'),
    ('HGH Fragment 176-191', array['HGH Frag', 'Frag 176-191', 'Fragment 176-191']::text[], 0.4, 0.4, 1, 'peptide', 'HWZ ~15–30 min; humane Daten begrenzt, aus AOD-9604 extrapoliert. Schätzung.'),
    ('Thymosin Alpha-1', array['Tα1', 'Ta1', 'Thymalfasin', 'Zadaxin']::text[], 2, 0.5, 1, 'peptide', 'Plasma-HWZ ~2 h. Quelle: PK-Studien Thymalfasin (Zadaxin, in mehreren Ländern zugelassen).'),
    ('DSIP', array['Delta Sleep-Inducing Peptide']::text[], 0.35, 0.3, 1, 'peptide', 'Plasma-HWZ ~15–25 min (Aminopeptidase-Spaltung). Schätzung aus Degradationsstudien.'),
    ('Kisspeptin-10', array['KP-10', 'Metastin 45-54']::text[], 0.07, 0.1, 1, 'peptide', 'Plasma-HWZ ~3,8 min (Männer). Sehr kurze HWZ. Quelle: JCEM 2011 (Jayasena et al.).'),
    ('Semax', '{}'::text[], 0.5, 0.25, 1, 'peptide', 'Intranasal oder subkutan; sehr kurz im Blut, die Wirkung im Gehirn haelt laenger an. Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung.'),
    ('Selank', '{}'::text[], 1, 0.25, 1, 'peptide', 'Intranasal oder subkutan; sehr kurz im Blut. Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung.'),
    ('Dihexa', '{}'::text[], 24, 2, 1, 'peptide', 'Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung. Die Werte stammen aus Tierversuchen.'),
    ('Cerebrolysin', '{}'::text[], 1, 0.5, 1, 'peptide', 'Ein Gemisch aus vielen Peptidfragmenten, keine einzelne Substanz — eine gemeinsame Halbwertszeit gibt es streng genommen nicht. Die Kurve ist eine grobe Naeherung.'),
    ('NA-Semax Amidate', '{}'::text[], 0.75, 0.25, 1, 'peptide', 'Intranasal. Laenger stabil als Semax selbst, aber ebenfalls ohne belastbare Messung am Menschen.'),
    ('PT-141', array['Bremelanotide']::text[], 2.7, 1, 1, 'peptide', 'Subkutan oder intranasal. Subkutan injiziert, daher volle Peak-Skalierung.'),
    ('Melanotan II', array['MT-2', 'MT-II']::text[], 1, 1.25, 1, 'peptide', 'HWZ ~33 min (bi-exponentiell), Peak 60–90 min. Quelle: humane MT-II-PK-Studien.'),
    ('Epithalon', array['Epitalon']::text[], 1, 0.5, 1, 'peptide', 'Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung. Subkutan.'),
    ('SS-31', array['Elamipretide']::text[], 2, 0.5, 1, 'peptide', 'Reichert sich in den Mitochondrien an — der Blutspiegel sagt wenig darueber, wie lange der Stoff am Wirkort bleibt. Subkutan.'),
    ('Humanin', '{}'::text[], 3, 1, 1, 'peptide', 'Duenne Datenlage beim Menschen — die Kurve zeigt eine Groessenordnung, keine Messung. Subkutan.'),
    ('Testosterone Enanthate', array['Test E']::text[], 110, 48, 1, 'hormone', 'Eliminations-HWZ ~4,5 Tage (IM-Depot). Quelle: PK-Literatur Testosteron-Ester.'),
    ('Testosterone Cypionate', array['Test C']::text[], 192, 48, 1, 'hormone', 'HWZ ~8 Tage (IM-Depot). Quelle: FDA-Label Testosteron-Cypionat.'),
    ('Testosterone Propionate', array['Test P']::text[], 20, 12, 1, 'hormone', 'Kurzer Depotester, intramuskulaer. Die Halbwertszeit ist die der Freisetzung aus dem Oeldepot.'),
    ('HCG', array['Human Chorionic Gonadotropin']::text[], 36, 6, 1, 'hormone', 'Subkutan oder intramuskulaer. Wird in IU dosiert — die Kurve rechnet derzeit nur mg und mcg um und bleibt deshalb leer.'),
    ('IGF-1 LR3', array['Long R3 IGF-1']::text[], 20, 2, 1, 'hormone', 'Die Laenge der Halbwertszeit stammt aus der Bindung an Traegerproteine; Literaturwerte mit breiter Streuung. Subkutan.'),
    ('HGH', array['Somatropin', 'Human Growth Hormone']::text[], 3.8, 3, 1, 'hormone', 'Subkutan. Wird in IU dosiert — die Kurve rechnet derzeit nur mg und mcg um und bleibt deshalb leer.'),
    ('Ibuprofen', array['Nurofen']::text[], 2, 1.5, 0.9, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Paracetamol', array['Acetaminophen']::text[], 2.5, 1, 0.85, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Acetylsalicylsäure', array['ASS', 'Aspirin']::text[], 3, 1, 0.7, 'other', 'Werte des Salicylats, nicht der ASS selbst: die zerfaellt binnen 20 Minuten, und eine Kurve darueber waere gefallen bevor sie stand. Bei hoeheren Dosen verlaengert sich die Halbwertszeit deutlich.'),
    ('Prednisolon', array['Prednisolone']::text[], 3, 1.5, 0.8, 'other', 'Plasma-Halbwertszeit; die biologische Wirkung haelt laenger an als die Kurve zeigt.'),
    ('Pantoprazol', array['Pantoprazole']::text[], 1, 2.5, 0.77, 'other', 'Magensaftresistent ueberzogen: der Gipfel kommt nach der Halbwertszeit, die Kurve steigt also langsamer als sie faellt. Das ist richtig so. Die irreversible Pumpenhemmung ueberdauert den Spiegel ohnehin deutlich.'),
    ('Omeprazol', array['Omeprazole']::text[], 1, 1.5, 0.4, 'other', 'Wie Pantoprazol magensaftresistent — der Gipfel liegt bei der Halbwertszeit, und die Wirkung ueberdauert den Spiegel. Bioverfuegbarkeit steigt bei wiederholter Gabe.'),
    ('Atorvastatin', array['Sortis']::text[], 14, 1.5, 0.14, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Rosuvastatin', array['Crestor']::text[], 19, 4, 0.2, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Simvastatin', array['Zocor']::text[], 2, 1.5, 0.05, 'other', 'Prodrug mit starkem First-Pass; der aktive Metabolit bleibt laenger als die Muttersubstanz.'),
    ('Ramipril', array['Delix']::text[], 15, 3, 0.28, 'other', 'Werte des aktiven Metaboliten Ramiprilat, der nach zwei bis vier Stunden gipfelt — Ramipril selbst ist nach einer Stunde oben und binnen Stunden weg.'),
    ('Bisoprolol', array['Concor']::text[], 11, 3, 0.9, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Metoprolol', array['Beloc']::text[], 3.5, 1.5, 0.4, 'other', 'Werte fuer schnell freisetzende Form; Retardformen verlaufen flacher.'),
    ('Amlodipin', array['Norvasc']::text[], 40, 7, 0.65, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Candesartan', array['Blopress']::text[], 9, 3.5, 0.15, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Sertralin', array['Sertraline', 'Zoloft']::text[], 26, 6, 0.44, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Escitalopram', array['Cipralex']::text[], 30, 4, 0.8, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Venlafaxin', array['Venlafaxine', 'Trevilor']::text[], 5, 2, 0.45, 'other', 'Werte der Muttersubstanz, schnell freisetzende Form. Retardformen und der aktive Metabolit verlaufen flacher und laenger.'),
    ('Bupropion', array['Elontril', 'Wellbutrin']::text[], 20, 3, 0.87, 'other', 'Relative Bioverfuegbarkeit; absolute Werte liegen nicht vor.'),
    ('Methylphenidat', array['Ritalin', 'Medikinet']::text[], 3, 2, 0.3, 'other', 'Werte fuer schnell freisetzende Form. Retardformen (Concerta, Medikinet retard) haben ein anderes Profil.'),
    ('Lisdexamfetamin', array['Elvanse', 'Vyvanse']::text[], 10, 3.5, 0.96, 'other', 'Werte des aktiven Dexamfetamins; Lisdexamfetamin selbst ist ein Prodrug mit sehr kurzer Halbwertszeit.'),
    ('Modafinil', array['Vigil', 'Provigil']::text[], 13, 2.5, 0.8, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Finasterid', array['Finasteride', 'Propecia']::text[], 6, 2, 0.65, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Dutasterid', array['Dutasteride', 'Avodart']::text[], 840, 3, 0.6, 'other', 'Etwa fuenf Wochen Halbwertszeit — der Spiegel baut sich ueber Monate auf und ab.'),
    ('Anastrozol', array['Arimidex']::text[], 46, 2, 0.85, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Tamoxifen', array['Nolvadex']::text[], 120, 5, 0.8, 'other', 'Fuenf bis sieben Tage; der aktive Metabolit Endoxifen bleibt noch laenger.'),
    ('Enclomifen', array['Enclomiphene']::text[], 10, 1.5, 0.7, 'other', 'Literaturwerte mit breiter Streuung — die Kurve zeigt die Groessenordnung, nicht den Einzelfall.'),
    ('Levothyroxin', array['L-Thyroxin', 'Euthyrox', 'T4']::text[], 168, 3, 0.75, 'other', 'Sieben Tage Halbwertszeit: der Spiegel folgt der Einzeldosis kaum, sondern dem Wochenmittel.'),
    ('Liothyronin', array['T3', 'Thybon']::text[], 24, 2.5, 0.9, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Tadalafil', array['Cialis']::text[], 17.5, 2, 0.8, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Sildenafil', array['Viagra']::text[], 4, 1, 0.41, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Metformin', array['Metformin HCl', 'Glucophage']::text[], 5, 2.5, 0.55, 'other', 'Werte fuer schnell freisetzende Form; Retardformen verlaufen flacher.'),
    ('Dapagliflozin', array['Forxiga', 'Farxiga']::text[], 12.9, 1.5, 0.78, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Empagliflozin', array['Jardiance']::text[], 12.4, 1.5, 0.78, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Allopurinol', array['Zyloric']::text[], 2, 1.5, 0.8, 'other', 'Der wirksame Metabolit Oxypurinol hat rund 20 Stunden — die Kurve zeigt nur die Muttersubstanz.'),
    ('Cetirizin', array['Zyrtec']::text[], 10, 1, 0.7, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Loratadin', array['Lorano']::text[], 8, 1.5, 0.4, 'other', 'Der aktive Metabolit Desloratadin bleibt mit rund 27 Stunden deutlich laenger.'),
    ('Amoxicillin', array['Amoxi']::text[], 1.2, 1.5, 0.8, 'other', 'Aufnahme und Ausscheidung laufen fast gleich schnell — der Gipfel liegt bei der Halbwertszeit. Fachinformation.'),
    ('Naltrexon', array['Naltrexone', 'LDN']::text[], 4, 1, 0.2, 'other', 'Starker First-Pass. Der aktive Metabolit 6-beta-Naltrexol bleibt laenger.'),
    ('Rapamycin', array['Sirolimus', 'Rapamune']::text[], 62, 2, 0.15, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('DHEA', array['Dehydroepiandrosteron']::text[], 12, 1.5, 0.5, 'hormone', 'Die lange Fahne kommt vom Sulfat DHEA-S; DHEA selbst ist nach ein bis zwei Stunden weg. Literaturwerte mit breiter Streuung.'),
    ('Pregnenolon', array['Pregnenolone']::text[], 1.5, 1, 0.3, 'hormone', 'Duenne Datenlage beim Menschen — die Kurve ist eine Groessenordnung, keine Messung. Ein kleines Steroid wird schneller aufgenommen als ausgeschieden, daher tmax unter der Halbwertszeit.'),
    ('Östradiol', array['Estradiol', 'Oestradiol']::text[], 15, 5, 0.05, 'hormone', 'Werte fuer orales Estradiol mit starkem First-Pass. Gel und Pflaster umgehen ihn und verlaufen ganz anders.'),
    ('Progesteron', array['Progesterone', 'Utrogest']::text[], 16, 2.5, 0.1, 'hormone', 'Werte fuer orales mikronisiertes Progesteron.'),
    ('Koffein', array['Caffeine', 'Coffein']::text[], 5, 0.75, 1, 'other', 'Nahezu vollstaendig aufgenommen. Die Halbwertszeit schwankt genetisch zwischen etwa 2 und 10 Stunden.'),
    ('Melatonin', '{}'::text[], 0.75, 0.75, 0.15, 'other', 'Gipfel und Halbwertszeit liegen beide bei etwa 45 Minuten — der Stoff ist weg, bevor die Kurve richtig anfaengt. Starker First-Pass. Retardformen verlaufen deutlich flacher.'),
    ('5-HTP', array['5-Hydroxytryptophan']::text[], 2.2, 1.5, 0.7, 'other', 'Literaturwerte, gut belegt.'),
    ('L-Theanin', array['Theanin']::text[], 1.2, 0.8, 0.9, 'other', 'Literaturwerte, gut belegt.'),
    ('NAC', array['N-Acetyl-Cystein']::text[], 6, 1, 0.1, 'other', 'Sehr geringe orale Bioverfuegbarkeit der unveraenderten Substanz.'),
    ('Coenzym Q10', array['CoQ10', 'Ubiquinol']::text[], 33, 6, 0.05, 'other', 'Schlecht loeslich; die Aufnahme haengt stark an der Formulierung und an der Mahlzeit.')
)
insert into public.pk_profiles as ziel (
  name, aliases, half_life_hours, tmax_hours, bioavailability_sc, vd_l_kg, category, notes
)
select name, aliases, half_life_hours, tmax_hours, bioavailability_sc, 0.3, category, notes
from quelle
on conflict (name) do update set
  aliases = excluded.aliases,
  half_life_hours = excluded.half_life_hours,
  tmax_hours = excluded.tmax_hours,
  bioavailability_sc = excluded.bioavailability_sc,
  category = excluded.category,
  notes = excluded.notes,
  updated_at = now();

-- Die Katalogzeilen an ihr Profil haengen. Nur dort, wo noch keines haengt:
-- eine bestehende Verknuepfung ist eine Entscheidung und wird nicht
-- ueberschrieben.
update public.substance_catalog katalog
set pk_profile_id = profil.id, updated_at = now()
from public.pk_profiles profil
where katalog.pk_profile_id is null
  and lower(katalog.canonical_name) = lower(profil.name)
  and lower(profil.name) in ('semaglutide', 'tirzepatide', 'liraglutide', 'exenatide', 'retatrutide', 'cagrilintide', 'survodutide', 'mazdutide', 'orforglipron', 'bpc-157', 'tb-500', 'ghk-cu', 'kpv', 'cjc-1295 dac', 'cjc-1295 no dac', 'ipamorelin', 'ghrp-2', 'ghrp-6', 'hexarelin', 'sermorelin', 'tesamorelin', 'mk-677', 'mots-c', 'aod-9604', 'hgh fragment 176-191', 'thymosin alpha-1', 'dsip', 'kisspeptin-10', 'semax', 'selank', 'dihexa', 'cerebrolysin', 'na-semax amidate', 'pt-141', 'melanotan ii', 'epithalon', 'ss-31', 'humanin', 'testosterone enanthate', 'testosterone cypionate', 'testosterone propionate', 'hcg', 'igf-1 lr3', 'hgh', 'ibuprofen', 'paracetamol', 'acetylsalicylsäure', 'prednisolon', 'pantoprazol', 'omeprazol', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'ramipril', 'bisoprolol', 'metoprolol', 'amlodipin', 'candesartan', 'sertralin', 'escitalopram', 'venlafaxin', 'bupropion', 'methylphenidat', 'lisdexamfetamin', 'modafinil', 'finasterid', 'dutasterid', 'anastrozol', 'tamoxifen', 'enclomifen', 'levothyroxin', 'liothyronin', 'tadalafil', 'sildenafil', 'metformin', 'dapagliflozin', 'empagliflozin', 'allopurinol', 'cetirizin', 'loratadin', 'amoxicillin', 'naltrexon', 'rapamycin', 'dhea', 'pregnenolon', 'östradiol', 'progesteron', 'koffein', 'melatonin', '5-htp', 'l-theanin', 'nac', 'coenzym q10');

commit;
