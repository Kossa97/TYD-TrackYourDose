import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Pencil, FlaskConical, Calculator,
  CalendarDays, ChevronDown, ChevronUp,
  TrendingUp, Search, Bell, Check,
  Package, FileUp, Droplets, X, FileText, ExternalLink,
} from 'lucide-react'
import { format, parseISO, addDays, differenceInDays } from 'date-fns'

// ─── Typen ───────────────────────────────────────────────────────────────────
interface Peptide {
  id: string; name: string; default_unit: string
  default_dose: number | null; default_method: string
  vial_amount_mg: number | null; reconstitution_ml: number | null
  syringe_type: string | null; notes: string | null
  // Vorrat & Haltbarkeit
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
  // Batch
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
}

interface Cycle {
  id: string; peptide_id: string; name: string
  dose: number; unit: string; method: string
  frequency: string; x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string; end_date: string | null; active: boolean
  intake_time: string | null; intake_time_custom: string | null
  reminder: string | null
}

interface Escalation {
  id: string; cycle_id: string
  increase_amount: number; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null; start_after_days: number | null
  notes: string | null
}

interface EscalationForm {
  increase_amount: string; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string; start_after_days: string; notes: string
}
const emptyEscalationForm = (unit: string): EscalationForm => ({
  increase_amount: '', unit,
  start_type: 'after_weeks', start_date: format(new Date(), 'yyyy-MM-dd'),
  start_after_days: '2', notes: '',
})

// ─── Konstanten ──────────────────────────────────────────────────────────────
const POPULAR_PEPTIDES = [
  'BPC-157','TB-500','Ipamorelin','CJC-1295','GHK-Cu','Epitalon',
  'Selank','Semax','PT-141','Retatrutide','Semaglutid','Tirzepatid',
  'IGF-1 LR3','GHRP-2','GHRP-6','Sermorelin','AOD 9604',
  'Thymosin Alpha-1','LL-37','Hexarelin','MGF',
]
const UNITS   = ['mcg','mg','IU','ml','nmol']
const METHODS = ['Subkutan','Intramuskulär','Nasal','Oral','Transdermal','Intravenös','Andere']
const WOCHENTAGE = ['Mo','Di','Mi','Do','Fr','Sa','So']
const EXPIRY_PRESETS = [10, 14, 21, 28, 42, 90]

const BASE_FREQUENCIES = [
  'Täglich','2x täglich','Jeden 2. Tag',
  '5 Tage an / 2 aus','Mo-Fr','Wöchentlich',
  'Alle X Tage','Wochentage wählen',
]

const INTAKE_TIME_CONFIG = {
  morgens: { label: 'Morgens', emoji: '🌅', time: '08:00' },
  mittags: { label: 'Mittags', emoji: '☀️',  time: '12:00' },
  abends:  { label: 'Abends',  emoji: '🌙', time: '20:00' },
  custom:  { label: 'Uhrzeit', emoji: '🕐', time: '' },
} as const

const REMINDER_OPTIONS = [
  { value: '1day',    label: '1 Tag vorher' },
  { value: '2h',      label: '2 Std vorher' },
  { value: 'on_time', label: 'Bei Einnahme' },
]

// ─── Dosierungsrechner ───────────────────────────────────────────────────────
function calcDosage(vialMgStr: string, reconMlStr: string, doseStr: string, unit: string, syringeMlStr: string, syringeUnitsStr: string) {
  const vialMg = parseFloat(vialMgStr), reconMl = parseFloat(reconMlStr), dose = parseFloat(doseStr)
  if (!vialMg || !reconMl || !dose) return null
  const syringeMl    = parseFloat(syringeMlStr)    || 1
  const syringeUnits = parseFloat(syringeUnitsStr) || 100
  const unitsPerMl   = syringeUnits / syringeMl
  const doseInMcg    = unit === 'mg' ? dose * 1000 : dose
  const concMcgPerMl = (vialMg * 1000) / reconMl
  const doseMl       = doseInMcg / concMcgPerMl
  return {
    concMgPerMl: (vialMg / reconMl).toFixed(2),
    doseMl: doseMl.toFixed(3),
    units: (doseMl * unitsPerMl).toFixed(1),
    syringeMl, syringeUnits, unitsPerMl: unitsPerMl.toFixed(1),
  }
}

// ─── Formular-Typen ───────────────────────────────────────────────────────────
interface PeptideForm {
  name: string; default_unit: string; default_dose: string; default_method: string
  vial_amount_mg: string; reconstitution_ml: string
  syringe_ml: string; syringe_units: string
  notes: string
  vials_in_stock: string
  reconstitution_date: string; expiry_days: string
  batch_number: string; batch_source: string; batch_file_url: string
}
const emptyPeptideForm = (): PeptideForm => ({
  name:'', default_unit:'mcg', default_dose:'', default_method:'Subkutan',
  vial_amount_mg:'', reconstitution_ml:'2',
  syringe_ml:'1', syringe_units:'100',
  notes:'',
  vials_in_stock:'0',
  reconstitution_date:'', expiry_days:'28',
  batch_number:'', batch_source:'', batch_file_url:'',
})

