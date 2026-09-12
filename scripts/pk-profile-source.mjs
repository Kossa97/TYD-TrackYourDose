/**
 * PK-Profile für den Live-Blutspiegel — die Quelle, aus der
 * `supabase-pk-profiles-expansion.sql` erzeugt wird (`npm run pk:sql`).
 *
 * WOZU
 * Die Kurve in `src/services/liveBlutspiegelChart.ts` braucht je Substanz drei
 * Zahlen: Eliminations-Halbwertszeit, Zeit bis zum Spitzenspiegel und eine
 * Skalierung des Peaks (bei oralen Stoffen die Bioverfügbarkeit).
 *
 * WAS HIER NICHT HINEINGEHOERT
 * Dosierungen, Indikationen, Warnhinweise. Halbwertszeit und tmax sind
 * beschreibende pharmakokinetische Groessen und stehen in jeder
 * Fachinformation — sie sagen, wie lange ein Stoff bleibt, nicht wie viel
 * davon jemand nehmen soll.
 *
 * WOFUER ES KEINE PROFILE GIBT — und zwar mit Absicht
 *
 *   Vitamine und Mineralien. Ein Blutspiegel von Zink oder Vitamin D3 nach
 *   Einzeldosis beschreibt nichts Nuetzliches: das sind Speicher, keine
 *   Einmal-Kinetiken. 25-OH-Vitamin-D hat 15 Tage Halbwertszeit und wird
 *   ueber Wochen aufgebaut — eine Tageskurve waere rechenbar und irrefuehrend.
 *
 *   Pflanzenextrakte mit schwankender Bioverfuegbarkeit (Ashwagandha,
 *   Kurkuma, Rhodiola, Ginkgo, Mariendistel, Baldrian). Die Werte haengen am
 *   Extrakt, nicht am Stoff, und schwanken um Groessenordnungen. Jede Zahl
 *   waere erfunden.
 *
 *   Creatin, Kollagen, Aminosaeuren, Whey. Ihr Nutzen haengt an der
 *   Saettigung von Speichern, nicht am Plasmaspiegel einer Einzeldosis.
 *
 * FELDER (wie in `scripts/seed-pk-profiles.ts`, gleiche Tabelle)
 *   name                muss dem Katalognamen entsprechen — die Verknuepfung
 *                       laeuft ueber Name oder Alias
 *   half_life_hours     Eliminations-Halbwertszeit
 *   tmax_hours          Zeit bis zum Spitzenspiegel
 *   bioavailability_sc  Peak-Skalierung: 1.0 = voll, <1 = oraler Verlust
 *   category            'other' fuer Medikamente und Supplemente, sonst 'hormone'
 *   notes               Belastbarkeit der Zahlen — ehrlich, nicht werbend
 */

/** @typedef {{ name: string, aliases: string[], half_life_hours: number, tmax_hours: number, bioavailability_sc: number, category: string, notes: string }} PkSeed */

const FI = 'Fachinformation/Standardliteratur, Median gesunder Erwachsener.'
const OK = 'Literaturwerte, gut belegt.'
const UNSICHER = 'Literaturwerte mit breiter Streuung — die Kurve zeigt die Groessenordnung, nicht den Einzelfall.'

