-- GENERIERT von scripts/generate-pk-profiles-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-source.mjs.
-- Neu erzeugen mit: npm run pk:sql
--
-- 50 PK-Profile fuer den Live-Blutspiegel, plus die Verknuepfung
-- mit den Katalogzeilen gleichen Namens. Ein zweiter Lauf aendert nichts.

begin;

with quelle (name, aliases, half_life_hours, tmax_hours, bioavailability_sc, category, notes) as (
  values
    ('Ibuprofen', array['Nurofen']::text[], 2, 1.5, 0.9, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Paracetamol', array['Acetaminophen']::text[], 2.5, 1, 0.85, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Acetylsalicylsäure', array['ASS', 'Aspirin']::text[], 0.33, 0.5, 0.7, 'other', 'Halbwertszeit der ASS selbst; der wirksame Salicylat-Metabolit bleibt deutlich laenger.'),
    ('Prednisolon', array['Prednisolone']::text[], 3, 1.5, 0.8, 'other', 'Plasma-Halbwertszeit; die biologische Wirkung haelt laenger an als die Kurve zeigt.'),
    ('Pantoprazol', array['Pantoprazole']::text[], 1, 2.5, 0.77, 'other', 'Kurze Plasma-Halbwertszeit, aber irreversible Pumpenhemmung — die Wirkung ueberdauert den Spiegel deutlich.'),
    ('Omeprazol', array['Omeprazole']::text[], 1, 1.5, 0.4, 'other', 'Wie Pantoprazol: Wirkung ueberdauert den Spiegel. Bioverfuegbarkeit steigt bei wiederholter Gabe.'),
    ('Atorvastatin', array['Sortis']::text[], 14, 1.5, 0.14, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Rosuvastatin', array['Crestor']::text[], 19, 4, 0.2, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Simvastatin', array['Zocor']::text[], 2, 1.5, 0.05, 'other', 'Prodrug mit starkem First-Pass; der aktive Metabolit bleibt laenger als die Muttersubstanz.'),
    ('Ramipril', array['Delix']::text[], 15, 1, 0.28, 'other', 'Werte des aktiven Metaboliten Ramiprilat.'),
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
    ('Amoxicillin', array['Amoxi']::text[], 1.2, 1.5, 0.8, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('Naltrexon', array['Naltrexone', 'LDN']::text[], 4, 1, 0.2, 'other', 'Starker First-Pass. Der aktive Metabolit 6-beta-Naltrexol bleibt laenger.'),
    ('Rapamycin', array['Sirolimus', 'Rapamune']::text[], 62, 2, 0.15, 'other', 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'),
    ('DHEA', array['Dehydroepiandrosteron']::text[], 12, 1.5, 0.5, 'hormone', 'Literaturwerte mit breiter Streuung — die Kurve zeigt die Groessenordnung, nicht den Einzelfall.'),
    ('Pregnenolon', array['Pregnenolone']::text[], 1.5, 1.5, 0.3, 'hormone', 'Duenne Datenlage beim Menschen — die Kurve ist eine Groessenordnung, keine Messung.'),
    ('Östradiol', array['Estradiol', 'Oestradiol']::text[], 15, 5, 0.05, 'hormone', 'Werte fuer orales Estradiol mit starkem First-Pass. Gel und Pflaster umgehen ihn und verlaufen ganz anders.'),
    ('Progesteron', array['Progesterone', 'Utrogest']::text[], 16, 2.5, 0.1, 'hormone', 'Werte fuer orales mikronisiertes Progesteron.'),
    ('Koffein', array['Caffeine', 'Coffein']::text[], 5, 0.75, 1, 'other', 'Nahezu vollstaendig aufgenommen. Die Halbwertszeit schwankt genetisch zwischen etwa 2 und 10 Stunden.'),
    ('Melatonin', '{}'::text[], 0.75, 0.75, 0.15, 'other', 'Sehr kurze Halbwertszeit und starker First-Pass. Retardformen verlaufen deutlich flacher.'),
    ('5-HTP', array['5-Hydroxytryptophan']::text[], 2.2, 1.5, 0.7, 'other', 'Literaturwerte, gut belegt.'),
    ('L-Theanin', array['Theanin']::text[], 1.2, 0.8, 0.9, 'other', 'Literaturwerte, gut belegt.'),
    ('NAC', array['N-Acetyl-Cystein']::text[], 6, 1, 0.1, 'other', 'Sehr geringe orale Bioverfuegbarkeit der unveraenderten Substanz.'),
    ('Coenzym Q10', array['CoQ10', 'Ubiquinol']::text[], 33, 6, 0.05, 'other', 'Schlecht loeslich; die Aufnahme haengt stark an der Formulierung und an der Mahlzeit.'),
    ('Berberin', array['Berberine']::text[], 4, 4, 0.05, 'other', 'Sehr geringe orale Bioverfuegbarkeit; der Wirkort liegt teils im Darm, nicht im Blut.')
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
  and lower(profil.name) in ('ibuprofen', 'paracetamol', 'acetylsalicylsäure', 'prednisolon', 'pantoprazol', 'omeprazol', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'ramipril', 'bisoprolol', 'metoprolol', 'amlodipin', 'candesartan', 'sertralin', 'escitalopram', 'venlafaxin', 'bupropion', 'methylphenidat', 'lisdexamfetamin', 'modafinil', 'finasterid', 'dutasterid', 'anastrozol', 'tamoxifen', 'enclomifen', 'levothyroxin', 'liothyronin', 'tadalafil', 'sildenafil', 'metformin', 'dapagliflozin', 'empagliflozin', 'allopurinol', 'cetirizin', 'loratadin', 'amoxicillin', 'naltrexon', 'rapamycin', 'dhea', 'pregnenolon', 'östradiol', 'progesteron', 'koffein', 'melatonin', '5-htp', 'l-theanin', 'nac', 'coenzym q10', 'berberin');

commit;