interface CycleForm {
  name: string; dose: string; unit: string; method: string
  frequency: string; x_days_interval: string; schedule_days: string[]
  start_date: string; end_date: string
  intake_time: string; intake_time_custom: string; reminder: string[]
}
const emptyCycleForm = (p: Peptide): CycleForm => ({
  name: p.name + ' Zyklus',
  dose: p.default_dose?.toString() ?? '', unit: p.default_unit,
  method: p.default_method, frequency: 'Täglich',
  x_days_interval: '3', schedule_days: [],
  start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '',
  intake_time: '', intake_time_custom: '', reminder: [],
})

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function Peptide() {
  const { user } = useAuth()
  const [peptides, setPeptides]     = useState<Peptide[]>([])
  const [cycles, setCycles]         = useState<Cycle[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showPeptideForm, setShowPeptideForm]   = useState(false)
  const [editingPeptideId, setEditingPeptideId] = useState<string | null>(null)
  const [pForm, setPForm]       = useState<PeptideForm>(emptyPeptideForm())
  const [showDropdown, setShowDropdown] = useState(false)
  const [savingPeptide, setSavingPeptide] = useState(false)
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [infoPeptide, setInfoPeptide] = useState<Peptide | null>(null)

  const [showCycleForm, setShowCycleForm]     = useState(false)
  const [cycleForPeptide, setCycleForPeptide] = useState<Peptide | null>(null)
  const [editingCycleId, setEditingCycleId]   = useState<string | null>(null)
  const [cForm, setCForm] = useState<CycleForm | null>(null)
  const [savingCycle, setSavingCycle] = useState(false)

  // Suche + Sortierung
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState<'name_asc' | 'name_desc'>('name_asc')

  // Dosiserhöhungen
  const [escalations, setEscalations]               = useState<Escalation[]>([])
  const [showEscForm, setShowEscForm]               = useState(false)
  const [escForCycle, setEscForCycle]               = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]             = useState<string | null>(null)
  const [eForm, setEForm]                           = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                   = useState(false)

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user!.id).order('name')
    if (data) setPeptides(data as Peptide[])
  }
  const loadCycles = async () => {
    const { data } = await supabase.from('cycles').select('*').eq('user_id', user!.id)
    if (data) setCycles(data as Cycle[])
  }
  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user!.id).order('start_after_days').order('start_date')
    if (data) setEscalations(data as Escalation[])
  }
  useEffect(() => { loadPeptides(); loadCycles(); loadEscalations() }, [])

  const displayPeptides = peptides
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'name_asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))

  const cyclesOf = (pid: string) => cycles.filter(c => c.peptide_id === pid)

  // ── Peptid speichern ──────────────────────────────────────────────────────
  const savePeptide = async () => {
    if (!pForm.name.trim()) return toast.error('Peptidname erforderlich')
    setSavingPeptide(true)

    // Datei hochladen falls vorhanden
    let fileUrl = pForm.batch_file_url
    if (batchFile) {
      setUploadingFile(true)
      const ext = batchFile.name.split('.').pop()?.toLowerCase()
      const path = `${user!.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('batch-files').upload(path, batchFile)
      if (upErr) toast.error('Datei-Upload fehlgeschlagen')
      else {
        const { data } = supabase.storage.from('batch-files').getPublicUrl(path)
        fileUrl = data.publicUrl
      }
      setUploadingFile(false)
    }

    const stock = parseFloat(pForm.vials_in_stock) || 0
    // vials_initial nur beim ersten Speichern setzen (als 100%-Basis), danach nicht überschreiben
    const existingInitial = editingPeptideId
      ? (peptides.find(p => p.id === editingPeptideId)?.vials_initial ?? 0)
      : 0
    const initial = existingInitial > 0 ? existingInitial : stock

    const payload = {
      user_id: user!.id, name: pForm.name.trim(),
      default_unit: pForm.default_unit,
      default_dose: pForm.default_dose ? parseFloat(pForm.default_dose) : null,
      default_method: pForm.default_method,
      vial_amount_mg: pForm.vial_amount_mg ? parseFloat(pForm.vial_amount_mg) : null,
      reconstitution_ml: pForm.reconstitution_ml ? parseFloat(pForm.reconstitution_ml) : null,
      syringe_type: (pForm.syringe_ml && pForm.syringe_units) ? `${pForm.syringe_ml}:${pForm.syringe_units}` : null,
      notes: pForm.notes || null,
      vials_in_stock: stock, vials_initial: initial,
      reconstitution_date: pForm.reconstitution_date || null,
      expiry_days: pForm.expiry_days ? parseInt(pForm.expiry_days) : null,
      batch_number: pForm.batch_number || null,
      batch_source: pForm.batch_source || null,
      batch_file_url: fileUrl || null,
    }
    const { error } = editingPeptideId
      ? await supabase.from('peptides').update(payload).eq('id', editingPeptideId)
      : await supabase.from('peptides').insert(payload)
    if (error) toast.error('Fehler beim Speichern')
    else toast.success(editingPeptideId ? 'Peptid aktualisiert' : 'Peptid hinzugefügt')
    setSavingPeptide(false); setShowPeptideForm(false); setBatchFile(null); loadPeptides()
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setPForm({
      name: p.name, default_unit: p.default_unit,
      default_dose: p.default_dose?.toString() ?? '',
      default_method: p.default_method,
      vial_amount_mg: p.vial_amount_mg?.toString() ?? '',
      reconstitution_ml: p.reconstitution_ml?.toString() ?? '2',
      syringe_ml: p.syringe_type?.split(':')[0] ?? '1',
      syringe_units: p.syringe_type?.split(':')[1] ?? '100',
      notes: p.notes ?? '',
      vials_in_stock: p.vials_in_stock?.toString() ?? '0',
      reconstitution_date: p.reconstitution_date ?? '',
      expiry_days: p.expiry_days?.toString() ?? '28',
      batch_number: p.batch_number ?? '',
      batch_source: p.batch_source ?? '',
      batch_file_url: p.batch_file_url ?? '',
    })
    setBatchFile(null)
    setShowPeptideForm(true)
  }

  const removePeptide = async (id: string) => {
    if (!confirm('Peptid und alle zugehörigen Daten löschen?')) return
    await supabase.from('peptides').delete().eq('id', id)
    toast.success('Gelöscht'); loadPeptides(); loadCycles()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  const openNewCycle = (p: Peptide) => {
    setCycleForPeptide(p); setEditingCycleId(null)
    setCForm(emptyCycleForm(p)); setShowCycleForm(true)
  }

  const openEditCycle = (p: Peptide, c: Cycle) => {
    setCycleForPeptide(p); setEditingCycleId(c.id)
    setCForm({
      name: c.name, dose: c.dose.toString(), unit: c.unit,
      method: c.method, frequency: c.frequency,
      x_days_interval: c.x_days_interval?.toString() ?? '3',
      schedule_days: c.schedule_days ?? [],
      start_date: c.start_date, end_date: c.end_date ?? '',
      intake_time: c.intake_time ?? '',
      intake_time_custom: c.intake_time_custom ?? '',
      reminder: (c.reminder && c.reminder !== 'none') ? c.reminder.split(',').filter(Boolean) : [],
    })
    setShowCycleForm(true)
  }

  const saveCycle = async () => {
    if (!cForm || !cycleForPeptide) return
    if (!cForm.name || !cForm.dose) return toast.error('Name und Dosis erforderlich')
    if (cForm.frequency === 'Wochentage wählen' && cForm.schedule_days.length === 0)
      return toast.error('Mindestens einen Wochentag auswählen')
    setSavingCycle(true)
    const payload = {
      user_id: user!.id, peptide_id: cycleForPeptide.id,
      name: cForm.name, dose: parseFloat(cForm.dose),
      unit: cForm.unit, method: cForm.method, frequency: cForm.frequency,
      x_days_interval: cForm.frequency === 'Alle X Tage' ? parseInt(cForm.x_days_interval) : null,
      schedule_days: cForm.frequency === 'Wochentage wählen' ? cForm.schedule_days : null,
      start_date: cForm.start_date, end_date: cForm.end_date || null, active: true,
      intake_time: cForm.intake_time,
      intake_time_custom: cForm.intake_time === 'custom' ? cForm.intake_time_custom : null,
      reminder: cForm.reminder.length > 0 ? cForm.reminder.join(',') : 'none',
    }
    const { error } = editingCycleId
      ? await supabase.from('cycles').update(payload).eq('id', editingCycleId)
      : await supabase.from('cycles').insert(payload)
    if (error) { toast.error('Fehler'); setSavingCycle(false); return }
    toast.success(editingCycleId ? 'Zyklus aktualisiert' : 'Zyklus erstellt')
    // Erinnerungen planen (Mehrfachauswahl)
    if (cForm.reminder.length > 0 && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        const baseTime = cForm.intake_time === 'custom'
          ? cForm.intake_time_custom
          : (INTAKE_TIME_CONFIG as Record<string, { time: string }>)[cForm.intake_time]?.time ?? ''
        if (baseTime) {
          const [h, m] = baseTime.split(':').map(Number)
          let scheduled = 0
          for (const r of cForm.reminder) {
            const fireAt = new Date(); fireAt.setHours(h, m, 0, 0)
            if (r === '2h')   fireAt.setHours(fireAt.getHours() - 2)
            if (r === '1day') fireAt.setDate(fireAt.getDate() - 1)
            const delay = fireAt.getTime() - Date.now()
            if (delay > 0) {
              const label = r === '2h' ? ' in 2 Stunden' : r === '1day' ? ' morgen' : ''
              setTimeout(() => new Notification(`💊 ${cForm.name}`, {
                body: `Einnahme${label} um ${baseTime} Uhr`,
              }), delay)
              scheduled++
            }
          }
          if (scheduled > 0) toast.success(`${scheduled} Erinnerung${scheduled > 1 ? 'en' : ''} gesetzt!`)
        }
      }
    }
    setSavingCycle(false); setShowCycleForm(false); loadCycles()
  }

  const toggleCycleActive = async (c: Cycle) => {
    await supabase.from('cycles').update({ active: !c.active }).eq('id', c.id)
    toast.success(c.active ? 'Zyklus deaktiviert' : 'Zyklus aktiviert')
    loadCycles()
  }

  const removeCycle = async (id: string) => {
    if (!confirm('Zyklus löschen?')) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success('Gelöscht'); loadCycles()
  }

  // ── Dosiserhöhungs-Aktionen ───────────────────────────────────────────────
  const escalationsOf = (cid: string) => escalations.filter(e => e.cycle_id === cid)

  const openNewEsc = (c: Cycle) => {
    setEscForCycle(c); setEditingEscId(null)
    setEForm(emptyEscalationForm(c.unit)); setShowEscForm(true)
  }

  const openEditEsc = (c: Cycle, e: Escalation) => {
    setEscForCycle(c); setEditingEscId(e.id)
    setEForm({
      increase_amount: e.increase_amount.toString(), unit: e.unit,
      start_type: e.start_type,
      start_date: e.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_after_days: e.start_after_days?.toString() ?? '2',
      notes: e.notes ?? '',
    })
    setShowEscForm(true)
  }

  const saveEsc = async () => {
    if (!eForm || !escForCycle) return
    if (!eForm.increase_amount) return toast.error('Erhöhungsbetrag erforderlich')
    setSavingEsc(true)
    const payload = {
      user_id: user!.id, cycle_id: escForCycle.id,
      increase_amount: parseFloat(eForm.increase_amount),
      unit: eForm.unit, start_type: eForm.start_type,
      start_date: eForm.start_type === 'date' ? eForm.start_date : null,
      start_after_days: eForm.start_type !== 'date'
        ? parseInt(eForm.start_after_days) * (eForm.start_type === 'after_weeks' ? 7 : 1)
        : null,
      notes: eForm.notes || null,
    }
    const { error } = editingEscId
      ? await supabase.from('dose_escalations').update(payload).eq('id', editingEscId)
      : await supabase.from('dose_escalations').insert(payload)
    if (error) toast.error('Fehler')
    else { toast.success(editingEscId ? 'Aktualisiert' : 'Dosiserhöhung gespeichert'); setShowEscForm(false); loadEscalations() }
    setSavingEsc(false)
  }

  const removeEsc = async (id: string) => {
    if (!confirm('Dosiserhöhung löschen?')) return
    await supabase.from('dose_escalations').delete().eq('id', id)
    toast.success('Gelöscht'); loadEscalations()
  }

  const escLabel = (e: Escalation) => {
    if (e.start_type === 'date' && e.start_date)
      return `ab ${format(parseISO(e.start_date), 'dd.MM.yyyy')}`
    if (e.start_after_days) {
      const weeks = e.start_after_days % 7 === 0 ? e.start_after_days / 7 : null
      return weeks ? `nach ${weeks} Woche${weeks > 1 ? 'n' : ''}` : `nach ${e.start_after_days} Tagen`
    }
    return ''
  }

  const intakeLabel = (c: Cycle) => {
    if (!c.intake_time) return null
    if (c.intake_time === 'custom') return c.intake_time_custom ?? null
    return (INTAKE_TIME_CONFIG as Record<string, { label: string }>)[c.intake_time]?.label ?? null
  }

  const freqLabel = (c: Cycle) => {
    if (c.frequency === 'Alle X Tage' && c.x_days_interval) return `Alle ${c.x_days_interval} Tage`
    if (c.frequency === 'Wochentage wählen' && c.schedule_days?.length)
      return c.schedule_days.join(', ')
    return c.frequency
  }

  const toggleDay = (day: string) => {
    setCForm(f => {
      if (!f) return f
      const days = f.schedule_days.includes(day)
        ? f.schedule_days.filter(d => d !== day)
        : [...f.schedule_days, day]
      return { ...f, schedule_days: days }
    })
  }

  const calc = calcDosage(pForm.vial_amount_mg, pForm.reconstitution_ml, pForm.default_dose, pForm.default_unit, pForm.syringe_ml, pForm.syringe_units)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Meine Peptide</h1>
        <button className="btn-primary flex items-center gap-2"
          onClick={() => { setEditingPeptideId(null); setPForm(emptyPeptideForm()); setShowPeptideForm(true) }}>
          <Plus size={16} /> Neu
        </button>
      </div>

      {/* Suche + Sortierung */}
      {peptides.length > 0 && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input className="input pl-9 text-sm" placeholder="Peptid suchen..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select text-sm shrink-0 w-auto pr-8" value={sortBy}
            onChange={e => setSortBy(e.target.value as 'name_asc' | 'name_desc')}>
            <option value="name_asc">A → Z</option>
            <option value="name_desc">Z → A</option>
          </select>
        </div>
      )}

      {peptides.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <FlaskConical size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Peptide angelegt</p>
        </div>
      )}

      {search && displayPeptides.length === 0 && (
        <div className="card text-center py-8 text-slate-500 text-sm">
          Kein Peptid gefunden für „{search}"
        </div>
      )}

      {/* ── Peptid-Liste ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {displayPeptides.map(p => {
          const pCycles   = cyclesOf(p.id)
          const isOpen    = expandedId === p.id
          const hasActive = pCycles.some(c => c.active)

          return (
            <div key={p.id} className="card">
              {/* Kopfzeile */}
              <div className="flex items-start justify-between gap-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{p.name}</p>
                    {hasActive && <span className="badge bg-emerald-500/10 text-emerald-400">Aktiv</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-1">
                    {p.default_dose && <span>{p.default_dose} {p.default_unit}</span>}
                    <span>{p.default_method}</span>
                    {p.vial_amount_mg && <span>Vial: {p.vial_amount_mg} mg</span>}
                  </div>
                  {/* Vorrats-Balken */}
                  {(p.vials_initial ?? 0) > 0 && (() => {
                    const pct = Math.max(0, Math.min(100, ((p.vials_in_stock ?? 0) / p.vials_initial!) * 100))
                    const barColor = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
                    const textColor = pct > 50 ? 'text-emerald-400' : pct > 25 ? 'text-amber-400' : 'text-red-400'
                    return (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${textColor}`}>
                          {Math.round(pct)}% · {p.vials_in_stock ?? 0}/{p.vials_initial} Vials
                        </span>
                      </div>
                    )
                  })()}

                  {/* Ablaufdatum */}
                  {p.reconstitution_date && p.expiry_days && (() => {
                    const exp = addDays(parseISO(p.reconstitution_date), p.expiry_days)
                    const days = differenceInDays(exp, new Date())
                    const cls = days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'
                    return (
                      <p className={`text-xs mt-0.5 ${cls}`}>
                        {days > 0 ? `Haltbar noch ${days} Tag${days !== 1 ? 'e' : ''}` : '⚠ Abgelaufen!'}
                      </p>
                    )
                  })()}
                </button>
                <div className="flex gap-1 shrink-0">
                  <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                    title="Infos" onClick={() => setInfoPeptide(p)}><FileText size={15} /></button>
                  <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                    onClick={() => openEditPeptide(p)}><Pencil size={15} /></button>
                  <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                    onClick={() => removePeptide(p.id)}><Trash2 size={15} /></button>
                </div>
              </div>

              {/* Zyklus-Zeile + Zyklus hinzufügen */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                <button
                  onClick={() => setExpandedId(isOpen ? null : p.id)}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {pCycles.length > 0
                    ? `${pCycles.length} Zyklus${pCycles.length > 1 ? 'en' : ''}`
                    : 'Keine Zyklen'}
                </button>
                <button
                  onClick={() => openNewCycle(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors text-xs font-medium">
                  <Plus size={12} /> Zyklus hinzufügen
                </button>
              </div>

              {/* Ausgeklappt: Zyklen */}
              {isOpen && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <CalendarDays size={14} className="text-violet-400" /> Zyklen
                    </span>
                    <button className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                      onClick={() => openNewCycle(p)}>
                      <Plus size={12} /> Neuer Zyklus
                    </button>
                  </div>

                  {pCycles.length === 0 && (
                    <p className="text-slate-500 text-sm text-center py-4">
                      Noch kein Zyklus — klick auf "+ Neuer Zyklus"
                    </p>
                  )}

                  {pCycles.map(c => {
                    const pEscs = escalationsOf(c.id)
                    return (
                    <div key={c.id}
                      className={`rounded-xl border ${c.active
                        ? 'border-violet-500/30 bg-violet-500/5'
                        : 'border-slate-800 opacity-60'}`}>

                      {/* Zyklus-Header */}
                      <div className="flex items-start justify-between gap-2 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-0.5">
                            <span className="font-medium text-slate-300">{c.dose} {c.unit}</span>
                            <span>{c.method}</span>
                            <span>{freqLabel(c)}</span>
                            {(() => { const lbl = intakeLabel(c); return lbl ? <span className="text-amber-400">{(INTAKE_TIME_CONFIG as Record<string,{emoji:string}>)[c.intake_time!]?.emoji ?? '🕐'} {lbl}</span> : null })()}
                            <span>ab {format(parseISO(c.start_date), 'dd.MM.yyyy')}</span>
                            {c.end_date && <span>bis {format(parseISO(c.end_date), 'dd.MM.yyyy')}</span>}
                          </div>
                          {c.reminder && c.reminder !== 'none' && (
                            <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap text-sky-400">
                              <Bell size={10} className="shrink-0" />
                              {c.reminder.split(',').filter(v => v && v !== 'none').map(v =>
                                REMINDER_OPTIONS.find(r => r.value === v)?.label
                              ).filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleCycleActive(c)}
                            title={c.active ? 'Zyklus deaktivieren' : 'Zyklus aktivieren'}
                            className="flex items-center gap-1.5"
                          >
                            <span className={`text-xs font-medium transition-colors ${c.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {c.active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                            <div className={`relative w-9 h-5 rounded-full transition-colors ${c.active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${c.active ? 'left-4' : 'left-0.5'}`} />
                            </div>
                          </button>
                          <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                            onClick={() => openEditCycle(p, c)}><Pencil size={13} /></button>
                          <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            onClick={() => removeCycle(c.id)}><Trash2 size={13} /></button>
                        </div>
                      </div>

                      {/* Dosiserhöhungen */}
                      <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-orange-400" /> Dosiserhöhungen
                          </span>
                          <button className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
                            onClick={() => openNewEsc(c)}>
                            <Plus size={11} /> Hinzufügen
                          </button>
                        </div>

                        {pEscs.length === 0 && (
                          <p className="text-slate-600 text-xs italic">Keine Dosiserhöhungen geplant</p>
                        )}

                        <div className="space-y-1.5">
                          {pEscs.map((e, idx) => (
                            <div key={e.id} className="flex items-center justify-between gap-2
                              bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-orange-400 text-xs font-bold shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <span className="text-white text-xs font-medium">
                                    +{e.increase_amount} {e.unit}
                                  </span>
                                  <span className="text-slate-400 text-xs ml-2">{escLabel(e)}</span>
                                  {e.notes && <p className="text-slate-500 text-xs truncate">{e.notes}</p>}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button className="p-1 text-slate-500 hover:text-sky-400 transition-colors"
                                  onClick={() => openEditEsc(c, e)}><Pencil size={11} /></button>
                                <button className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                  onClick={() => removeEsc(e.id)}><Trash2 size={11} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ══ PEPTID-FORMULAR ══════════════════════════════════════════════════ */}
      {showPeptideForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={() => setShowPeptideForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[95vh]"
            onClick={e => e.stopPropagation()}>

            {/* Sticky Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-sky-400" />
                <h2 className="font-bold text-white text-lg">
                  {editingPeptideId ? 'Peptid bearbeiten' : 'Neues Peptid'}
                </h2>
              </div>
              <button onClick={() => setShowPeptideForm(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* ── 1. Peptid ──────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical size={12} /> Peptid
              </p>
              <div className="relative flex gap-2">
                <input className="input flex-1" placeholder="Peptidname *"
                  value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
                <button className="btn-secondary flex items-center gap-1 shrink-0 text-sm px-3"
                  onClick={() => setShowDropdown(d => !d)}>
                  Bekannte <ChevronDown size={14} />
                </button>
                {showDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700
                    rounded-xl shadow-xl z-10 w-56 max-h-52 overflow-y-auto">
                    {POPULAR_PEPTIDES.map(name => (
                      <button key={name} className="w-full text-left px-4 py-2.5 text-sm
                        hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => { setPForm(f => ({ ...f, name })); setShowDropdown(false) }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. Wirkstoff & Rekonstitution ──────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets size={12} /> Wirkstoff & Rekonstitution
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Wirkstoff pro Vial (mg)</label>
                  <input className="input" type="number" placeholder="z.B. 10"
                    value={pForm.vial_amount_mg} onChange={e => setPForm(f => ({ ...f, vial_amount_mg: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Zugefügte Flüssigkeit (mL)</label>
                  <input className="input" type="number" step="0.1" placeholder="z.B. 2"
                    value={pForm.reconstitution_ml} onChange={e => setPForm(f => ({ ...f, reconstitution_ml: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Datum Rekonstitution</label>
                  <input className="input" type="date" value={pForm.reconstitution_date}
                    onChange={e => setPForm(f => ({ ...f, reconstitution_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Spritzenvolumen</label>
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <input className="input pr-8" type="number" min="0.1" step="0.1" placeholder="1"
                        value={pForm.syringe_ml}
                        onChange={e => setPForm(f => ({ ...f, syringe_ml: e.target.value }))} />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">mL</span>
                    </div>
                    <div className="relative flex-1">
                      <input className="input pr-10" type="number" min="1" placeholder="100"
                        value={pForm.syringe_units}
                        onChange={e => setPForm(f => ({ ...f, syringe_units: e.target.value }))} />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">Einh.</span>
                    </div>
                  </div>
                  {pForm.syringe_ml && pForm.syringe_units && (() => {
                    const ratio = (parseFloat(pForm.syringe_units) / parseFloat(pForm.syringe_ml))
                    return isFinite(ratio)
                      ? <p className="text-slate-500 text-xs mt-1">= {ratio.toFixed(1)} Einheiten/mL</p>
                      : null
                  })()}
                </div>
              </div>

              <div>
                <label className="label">Haltbarkeit nach Rekonstitution</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {EXPIRY_PRESETS.map(d => (
                    <button key={d} type="button"
                      onClick={() => setPForm(f => ({ ...f, expiry_days: d.toString() }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        pForm.expiry_days === d.toString()
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {d} Tage
                    </button>
                  ))}
                  <input className="input w-24 py-1.5 text-xs" type="number" placeholder="Individuell"
                    value={EXPIRY_PRESETS.includes(parseInt(pForm.expiry_days)) ? '' : pForm.expiry_days}
                    onChange={e => setPForm(f => ({ ...f, expiry_days: e.target.value }))} />
                </div>
                {pForm.reconstitution_date && pForm.expiry_days && (() => {
                  const exp = addDays(parseISO(pForm.reconstitution_date), parseInt(pForm.expiry_days))
                  const days = differenceInDays(exp, new Date())
                  return (
                    <p className={`text-xs ${days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      Ablaufdatum: {format(exp, 'dd.MM.yyyy')}
                      {days > 0 ? ` · noch ${days} Tag${days !== 1 ? 'e' : ''}` : ' · Abgelaufen!'}
                    </p>
                  )
                })()}
              </div>
            </div>

            {/* ── 3. Dosierungsrechner ────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Calculator size={12} /> Dosierungsrechner
              </p>
              {calc ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-emerald-400 text-lg font-bold">{calc.concMgPerMl}</p>
                    <p className="text-slate-400 text-xs mt-0.5">mg/mL</p>
                    <p className="text-slate-500 text-xs">Konzentration</p>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-3 text-center">
                    <p className="text-sky-400 text-lg font-bold">{calc.doseMl}</p>
                    <p className="text-slate-400 text-xs mt-0.5">mL</p>
                    <p className="text-slate-500 text-xs">Volumen</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                    <p className="text-emerald-300 text-2xl font-bold">{calc.units}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Einh. aufziehen</p>
                    <p className="text-slate-500 text-xs">{calc.syringeMl} mL · {calc.syringeUnits} Einh.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-3 text-center text-slate-500 text-sm">
                  Wirkstoff, Dosis und BAC-Wasser eingeben
                </div>
              )}
            </div>

            {/* ── 4. Bestand ─────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={12} /> Bestand
              </p>
              <div>
                <label className="label">Vorrätige Vials</label>
                <input className="input" type="number" min="0" step="0.5" placeholder="0"
                  value={pForm.vials_in_stock}
                  onChange={e => setPForm(f => ({ ...f, vials_in_stock: e.target.value }))} />
                <p className="text-slate-600 text-xs mt-1">Beim ersten Speichern wird dieser Wert als 100%-Basis gemerkt. Im Vorrat-Bereich kannst du den Bestand jederzeit anpassen.</p>
              </div>
            </div>

            {/* ── 5. Batch & Herkunft ─────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileUp size={12} /> Batch & Herkunft
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Batch-Nummer</label>
                  <input className="input" placeholder="z.B. BPC-2024-01"
                    value={pForm.batch_number}
                    onChange={e => setPForm(f => ({ ...f, batch_number: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Quelle / Hersteller</label>
                  <input className="input" placeholder="z.B. Peptide Sciences"
                    value={pForm.batch_source}
                    onChange={e => setPForm(f => ({ ...f, batch_source: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Analyse-Dokument (PDF / Bild)</label>
                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  batchFile ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <FileUp size={18} className={batchFile ? 'text-sky-400' : 'text-slate-500'} />
                  <div className="flex-1 min-w-0">
                    {batchFile
                      ? <p className="text-sky-400 text-sm font-medium truncate">{batchFile.name}</p>
                      : pForm.batch_file_url
                        ? <p className="text-slate-300 text-sm truncate">Datei vorhanden</p>
                        : <p className="text-slate-500 text-sm">PDF oder Bild auswählen</p>
                    }
                    <p className="text-slate-600 text-xs">COA, Laborbericht, Rechnung…</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => { if (e.target.files?.[0]) setBatchFile(e.target.files[0]) }} />
                </label>
                {pForm.batch_file_url && !batchFile && (
                  <div className="flex items-center gap-2 mt-2">
                    <a href={pForm.batch_file_url} target="_blank" rel="noopener noreferrer"
                      className="text-sky-400 text-xs hover:underline flex-1 truncate">
                      Vorhandenes Dokument anzeigen ↗
                    </a>
                    <button className="text-red-400 text-xs hover:text-red-300"
                      onClick={() => setPForm(f => ({ ...f, batch_file_url: '' }))}>
                      Entfernen
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── 6. Dosierung & Applikation ──────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                💉 Dosierung & Applikation
              </p>
              <div>
                <label className="label">Standard-Dosis</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="number" placeholder="z.B. 500"
                    value={pForm.default_dose}
                    onChange={e => setPForm(f => ({ ...f, default_dose: e.target.value }))} />
                  <select className="select w-24" value={pForm.default_unit}
                    onChange={e => setPForm(f => ({ ...f, default_unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <p className="text-slate-600 text-xs mt-1">Fallback wenn kein Zyklus aktiv ist. Aktive Zyklen überschreiben diese Dosis.</p>
              </div>
              <div>
                <label className="label">Applikationsart</label>
                <select className="select" value={pForm.default_method}
                  onChange={e => setPForm(f => ({ ...f, default_method: e.target.value }))}>
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notizen (optional)</label>
                <textarea className="input resize-none" rows={2}
                  value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* ── Buttons ─────────────────────────────────────────────── */}
            <div className="px-5 py-4 flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowPeptideForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={savePeptide}
                disabled={savingPeptide || uploadingFile}>
                {uploadingFile ? 'Lädt hoch…' : savingPeptide ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {showCycleForm && cForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={() => setShowCycleForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4
            overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-400" />
                <h2 className="text-lg font-bold">
                  {editingCycleId ? 'Zyklus bearbeiten' : 'Neuer Zyklus'}
                </h2>
              </div>
              {cycleForPeptide && (
                <p className="text-sky-400 text-sm mt-0.5 ml-6">{cycleForPeptide.name}</p>
              )}
            </div>

            <div>
              <label className="label">Zyklus-Name</label>
              <input className="input" placeholder="z.B. Heilungsprotokoll"
                value={cForm.name} onChange={e => setCForm(f => f ? { ...f, name: e.target.value } : f)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Dosis</label>
                <input className="input" type="number" value={cForm.dose}
                  onChange={e => setCForm(f => f ? { ...f, dose: e.target.value } : f)} />
              </div>
              <div>
                <label className="label">Einheit</label>
                <select className="select" value={cForm.unit}
                  onChange={e => setCForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Applikationsart</label>
              <select className="select" value={cForm.method}
                onChange={e => setCForm(f => f ? { ...f, method: e.target.value } : f)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Frequenz</label>
              <select className="select" value={cForm.frequency}
                onChange={e => setCForm(f => f ? { ...f, frequency: e.target.value } : f)}>
                {BASE_FREQUENCIES.map(freq => <option key={freq}>{freq}</option>)}
              </select>
            </div>

            {/* Alle X Tage */}
            {cForm.frequency === 'Alle X Tage' && (
              <div>
                <label className="label">Alle wie viele Tage?</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">Alle</span>
                  <input className="input w-24" type="number" min="2" max="30"
                    value={cForm.x_days_interval}
                    onChange={e => setCForm(f => f ? { ...f, x_days_interval: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm">Tage</span>
                </div>
              </div>
            )}

            {/* Wochentage wählen */}
            {cForm.frequency === 'Wochentage wählen' && (
              <div>
                <label className="label">Injektionstage wählen</label>
                <div className="flex gap-2">
                  {WOCHENTAGE.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                        cForm.schedule_days.includes(day)
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                {cForm.schedule_days.length > 0 && (
                  <p className="text-sky-400 text-xs mt-2">
                    Ausgewählt: {cForm.schedule_days.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Startdatum</label>
                <input className="input" type="date" value={cForm.start_date}
                  onChange={e => setCForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
              <div>
                <label className="label">Enddatum (optional)</label>
                <input className="input" type="date" value={cForm.end_date}
                  onChange={e => setCForm(f => f ? { ...f, end_date: e.target.value } : f)} />
              </div>
            </div>

            {/* Einnahmezeitpunkt */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Einnahmezeitpunkt</label>
                <span className="text-xs text-slate-500">optional</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(INTAKE_TIME_CONFIG) as [string, { label: string; emoji: string }][]).map(([key, cfg]) => (
                  <button key={key} type="button"
                    onClick={() => setCForm(f => f ? {
                      ...f,
                      intake_time: f.intake_time === key ? '' : key,
                      intake_time_custom: f.intake_time === key ? '' : f.intake_time_custom,
                    } : f)}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                      cForm.intake_time === key
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    <span className="text-base">{cfg.emoji}</span>
                    {cfg.label}
                  </button>
                ))}
              </div>
              {cForm.intake_time === 'custom' && (
                <input className="input mt-2" type="time"
                  value={cForm.intake_time_custom}
                  onChange={e => setCForm(f => f ? { ...f, intake_time_custom: e.target.value } : f)} />
              )}
            </div>

            {/* Erinnerung */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Bell size={13} className="text-sky-400" /> Erinnerung
                </label>
                <span className="text-xs text-slate-500">Mehrfachauswahl möglich</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {REMINDER_OPTIONS.map(opt => {
                  const active = cForm.reminder.includes(opt.value)
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setCForm(f => {
                        if (!f) return f
                        const next = f.reminder.includes(opt.value)
                          ? f.reminder.filter(v => v !== opt.value)
                          : [...f.reminder, opt.value]
                        return { ...f, reminder: next }
                      })}
                      className={`relative py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      <span>{opt.label}</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        active ? 'bg-white/20 border-white/60' : 'border-slate-600'
                      }`}>
                        {active && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </div>
              {cForm.reminder.length > 0 && (
                <p className="text-slate-500 text-xs mt-1.5">
                  {cForm.reminder.length} Erinnerung{cForm.reminder.length > 1 ? 'en' : ''} ausgewählt · werden heute geplant wenn die App geöffnet ist.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowCycleForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={saveCycle} disabled={savingCycle}>
                {savingCycle ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DOSISERHÖHUNG-FORMULAR ═══════════════════════════════════════════ */}
      {showEscForm && eForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
          onClick={() => setShowEscForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4
            overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-orange-400" />
                <h2 className="text-lg font-bold">
                  {editingEscId ? 'Dosiserhöhung bearbeiten' : 'Dosiserhöhung hinzufügen'}
                </h2>
              </div>
              {escForCycle && (
                <p className="text-slate-400 text-sm mt-0.5 ml-6">{escForCycle.name}</p>
              )}
            </div>

            {/* Erhöhungsbetrag + Einheit */}
            <div>
              <label className="label">Dosis wird erhöht um *</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="number" placeholder="z.B. 100"
                  value={eForm.increase_amount}
                  onChange={e => setEForm(f => f ? { ...f, increase_amount: e.target.value } : f)} />
                <select className="select w-28" value={eForm.unit}
                  onChange={e => setEForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Startzeitpunkt-Typ */}
            <div>
              <label className="label">Ab wann?</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'date',        label: 'Festes Datum' },
                  { value: 'after_days',  label: 'Nach X Tagen' },
                  { value: 'after_weeks', label: 'Nach X Wochen' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEForm(f => f ? { ...f, start_type: opt.value } : f)}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      eForm.start_type === opt.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedingtes Eingabefeld */}
            {eForm.start_type === 'date' && (
              <div>
                <label className="label">Datum</label>
                <input className="input" type="date" value={eForm.start_date}
                  onChange={e => setEForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
            )}

            {eForm.start_type === 'after_days' && (
              <div>
                <label className="label">Anzahl Tage nach Zyklusstart</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">Nach</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">Tagen</span>
                </div>
              </div>
            )}

            {eForm.start_type === 'after_weeks' && (
              <div>
                <label className="label">Anzahl Wochen nach Zyklusstart</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">Nach</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">Wochen</span>
                </div>
              </div>
            )}

            {/* Notizen */}
            <div>
              <label className="label">Notizen (optional)</label>
              <textarea className="input resize-none" rows={2}
                placeholder="z.B. schrittweise erhöhen, Verträglichkeit prüfen..."
                value={eForm.notes}
                onChange={e => setEForm(f => f ? { ...f, notes: e.target.value } : f)} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowEscForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={saveEsc} disabled={savingEsc}>
                {savingEsc ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ INFO-SHEET ═══════════════════════════════════════════════════════ */}
      {infoPeptide && (() => {
        const p = infoPeptide
        const syringeMl    = p.syringe_type?.split(':')[0]
        const syringeUnits = p.syringe_type?.split(':')[1]
        const isImage = p.batch_file_url ? /\.(jpe?g|png|webp)$/i.test(p.batch_file_url) : false
        const isPdf   = p.batch_file_url ? /\.pdf$/i.test(p.batch_file_url) : false

        let expiryDays: number | null = null
        let expiryDate: string | null = null
        if (p.reconstitution_date && p.expiry_days) {
          const exp = addDays(parseISO(p.reconstitution_date), p.expiry_days)
          expiryDays = differenceInDays(exp, new Date())
          expiryDate = format(exp, 'dd.MM.yyyy')
        }

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => setInfoPeptide(null)}>
            <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-sky-400" />
                  <h2 className="font-bold text-white text-lg">{p.name}</h2>
                </div>
                <button onClick={() => setInfoPeptide(null)} className="p-1.5 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">

                {/* Dosierung */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dosierung</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">Standard-Dosis</p>
                      <p className="text-white font-semibold mt-0.5">
                        {p.default_dose ? `${p.default_dose} ${p.default_unit}` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">Applikation</p>
                      <p className="text-white font-semibold mt-0.5">{p.default_method}</p>
                    </div>
                  </div>
                </div>

                {/* Rekonstitution */}
                {(p.vial_amount_mg || p.reconstitution_ml) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Wirkstoff & Rekonstitution</p>
                    <div className="grid grid-cols-3 gap-2">
                      {p.vial_amount_mg && (
                        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{p.vial_amount_mg}</p>
                          <p className="text-slate-500 text-xs mt-0.5">mg / Vial</p>
                        </div>
                      )}
                      {p.reconstitution_ml && (
                        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{p.reconstitution_ml}</p>
                          <p className="text-slate-500 text-xs mt-0.5">mL Flüssigkeit</p>
                        </div>
                      )}
                      {syringeMl && syringeUnits && (
                        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{syringeMl} mL</p>
                          <p className="text-slate-500 text-xs mt-0.5">{syringeUnits} Einh.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Haltbarkeit */}
                {(p.reconstitution_date || expiryDate) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Haltbarkeit</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.reconstitution_date && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">Rekonstitution</p>
                          <p className="text-white font-semibold mt-0.5">
                            {format(parseISO(p.reconstitution_date), 'dd.MM.yyyy')}
                          </p>
                        </div>
                      )}
                      {expiryDate && expiryDays !== null && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">Ablauf</p>
                          <p className={`font-semibold mt-0.5 ${expiryDays > 7 ? 'text-emerald-400' : expiryDays > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {expiryDate}
                          </p>
                          <p className={`text-xs ${expiryDays > 7 ? 'text-emerald-500' : expiryDays > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                            {expiryDays > 0 ? `noch ${expiryDays} Tag${expiryDays !== 1 ? 'e' : ''}` : 'Abgelaufen!'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bestand */}
                {(p.vials_in_stock !== null || p.vials_initial) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Bestand</p>
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold">{p.vials_in_stock ?? 0} Vials</span>
                        {(p.vials_initial ?? 0) > 0 && (
                          <span className="text-slate-400 text-xs">von {p.vials_initial} gesamt</span>
                        )}
                      </div>
                      {(p.vials_initial ?? 0) > 0 && (() => {
                        const pct = Math.max(0, Math.min(100, ((p.vials_in_stock ?? 0) / p.vials_initial!) * 100))
                        const bar  = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
                        const txt  = pct > 50 ? 'text-emerald-400' : pct > 25 ? 'text-amber-400' : 'text-red-400'
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold shrink-0 ${txt}`}>{Math.round(pct)}%</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Batch */}
                {(p.batch_number || p.batch_source) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Batch & Herkunft</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.batch_number && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">Batch-Nr.</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_number}</p>
                        </div>
                      )}
                      {p.batch_source && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">Quelle</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_source}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dokument */}
                {p.batch_file_url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Analyse-Dokument</p>
                    {isImage && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer">
                        <img src={p.batch_file_url} alt="Batch-Dokument"
                          className="w-full rounded-xl border border-slate-700 object-contain max-h-64" />
                      </a>
                    )}
                    {isPdf && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-sky-500/40 transition-colors">
                        <FileText size={20} className="text-sky-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">PDF öffnen</p>
                          <p className="text-slate-500 text-xs truncate">{p.batch_file_url.split('/').pop()}</p>
                        </div>
                        <ExternalLink size={14} className="text-slate-500 shrink-0" />
                      </a>
                    )}
                    {!isImage && !isPdf && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sky-400 text-sm hover:underline">
                        <ExternalLink size={14} /> Dokument öffnen
                      </a>
                    )}
                  </div>
                )}

                {/* Notizen */}
                {p.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notizen</p>
                    <p className="text-slate-300 text-sm bg-slate-800/60 rounded-xl px-4 py-3 whitespace-pre-wrap">{p.notes}</p>
                  </div>
                )}

              </div>

              <div className="px-5 pb-8 pt-2">
                <button className="btn-secondary w-full" onClick={() => setInfoPeptide(null)}>Schließen</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
