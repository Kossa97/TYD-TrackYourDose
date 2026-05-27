/**
 * Einmaliger Upsert aller PK-Profile in Supabase (pk_profiles).
 * Voraussetzung: supabase-pk-profiles.sql im SQL Editor ausgeführt.
 *
 *   npm run seed:pk
 */
import { supabase } from '../src/lib/supabase';

const PK_PROFILES = [
  { name: 'Semaglutide', aliases: ['Ozempic', 'Wegovy'], half_life_hours: 168, tmax_hours: 24, category: 'glp1' },
  { name: 'Tirzepatide', aliases: ['Mounjaro', 'Zepbound'], half_life_hours: 120, tmax_hours: 8, category: 'glp1' },
  { name: 'Liraglutide', aliases: ['Victoza', 'Saxenda'], half_life_hours: 13, tmax_hours: 8, category: 'glp1' },
  { name: 'Exenatide', aliases: ['Byetta'], half_life_hours: 2.4, tmax_hours: 2, category: 'glp1' },
  { name: 'BPC-157', aliases: ['Body Protection Compound'], half_life_hours: 4, tmax_hours: 0.5, category: 'peptide' },
  { name: 'TB-500', aliases: ['Thymosin Beta-4'], half_life_hours: 72, tmax_hours: 2, category: 'peptide' },
  { name: 'GHK-Cu', aliases: ['Copper Peptide'], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'KPV', aliases: [], half_life_hours: 2, tmax_hours: 0.5, category: 'peptide' },
  { name: 'CJC-1295 DAC', aliases: ['CJC-1295 with DAC'], half_life_hours: 192, tmax_hours: 2, category: 'peptide' },
  { name: 'CJC-1295 no DAC', aliases: ['Modified GRF 1-29'], half_life_hours: 0.5, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Ipamorelin', aliases: [], half_life_hours: 2, tmax_hours: 0.25, category: 'peptide' },
  { name: 'GHRP-2', aliases: ['Pralmorelin'], half_life_hours: 1, tmax_hours: 0.25, category: 'peptide' },
  { name: 'GHRP-6', aliases: [], half_life_hours: 2, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Sermorelin', aliases: [], half_life_hours: 0.17, tmax_hours: 0.17, category: 'peptide' },
  { name: 'Tesamorelin', aliases: ['Egrifta'], half_life_hours: 0.1, tmax_hours: 0.1, category: 'peptide' },
  { name: 'MK-677', aliases: ['Ibutamoren', 'Nutrobal'], half_life_hours: 6, tmax_hours: 1, category: 'peptide' },
  { name: 'Semax', aliases: [], half_life_hours: 0.5, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Selank', aliases: [], half_life_hours: 1, tmax_hours: 0.25, category: 'peptide' },
  { name: 'Dihexa', aliases: [], half_life_hours: 24, tmax_hours: 2, category: 'peptide' },
  { name: 'Cerebrolysin', aliases: [], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'NA-Semax Amidate', aliases: [], half_life_hours: 0.75, tmax_hours: 0.25, category: 'peptide' },
  { name: 'PT-141', aliases: ['Bremelanotide'], half_life_hours: 2.7, tmax_hours: 1, category: 'peptide' },
  { name: 'Melanotan II', aliases: ['MT-2'], half_life_hours: 24, tmax_hours: 1, category: 'peptide' },
  { name: 'Epithalon', aliases: ['Epitalon'], half_life_hours: 1, tmax_hours: 0.5, category: 'peptide' },
  { name: 'SS-31', aliases: ['Elamipretide'], half_life_hours: 2, tmax_hours: 0.5, category: 'peptide' },
  { name: 'Humanin', aliases: [], half_life_hours: 3, tmax_hours: 1, category: 'peptide' },
  { name: 'Testosterone Enanthate', aliases: ['Test E'], half_life_hours: 192, tmax_hours: 48, category: 'hormone' },
  { name: 'Testosterone Cypionate', aliases: ['Test C'], half_life_hours: 192, tmax_hours: 48, category: 'hormone' },
  { name: 'Testosterone Propionate', aliases: ['Test P'], half_life_hours: 20, tmax_hours: 12, category: 'hormone' },
  { name: 'HCG', aliases: ['Human Chorionic Gonadotropin'], half_life_hours: 36, tmax_hours: 6, category: 'hormone' },
  { name: 'IGF-1 LR3', aliases: ['Long R3 IGF-1'], half_life_hours: 20, tmax_hours: 2, category: 'hormone' },
  { name: 'HGH', aliases: ['Somatropin', 'Human Growth Hormone'], half_life_hours: 3.8, tmax_hours: 3, category: 'hormone' },
] as const;

async function main() {
  const rows = PK_PROFILES.map((p) => ({
    ...p,
    bioavailability_sc: 1.0,
    vd_l_kg: 0.3,
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
      console.error('→ RLS blockiert Insert: supabase-pk-profiles.sql im SQL Editor ausführen (Policies + Seed).');
    }
    process.exit(1);
  }

  console.log('✅ PK-Profile eingefügt');
}

main();
