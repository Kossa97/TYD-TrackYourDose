/**
 * Einmaliger Upsert aller PK-Profile in Supabase (pk_profiles).
 * Voraussetzung: supabase-pk-profiles.sql im SQL Editor ausgeführt.
 *
 *   npm run seed:pk
 *
 * HINWEIS: Seit der RLS-Härtung (supabase-rls-hardening.sql) dürfen nur Admins
 * schreiben. Dieses Skript nutzt den Anon-Key und schlägt daher fehl, wenn die
 * Härtung aktiv ist. In dem Fall stattdessen die SQL-Dateien im Supabase SQL
 * Editor ausführen (dort greift RLS nicht):
 *   - supabase-pk-profiles.sql              (Vollbestand, frische Installation)
 *   - supabase-pk-profiles-2026-update.sql  (nur Gruppen A+B+C, inkrementell)
 *
 * Feldkonvention:
 *   half_life_hours    = Eliminations-Halbwertszeit
 *   tmax_hours         = Zeit bis Peak-Plasmaspiegel
 *   bioavailability_sc = Peak-Skalierung (1.0 = injizierbar/voll; <1 = oral)
 *   notes              = Datenquelle + Belastbarkeit
 */
import { supabase } from '../src/lib/supabase';

interface PkSeed {
  name: string;
  aliases: string[];
  half_life_hours: number;
  tmax_hours: number;
  category: 'glp1' | 'peptide' | 'hormone' | 'sarm' | 'other';
  bioavailability_sc?: number;
  notes?: string;
}