/** @type {PkSeed[]} */
export const PK_PROFILE_ERWEITERUNG = [
  // ── Schmerz und Entzuendung ──────────────────────────────────────────
  { name: 'Ibuprofen', aliases: ['Nurofen'], half_life_hours: 2, tmax_hours: 1.5, bioavailability_sc: 0.9, category: 'other', notes: FI },
  { name: 'Paracetamol', aliases: ['Acetaminophen'], half_life_hours: 2.5, tmax_hours: 1, bioavailability_sc: 0.85, category: 'other', notes: FI },
  { name: 'Acetylsalicylsäure', aliases: ['ASS', 'Aspirin'], half_life_hours: 0.33, tmax_hours: 0.5, bioavailability_sc: 0.7, category: 'other', notes: 'Halbwertszeit der ASS selbst; der wirksame Salicylat-Metabolit bleibt deutlich laenger.' },
  { name: 'Prednisolon', aliases: ['Prednisolone'], half_life_hours: 3, tmax_hours: 1.5, bioavailability_sc: 0.8, category: 'other', notes: 'Plasma-Halbwertszeit; die biologische Wirkung haelt laenger an als die Kurve zeigt.' },

  // ── Magen ────────────────────────────────────────────────────────────
  { name: 'Pantoprazol', aliases: ['Pantoprazole'], half_life_hours: 1, tmax_hours: 2.5, bioavailability_sc: 0.77, category: 'other', notes: 'Kurze Plasma-Halbwertszeit, aber irreversible Pumpenhemmung — die Wirkung ueberdauert den Spiegel deutlich.' },
  { name: 'Omeprazol', aliases: ['Omeprazole'], half_life_hours: 1, tmax_hours: 1.5, bioavailability_sc: 0.4, category: 'other', notes: 'Wie Pantoprazol: Wirkung ueberdauert den Spiegel. Bioverfuegbarkeit steigt bei wiederholter Gabe.' },

  // ── Herz und Kreislauf ───────────────────────────────────────────────
  { name: 'Atorvastatin', aliases: ['Sortis'], half_life_hours: 14, tmax_hours: 1.5, bioavailability_sc: 0.14, category: 'other', notes: FI },
  { name: 'Rosuvastatin', aliases: ['Crestor'], half_life_hours: 19, tmax_hours: 4, bioavailability_sc: 0.2, category: 'other', notes: FI },
  { name: 'Simvastatin', aliases: ['Zocor'], half_life_hours: 2, tmax_hours: 1.5, bioavailability_sc: 0.05, category: 'other', notes: 'Prodrug mit starkem First-Pass; der aktive Metabolit bleibt laenger als die Muttersubstanz.' },
  { name: 'Ramipril', aliases: ['Delix'], half_life_hours: 15, tmax_hours: 1, bioavailability_sc: 0.28, category: 'other', notes: 'Werte des aktiven Metaboliten Ramiprilat.' },
  { name: 'Bisoprolol', aliases: ['Concor'], half_life_hours: 11, tmax_hours: 3, bioavailability_sc: 0.9, category: 'other', notes: FI },
  { name: 'Metoprolol', aliases: ['Beloc'], half_life_hours: 3.5, tmax_hours: 1.5, bioavailability_sc: 0.4, category: 'other', notes: 'Werte fuer schnell freisetzende Form; Retardformen verlaufen flacher.' },
  { name: 'Amlodipin', aliases: ['Norvasc'], half_life_hours: 40, tmax_hours: 7, bioavailability_sc: 0.65, category: 'other', notes: FI },
  { name: 'Candesartan', aliases: ['Blopress'], half_life_hours: 9, tmax_hours: 3.5, bioavailability_sc: 0.15, category: 'other', notes: FI },

  // ── Psyche und ADHS ──────────────────────────────────────────────────
  { name: 'Sertralin', aliases: ['Sertraline', 'Zoloft'], half_life_hours: 26, tmax_hours: 6, bioavailability_sc: 0.44, category: 'other', notes: FI },
  { name: 'Escitalopram', aliases: ['Cipralex'], half_life_hours: 30, tmax_hours: 4, bioavailability_sc: 0.8, category: 'other', notes: FI },
  { name: 'Venlafaxin', aliases: ['Venlafaxine', 'Trevilor'], half_life_hours: 5, tmax_hours: 2, bioavailability_sc: 0.45, category: 'other', notes: 'Werte der Muttersubstanz, schnell freisetzende Form. Retardformen und der aktive Metabolit verlaufen flacher und laenger.' },
  { name: 'Bupropion', aliases: ['Elontril', 'Wellbutrin'], half_life_hours: 20, tmax_hours: 3, bioavailability_sc: 0.87, category: 'other', notes: 'Relative Bioverfuegbarkeit; absolute Werte liegen nicht vor.' },
  { name: 'Methylphenidat', aliases: ['Ritalin', 'Medikinet'], half_life_hours: 3, tmax_hours: 2, bioavailability_sc: 0.3, category: 'other', notes: 'Werte fuer schnell freisetzende Form. Retardformen (Concerta, Medikinet retard) haben ein anderes Profil.' },
  { name: 'Lisdexamfetamin', aliases: ['Elvanse', 'Vyvanse'], half_life_hours: 10, tmax_hours: 3.5, bioavailability_sc: 0.96, category: 'other', notes: 'Werte des aktiven Dexamfetamins; Lisdexamfetamin selbst ist ein Prodrug mit sehr kurzer Halbwertszeit.' },
  { name: 'Modafinil', aliases: ['Vigil', 'Provigil'], half_life_hours: 13, tmax_hours: 2.5, bioavailability_sc: 0.8, category: 'other', notes: FI },

  // ── Hormonell wirksame Medikamente ───────────────────────────────────
  { name: 'Finasterid', aliases: ['Finasteride', 'Propecia'], half_life_hours: 6, tmax_hours: 2, bioavailability_sc: 0.65, category: 'other', notes: FI },
  { name: 'Dutasterid', aliases: ['Dutasteride', 'Avodart'], half_life_hours: 840, tmax_hours: 3, bioavailability_sc: 0.6, category: 'other', notes: 'Etwa fuenf Wochen Halbwertszeit — der Spiegel baut sich ueber Monate auf und ab.' },
  { name: 'Anastrozol', aliases: ['Arimidex'], half_life_hours: 46, tmax_hours: 2, bioavailability_sc: 0.85, category: 'other', notes: FI },
  { name: 'Tamoxifen', aliases: ['Nolvadex'], half_life_hours: 120, tmax_hours: 5, bioavailability_sc: 0.8, category: 'other', notes: 'Fuenf bis sieben Tage; der aktive Metabolit Endoxifen bleibt noch laenger.' },
  { name: 'Enclomifen', aliases: ['Enclomiphene'], half_life_hours: 10, tmax_hours: 1.5, bioavailability_sc: 0.7, category: 'other', notes: UNSICHER },
  { name: 'Levothyroxin', aliases: ['L-Thyroxin', 'Euthyrox', 'T4'], half_life_hours: 168, tmax_hours: 3, bioavailability_sc: 0.75, category: 'other', notes: 'Sieben Tage Halbwertszeit: der Spiegel folgt der Einzeldosis kaum, sondern dem Wochenmittel.' },
  { name: 'Liothyronin', aliases: ['T3', 'Thybon'], half_life_hours: 24, tmax_hours: 2.5, bioavailability_sc: 0.9, category: 'other', notes: FI },
  { name: 'Tadalafil', aliases: ['Cialis'], half_life_hours: 17.5, tmax_hours: 2, bioavailability_sc: 0.8, category: 'other', notes: FI },
  { name: 'Sildenafil', aliases: ['Viagra'], half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 0.41, category: 'other', notes: FI },

  // ── Stoffwechsel ─────────────────────────────────────────────────────
  { name: 'Metformin', aliases: ['Metformin HCl', 'Glucophage'], half_life_hours: 5, tmax_hours: 2.5, bioavailability_sc: 0.55, category: 'other', notes: 'Werte fuer schnell freisetzende Form; Retardformen verlaufen flacher.' },
  { name: 'Dapagliflozin', aliases: ['Forxiga', 'Farxiga'], half_life_hours: 12.9, tmax_hours: 1.5, bioavailability_sc: 0.78, category: 'other', notes: FI },
  { name: 'Empagliflozin', aliases: ['Jardiance'], half_life_hours: 12.4, tmax_hours: 1.5, bioavailability_sc: 0.78, category: 'other', notes: FI },
  { name: 'Allopurinol', aliases: ['Zyloric'], half_life_hours: 2, tmax_hours: 1.5, bioavailability_sc: 0.8, category: 'other', notes: 'Der wirksame Metabolit Oxypurinol hat rund 20 Stunden — die Kurve zeigt nur die Muttersubstanz.' },

  // ── Weitere ──────────────────────────────────────────────────────────
  { name: 'Cetirizin', aliases: ['Zyrtec'], half_life_hours: 10, tmax_hours: 1, bioavailability_sc: 0.7, category: 'other', notes: FI },
  { name: 'Loratadin', aliases: ['Lorano'], half_life_hours: 8, tmax_hours: 1.5, bioavailability_sc: 0.4, category: 'other', notes: 'Der aktive Metabolit Desloratadin bleibt mit rund 27 Stunden deutlich laenger.' },
  { name: 'Amoxicillin', aliases: ['Amoxi'], half_life_hours: 1.2, tmax_hours: 1.5, bioavailability_sc: 0.8, category: 'other', notes: FI },
  { name: 'Naltrexon', aliases: ['Naltrexone', 'LDN'], half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 0.2, category: 'other', notes: 'Starker First-Pass. Der aktive Metabolit 6-beta-Naltrexol bleibt laenger.' },
  { name: 'Rapamycin', aliases: ['Sirolimus', 'Rapamune'], half_life_hours: 62, tmax_hours: 2, bioavailability_sc: 0.15, category: 'other', notes: FI },

  // ── Hormone in Stueckform ────────────────────────────────────────────
  { name: 'DHEA', aliases: ['Dehydroepiandrosteron'], half_life_hours: 12, tmax_hours: 1.5, bioavailability_sc: 0.5, category: 'hormone', notes: UNSICHER },
  { name: 'Pregnenolon', aliases: ['Pregnenolone'], half_life_hours: 1.5, tmax_hours: 1.5, bioavailability_sc: 0.3, category: 'hormone', notes: 'Duenne Datenlage beim Menschen — die Kurve ist eine Groessenordnung, keine Messung.' },
  { name: 'Östradiol', aliases: ['Estradiol', 'Oestradiol'], half_life_hours: 15, tmax_hours: 5, bioavailability_sc: 0.05, category: 'hormone', notes: 'Werte fuer orales Estradiol mit starkem First-Pass. Gel und Pflaster umgehen ihn und verlaufen ganz anders.' },
  { name: 'Progesteron', aliases: ['Progesterone', 'Utrogest'], half_life_hours: 16, tmax_hours: 2.5, bioavailability_sc: 0.1, category: 'hormone', notes: 'Werte fuer orales mikronisiertes Progesteron.' },

  // ── Supplemente mit belastbaren Werten ───────────────────────────────
  { name: 'Koffein', aliases: ['Caffeine', 'Coffein'], half_life_hours: 5, tmax_hours: 0.75, bioavailability_sc: 1.0, category: 'other', notes: 'Nahezu vollstaendig aufgenommen. Die Halbwertszeit schwankt genetisch zwischen etwa 2 und 10 Stunden.' },
  { name: 'Melatonin', aliases: [], half_life_hours: 0.75, tmax_hours: 0.75, bioavailability_sc: 0.15, category: 'other', notes: 'Sehr kurze Halbwertszeit und starker First-Pass. Retardformen verlaufen deutlich flacher.' },
  { name: '5-HTP', aliases: ['5-Hydroxytryptophan'], half_life_hours: 2.2, tmax_hours: 1.5, bioavailability_sc: 0.7, category: 'other', notes: OK },
  { name: 'L-Theanin', aliases: ['Theanin'], half_life_hours: 1.2, tmax_hours: 0.8, bioavailability_sc: 0.9, category: 'other', notes: OK },
  { name: 'NAC', aliases: ['N-Acetyl-Cystein'], half_life_hours: 6, tmax_hours: 1, bioavailability_sc: 0.1, category: 'other', notes: 'Sehr geringe orale Bioverfuegbarkeit der unveraenderten Substanz.' },
  { name: 'Coenzym Q10', aliases: ['CoQ10', 'Ubiquinol'], half_life_hours: 33, tmax_hours: 6, bioavailability_sc: 0.05, category: 'other', notes: 'Schlecht loeslich; die Aufnahme haengt stark an der Formulierung und an der Mahlzeit.' },
  { name: 'Berberin', aliases: ['Berberine'], half_life_hours: 4, tmax_hours: 4, bioavailability_sc: 0.05, category: 'other', notes: 'Sehr geringe orale Bioverfuegbarkeit; der Wirkort liegt teils im Darm, nicht im Blut.' },
]
