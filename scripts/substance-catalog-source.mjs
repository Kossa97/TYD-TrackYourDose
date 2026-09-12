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
 */

/** @typedef {{ name: string, aliases: string[], category: string, dosageForms: string[], units: string[], pkProfile: string | null }} SubstanceSeed */

/** @type {SubstanceSeed[]} */
export const SUBSTANCE_CATALOG = [
  // ── Inkretine (GLP-1 und Verwandte) ──────────────────────────────────
  { name: 'Semaglutid', aliases: ['Semaglutide', 'Ozempic', 'Wegovy', 'Rybelsus'], category: 'peptide', dosageForms: ['pen', 'vial', 'tablet'], units: ['mg', 'mcg'], pkProfile: 'Semaglutide' },
  { name: 'Tirzepatid', aliases: ['Tirzepatide', 'Mounjaro', 'Zepbound'], category: 'peptide', dosageForms: ['pen', 'vial'], units: ['mg', 'mcg'], pkProfile: 'Tirzepatide' },
  { name: 'Liraglutid', aliases: ['Liraglutide', 'Victoza', 'Saxenda'], category: 'peptide', dosageForms: ['pen'], units: ['mg'], pkProfile: 'Liraglutide' },
  { name: 'Exenatid', aliases: ['Exenatide', 'Byetta', 'Bydureon'], category: 'peptide', dosageForms: ['pen', 'vial'], units: ['mcg', 'mg'], pkProfile: 'Exenatide' },
  { name: 'Retatrutid', aliases: ['Retatrutide', 'LY3437943', 'Reta', 'Triple-G'], category: 'peptide', dosageForms: ['vial', 'pen'], units: ['mg', 'mcg'], pkProfile: 'Retatrutide' },
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
  { name: 'Melanotan II', aliases: ['Melanotan 2', 'MT-2', 'MT-II'], category: 'peptide', dosageForms: ['vial'], units: ['mg', 'mcg'], pkProfile: 'Melanotan II' },
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
]
