-- GENERIERT von scripts/generate-substance-catalog-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/substance-catalog-source.mjs.
-- Neu erzeugen mit: npm run catalog:sql
--
-- 142 Substanzen. Der Upsert trifft den Unique-Index auf
-- lower(canonical_name): bekannte Zeilen werden aktualisiert, neue angelegt.
-- Ein zweiter Lauf aendert nichts.

begin;

-- 2 Umbenennung(en): bestehende Zeilen behalten ihre id.
update public.substance_catalog set canonical_name = 'Retatrutid', updated_at = now()
where lower(canonical_name) = lower('Retatrutide')
  and not exists (
    select 1 from public.substance_catalog andere
    where lower(andere.canonical_name) = lower('Retatrutid')
  );

update public.substance_catalog set canonical_name = 'Melanotan II', updated_at = now()
where lower(canonical_name) = lower('Melanotan II (MT2)')
  and not exists (
    select 1 from public.substance_catalog andere
    where lower(andere.canonical_name) = lower('Melanotan II')
  );

with quelle (canonical_name, aliases, default_category, suggested_dosage_forms, suggested_units, pk_profile_name) as (
  values
    ('Semaglutid', array['Semaglutide', 'Ozempic', 'Wegovy', 'Rybelsus']::text[], 'peptide', array['pen', 'vial', 'tablet']::text[], array['mg', 'mcg']::text[], 'Semaglutide'),
    ('Tirzepatid', array['Tirzepatide', 'Mounjaro', 'Zepbound']::text[], 'peptide', array['pen', 'vial']::text[], array['mg', 'mcg']::text[], 'Tirzepatide'),
    ('Liraglutid', array['Liraglutide', 'Victoza', 'Saxenda']::text[], 'peptide', array['pen']::text[], array['mg']::text[], 'Liraglutide'),
    ('Exenatid', array['Exenatide', 'Byetta', 'Bydureon']::text[], 'peptide', array['pen', 'vial']::text[], array['mcg', 'mg']::text[], 'Exenatide'),
    ('Retatrutid', array['Retatrutide', 'LY3437943', 'Reta', 'Triple-G']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Retatrutide'),
    ('Cagrilintid', array['Cagrilintide', 'AM833', 'NN9838', 'Cagri']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Cagrilintide'),
    ('Survodutid', array['Survodutide', 'BI 456906']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Survodutide'),
    ('Mazdutid', array['Mazdutide', 'IBI362', 'LY3305677']::text[], 'peptide', array['vial', 'pen']::text[], array['mg', 'mcg']::text[], 'Mazdutide'),
    ('Orforglipron', array['LY3502970']::text[], 'peptide', array['tablet', 'capsule']::text[], array['mg']::text[], 'Orforglipron'),
    ('BPC-157', array['Body Protection Compound', 'Body Protection Compound 157', 'PL-14736']::text[], 'peptide', array['vial', 'capsule', 'nasal_spray', 'tube']::text[], array['mg', 'mcg']::text[], 'BPC-157'),
    ('TB-500', array['Thymosin Beta-4', 'TB4']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'TB-500'),
    ('GHK-Cu', array['Copper Peptide', 'Kupferpeptid']::text[], 'peptide', array['vial', 'gel', 'tube']::text[], array['mg']::text[], 'GHK-Cu'),
    ('KPV', array['Lysin-Prolin-Valin']::text[], 'peptide', array['vial', 'capsule']::text[], array['mg', 'mcg']::text[], 'KPV'),
    ('CJC-1295', array['CJC-1295 DAC', 'CJC-1295 with DAC']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'CJC-1295 DAC'),
    ('CJC-1295 ohne DAC', array['CJC-1295 no DAC', 'Modified GRF 1-29', 'Mod GRF 1-29']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'CJC-1295 no DAC'),
    ('Ipamorelin', '{}'::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'Ipamorelin'),
    ('GHRP-2', array['Pralmorelin']::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'GHRP-2'),
    ('GHRP-6', '{}'::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mcg', 'mg']::text[], 'GHRP-6'),
    ('Hexarelin', array['Examorelin']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'Hexarelin'),
    ('Sermorelin', '{}'::text[], 'peptide', array['vial', 'ampoule']::text[], array['mcg', 'mg']::text[], 'Sermorelin'),
    ('Tesamorelin', array['Egrifta']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Tesamorelin'),
    ('MK-677', array['Ibutamoren', 'Nutrobal']::text[], 'peptide', array['capsule', 'tablet', 'drops']::text[], array['mg']::text[], 'MK-677'),
    ('MOTS-c', array['Mitochondrial ORF 12S rRNA-c']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'MOTS-c'),
    ('AOD-9604', array['AOD9604', 'hGH 176-191 (Tyr)']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'AOD-9604'),
    ('HGH Fragment 176-191', array['HGH Frag', 'Frag 176-191', 'Fragment 176-191']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'HGH Fragment 176-191'),
    ('Thymosin Alpha-1', array['Thymalfasin', 'Zadaxin', 'Ta1']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Thymosin Alpha-1'),
    ('DSIP', array['Delta Sleep-Inducing Peptide', 'Delta-Schlaf-induzierendes Peptid']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'DSIP'),
    ('Kisspeptin-10', array['KP-10', 'Metastin 45-54']::text[], 'peptide', array['vial']::text[], array['mcg', 'mg']::text[], 'Kisspeptin-10'),
    ('Semax', '{}'::text[], 'peptide', array['nasal_spray', 'vial', 'drops']::text[], array['mg', 'mcg']::text[], 'Semax'),
    ('Selank', '{}'::text[], 'peptide', array['nasal_spray', 'vial', 'drops']::text[], array['mg', 'mcg']::text[], 'Selank'),
    ('Dihexa', '{}'::text[], 'peptide', array['capsule', 'vial']::text[], array['mg', 'mcg']::text[], 'Dihexa'),
    ('Cerebrolysin', '{}'::text[], 'peptide', array['ampoule', 'vial']::text[], array['ml', 'mg']::text[], 'Cerebrolysin'),
    ('NA-Semax Amidat', array['NA-Semax Amidate', 'N-Acetyl Semax Amidate', 'NA-Semax']::text[], 'peptide', array['nasal_spray', 'drops', 'vial']::text[], array['mg', 'mcg']::text[], 'NA-Semax Amidate'),
    ('PT-141', array['Bremelanotid', 'Bremelanotide', 'Vyleesi']::text[], 'peptide', array['vial', 'nasal_spray']::text[], array['mg', 'mcg']::text[], 'PT-141'),
    ('Melanotan II', array['Melanotan 2', 'MT-2', 'MT-II']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Melanotan II'),
    ('Epithalon', array['Epitalon', 'Epithalone']::text[], 'peptide', array['vial', 'capsule', 'tablet']::text[], array['mg', 'mcg']::text[], 'Epithalon'),
    ('SS-31', array['Elamipretid', 'Elamipretide', 'MTP-131']::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'SS-31'),
    ('Humanin', '{}'::text[], 'peptide', array['vial']::text[], array['mg', 'mcg']::text[], 'Humanin'),
    ('Testosteron', array['Testosterone']::text[], 'hormone', array['vial', 'ampoule', 'gel', 'patch', 'capsule', 'pen']::text[], array['mg']::text[], null),
    ('Testosteron Enantat', array['Testosterone Enanthate', 'Test E']::text[], 'hormone', array['vial', 'ampoule', 'pen']::text[], array['mg']::text[], 'Testosterone Enanthate'),
    ('Testosteron Cypionat', array['Testosterone Cypionate', 'Test C']::text[], 'hormone', array['vial', 'ampoule']::text[], array['mg']::text[], 'Testosterone Cypionate'),
    ('Testosteron Propionat', array['Testosterone Propionate', 'Test P']::text[], 'hormone', array['vial', 'ampoule']::text[], array['mg']::text[], 'Testosterone Propionate'),
    ('HCG', array['Human Chorionic Gonadotropin', 'Humanes Choriongonadotropin', 'Choriongonadotropin']::text[], 'hormone', array['vial', 'ampoule']::text[], array['IU', 'mg']::text[], 'HCG'),
    ('IGF-1 LR3', array['Long R3 IGF-1', 'LR3']::text[], 'hormone', array['vial']::text[], array['mcg', 'mg']::text[], 'IGF-1 LR3'),
    ('HGH', array['Somatropin', 'Human Growth Hormone', 'Wachstumshormon']::text[], 'hormone', array['vial', 'pen']::text[], array['IU', 'mg']::text[], 'HGH'),
    ('Vitamin D3', array['Cholecalciferol', 'Colecalciferol']::text[], 'vitamin', array['capsule', 'drops', 'tablet', 'spray']::text[], array['IU', 'mcg']::text[], null),
    ('Vitamin K2', array['Menachinon-7', 'MK-7', 'Menaquinon']::text[], 'vitamin', array['capsule', 'drops', 'tablet']::text[], array['mcg']::text[], null),
    ('Magnesium', array['Magnesiumcitrat', 'Magnesium citrate']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg']::text[], null),
    ('Omega-3', array['Omega 3', 'Fischöl', 'Fish oil', 'EPA/DHA']::text[], 'supplement', array['capsule']::text[], array['mg', 'g']::text[], null),
    ('Creatin', array['Kreatin', 'Creatine', 'Creatin-Monohydrat']::text[], 'supplement', array['powder', 'capsule', 'tablet']::text[], array['g', 'mg']::text[], null),
    ('Metformin', array['Metformin HCl', 'Glucophage']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Metformin'),
    ('Melatonin', '{}'::text[], 'supplement', array['tablet', 'capsule', 'drops', 'spray']::text[], array['mg', 'mcg']::text[], 'Melatonin'),
    ('Vitamin C', array['Ascorbinsäure', 'Ascorbic acid']::text[], 'vitamin', array['capsule', 'tablet', 'powder']::text[], array['mg', 'g']::text[], null),
    ('Vitamin A', array['Retinol', 'Retinylpalmitat']::text[], 'vitamin', array['capsule', 'drops']::text[], array['IU', 'mcg']::text[], null),
    ('Vitamin E', array['Tocopherol', 'Alpha-Tocopherol']::text[], 'vitamin', array['capsule', 'drops']::text[], array['IU', 'mg']::text[], null),
    ('Vitamin B1', array['Thiamin', 'Benfotiamin']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Vitamin B2', array['Riboflavin']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Vitamin B3', array['Niacin', 'Nicotinamid', 'Nicotinsäure']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Vitamin B5', array['Pantothensäure', 'Calcium-Pantothenat']::text[], 'vitamin', array['capsule', 'tablet']::text[], array['mg']::text[], null),
    ('Vitamin B6', array['Pyridoxin', 'P5P', 'Pyridoxal-5-Phosphat']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Vitamin B7', array['Biotin', 'Vitamin H']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mcg', 'mg']::text[], null),
    ('Folsäure', array['Vitamin B9', 'Folat', 'Methylfolat', '5-MTHF']::text[], 'vitamin', array['tablet', 'capsule']::text[], array['mcg']::text[], null),
    ('Vitamin B12', array['Cobalamin', 'Methylcobalamin', 'Hydroxocobalamin', 'Cyanocobalamin']::text[], 'vitamin', array['tablet', 'capsule', 'drops', 'spray']::text[], array['mcg']::text[], null),
    ('Vitamin B-Komplex', array['B-Komplex', 'Vitamin B Complex']::text[], 'vitamin', array['capsule', 'tablet']::text[], array['mg', 'mcg']::text[], null),
    ('Zink', array['Zinc', 'Zinkgluconat', 'Zinkbisglycinat', 'Zinkpicolinat']::text[], 'supplement', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Eisen', array['Ferrum', 'Iron', 'Eisenbisglycinat', 'Eisensulfat']::text[], 'supplement', array['tablet', 'capsule', 'drops']::text[], array['mg']::text[], null),
    ('Calcium', array['Kalzium', 'Calciumcitrat', 'Calciumcarbonat']::text[], 'supplement', array['tablet', 'capsule', 'powder']::text[], array['mg']::text[], null),
    ('Kalium', array['Potassium', 'Kaliumcitrat']::text[], 'supplement', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Selen', array['Selenium', 'Natriumselenit', 'Selenomethionin']::text[], 'supplement', array['tablet', 'capsule']::text[], array['mcg']::text[], null),
    ('Jod', array['Iod', 'Iodine', 'Kaliumiodid']::text[], 'supplement', array['tablet', 'capsule', 'drops']::text[], array['mcg']::text[], null),
    ('Kupfer', array['Copper', 'Kupferbisglycinat']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg', 'mcg']::text[], null),
    ('Mangan', array['Manganese']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], null),
    ('Chrom', array['Chromium', 'Chrompicolinat']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mcg']::text[], null),
    ('Molybdän', array['Molybdenum']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mcg']::text[], null),
    ('Koffein', array['Caffeine', 'Coffein']::text[], 'supplement', array['tablet', 'capsule']::text[], array['mg']::text[], 'Koffein'),
    ('L-Theanin', array['Theanin', 'L-Theanine']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg']::text[], 'L-Theanin'),
    ('L-Citrullin', array['Citrullin', 'Citrullin-Malat', 'L-Citrulline']::text[], 'supplement', array['powder', 'capsule']::text[], array['g', 'mg']::text[], null),
    ('L-Arginin', array['Arginin', 'L-Arginine', 'AAKG']::text[], 'supplement', array['capsule', 'powder', 'tablet']::text[], array['mg', 'g']::text[], null),
    ('Beta-Alanin', array['Beta Alanine', 'β-Alanin']::text[], 'supplement', array['powder', 'capsule']::text[], array['g', 'mg']::text[], null),
    ('Taurin', array['Taurine']::text[], 'supplement', array['powder', 'capsule']::text[], array['mg', 'g']::text[], null),
    ('L-Carnitin', array['Carnitin', 'Acetyl-L-Carnitin', 'ALCAR']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg', 'g']::text[], null),
    ('Glycin', array['Glycine']::text[], 'supplement', array['powder', 'capsule']::text[], array['g', 'mg']::text[], null),
    ('NAC', array['N-Acetyl-Cystein', 'N-Acetylcystein', 'Acetylcystein']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], 'NAC'),
    ('Whey Protein', array['Molkenprotein', 'Whey', 'Proteinpulver']::text[], 'supplement', array['powder']::text[], array['g']::text[], null),
    ('Kollagen', array['Collagen', 'Kollagenpeptide', 'Collagen peptides']::text[], 'supplement', array['powder', 'capsule']::text[], array['g', 'mg']::text[], null),
    ('Inositol', array['Myo-Inositol']::text[], 'supplement', array['powder', 'capsule']::text[], array['g', 'mg']::text[], null),
    ('Ashwagandha', array['Withania somnifera', 'KSM-66', 'Schlafbeere']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg']::text[], null),
    ('Kurkuma', array['Curcumin', 'Turmeric', 'Kurkumaextrakt']::text[], 'supplement', array['capsule', 'tablet', 'powder']::text[], array['mg']::text[], null),
    ('Rhodiola rosea', array['Rosenwurz', 'Rhodiola']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], null),
    ('Ginkgo biloba', array['Ginkgo']::text[], 'supplement', array['tablet', 'capsule']::text[], array['mg']::text[], null),
    ('Mariendistel', array['Silymarin', 'Silybum marianum']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], null),
    ('Baldrian', array['Valeriana', 'Valerian']::text[], 'supplement', array['tablet', 'capsule', 'drops']::text[], array['mg']::text[], null),
    ('5-HTP', array['5-Hydroxytryptophan', 'Griffonia']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], '5-HTP'),
    ('Coenzym Q10', array['CoQ10', 'Ubiquinol', 'Ubichinon']::text[], 'supplement', array['capsule']::text[], array['mg']::text[], 'Coenzym Q10'),
    ('Alpha-Liponsäure', array['ALA', 'Alpha Lipoic Acid', 'Liponsäure']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], null),
    ('Resveratrol', array['Trans-Resveratrol']::text[], 'supplement', array['capsule']::text[], array['mg']::text[], null),
    ('Berberin', array['Berberine', 'Berberin-HCl']::text[], 'supplement', array['capsule', 'tablet']::text[], array['mg']::text[], 'Berberin'),
    ('Spermidin', array['Spermidine']::text[], 'supplement', array['capsule']::text[], array['mg']::text[], null),
    ('NMN', array['Nicotinamid-Mononukleotid', 'Nicotinamide Mononucleotide']::text[], 'supplement', array['capsule', 'powder']::text[], array['mg']::text[], null),
    ('NR', array['Nicotinamid-Ribosid', 'Nicotinamide Riboside', 'Niagen']::text[], 'supplement', array['capsule']::text[], array['mg']::text[], null),
    ('Ibuprofen', array['Nurofen']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Ibuprofen'),
    ('Paracetamol', array['Acetaminophen', 'Ben-u-ron']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Paracetamol'),
    ('Acetylsalicylsäure', array['ASS', 'Aspirin']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Acetylsalicylsäure'),
    ('Pantoprazol', array['Pantoprazole', 'Pantozol']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Pantoprazol'),
    ('Omeprazol', array['Omeprazole']::text[], 'medication', array['capsule', 'tablet']::text[], array['mg']::text[], 'Omeprazol'),
    ('Atorvastatin', array['Sortis']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Atorvastatin'),
    ('Rosuvastatin', array['Crestor']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Rosuvastatin'),
    ('Simvastatin', array['Zocor']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Simvastatin'),
    ('Ramipril', array['Delix']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Ramipril'),
    ('Bisoprolol', array['Concor']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Bisoprolol'),
    ('Metoprolol', array['Beloc']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Metoprolol'),
    ('Amlodipin', array['Amlodipine', 'Norvasc']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Amlodipin'),
    ('Candesartan', array['Blopress']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Candesartan'),
    ('Sertralin', array['Sertraline', 'Zoloft']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Sertralin'),
    ('Escitalopram', array['Cipralex']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Escitalopram'),
    ('Venlafaxin', array['Venlafaxine', 'Trevilor']::text[], 'medication', array['capsule', 'tablet']::text[], array['mg']::text[], 'Venlafaxin'),
    ('Bupropion', array['Elontril', 'Wellbutrin']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Bupropion'),
    ('Methylphenidat', array['Methylphenidate', 'Ritalin', 'Medikinet', 'Concerta']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Methylphenidat'),
    ('Lisdexamfetamin', array['Lisdexamfetamine', 'Elvanse', 'Vyvanse']::text[], 'medication', array['capsule']::text[], array['mg']::text[], 'Lisdexamfetamin'),
    ('Modafinil', array['Vigil', 'Provigil']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Modafinil'),
    ('Finasterid', array['Finasteride', 'Propecia']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Finasterid'),
    ('Dutasterid', array['Dutasteride', 'Avodart']::text[], 'medication', array['capsule']::text[], array['mg']::text[], 'Dutasterid'),
    ('Tadalafil', array['Cialis']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Tadalafil'),
    ('Sildenafil', array['Viagra']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Sildenafil'),
    ('Anastrozol', array['Anastrozole', 'Arimidex']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Anastrozol'),
    ('Tamoxifen', array['Nolvadex']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Tamoxifen'),
    ('Enclomifen', array['Enclomiphene', 'Enclomifencitrat']::text[], 'medication', array['capsule', 'tablet']::text[], array['mg']::text[], 'Enclomifen'),
    ('Levothyroxin', array['Levothyroxine', 'L-Thyroxin', 'Euthyrox', 'T4']::text[], 'medication', array['tablet']::text[], array['mcg']::text[], 'Levothyroxin'),
    ('Liothyronin', array['Liothyronine', 'T3', 'Thybon']::text[], 'medication', array['tablet']::text[], array['mcg']::text[], 'Liothyronin'),
    ('Allopurinol', array['Zyloric']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Allopurinol'),
    ('Cetirizin', array['Cetirizine', 'Zyrtec']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Cetirizin'),
    ('Loratadin', array['Loratadine', 'Lorano']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Loratadin'),
    ('Prednisolon', array['Prednisolone', 'Decortin H']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Prednisolon'),
    ('Amoxicillin', array['Amoxi']::text[], 'medication', array['capsule', 'tablet']::text[], array['mg']::text[], 'Amoxicillin'),
    ('Dapagliflozin', array['Forxiga', 'Farxiga']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Dapagliflozin'),
    ('Empagliflozin', array['Jardiance']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Empagliflozin'),
    ('Naltrexon', array['Naltrexone', 'LDN', 'Low Dose Naltrexone']::text[], 'medication', array['tablet', 'capsule']::text[], array['mg']::text[], 'Naltrexon'),
    ('Rapamycin', array['Sirolimus', 'Rapamune']::text[], 'medication', array['tablet']::text[], array['mg']::text[], 'Rapamycin'),
    ('DHEA', array['Dehydroepiandrosteron', 'Prasteron']::text[], 'hormone', array['capsule', 'tablet']::text[], array['mg']::text[], 'DHEA'),
    ('Pregnenolon', array['Pregnenolone']::text[], 'hormone', array['capsule', 'tablet']::text[], array['mg']::text[], 'Pregnenolon'),
    ('Östradiol', array['Estradiol', 'Oestradiol', 'Estrogel']::text[], 'hormone', array['tablet', 'gel', 'patch']::text[], array['mg', 'mcg']::text[], 'Östradiol'),
    ('Progesteron', array['Progesterone', 'Utrogest']::text[], 'hormone', array['capsule', 'tablet']::text[], array['mg']::text[], 'Progesteron')
),
aufgeloest as (
  select
    quelle.canonical_name,
    quelle.aliases,
    quelle.default_category,
    quelle.suggested_dosage_forms,
    quelle.suggested_units,
    -- Das PK-Profil wird ueber Name ODER Alias gesucht, wie schon im
    -- Foundation-Seed: der Katalog schreibt "Semaglutid", das Profil
    -- "Semaglutide".
    (
      select profil.id
      from public.pk_profiles profil
      where quelle.pk_profile_name is not null
        and (
          lower(profil.name) = lower(quelle.pk_profile_name)
          or exists (
            select 1
            from unnest(profil.aliases) profil_alias
            where lower(profil_alias) = lower(quelle.pk_profile_name)
          )
        )
      order by (lower(profil.name) = lower(quelle.pk_profile_name)) desc, profil.id
      limit 1
    ) as pk_profile_id
  from quelle
)
insert into public.substance_catalog as ziel (
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  active
)
select
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  true
from aufgeloest
on conflict (lower(canonical_name)) do update set
  aliases = excluded.aliases,
  default_category = excluded.default_category,
  suggested_dosage_forms = excluded.suggested_dosage_forms,
  suggested_units = excluded.suggested_units,
  -- Eine bestehende Verknuepfung wird nicht geloescht, nur ergaenzt: steht in
  -- der Quelle kein Profil, bleibt das gefundene stehen.
  pk_profile_id = coalesce(excluded.pk_profile_id, ziel.pk_profile_id),
  active = true,
  updated_at = now();

commit;
