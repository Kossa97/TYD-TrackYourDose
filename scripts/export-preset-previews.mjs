
import { writeFileSync, mkdirSync } from 'fs'
import { buildProtocolPdf } from '../src/lib/protocolPdf/renderProtocolPdf.ts'
import { applyPreset } from '../src/lib/protocolPdf/presets.ts'

const data = {
  profile: { display_name: 'Max Muster', username: 'max', age: 32, gender: 'männlich', height_cm: 182, weight_kg: 84 },
  cycles: [{ id:'c1', name:'Zyklus', stack_item_name:'BPC-157', dose:250, unit:'mcg', method:'SC', frequency:'Täglich', start_date:'2026-01-01', end_date:null, active:true }],
  doseLogs: [
    { stack_item_id:'p1', logged_at:'2026-06-01T08:00:00Z', taken:true },
    { stack_item_id:'p1', logged_at:'2026-06-02T08:00:00Z', taken:false },
    { stack_item_id:'p1', logged_at:'2026-06-03T08:00:00Z', taken:true },
  ],
  weightLogs: [
    { logged_at:'2026-06-01T08:00:00Z', weight_kg:84 },
    { logged_at:'2026-06-15T08:00:00Z', weight_kg:82.5 },
    { logged_at:'2026-06-29T08:00:00Z', weight_kg:81.2 },
  ],
  bloodwork: [
    { tested_at:'2026-06-01', marker:'IGF-1', value:180, unit:'ng/ml' },
    { tested_at:'2026-06-28', marker:'IGF-1', value:240, unit:'ng/ml' },
  ],
  effects: [{ type:'effect', description:'Bessere Regeneration', severity:4, stack_item_name:'BPC-157', occurred_at:'2026-06-10T08:00:00Z' }],
  reviews: [{ stack_item_name:'BPC-157', rating:5, experience:'gut' }],
  dailyLogs: [
    { log_date:'2026-06-01', energie:6, schlaf:7, libido:5 },
    { log_date:'2026-06-15', energie:8, schlaf:8, libido:7 },
  ],
  stackItemNames: new Map([['p1','BPC-157']]),
}
const range = { from:'2026-06-01', to:'2026-06-30' }
mkdirSync('public/pdf-preview', { recursive: true })
mkdirSync('/opt/cursor/artifacts/pdf-preview', { recursive: true })
for (const preset of ['arzt','coach','forum']) {
  const sections = applyPreset(preset, data)
  const doc = await buildProtocolPdf(data, { lang:'de', range, sections, note: preset==='forum'?'': 'Frage zur Anpassung', preset })
  const buf = Buffer.from(doc.output('arraybuffer'))
  const name = `TYD-${preset}-demo.pdf`
  writeFileSync(`public/pdf-preview/${name}`, buf)
  writeFileSync(`/opt/cursor/artifacts/pdf-preview/${name}`, buf)
  console.log(preset, buf.length)
}
