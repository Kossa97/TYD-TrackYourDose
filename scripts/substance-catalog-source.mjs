/**
 * Der Substanzkatalog — die Quelle, aus der `supabase-my-stack-catalog-expansion.sql`
 * erzeugt wird (`npm run catalog:sql`).
 *
 * WAS EIN EINTRAG IST
 * Eine Tippersparnis, kein Nachschlagewerk. Er traegt den Namen, unter dem
 * man die Substanz sucht, die Formen, in denen es sie ueblicherweise gibt,
 * und die Einheiten, in denen ihre Staerke angegeben wird. Mehr nicht.
 *
 * WAS HIER NICHT HINEINGEHOERT
 * Dosierungen, Wirkungen, Nebenwirkungen, Anwendungshinweise. Das liegt in
 * `peptide_library` und in den PK-Profilen (`scripts/seed-pk-profiles.ts`)
 * und bleibt dort. Genau deshalb ist ein Eintrag billig und der Katalog
 * kann auf Hunderte wachsen, ohne dass jemand medizinisch haftet.
 *
 * WARUM DIE ALIASE WICHTIG SIND
 * Sie sind nicht Beiwerk, sondern der Klebstoff. Die Suche findet ueber sie,
 * und die Verknuepfung zum PK-Profil laeuft ueber Name ODER Alias. Der
 * Katalog schrieb „Semaglutid", das PK-Profil „Semaglutide" — ohne den Alias
 * finden sich die beiden nie. Deshalb gilt: deutscher Name vorn, englische
 * Schreibweise als erster Alias, Handelsnamen dahinter.
 *
 * FELDER
 *   name         deutscher Anzeigename, eindeutig (Unique-Index auf lower(name))
 *   aliases      weitere Schreibweisen und Handelsnamen, ebenfalls eindeutig
 *   category     StackCategory. Steuert im Formular mit, ob ein Vial ein
 *                Pulver traegt (peptide) oder eine fertige Loesung.
 *   dosageForms  DosageFormKey[], die uebliche zuerst
 *   units        Wirkstoffeinheiten, die uebliche zuerst. Jede muss zu einer
 *                der genannten Formen passen.
 *   pkProfile    Name in `pk_profiles`, oder null
 *   renameFrom   optional: die Schreibweise, unter der die Zeile HEUTE in der
 *                Datenbank steht. Ohne sie legt der Upsert eine zweite Zeile
 *                an, statt die bestehende zu treffen — und die bestehende
 *                traegt die id, an der `stack_item_ingredients` haengt.
 */

/** @typedef {{ name: string, aliases: string[], category: string, dosageForms: string[], units: string[], pkProfile: string | null, renameFrom?: string }} SubstanceSeed */