const PK_PROFILES: PkSeed[] = [
  // ── GLP-1 / Metabolic ─────────────────────────────────────────────────────
  { name: 'Semaglutide', aliases: ['Ozempic', 'Wegovy'], half_life_hours: 168, tmax_hours: 24, category: 'glp1' },
  { name: 'Tirzepatide', aliases: ['Mounjaro', 'Zepbound'], half_life_hours: 120, tmax_hours: 8, category: 'glp1' },
  { name: 'Liraglutide', aliases: ['Victoza', 'Saxenda'], half_life_hours: 13, tmax_hours: 8, category: 'glp1' },
  { name: 'Exenatide', aliases: ['Byetta'], half_life_hours: 2.4, tmax_hours: 2, category: 'glp1' },
  { name: 'Retatrutide', aliases: ['LY3437943', 'Reta', 'Triple-G'], half_life_hours: 156, tmax_hours: 48, category: 'glp1',
    notes: 'HWZ ~144–165 h, tmax 24–72 h; wöchentlich SC. GIP/GLP-1/Glucagon-Triagonist. Quelle: Nature Medicine 2024 (Phase 2, Lilly).' },
  { name: 'Cagrilintide', aliases: ['AM833', 'NN9838', 'Cagri'], half_life_hours: 175, tmax_hours: 48, category: 'glp1',
    notes: 'HWZ ~7,3 Tage; wöchentlich SC. Langwirksames Amylin-Analogon (CagriSema). Quelle: Lancet 2021 (Phase 1b, Novo Nordisk).' },
  { name: 'Survodutide', aliases: ['BI 456906'], half_life_hours: 144, tmax_hours: 72, category: 'glp1',
    notes: 'HWZ ~6 Tage, Peak 60–96 h; wöchentlich SC. GCGR/GLP-1-Dualagonist. Quelle: J Hepatology 2024 (Boehringer Ingelheim).' },
  { name: 'Mazdutide', aliases: ['IBI362', 'LY3305677'], half_life_hours: 175, tmax_hours: 72, category: 'glp1',
    notes: 'HWZ ~7–8 Tage, tmax ~72 h; wöchentlich SC. GLP-1/Glucagon-Dualagonist. Quelle: Diabetes Obes Metab 2025 (Innovent/Lilly).' },
  { name: 'Orforglipron', aliases: ['LY3502970'], half_life_hours: 48, tmax_hours: 6, category: 'glp1', bioavailability_sc: 0.35,
    notes: 'Orales nicht-Peptid GLP-1; HWZ ~48 h (Steady-State), tmax 4–8 h, orale BV ~30–40 %. Quelle: Diabetes Obes Metab 2023 / NEJM 2023.' },

  // ── Research-Peptide ──────────────────────────────────────────────────────
  { name: 'BPC-157', aliases: ['Body Protection Compound'], half_life_hours: 4, tmax_hours: 0.5, category: 'peptide' },
  { name: 'TB-500', aliases: ['Thymosin Beta-4'], half_life_hours: 72, tmax_hours: 2, category: 'peptide' },
  { name: 'GHK-Cu', aliases: ['Copper Peptide'], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'KPV', aliases: [], half_life_hours: 2, tmax_hours: 0.5, category: 'peptide' },
  { name: 'CJC-1295 DAC', aliases: ['CJC-1295 with DAC'], half_life_hours: 192, tmax_hours: 2, category: 'peptide' },
  { name: 'CJC-1295 no DAC', aliases: ['Modified GRF 1-29'], half_life_hours: 0.5, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Ipamorelin', aliases: [], half_life_hours: 2, tmax_hours: 0.25, category: 'peptide' },
  { name: 'GHRP-2', aliases: ['Pralmorelin'], half_life_hours: 1, tmax_hours: 0.25, category: 'peptide' },
  { name: 'GHRP-6', aliases: [], half_life_hours: 2, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Hexarelin', aliases: ['Examorelin'], half_life_hours: 1.3, tmax_hours: 0.3, category: 'peptide',
    notes: 'Terminale HWZ ~76 min (Ratte) / ~120 min (Hund); GH-Effekt 3–4 h. Quelle: Drug Metab Dispos.' },
  { name: 'Sermorelin', aliases: [], half_life_hours: 0.17, tmax_hours: 0.17, category: 'peptide' },
  { name: 'Tesamorelin', aliases: ['Egrifta'], half_life_hours: 0.3, tmax_hours: 0.25, category: 'peptide',
    notes: 'HWZ 8–11 min Einzeldosis, 26–38 min Steady-State (14 Tage SC). Quelle: FDA-Label Egrifta.' },
  { name: 'MK-677', aliases: ['Ibutamoren', 'Nutrobal'], half_life_hours: 6, tmax_hours: 1, category: 'peptide' },
  { name: 'MOTS-c', aliases: ['Mitochondrial ORF 12S rRNA-c'], half_life_hours: 0.75, tmax_hours: 0.5, category: 'peptide',
    notes: 'Plasma-HWZ ~30–60 min (SC). Humane PK begrenzt — Schätzung aus Sekundärliteratur.' },
  { name: 'AOD-9604', aliases: ['AOD9604', 'hGH 176-191 (Tyr)'], half_life_hours: 0.3, tmax_hours: 0.4, category: 'peptide',
    notes: 'Plasma-HWZ ~4 min (IV, Metabolic Pharmaceuticals), SC-Peak 30–60 min. Sehr kurze HWZ.' },
  { name: 'HGH Fragment 176-191', aliases: ['HGH Frag', 'Frag 176-191', 'Fragment 176-191'], half_life_hours: 0.4, tmax_hours: 0.4, category: 'peptide',
    notes: 'HWZ ~15–30 min; humane Daten begrenzt, aus AOD-9604 extrapoliert. Schätzung.' },
  { name: 'Thymosin Alpha-1', aliases: ['Tα1', 'Ta1', 'Thymalfasin', 'Zadaxin'], half_life_hours: 2, tmax_hours: 0.5, category: 'peptide',
    notes: 'Plasma-HWZ ~2 h. Quelle: PK-Studien Thymalfasin (Zadaxin, in mehreren Ländern zugelassen).' },
  { name: 'DSIP', aliases: ['Delta Sleep-Inducing Peptide'], half_life_hours: 0.35, tmax_hours: 0.3, category: 'peptide',
    notes: 'Plasma-HWZ ~15–25 min (Aminopeptidase-Spaltung). Schätzung aus Degradationsstudien.' },
  { name: 'Kisspeptin-10', aliases: ['KP-10', 'Metastin 45-54'], half_life_hours: 0.07, tmax_hours: 0.1, category: 'peptide',
    notes: 'Plasma-HWZ ~3,8 min (Männer). Sehr kurze HWZ. Quelle: JCEM 2011 (Jayasena et al.).' },
  { name: 'Semax', aliases: [], half_life_hours: 0.5, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Selank', aliases: [], half_life_hours: 1, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Dihexa', aliases: [], half_life_hours: 24, tmax_hours: 2, category: 'peptide' },
  { name: 'Cerebrolysin', aliases: [], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'NA-Semax Amidate', aliases: [], half_life_hours: 0.75, tmax_hours: 0.25, category: 'peptide' },
  { name: 'PT-141', aliases: ['Bremelanotide'], half_life_hours: 2.7, tmax_hours: 1, category: 'peptide' },
  { name: 'Melanotan II', aliases: ['MT-2', 'MT-II'], half_life_hours: 1.0, tmax_hours: 1.25, category: 'peptide',
    notes: 'HWZ ~33 min (bi-exponentiell), Peak 60–90 min. Quelle: humane MT-II-PK-Studien.' },
  { name: 'Epithalon', aliases: ['Epitalon'], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'SS-31', aliases: ['Elamipretide'], half_life_hours: 2, tmax_hours: 0.5, category: 'peptide' },
  { name: 'Humanin', aliases: [], half_life_hours: 3, tmax_hours: 1, category: 'peptide' },

  // ── Hormone ───────────────────────────────────────────────────────────────
  { name: 'Testosterone Enanthate', aliases: ['Test E'], half_life_hours: 110, tmax_hours: 48, category: 'hormone',
    notes: 'Eliminations-HWZ ~4,5 Tage (IM-Depot). Quelle: PK-Literatur Testosteron-Ester.' },
  { name: 'Testosterone Cypionate', aliases: ['Test C'], half_life_hours: 192, tmax_hours: 48, category: 'hormone',
    notes: 'HWZ ~8 Tage (IM-Depot). Quelle: FDA-Label Testosteron-Cypionat.' },
  { name: 'Testosterone Propionate', aliases: ['Test P'], half_life_hours: 20, tmax_hours: 12, category: 'hormone' },
  { name: 'HCG', aliases: ['Human Chorionic Gonadotropin'], half_life_hours: 36, tmax_hours: 6, category: 'hormone' },
  { name: 'IGF-1 LR3', aliases: ['Long R3 IGF-1'], half_life_hours: 20, tmax_hours: 2, category: 'hormone' },
  { name: 'HGH', aliases: ['Somatropin', 'Human Growth Hormone'], half_life_hours: 3.8, tmax_hours: 3, category: 'hormone' },
];

async function main() {
  const rows = PK_PROFILES.map((p) => ({
    name: p.name,
    aliases: p.aliases,
    half_life_hours: p.half_life_hours,
    tmax_hours: p.tmax_hours,
    category: p.category,
    bioavailability_sc: p.bioavailability_sc ?? 1.0,
    vd_l_kg: 0.3,
    notes: p.notes ?? null,
  }));

  const { error } = await supabase
    .from('pk_profiles')
    .upsert(rows, { onConflict: 'name' });

  if (error) {
    console.error('PK-Seed fehlgeschlagen:', error.message);
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.error('→ Bitte zuerst supabase-pk-profiles.sql im Supabase SQL Editor ausführen.');
    }
    if (error.message.includes('row-level security')) {
      console.error('→ RLS blockiert Insert. Seit der RLS-Härtung dürfen nur Admins schreiben —');
      console.error('  stattdessen supabase-pk-profiles.sql bzw. supabase-pk-profiles-2026-update.sql im SQL Editor ausführen.');
    }
    process.exit(1);
  }

  console.log(`✅ ${rows.length} PK-Profile eingefügt/aktualisiert`);
}

main();