/** @type {SubstanceSeed[]} */
export const SUBSTANCE_CATALOG = [
  // ── Inkretine (GLP-1 und Verwandte) ──────────────────────────────────
  { name: 'Semaglutid', aliases: ['Semaglutide', 'Ozempic', 'Wegovy', 'Rybelsus'], category: 'peptide', dosageForms: ['pen', 'vial', 'tablet'], units: ['mg', 'mcg'], pkProfile: 'Semaglutide' },
  { name: 'Tirzepatid', aliases: ['Tirzepatide', 'Mounjaro', 'Zepbound'], category: 'peptide', dosageForms: ['pen', 'vial'], units: ['mg', 'mcg'], pkProfile: 'Tirzepatide' },
  { name: 'Liraglutid', aliases: ['Liraglutide', 'Victoza', 'Saxenda'], category: 'peptide', dosageForms: ['pen'], units: ['mg'], pkProfile: 'Liraglutide' },
  { name: 'Exenatid', aliases: ['Exenatide', 'Byetta', 'Bydureon'], category: 'peptide', dosageForms: ['pen', 'vial'], units: ['mcg', 'mg'], pkProfile: 'Exenatide' },
  { name: 'Retatrutid', aliases: ['Retatrutide', 'LY3437943', 'Reta', 'Triple-G'], category: 'peptide', dosageForms: ['vial', 'pen'], units: ['mg', 'mcg'], pkProfile: 'Retatrutide', renameFrom: 'Retatrutide' },
  { name: 'Cagrilintid', aliases: ['Cagrilintide', 'AM833', 'NN9838', 'Cagri'], category: 'peptide', dosageForms: ['vial', 'pen'], units: ['mg', 'mcg'], pkProfile: 'Cagrilintide' },
  { name: 'Survodutid', aliases: ['Survodutide', 'BI 456906'], category: 'peptide', dosageForms: ['vial', 'pen'], units: ['mg', 'mcg'], pkProfile: 'Survodutide' },
  { name: 'Mazdutid', aliases: ['Mazdutide', 'IBI362', 'LY3305677'], category: 'peptide', dosageForms: ['vial', 'pen'], units: ['mg', 'mcg'], pkProfile: 'Mazdutide' },
  { name: 'Orforglipron', aliases: ['LY3502970'], category: 'peptide', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: 'Orforglipron' },

  // ── Peptide ──────────────────────────────────────────────────────────
  { name: 'BPC-157', aliases: ['Body Protection Compound', 'Body Protection Compound 157', 'PL-14736'], category: 'peptide', dosageForms: ['vial', 'capsule', 'nasal_spray', 'tube'], units: ['mg', 'mcg'], pkProfile: 'BPC-157' },
  { name: 'TB-500', aliases: ['Thymosin Beta-4', 'TB4'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'TB-500' },
  { name: 'GHK-Cu', aliases: ['Copper Peptide', 'Kupferpeptid'], category: 'peptide', dosageForms: ['vial', 'gel', 'tube'], units: ['mg'], pkProfile: 'GHK-Cu' },
  { name: 'KPV', aliases: ['Lysin-Prolin-Valin'], category: 'peptide', dosageForms: ['vial', 'capsule'], units: ['mg', 'mcg'], pkProfile: 'KPV' },
  { name: 'CJC-1295', aliases: ['CJC-1295 DAC', 'CJC-1295 with DAC'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'CJC-1295 DAC' },
  { name: 'CJC-1295 ohne DAC', aliases: ['CJC-1295 no DAC', 'Modified GRF 1-29', 'Mod GRF 1-29'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'CJC-1295 no DAC' },
  { name: 'Ipamorelin', aliases: [], category: 'peptide', dosageForms: ['vial', 'nasal_spray'], units: ['mcg', 'mg'], pkProfile: 'Ipamorelin' },
  { name: 'GHRP-2', aliases: ['Pralmorelin'], category: 'peptide', dosageForms: ['vial', 'nasal_spray'], units: ['mcg', 'mg'], pkProfile: 'GHRP-2' },
  { name: 'GHRP-6', aliases: [], category: 'peptide', dosageForms: ['vial', 'nasal_spray'], units: ['mcg', 'mg'], pkProfile: 'GHRP-6' },
  { name: 'Hexarelin', aliases: ['Examorelin'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'Hexarelin' },
  { name: 'Sermorelin', aliases: [], category: 'peptide', dosageForms: ['vial', 'ampoule'], units: ['mcg', 'mg'], pkProfile: 'Sermorelin' },
  { name: 'Tesamorelin', aliases: ['Egrifta'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'Tesamorelin' },
  { name: 'MK-677', aliases: ['Ibutamoren', 'Nutrobal'], category: 'peptide', dosageForms: ['capsule', 'tablet', 'drops'], units: ['mg'], pkProfile: 'MK-677' },
  { name: 'MOTS-c', aliases: ['Mitochondrial ORF 12S rRNA-c'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'MOTS-c' },
  { name: 'AOD-9604', aliases: ['AOD9604', 'hGH 176-191 (Tyr)'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'AOD-9604' },
  { name: 'HGH Fragment 176-191', aliases: ['HGH Frag', 'Frag 176-191', 'Fragment 176-191'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'HGH Fragment 176-191' },
  { name: 'Thymosin Alpha-1', aliases: ['Thymalfasin', 'Zadaxin', 'Ta1'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'Thymosin Alpha-1' },
  { name: 'DSIP', aliases: ['Delta Sleep-Inducing Peptide', 'Delta-Schlaf-induzierendes Peptid'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'DSIP' },
  { name: 'Kisspeptin-10', aliases: ['KP-10', 'Metastin 45-54'], category: 'peptide', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'Kisspeptin-10' },
  { name: 'Semax', aliases: [], category: 'peptide', dosageForms: ['nasal_spray', 'vial', 'drops'], units: ['mg', 'mcg'], pkProfile: 'Semax' },
  { name: 'Selank', aliases: [], category: 'peptide', dosageForms: ['nasal_spray', 'vial', 'drops'], units: ['mg', 'mcg'], pkProfile: 'Selank' },
  { name: 'Dihexa', aliases: [], category: 'peptide', dosageForms: ['capsule', 'vial'], units: ['mg', 'mcg'], pkProfile: 'Dihexa' },
  { name: 'Cerebrolysin', aliases: [], category: 'peptide', dosageForms: ['ampoule', 'vial'], units: ['ml', 'mg'], pkProfile: 'Cerebrolysin' },
  { name: 'NA-Semax Amidat', aliases: ['NA-Semax Amidate', 'N-Acetyl Semax Amidate', 'NA-Semax'], category: 'peptide', dosageForms: ['nasal_spray', 'drops', 'vial'], units: ['mg', 'mcg'], pkProfile: 'NA-Semax Amidate' },
  { name: 'PT-141', aliases: ['Bremelanotid', 'Bremelanotide', 'Vyleesi'], category: 'peptide', dosageForms: ['vial', 'nasal_spray'], units: ['mg', 'mcg'], pkProfile: 'PT-141' },
  { name: 'Melanotan II', aliases: ['Melanotan 2', 'MT-2', 'MT-II'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'Melanotan II', renameFrom: 'Melanotan II (MT2)' },
  { name: 'Epithalon', aliases: ['Epitalon', 'Epithalone'], category: 'peptide', dosageForms: ['vial', 'capsule', 'tablet'], units: ['mg', 'mcg'], pkProfile: 'Epithalon' },
  { name: 'SS-31', aliases: ['Elamipretid', 'Elamipretide', 'MTP-131'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'SS-31' },
  { name: 'Humanin', aliases: [], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'Humanin' },

  // ── Hormone ──────────────────────────────────────────────────────────
  // Im Vial liegt hier ein Oel oder eine fertige Loesung, kein Pulver — die
  // Kategorie sagt dem Staerke-Schritt genau das (siehe `strengthShapeFor`).
  { name: 'Testosteron', aliases: ['Testosterone'], category: 'hormone', dosageForms: ['vial', 'ampoule', 'gel', 'patch', 'capsule', 'pen'], units: ['mg'], pkProfile: null },
  { name: 'Testosteron Enantat', aliases: ['Testosterone Enanthate', 'Test E'], category: 'hormone', dosageForms: ['vial', 'ampoule', 'pen'], units: ['mg'], pkProfile: 'Testosterone Enanthate' },
  { name: 'Testosteron Cypionat', aliases: ['Testosterone Cypionate', 'Test C'], category: 'hormone', dosageForms: ['vial', 'ampoule'], units: ['mg'], pkProfile: 'Testosterone Cypionate' },
  { name: 'Testosteron Propionat', aliases: ['Testosterone Propionate', 'Test P'], category: 'hormone', dosageForms: ['vial', 'ampoule'], units: ['mg'], pkProfile: 'Testosterone Propionate' },
  // HCG kommt als Pulver und wird rekonstituiert — als Hormon gefuehrt fragt
  // der Staerke-Schritt nach der Konzentration. Der Hinweiskasten dort nennt
  // deshalb den Weg zurueck (Kategorie „Peptid").
  { name: 'HCG', aliases: ['Human Chorionic Gonadotropin', 'Humanes Choriongonadotropin', 'Choriongonadotropin'], category: 'hormone', dosageForms: ['vial', 'ampoule'], units: ['IU', 'mg'], pkProfile: 'HCG' },
  { name: 'IGF-1 LR3', aliases: ['Long R3 IGF-1', 'LR3'], category: 'hormone', dosageForms: ['vial'], units: ['mcg', 'mg'], pkProfile: 'IGF-1 LR3' },
  { name: 'HGH', aliases: ['Somatropin', 'Human Growth Hormone', 'Wachstumshormon'], category: 'hormone', dosageForms: ['vial', 'pen'], units: ['IU', 'mg'], pkProfile: 'HGH' },

  // ── Vitamine, Mineralien, Supplemente, Medikamente ───────────────────
  // Der Anfang; Welle 2 fuellt hier je Darreichungsform auf.
  { name: 'Vitamin D3', aliases: ['Cholecalciferol', 'Colecalciferol'], category: 'vitamin', dosageForms: ['capsule', 'drops', 'tablet', 'spray'], units: ['IU', 'mcg'], pkProfile: null },
  { name: 'Vitamin K2', aliases: ['Menachinon-7', 'MK-7', 'Menaquinon'], category: 'vitamin', dosageForms: ['capsule', 'drops', 'tablet'], units: ['mcg'], pkProfile: null },
  { name: 'Magnesium', aliases: ['Magnesiumcitrat', 'Magnesium citrate'], category: 'supplement', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'Omega-3', aliases: ['Omega 3', 'Fischöl', 'Fish oil', 'EPA/DHA'], category: 'supplement', dosageForms: ['capsule'], units: ['mg', 'g'], pkProfile: null },
  { name: 'Creatin', aliases: ['Kreatin', 'Creatine', 'Creatin-Monohydrat'], category: 'supplement', dosageForms: ['powder', 'capsule', 'tablet'], units: ['g', 'mg'], pkProfile: null },
  { name: 'Metformin', aliases: ['Metformin HCl', 'Glucophage'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Melatonin', aliases: [], category: 'supplement', dosageForms: ['tablet', 'capsule', 'drops', 'spray'], units: ['mg', 'mcg'], pkProfile: null },

  // ── Welle 2a: Vitamine ───────────────────────────────────────────────
  { name: 'Vitamin C', aliases: ['Ascorbinsäure', 'Ascorbic acid'], category: 'vitamin', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg', 'g'], pkProfile: null },
  { name: 'Vitamin A', aliases: ['Retinol', 'Retinylpalmitat'], category: 'vitamin', dosageForms: ['capsule', 'drops'], units: ['IU', 'mcg'], pkProfile: null },
  { name: 'Vitamin E', aliases: ['Tocopherol', 'Alpha-Tocopherol'], category: 'vitamin', dosageForms: ['capsule', 'drops'], units: ['IU', 'mg'], pkProfile: null },
  { name: 'Vitamin B1', aliases: ['Thiamin', 'Benfotiamin'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Vitamin B2', aliases: ['Riboflavin'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Vitamin B3', aliases: ['Niacin', 'Nicotinamid', 'Nicotinsäure'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Vitamin B5', aliases: ['Pantothensäure', 'Calcium-Pantothenat'], category: 'vitamin', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Vitamin B6', aliases: ['Pyridoxin', 'P5P', 'Pyridoxal-5-Phosphat'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Vitamin B7', aliases: ['Biotin', 'Vitamin H'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mcg', 'mg'], pkProfile: null },
  { name: 'Folsäure', aliases: ['Vitamin B9', 'Folat', 'Methylfolat', '5-MTHF'], category: 'vitamin', dosageForms: ['tablet', 'capsule'], units: ['mcg'], pkProfile: null },
  { name: 'Vitamin B12', aliases: ['Cobalamin', 'Methylcobalamin', 'Hydroxocobalamin', 'Cyanocobalamin'], category: 'vitamin', dosageForms: ['tablet', 'capsule', 'drops', 'spray'], units: ['mcg'], pkProfile: null },
  { name: 'Vitamin B-Komplex', aliases: ['B-Komplex', 'Vitamin B Complex'], category: 'vitamin', dosageForms: ['capsule', 'tablet'], units: ['mg', 'mcg'], pkProfile: null },

  // ── Welle 2a: Mineralien und Spurenelemente ──────────────────────────
  // Als 'supplement' gefuehrt: eine eigene Kategorie „Mineral" braeuchte eine
  // eigene Regel und bekaeme keine — Zink verhaelt sich in einer Kapsel
  // genau wie Magnesium.
  { name: 'Zink', aliases: ['Zinc', 'Zinkgluconat', 'Zinkbisglycinat', 'Zinkpicolinat'], category: 'supplement', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Eisen', aliases: ['Ferrum', 'Iron', 'Eisenbisglycinat', 'Eisensulfat'], category: 'supplement', dosageForms: ['tablet', 'capsule', 'drops'], units: ['mg'], pkProfile: null },
  { name: 'Calcium', aliases: ['Kalzium', 'Calciumcitrat', 'Calciumcarbonat'], category: 'supplement', dosageForms: ['tablet', 'capsule', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'Kalium', aliases: ['Potassium', 'Kaliumcitrat'], category: 'supplement', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Selen', aliases: ['Selenium', 'Natriumselenit', 'Selenomethionin'], category: 'supplement', dosageForms: ['tablet', 'capsule'], units: ['mcg'], pkProfile: null },
  { name: 'Jod', aliases: ['Iod', 'Iodine', 'Kaliumiodid'], category: 'supplement', dosageForms: ['tablet', 'capsule', 'drops'], units: ['mcg'], pkProfile: null },
  { name: 'Kupfer', aliases: ['Copper', 'Kupferbisglycinat'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg', 'mcg'], pkProfile: null },
  { name: 'Mangan', aliases: ['Manganese'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Chrom', aliases: ['Chromium', 'Chrompicolinat'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mcg'], pkProfile: null },
  { name: 'Molybdän', aliases: ['Molybdenum'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mcg'], pkProfile: null },

  // ── Welle 2a: Aminosaeuren und Alltagssupplemente ────────────────────
  { name: 'Koffein', aliases: ['Caffeine', 'Coffein'], category: 'supplement', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'L-Theanin', aliases: ['Theanin', 'L-Theanine'], category: 'supplement', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'L-Citrullin', aliases: ['Citrullin', 'Citrullin-Malat', 'L-Citrulline'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['g', 'mg'], pkProfile: null },
  { name: 'L-Arginin', aliases: ['Arginin', 'L-Arginine', 'AAKG'], category: 'supplement', dosageForms: ['capsule', 'powder', 'tablet'], units: ['mg', 'g'], pkProfile: null },
  { name: 'Beta-Alanin', aliases: ['Beta Alanine', 'β-Alanin'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['g', 'mg'], pkProfile: null },
  { name: 'Taurin', aliases: ['Taurine'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['mg', 'g'], pkProfile: null },
  { name: 'L-Carnitin', aliases: ['Carnitin', 'Acetyl-L-Carnitin', 'ALCAR'], category: 'supplement', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg', 'g'], pkProfile: null },
  { name: 'Glycin', aliases: ['Glycine'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['g', 'mg'], pkProfile: null },
  { name: 'NAC', aliases: ['N-Acetyl-Cystein', 'N-Acetylcystein', 'Acetylcystein'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Whey Protein', aliases: ['Molkenprotein', 'Whey', 'Proteinpulver'], category: 'supplement', dosageForms: ['powder'], units: ['g'], pkProfile: null },
  { name: 'Kollagen', aliases: ['Collagen', 'Kollagenpeptide', 'Collagen peptides'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['g', 'mg'], pkProfile: null },
  { name: 'Inositol', aliases: ['Myo-Inositol'], category: 'supplement', dosageForms: ['powder', 'capsule'], units: ['g', 'mg'], pkProfile: null },

  // ── Welle 2a: Pflanzliches und Longevity ─────────────────────────────
  { name: 'Ashwagandha', aliases: ['Withania somnifera', 'KSM-66', 'Schlafbeere'], category: 'supplement', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'Kurkuma', aliases: ['Curcumin', 'Turmeric', 'Kurkumaextrakt'], category: 'supplement', dosageForms: ['capsule', 'tablet', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'Rhodiola rosea', aliases: ['Rosenwurz', 'Rhodiola'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Ginkgo biloba', aliases: ['Ginkgo'], category: 'supplement', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Mariendistel', aliases: ['Silymarin', 'Silybum marianum'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Baldrian', aliases: ['Valeriana', 'Valerian'], category: 'supplement', dosageForms: ['tablet', 'capsule', 'drops'], units: ['mg'], pkProfile: null },
  { name: '5-HTP', aliases: ['5-Hydroxytryptophan', 'Griffonia'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Coenzym Q10', aliases: ['CoQ10', 'Ubiquinol', 'Ubichinon'], category: 'supplement', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },
  { name: 'Alpha-Liponsäure', aliases: ['ALA', 'Alpha Lipoic Acid', 'Liponsäure'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Resveratrol', aliases: ['Trans-Resveratrol'], category: 'supplement', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },
  { name: 'Berberin', aliases: ['Berberine', 'Berberin-HCl'], category: 'supplement', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Spermidin', aliases: ['Spermidine'], category: 'supplement', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },
  { name: 'NMN', aliases: ['Nicotinamid-Mononukleotid', 'Nicotinamide Mononucleotide'], category: 'supplement', dosageForms: ['capsule', 'powder'], units: ['mg'], pkProfile: null },
  { name: 'NR', aliases: ['Nicotinamid-Ribosid', 'Nicotinamide Riboside', 'Niagen'], category: 'supplement', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },

  // ── Welle 2a: Medikamente ────────────────────────────────────────────
  // Nur Namen und uebliche Formen. Keine Dosierung, keine Indikation — was
  // jemand verschrieben bekommt, steht auf seiner Packung, nicht hier.
  { name: 'Ibuprofen', aliases: ['Nurofen'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Paracetamol', aliases: ['Acetaminophen', 'Ben-u-ron'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Acetylsalicylsäure', aliases: ['ASS', 'Aspirin'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Pantoprazol', aliases: ['Pantoprazole', 'Pantozol'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Omeprazol', aliases: ['Omeprazole'], category: 'medication', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Atorvastatin', aliases: ['Sortis'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Rosuvastatin', aliases: ['Crestor'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Simvastatin', aliases: ['Zocor'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Ramipril', aliases: ['Delix'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Bisoprolol', aliases: ['Concor'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Metoprolol', aliases: ['Beloc'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Amlodipin', aliases: ['Amlodipine', 'Norvasc'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Candesartan', aliases: ['Blopress'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Sertralin', aliases: ['Sertraline', 'Zoloft'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Escitalopram', aliases: ['Cipralex'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Venlafaxin', aliases: ['Venlafaxine', 'Trevilor'], category: 'medication', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Bupropion', aliases: ['Elontril', 'Wellbutrin'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Methylphenidat', aliases: ['Methylphenidate', 'Ritalin', 'Medikinet', 'Concerta'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Lisdexamfetamin', aliases: ['Lisdexamfetamine', 'Elvanse', 'Vyvanse'], category: 'medication', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },
  { name: 'Modafinil', aliases: ['Vigil', 'Provigil'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Finasterid', aliases: ['Finasteride', 'Propecia'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Dutasterid', aliases: ['Dutasteride', 'Avodart'], category: 'medication', dosageForms: ['capsule'], units: ['mg'], pkProfile: null },
  { name: 'Tadalafil', aliases: ['Cialis'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Sildenafil', aliases: ['Viagra'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Anastrozol', aliases: ['Anastrozole', 'Arimidex'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Tamoxifen', aliases: ['Nolvadex'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Enclomifen', aliases: ['Enclomiphene', 'Enclomifencitrat'], category: 'medication', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Levothyroxin', aliases: ['Levothyroxine', 'L-Thyroxin', 'Euthyrox', 'T4'], category: 'medication', dosageForms: ['tablet'], units: ['mcg'], pkProfile: null },
  { name: 'Liothyronin', aliases: ['Liothyronine', 'T3', 'Thybon'], category: 'medication', dosageForms: ['tablet'], units: ['mcg'], pkProfile: null },
  { name: 'Allopurinol', aliases: ['Zyloric'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Cetirizin', aliases: ['Cetirizine', 'Zyrtec'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Loratadin', aliases: ['Loratadine', 'Lorano'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Prednisolon', aliases: ['Prednisolone', 'Decortin H'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Amoxicillin', aliases: ['Amoxi'], category: 'medication', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Dapagliflozin', aliases: ['Forxiga', 'Farxiga'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Empagliflozin', aliases: ['Jardiance'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },
  { name: 'Naltrexon', aliases: ['Naltrexone', 'LDN', 'Low Dose Naltrexone'], category: 'medication', dosageForms: ['tablet', 'capsule'], units: ['mg'], pkProfile: null },
  { name: 'Rapamycin', aliases: ['Sirolimus', 'Rapamune'], category: 'medication', dosageForms: ['tablet'], units: ['mg'], pkProfile: null },

  // ── Welle 2a: Hormone in Stueckform ──────────────────────────────────
  { name: 'DHEA', aliases: ['Dehydroepiandrosteron', 'Prasteron'], category: 'hormone', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Pregnenolon', aliases: ['Pregnenolone'], category: 'hormone', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
  { name: 'Östradiol', aliases: ['Estradiol', 'Oestradiol', 'Estrogel'], category: 'hormone', dosageForms: ['tablet', 'gel', 'patch'], units: ['mg', 'mcg'], pkProfile: null },
  { name: 'Progesteron', aliases: ['Progesterone', 'Utrogest'], category: 'hormone', dosageForms: ['capsule', 'tablet'], units: ['mg'], pkProfile: null },
]
