import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Pencil, FlaskConical,
  CalendarDays, ChevronDown, ChevronUp,
  TrendingUp, Search, Bell, Check,
  Package, FileUp, Droplets, X, FileText, ExternalLink,
  Archive, Lock, Minus, RefreshCw,
} from 'lucide-react'
import { getPeptideColor } from '../lib/peptideColors'
import { useNew } from '../lib/useNew'
import { NewDot } from '../components/NewDot'
import { format, parseISO, addDays, differenceInDays } from 'date-fns'

// ─── Inventar-Typen ───────────────────────────────────────────────────────────
interface InventoryItem {
  id: string; user_id: string; name: string
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  vials_count: number; vials_initial: number | null; mg_per_vial: number; created_at: string
}
interface InventoryForm {
  name: string; batch_number: string; batch_source: string
  batch_file_url: string; vials_count: string; mg_per_vial: string
}
const emptyInventoryForm = (): InventoryForm => ({
  name: '', batch_number: '', batch_source: '', batch_file_url: '',
  vials_count: '1', mg_per_vial: '',
})

// ─── Peptid-Typen ─────────────────────────────────────────────────────────────
interface Peptide {
  id: string; name: string; default_unit: string
  default_dose: number | null; default_method: string
  vial_amount_mg: number | null; reconstitution_ml: number | null
  syringe_type: string | null; notes: string | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  inventory_item_id: string | null
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

// ─── Konstanten ───────────────────────────────────────────────────────────────
const POPULAR_PEPTIDES = [
  'BPC-157','TB-500','Ipamorelin','CJC-1295','GHK-Cu','Epitalon',
  'Selank','Semax','PT-141','Retatrutide','Semaglutid','Tirzepatid',
  'IGF-1 LR3','GHRP-2','GHRP-6','Sermorelin','AOD 9604',
  'Thymosin Alpha-1','LL-37','Hexarelin','MGF',
]
const UNITS   = ['mcg','mg','IU','ml','nmol']
const METHODS = ['Subkutan','Intramuskulär','Nasal','Oral','Transdermal','Intravenös','Andere']
const METHOD_KEYS: Record<string,string> = {
  'Subkutan':'method_subkutan','Intramuskulär':'method_intramusk','Nasal':'method_nasal',
  'Oral':'method_oral','Transdermal':'method_transdermal','Intravenös':'method_intravenoese','Andere':'method_andere',
}
const WOCHENTAGE = ['Mo','Di','Mi','Do','Fr','Sa','So']
const EXPIRY_PRESETS = [10, 14, 21, 28, 42, 90]
const SYRINGE_PRESETS = [
  { label: '1 mL · 100 Einh. (U-100)',  ml: '1',   units: '100' },
  { label: '0,5 mL · 50 Einh. (U-100)', ml: '0.5', units: '50'  },
  { label: '0,3 mL · 30 Einh. (U-100)', ml: '0.3', units: '30'  },
  { label: '0,5 mL · 100 Einh. (U-100)',ml: '0.5', units: '100' },
  { label: '2 mL · 200 Einh. (U-100)',  ml: '2',   units: '200' },
  { label: '1 mL · 40 Einh. (U-40)',    ml: '1',   units: '40'  },
]
const BASE_FREQUENCIES = [
  'Täglich','2x täglich','3x täglich','Jeden 2. Tag',
  '5 Tage an / 2 aus','Mo-Fr','Wöchentlich',
  'Alle X Tage','Wochentage wählen',
]
const FREQ_KEYS: Record<string,string> = {
  'Täglich':'freq_taeglich','2x täglich':'freq_2x','3x täglich':'freq_3x','Jeden 2. Tag':'freq_jeden2',
  '5 Tage an / 2 aus':'freq_5an2aus','Mo-Fr':'freq_mofr','Wöchentlich':'freq_woechentlich',
  'Alle X Tage':'freq_alle_x','Wochentage wählen':'freq_wochentage',
}
const intakeSlots = (freq: string) =>
  freq === '3x täglich' ? 3 : freq === '2x täglich' ? 2 : 1
const INTAKE_TIME_CONFIG = {
  morgens: { labelKey: 'morgens', emoji: '🌅', time: '08:00' },
  mittags: { labelKey: 'mittags', emoji: '☀️',  time: '12:00' },
  abends:  { labelKey: 'abends',  emoji: '🌙', time: '20:00' },
  custom:  { labelKey: 'uhrzeit_label', emoji: '🕐', time: '' },
} as const
const REMINDER_OPTIONS = [
  { value: '1day',    labelKey: 'reminder_1day' },
  { value: '2h',      labelKey: 'reminder_2h' },
  { value: 'on_time', labelKey: 'reminder_on_time' },
]

// ─── Formular-Typen ───────────────────────────────────────────────────────────
interface PeptideForm {
  inventory_item_id: string
  name: string; default_unit: string; default_dose: string; default_method: string
  vial_amount_mg: string; reconstitution_ml: string
  syringe_ml: string; syringe_units: string
  notes: string; vials_in_stock: string
  reconstitution_date: string; expiry_days: string
  batch_number: string; batch_source: string; batch_file_url: string
}
const emptyPeptideForm = (): PeptideForm => ({
  inventory_item_id: '',
  name:'', default_unit:'mcg', default_dose:'', default_method:'Subkutan',
  vial_amount_mg:'', reconstitution_ml:'2',
  syringe_ml:'1', syringe_units:'100',
  notes:'', vials_in_stock:'0',
  reconstitution_date:'', expiry_days:'28',
  batch_number:'', batch_source:'', batch_file_url:'',
})
interface CycleForm {
  name: string; dose: string; unit: string; method: string
  frequency: string; x_days_interval: string; schedule_days: string[]
  start_date: string; end_date: string
  intake_times: string[]; intake_time_customs: string[]; reminder: string[]
}
const emptyCycleForm = (p: Peptide, tFn: (k:string)=>string): CycleForm => ({
  name: p.name + ' ' + tFn('zyklus'),
  dose: p.default_dose?.toString() ?? '', unit: p.default_unit,
  method: p.default_method, frequency: 'Täglich',
  x_days_interval: '3', schedule_days: [],
  start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '',
  intake_times: [], intake_time_customs: [], reminder: [],
})

// ─── Inventar-Bestand-Grafik ─────────────────────────────────────────────────
function VialStockDisplay({ current, initial, inUse = 0 }: {
  current: number; initial: number | null; inUse?: number
}) {
  const { t } = useTranslation()
  if (!initial || initial <= 0) return null
  const available = Math.max(0, current - inUse)
  const lowStock  = available <= 2
  const color     = lowStock ? '#ef4444' : '#10b981'

  if (initial > 10) {
    const availPct = (available / initial) * 100
    const inUsePct = (Math.min(inUse, current) / initial) * 100
    const barColor = lowStock ? '#ff3355' : '#00ccf5'
    const barGlow  = lowStock ? 'rgba(255,40,80,0.35)' : 'rgba(0,204,245,0.35)'
    return (
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1.5" style={{ fontSize: '10px' }}>
          <span style={{ color: lowStock ? '#ff4466' : 'rgba(0,204,245,0.60)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {available} {t('verfuegbar')}{lowStock ? ' · ' + t('bestand_niedrig') : ''}
          </span>
          {inUse > 0 && <span style={{ color: 'rgba(245,160,0,0.75)', fontWeight: 600 }}>{inUse} {t('in_verwendung')}</span>}
        </div>
        <div className="overflow-hidden flex" style={{
          height: '6px', borderRadius: '3px',
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
        }}>
          <div className="transition-all duration-500" style={{
            width: `${availPct}%`,
            background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`,
            boxShadow: `0 0 8px ${barGlow}`,
          }} />
          {inUse > 0 && (
            <div className="transition-all duration-500" style={{
              width: `${inUsePct}%`,
              background: 'linear-gradient(90deg, #e09000aa, #f5a000)',
              opacity: 0.75,
            }} />
          )}
        </div>
      </div>
    )
  }

  // Nur current Vials anzeigen (keine verbrauchten)
  return (
    <div className="mt-2.5 flex items-end gap-1 flex-wrap">
      {Array.from({ length: current }, (_, i) => {
        const isInUse = i >= available
        const fill    = isInUse ? '#f59e0b' : color
        return (
          <svg key={i} width="13" height="28" viewBox="0 0 13 28">
            <rect x="4" y="0" width="5" height="3" rx="1" fill={fill} opacity={isInUse ? 0.85 : 1} />
            <rect x="3" y="3" width="7" height="2" rx="0.5" fill={fill} opacity={isInUse ? 0.75 : 0.85} />
            <rect x="1" y="5" width="11" height="22" rx="3"
              fill={fill} stroke={fill} strokeWidth="1.5" opacity={isInUse ? 0.4 : 0.65} />
          </svg>
        )
      })}
      <div className="flex flex-col ml-1 self-center gap-0.5">
        {inUse > 0 && (
          <span className="text-xs text-amber-400/70 leading-none">{inUse} {t('in_verwendung')}</span>
        )}
        {lowStock && (
          <span className="text-xs text-red-400 font-medium leading-none">{t('bestand_niedrig')}</span>
        )}
      </div>
    </div>
  )
}

// ─── Vial-Visualisierung ─────────────────────────────────────────────────────
function VialDisplay({ pct, uid, color }: { pct: number; uid: string; color: string }) {
  const [tilt, setTilt] = useState(0)
  useEffect(() => {
    const handle = (e: DeviceOrientationEvent) => {
      setTilt(Math.max(-45, Math.min(45, e.gamma ?? 0)))
    }
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [])
  const W = 32, H = 70
  const fillH   = Math.max(3, Math.round((pct / 100) * H))
  const liquidY = H - fillH
  const waveH   = 6
  const ww      = W * 2
  const wavePath = `M0,${waveH/2} C${ww*.25},0 ${ww*.25},${waveH} ${ww*.5},${waveH/2} C${ww*.75},0 ${ww*.75},${waveH} ${ww},${waveH/2} L${ww},${waveH} L0,${waveH} Z`
  const clipId  = `vc${uid}`
  return (
    <div className="shrink-0 select-none"
      style={{ transform: `rotate(${tilt * 0.38}deg)`, transition: 'transform 0.1s ease-out' }}>
      <svg width={W + 8} height={H + 22} viewBox={`0 0 ${W + 8} ${H + 22}`}>
        <defs>
          <clipPath id={clipId}><rect x="4" y="13" width={W} height={H} rx="5"/></clipPath>
          <style>{`@keyframes wv${uid}{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
        </defs>
        <rect x="12" y="1" width={W - 16} height="8" rx="2.5" fill="#64748b"/>
        <rect x="7"  y="7" width={W - 6}  height="7" rx="2"   fill="#475569"/>
        <rect x="4" y="13" width={W} height={H} rx="5" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>
        <g clipPath={`url(#${clipId})`}>
          <rect x="4" y={13 + liquidY + waveH * 0.6} width={W} height={fillH} fill={color} opacity="0.25"/>
          <g transform={`translate(4, ${13 + liquidY})`}>
            <path d={wavePath} fill={color} opacity="0.55"
              style={{ animation: `wv${uid} 2.6s linear infinite` }}/>
          </g>
        </g>
        <rect x="4" y="13" width={W} height={H} rx="5" fill="none" stroke="#334155" strokeWidth="1.5"/>
        <rect x="8" y="16" width="3" height={H - 8} rx="1.5" fill="white" opacity="0.06"/>
      </svg>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function Peptide() {
  const { t } = useTranslation()
  const { user } = useAuth()

  // ── Bestätigungs-Dialoge ──────────────────────────────────────────────────
  const [verwerfenTarget,      setVerwerfenTarget]      = useState<Peptide | null>(null)
  const [rekonstitutionTarget, setRekonstitutionTarget] = useState<Peptide | null>(null)
  const [verwerfenDontAsk,     setVerwerfenDontAsk]     = useState(false)
  const [rekonstitutionDontAsk,setRekonstitutionDontAsk]= useState(false)
  const [skipVerwerfen]        = useState(() => !!localStorage.getItem('_skip_verwerfen'))
  const [skipRekonstitution]   = useState(() => !!localStorage.getItem('_skip_rekonstitution'))

  // ── Neu-Signale ───────────────────────────────────────────────────────────
  const [inventarTabNew, dismissInventarTab]   = useNew('inventar_tab')
  const [infoBtnNew,     dismissInfoBtn]       = useNew('peptide_info')
  const [zyklusBtnNew,   dismissZyklusBtn]     = useNew('zyklus_btn')
  const [anlegenBtnNew,  dismissAnlegenBtn]    = useNew('peptid_anlegen')

  // ── Tab (per URL-Parameter: ?tab=inventar) ───────────────────────────────
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'inventar' | 'peptide'>(
    searchParams.get('tab') === 'inventar' ? 'inventar' : 'peptide'
  )
  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'inventar' ? 'inventar' : 'peptide')
  }, [searchParams])

  // ── Inventar ─────────────────────────────────────────────────────────────
  const [inventory, setInventory]             = useState<InventoryItem[]>([])
  const [showInvForm, setShowInvForm]         = useState(false)
  const [editingInvId, setEditingInvId]       = useState<string | null>(null)
  const [iForm, setIForm]                     = useState<InventoryForm>(emptyInventoryForm())
  const [savingInv, setSavingInv]             = useState(false)
  const [invBatchFile, setInvBatchFile]       = useState<File | null>(null)
  const [uploadingInvFile, setUploadingInvFile] = useState(false)
  const [showInvDropdown, setShowInvDropdown] = useState(false)

  // ── Peptide ───────────────────────────────────────────────────────────────
  const [peptides, setPeptides]               = useState<Peptide[]>([])
  const [cycles, setCycles]                   = useState<Cycle[]>([])
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [showPeptideForm, setShowPeptideForm] = useState(false)
  const [editingPeptideId, setEditingPeptideId] = useState<string | null>(null)
  const [pForm, setPForm]                     = useState<PeptideForm>(emptyPeptideForm())
  const [showDropdown, setShowDropdown]       = useState(false)
  const [savingPeptide, setSavingPeptide]     = useState(false)
  const [batchFile, setBatchFile]             = useState<File | null>(null)
  const [uploadingFile, setUploadingFile]     = useState(false)
  const [infoPeptide, setInfoPeptide]         = useState<Peptide | null>(null)
  const [search, setSearch]                   = useState('')
  const [sortBy, setSortBy]                   = useState<'name_asc' | 'name_desc'>('name_asc')

  // ── Zyklen ────────────────────────────────────────────────────────────────
  const [showCycleForm, setShowCycleForm]         = useState(false)
  const [cycleForPeptide, setCycleForPeptide]     = useState<Peptide | null>(null)
  const [editingCycleId, setEditingCycleId]       = useState<string | null>(null)
  const [cForm, setCForm]                         = useState<CycleForm | null>(null)
  const [savingCycle, setSavingCycle]             = useState(false)

  // ── Dosiserhöhungen ───────────────────────────────────────────────────────
  const [escalations, setEscalations]             = useState<Escalation[]>([])
  const [showEscForm, setShowEscForm]             = useState(false)
  const [escForCycle, setEscForCycle]             = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]           = useState<string | null>(null)
  const [eForm, setEForm]                         = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                 = useState(false)

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('user_id', user!.id).order('name')
    if (data) setInventory(data as InventoryItem[])
  }
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
  useEffect(() => { loadInventory(); loadPeptides(); loadCycles(); loadEscalations() }, [])

  const displayPeptides = peptides
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'name_asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))

  const cyclesOf      = (pid: string) => cycles.filter(c => c.peptide_id === pid)
  const escalationsOf = (cid: string) => escalations.filter(e => e.cycle_id === cid)

  // ── Inventar CRUD ─────────────────────────────────────────────────────────
  const saveInventory = async () => {
    if (!iForm.name.trim())  return toast.error(t('peptidname_erforderlich'))
    if (!iForm.mg_per_vial)  return toast.error(t('wirkstoff_erforderlich'))
    if (!iForm.vials_count)  return toast.error(t('anzahl_erforderlich'))
    setSavingInv(true)

    let fileUrl = iForm.batch_file_url
    if (invBatchFile) {
      setUploadingInvFile(true)
      const ext  = invBatchFile.name.split('.').pop()?.toLowerCase()
      const path = `${user!.id}/inv_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('batch-files').upload(path, invBatchFile)
      if (upErr) toast.error(t('datei_upload_fehler'))
      else { const { data } = supabase.storage.from('batch-files').getPublicUrl(path); fileUrl = data.publicUrl }
      setUploadingInvFile(false)
    }

    const currentCount = parseInt(iForm.vials_count) || 1
    const existingInitial = editingInvId
      ? (inventory.find(i => i.id === editingInvId)?.vials_initial ?? 0)
      : 0
    const initialCount = existingInitial > 0 ? existingInitial : currentCount

    const payload = {
      user_id:        user!.id,
      name:           iForm.name.trim(),
      batch_number:   iForm.batch_number  || null,
      batch_source:   iForm.batch_source  || null,
      batch_file_url: fileUrl             || null,
      vials_count:    currentCount,
      vials_initial:  initialCount,
      mg_per_vial:    parseFloat(iForm.mg_per_vial),
    }
    const { error } = editingInvId
      ? await supabase.from('inventory_items').update(payload).eq('id', editingInvId)
      : await supabase.from('inventory_items').insert(payload)
    if (error) toast.error(t('fehler_speichern'))
    else toast.success(editingInvId ? t('inventar_aktualisiert') : t('ins_lager_eingetragen'))
    setSavingInv(false); setShowInvForm(false); setInvBatchFile(null); loadInventory()
  }

  const openEditInv = (item: InventoryItem) => {
    setEditingInvId(item.id)
    setIForm({
      name: item.name, batch_number: item.batch_number ?? '',
      batch_source: item.batch_source ?? '', batch_file_url: item.batch_file_url ?? '',
      vials_count: item.vials_count.toString(), mg_per_vial: item.mg_per_vial.toString(),
    })
    setInvBatchFile(null); setShowInvForm(true)
  }

  const removeInventory = async (id: string) => {
    if (!confirm(t('inventar_eintrag_loeschen'))) return
    await supabase.from('inventory_items').delete().eq('id', id)
    toast.success(t('geloescht')); loadInventory()
  }

  const createPeptideFromInventory = (item: InventoryItem) => {
    setEditingPeptideId(null)
    setPForm({
      ...emptyPeptideForm(),
      inventory_item_id: item.id,
      name:           item.name,
      vial_amount_mg: item.mg_per_vial.toString(),
      vials_in_stock: item.vials_count.toString(),
      batch_number:   item.batch_number  ?? '',
      batch_source:   item.batch_source  ?? '',
      batch_file_url: item.batch_file_url ?? '',
    })
    setBatchFile(null); setActiveTab('peptide'); setShowPeptideForm(true)
  }

  // ── Inventar Bestand anpassen ─────────────────────────────────────────────
  const adjustInventoryCount = async (id: string, delta: number, current: number) => {
    const newCount = Math.max(0, current + delta)
    await supabase.from('inventory_items').update({ vials_count: newCount }).eq('id', id)
    loadInventory()
  }

  // ── Peptid verwerfen ──────────────────────────────────────────────────────
  const handleVerwerfen = (p: Peptide) => {
    if (skipVerwerfen) { doVerwerfen(p); return }
    setVerwerfenDontAsk(false); setVerwerfenTarget(p)
  }
  const doVerwerfen = async (p: Peptide) => {
    await supabase.from('peptides').delete().eq('id', p.id)
    if (p.inventory_item_id) {
      const invItem = inventory.find(i => i.id === p.inventory_item_id)
      if (invItem) {
        await supabase.from('inventory_items')
          .update({ vials_count: Math.max(0, invItem.vials_count - 1) })
          .eq('id', p.inventory_item_id)
        loadInventory()
      }
    }
    toast.success(t('peptid_verworfen'))
    setVerwerfenTarget(null); loadPeptides(); loadCycles()
  }
  const confirmVerwerfen = () => {
    if (!verwerfenTarget) return
    if (verwerfenDontAsk) localStorage.setItem('_skip_verwerfen', '1')
    doVerwerfen(verwerfenTarget)
  }

  // ── Rekonstitution wiederholen ────────────────────────────────────────────
  const handleRekonstitution = (p: Peptide) => {
    if (skipRekonstitution) { doRekonstitution(p); return }
    setRekonstitutionDontAsk(false); setRekonstitutionTarget(p)
  }
  const doRekonstitution = async (p: Peptide) => {
    await supabase.from('peptides')
      .update({ reconstitution_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', p.id)
    if (p.inventory_item_id) {
      const invItem = inventory.find(i => i.id === p.inventory_item_id)
      if (invItem) {
        await supabase.from('inventory_items')
          .update({ vials_count: Math.max(0, invItem.vials_count - 1) })
          .eq('id', p.inventory_item_id)
        loadInventory()
      }
    }
    toast.success(t('rekonstitution_erneuert'))
    setRekonstitutionTarget(null); loadPeptides()
  }
  const confirmRekonstitution = () => {
    if (!rekonstitutionTarget) return
    if (rekonstitutionDontAsk) localStorage.setItem('_skip_rekonstitution', '1')
    doRekonstitution(rekonstitutionTarget)
  }

  // ── Peptid CRUD ───────────────────────────────────────────────────────────
  const handleNewPeptide = () => {
    if (inventory.length === 0) {
      setActiveTab('inventar')
      toast(t('zuerst_ins_inventar'), { icon: '📦' })
      return
    }
    setEditingPeptideId(null); setPForm(emptyPeptideForm()); setBatchFile(null); setShowPeptideForm(true)
  }

  const savePeptide = async () => {
    if (!pForm.name.trim()) return toast.error(t('peptidname_erforderlich'))
    if (!editingPeptideId && !pForm.inventory_item_id) return toast.error(t('bitte_inventar_auswaehlen'))
    setSavingPeptide(true)

    let fileUrl = pForm.batch_file_url
    if (batchFile) {
      setUploadingFile(true)
      const ext  = batchFile.name.split('.').pop()?.toLowerCase()
      const path = `${user!.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('batch-files').upload(path, batchFile)
      if (upErr) toast.error(t('datei_upload_fehler'))
      else { const { data } = supabase.storage.from('batch-files').getPublicUrl(path); fileUrl = data.publicUrl }
      setUploadingFile(false)
    }

    const stock = parseFloat(pForm.vials_in_stock) || 0
    const existingInitial = editingPeptideId
      ? (peptides.find(p => p.id === editingPeptideId)?.vials_initial ?? 0)
      : 0
    const initial = existingInitial > 0 ? existingInitial : stock

    const payload = {
      user_id:        user!.id, name: pForm.name.trim(),
      default_unit:   pForm.default_unit,
      default_dose:   pForm.default_dose ? parseFloat(pForm.default_dose) : null,
      default_method: pForm.default_method,
      vial_amount_mg: pForm.vial_amount_mg ? parseFloat(pForm.vial_amount_mg) : null,
      reconstitution_ml: pForm.reconstitution_ml ? parseFloat(pForm.reconstitution_ml) : null,
      syringe_type:   (pForm.syringe_ml && pForm.syringe_units) ? `${pForm.syringe_ml}:${pForm.syringe_units}` : null,
      notes:          pForm.notes || null,
      vials_in_stock: stock, vials_initial: initial,
      reconstitution_date: pForm.reconstitution_date || null,
      expiry_days:    pForm.expiry_days ? parseInt(pForm.expiry_days) : null,
      batch_number:   pForm.batch_number   || null,
      batch_source:   pForm.batch_source   || null,
      batch_file_url: fileUrl              || null,
      inventory_item_id: pForm.inventory_item_id || null,
    }
    const { error } = editingPeptideId
      ? await supabase.from('peptides').update(payload).eq('id', editingPeptideId)
      : await supabase.from('peptides').insert(payload)
    if (error) toast.error(t('fehler_speichern'))
    else toast.success(editingPeptideId ? t('peptid_aktualisiert') : t('peptid_hinzugefuegt'))
    setSavingPeptide(false); setShowPeptideForm(false); setBatchFile(null); loadPeptides()
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setPForm({
      inventory_item_id: p.inventory_item_id ?? '',
      name: p.name, default_unit: p.default_unit,
      default_dose:      p.default_dose?.toString() ?? '',
      default_method:    p.default_method,
      vial_amount_mg:    p.vial_amount_mg?.toString()    ?? '',
      reconstitution_ml: p.reconstitution_ml?.toString() ?? '2',
      syringe_ml:    p.syringe_type?.split(':')[0] ?? '1',
      syringe_units: p.syringe_type?.split(':')[1] ?? '100',
      notes:         p.notes ?? '',
      vials_in_stock: p.vials_in_stock?.toString() ?? '0',
      reconstitution_date: p.reconstitution_date ?? '',
      expiry_days:   p.expiry_days?.toString() ?? '28',
      batch_number:  p.batch_number  ?? '',
      batch_source:  p.batch_source  ?? '',
      batch_file_url: p.batch_file_url ?? '',
    })
    setBatchFile(null); setShowPeptideForm(true)
  }

  const removePeptide = async (id: string) => {
    if (!confirm(t('peptid_loeschen_confirm'))) return
    await supabase.from('peptides').delete().eq('id', id)
    toast.success(t('geloescht')); loadPeptides(); loadCycles()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  const openNewCycle = (p: Peptide) => {
    setCycleForPeptide(p); setEditingCycleId(null)
    setCForm(emptyCycleForm(p, t)); setShowCycleForm(true)
  }
  const openEditCycle = (p: Peptide, c: Cycle) => {
    setCycleForPeptide(p); setEditingCycleId(c.id)
    setCForm({
      name: c.name, dose: c.dose.toString(), unit: c.unit,
      method: c.method, frequency: c.frequency,
      x_days_interval: c.x_days_interval?.toString() ?? '3',
      schedule_days: c.schedule_days ?? [],
      start_date: c.start_date, end_date: c.end_date ?? '',
      intake_times: (c.intake_time ?? '').split(',').filter(Boolean),
      intake_time_customs: (c.intake_time_custom ?? '').split(',').filter(Boolean),
      reminder: (c.reminder && c.reminder !== 'none') ? c.reminder.split(',').filter(Boolean) : [],
    })
    setShowCycleForm(true)
  }
  const saveCycle = async () => {
    if (!cForm || !cycleForPeptide) return
    if (!cForm.name || !cForm.dose) return toast.error(t('name_dosis_erforderlich'))
    if (['Wochentage wählen', '2x täglich', '3x täglich'].includes(cForm.frequency) && cForm.schedule_days.length === 0)
      return toast.error(t('wochentag_auswaehlen_hint'))
    setSavingCycle(true)
    const payload = {
      user_id: user!.id, peptide_id: cycleForPeptide.id,
      name: cForm.name, dose: parseFloat(cForm.dose),
      unit: cForm.unit, method: cForm.method, frequency: cForm.frequency,
      x_days_interval: cForm.frequency === 'Alle X Tage' ? parseInt(cForm.x_days_interval) : null,
      schedule_days: ['Wochentage wählen', '2x täglich', '3x täglich', 'Alle X Tage'].includes(cForm.frequency) ? cForm.schedule_days : null,
      start_date: cForm.start_date, end_date: cForm.end_date || null, active: true,
      intake_time: cForm.intake_times.filter(Boolean).join(',') || null,
      intake_time_custom: cForm.intake_times.some(t => t === 'custom')
        ? cForm.intake_time_customs.join(',')
        : null,
      reminder: cForm.reminder.length > 0 ? cForm.reminder.join(',') : 'none',
    }
    const { error } = editingCycleId
      ? await supabase.from('cycles').update(payload).eq('id', editingCycleId)
      : await supabase.from('cycles').insert(payload)
    if (error) { toast.error(t('error')); setSavingCycle(false); return }
    toast.success(editingCycleId ? t('zyklus_aktualisiert') : t('zyklus_erstellt'))
    if (cForm.reminder.length > 0 && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        const firstSlot = cForm.intake_times[0] ?? ''
        const baseTime = firstSlot === 'custom'
          ? (cForm.intake_time_customs[0] ?? '')
          : (INTAKE_TIME_CONFIG as Record<string, { time: string }>)[firstSlot]?.time ?? ''
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
    toast.success(c.active ? t('zyklus_deaktiviert') : t('zyklus_aktiviert'))
    loadCycles()
  }
  const removeCycle = async (id: string) => {
    if (!confirm(t('zyklus_loeschen'))) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success(t('geloescht')); loadCycles()
  }

  // ── Dosiserhöhungs-Aktionen ───────────────────────────────────────────────
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
    if (!eForm.increase_amount) return toast.error(t('erhoeht_erforderlich'))
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
    if (error) toast.error(t('error'))
    else { toast.success(editingEscId ? t('inventar_aktualisiert') : t('esc_gespeichert')); setShowEscForm(false); loadEscalations() }
    setSavingEsc(false)
  }
  const removeEsc = async (id: string) => {
    if (!confirm(t('esc_loeschen'))) return
    await supabase.from('dose_escalations').delete().eq('id', id)
    toast.success(t('geloescht')); loadEscalations()
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  const escLabel = (e: Escalation) => {
    if (e.start_type === 'date' && e.start_date)
      return t('ab_datum', { date: format(parseISO(e.start_date), 'dd.MM.yyyy') })
    if (e.start_after_days) {
      const weeks = e.start_after_days % 7 === 0 ? e.start_after_days / 7 : null
      return weeks
        ? `${t('nach_prefix')} ${weeks} ${t('wochen_suffix')}`
        : `${t('nach_prefix')} ${e.start_after_days} ${t('tagen_suffix')}`
    }
    return ''
  }
  const intakeLabel = (c: Cycle) => {
    if (!c.intake_time) return null
    const keys = c.intake_time.split(',').filter(Boolean)
    const customs = (c.intake_time_custom ?? '').split(',')
    const labels = keys.map((key, i) => {
      if (key === 'custom') return customs[i] ?? null
      const cfg = (INTAKE_TIME_CONFIG as Record<string, { labelKey: string }>)[key]
      return cfg ? t(cfg.labelKey) : null
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
  }
  const freqLabel = (c: Cycle) => {
    if (c.frequency === 'Alle X Tage' && c.x_days_interval)
      return `${t('alle_prefix')} ${c.x_days_interval} ${t('tage_suffix')}`
    if (c.frequency === 'Wochentage wählen' && c.schedule_days?.length)
      return c.schedule_days.join(', ')
    return t(FREQ_KEYS[c.frequency] ?? c.frequency)
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

  // ─────────────────────────────────────────────────────────────────────────
  const reconstitutedItemIds = new Set(
    peptides.map(p => p.inventory_item_id).filter((id): id is string => !!id)
  )
  const isLinked = !!pForm.inventory_item_id

  return (
    <div>
      {/* ── Tab-Switcher + Aktions-Button ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          <button
            data-ob="tab-inventar"
            onClick={() => { setActiveTab('inventar'); dismissInventarTab() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'inventar' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}>
            <Archive size={14} /> {t('inventar')}
            {inventory.length > 0 ? (
              <span className="ml-0.5 bg-slate-600 text-slate-300 text-xs rounded-full px-1.5 py-px leading-none">
                {inventory.length}
              </span>
            ) : inventarTabNew ? (
              <NewDot />
            ) : null}
          </button>
          <button
            data-ob="tab-peptide"
            onClick={() => setActiveTab('peptide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'peptide' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
            }`}>
            <FlaskConical size={14} /> {t('meine_peptide')}
            {peptides.length > 0 && (
              <span className="ml-0.5 bg-slate-600 text-slate-300 text-xs rounded-full px-1.5 py-px leading-none">
                {peptides.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'inventar' ? (
          <button data-ob="btn-einlagern" className="btn-primary flex items-center gap-1.5 text-sm py-2"
            onClick={() => { setEditingInvId(null); setIForm(emptyInventoryForm()); setInvBatchFile(null); setShowInvDropdown(false); setShowInvForm(true) }}>
            <Plus size={15} /> {t('einlagern')}
          </button>
        ) : (
          <button className="btn-primary flex items-center gap-1.5 text-sm py-2" onClick={handleNewPeptide}>
            <Plus size={15} /> {t('new')}
          </button>
        )}
      </div>

      {/* ══ INVENTAR TAB ═════════════════════════════════════════════════════ */}
      {activeTab === 'inventar' && (
        <div>
          {inventory.length === 0 ? (
            <div className="card text-center py-12 text-slate-500">
              <Archive size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-slate-400 mb-1">{t('kein_inventar')}</p>
              <p className="text-xs text-slate-600 mb-5 px-6 leading-relaxed">
                {t('kein_inventar_desc')}
              </p>
              <button className="btn-primary flex items-center gap-2 mx-auto"
                onClick={() => { setEditingInvId(null); setIForm(emptyInventoryForm()); setShowInvForm(true) }}>
                <Plus size={16} /> {t('einlagern')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {inventory.map(item => {
                const isUsed     = reconstitutedItemIds.has(item.id)
                const inUseCount = peptides.filter(p => p.inventory_item_id === item.id).length
                const isDepleted = item.vials_count === 0
                return (
                <div key={item.id} className="card transition-opacity" style={isDepleted ? { opacity: 0.5 } : {}}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-white">{item.name}</p>
                        <span className="badge bg-sky-500/10 text-sky-400">{item.mg_per_vial} mg/Vial</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustInventoryCount(item.id, -1, item.vials_count)}
                            className="w-5 h-5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center transition-colors">
                            <Minus size={10} />
                          </button>
                          <span className={`badge ${item.vials_count <= 1 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            {item.vials_count} Vial{item.vials_count !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => adjustInventoryCount(item.id, +1, item.vials_count)}
                            className="w-5 h-5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center justify-center transition-colors">
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                      {(item.batch_number || item.batch_source) && (
                        <div className="flex gap-x-3 text-xs text-slate-500 flex-wrap">
                          {item.batch_number && <span>{t('batch')}: {item.batch_number}</span>}
                          {item.batch_source && <span>{t('quelle')}: {item.batch_source}</span>}
                        </div>
                      )}
                      {item.batch_file_url && (
                        <a href={item.batch_file_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sky-400 hover:underline flex items-center gap-1 mt-0.5">
                          <FileText size={10} /> {t('dokument_link')}
                        </a>
                      )}
                      <VialStockDisplay current={item.vials_count} initial={item.vials_initial} inUse={inUseCount} />
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 items-end">
                      <button
                        data-ob="btn-peptid-anlegen"
                        onClick={() => { createPeptideFromInventory(item); dismissAnlegenBtn() }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 transition-colors text-xs font-medium">
                        <FlaskConical size={11} /> {t('peptid_anlegen')}
                        {anlegenBtnNew && <NewDot />}
                      </button>
                      <div className="flex gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                          onClick={() => openEditInv(item)}><Pencil size={14} /></button>
                        <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          onClick={() => removeInventory(item.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ MEINE PEPTIDE TAB ════════════════════════════════════════════════ */}
      {activeTab === 'peptide' && (
        <div>
          <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
            <FlaskConical size={12} className="text-sky-400" />
            {t('fertig_rekonst')}
          </p>

          {peptides.length > 0 && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input pl-9 text-sm" placeholder={t('peptid_suchen')}
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
              <p className="mb-1">{t('keine_peptide')}</p>
              {inventory.length === 0 ? (
                <>
                  <p className="text-xs text-slate-600 mb-4">{t('lege_inv_an_zuerst')}</p>
                  <button className="btn-secondary flex items-center gap-2 mx-auto"
                    onClick={() => setActiveTab('inventar')}>
                    <Archive size={14} /> {t('zum_inventar_btn')}
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-600">
                  {t(inventory.length === 1 ? 'inv_n_items_desc' : 'inv_n_items_desc_pl', { n: inventory.length })}
                </p>
              )}
            </div>
          )}

          {search && displayPeptides.length === 0 && (
            <div className="card text-center py-8 text-slate-500 text-sm">
              {t('kein_peptid_gefunden_msg', { search })}
            </div>
          )}

          {/* ── Peptid-Liste ────────────────────────────────────────────── */}
          <div className="space-y-3">
            {displayPeptides.map(p => {
              const pCycles   = cyclesOf(p.id)
              const isOpen    = expandedId === p.id
              const hasActive = pCycles.some(c => c.active)
              const vialPct = (p.vials_initial ?? 0) > 0
                ? Math.max(0, Math.min(100, ((p.vials_in_stock ?? 0) / p.vials_initial!) * 100))
                : null
              const colorIdx   = peptides.findIndex(pp => pp.id === p.id)
              const peptideColor = getPeptideColor(colorIdx)

              return (
                <div key={p.id} className="card">
                  {/* Kopfzeile */}
                  <div className="flex items-start gap-3">
                    {vialPct !== null && (
                      <VialDisplay pct={Math.round(vialPct)} uid={p.id.replace(/-/g, '')} color={peptideColor} />
                    )}
                    <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                      <button className="flex-1 text-left min-w-0" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white">{p.name}</p>
                          {hasActive && <span className="badge bg-emerald-500/10 text-emerald-400">{t('aktiv_badge')}</span>}
                          {p.inventory_item_id && <span className="badge bg-slate-700 text-slate-400 flex items-center gap-0.5"><Archive size={9} /> {t('nav_lager')}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-1">
                          {p.default_dose && <span>{p.default_dose} {p.default_unit}</span>}
                          <span>{t(METHOD_KEYS[p.default_method] ?? p.default_method)}</span>
                          {p.vial_amount_mg && <span>Vial: {p.vial_amount_mg} mg</span>}
                        </div>


                        {p.reconstitution_date && p.expiry_days && (() => {
                          const exp  = addDays(parseISO(p.reconstitution_date), p.expiry_days)
                          const days = differenceInDays(exp, new Date())
                          const cls  = days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'
                          return (
                            <p className={`text-xs mt-0.5 ${cls}`}>
                              {days > 0 ? (days === 1 ? t('haltbar_noch_1') : t('haltbar_noch_n', { n: days })) : t('abgelaufen_warn')}
                            </p>
                          )
                        })()}
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button className="relative p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                          title="Infos" onClick={() => { setInfoPeptide(p); dismissInfoBtn() }}>
                          <FileText size={15} />
                          {infoBtnNew && <NewDot className="absolute -top-0.5 -right-0.5" />}
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                          onClick={() => openEditPeptide(p)}><Pencil size={15} /></button>
                        <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          onClick={() => removePeptide(p.id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Verwerfen + Rekonstitution (nur bei Inventar-Verknüpfung) */}
                  {p.inventory_item_id && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleVerwerfen(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium">
                        <Trash2 size={11} /> {t('verwerfen')}
                      </button>
                      <button
                        onClick={() => handleRekonstitution(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-colors text-xs font-medium">
                        <RefreshCw size={11} /> {t('rekonstitution_wdh')}
                      </button>
                    </div>
                  )}

                  {/* Zyklus-Zeile */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                      className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {pCycles.length > 0 ? (pCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: pCycles.length })) : t('keine_zyklen')}
                    </button>
                    <button
                      data-ob="btn-zyklus-add"
                      onClick={() => { openNewCycle(p); dismissZyklusBtn() }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors text-xs font-medium">
                      <Plus size={12} /> {t('zyklus_hinzufuegen')}
                      {zyklusBtnNew && <NewDot />}
                    </button>
                  </div>

                  {/* Ausgeklappt: Zyklen */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          <CalendarDays size={14} className="text-violet-400" /> {t('zyklen_header')}
                        </span>
                        <button className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                          onClick={() => openNewCycle(p)}>
                          <Plus size={12} /> {t('neuer_zyklus_btn')}
                        </button>
                      </div>
                      {pCycles.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">
                          {t('noch_kein_zyklus')}
                        </p>
                      )}
                      {pCycles.map(c => {
                        const pEscs = escalationsOf(c.id)
                        return (
                          <div key={c.id} className={`rounded-xl border ${c.active ? 'border-violet-500/30 bg-violet-500/5' : 'border-slate-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2 p-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                                <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-0.5">
                                  <span className="font-medium text-slate-300">{c.dose} {c.unit}</span>
                                  <span>{t(METHOD_KEYS[c.method] ?? c.method)}</span>
                                  <span>{freqLabel(c)}</span>
                                  {(() => { const lbl = intakeLabel(c); const firstKey = c.intake_time?.split(',')[0] ?? ''; return lbl ? <span className="text-amber-400">{(INTAKE_TIME_CONFIG as Record<string,{emoji:string}>)[firstKey]?.emoji ?? '🕐'} {lbl}</span> : null })()}
                                  <span>{t('ab_datum', { date: format(parseISO(c.start_date), 'dd.MM.yyyy') })}</span>
                                  {c.end_date && <span>{t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}</span>}
                                </div>
                                {c.reminder && c.reminder !== 'none' && (
                                  <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap text-sky-400">
                                    <Bell size={10} className="shrink-0" />
                                    {c.reminder.split(',').filter(v => v && v !== 'none').map(v => {
                                      const opt = REMINDER_OPTIONS.find(r => r.value === v)
                                      return opt ? t(opt.labelKey) : v
                                    }).filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => toggleCycleActive(c)} title={c.active ? t('deaktivieren_title') : t('aktivieren_title')}
                                  className="flex items-center gap-1.5">
                                  <span className={`text-xs font-medium transition-colors ${c.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {c.active ? t('aktiv_badge') : t('inaktiv_badge')}
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
                                  <TrendingUp size={12} className="text-orange-400" /> {t('dosiserhoehungen')}
                                </span>
                                <button className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
                                  onClick={() => openNewEsc(c)}>
                                  <Plus size={11} /> {t('hinzufuegen')}
                                </button>
                              </div>
                              {pEscs.length === 0 && (
                                <p className="text-slate-600 text-xs italic">{t('keine_dosiserhoehungen')}</p>
                              )}
                              <div className="space-y-1.5">
                                {pEscs.map((e, idx) => (
                                  <div key={e.id} className="flex items-center justify-between gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-orange-400 text-xs font-bold shrink-0">#{idx + 1}</span>
                                      <div className="min-w-0">
                                        <span className="text-white text-xs font-medium">+{e.increase_amount} {e.unit}</span>
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
        </div>
      )}

      {/* ══ INVENTAR-FORMULAR ════════════════════════════════════════════════ */}
      {showInvForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowInvForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Archive size={18} className="text-sky-400" />
                <h2 className="font-bold text-white text-lg">
                  {editingInvId ? t('inventar_bearbeiten') : t('einlagern')}
                </h2>
              </div>
              <button onClick={() => setShowInvForm(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Name */}
              <div data-ob="inv-name">
                <label className="label">{t('peptidname_star')}</label>
                <div className="relative flex gap-2">
                  <input className="input flex-1" placeholder={t('eg_bpc157')}
                    value={iForm.name} onChange={e => setIForm(f => ({ ...f, name: e.target.value }))} />
                  <button className="btn-secondary flex items-center gap-1 shrink-0 text-sm px-3"
                    onClick={() => setShowInvDropdown(d => !d)}>
                    {t('bekannte_btn')} <ChevronDown size={14} />
                  </button>
                  {showInvDropdown && (
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 w-56 max-h-52 overflow-y-auto">
                      {POPULAR_PEPTIDES.map(name => (
                        <button key={name} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                          onClick={() => { setIForm(f => ({ ...f, name })); setShowInvDropdown(false) }}>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Anzahl + Wirkstoff */}
              <div className="grid grid-cols-2 gap-3" data-ob="inv-amounts">
                <div>
                  <label className="label">{t('anzahl_vials_star')}</label>
                  <input className="input" type="number" min="1" placeholder={t('eg_5')}
                    value={iForm.vials_count} onChange={e => setIForm(f => ({ ...f, vials_count: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('wirkstoff_pro_vial_pflicht')}</label>
                  <input className="input" type="number" step="0.1" placeholder={t('eg_10')}
                    value={iForm.mg_per_vial} onChange={e => setIForm(f => ({ ...f, mg_per_vial: e.target.value }))} />
                </div>
              </div>

              {/* Batch & Herkunft */}
              <div className="grid grid-cols-2 gap-3" data-ob="inv-batch">
                <div>
                  <label className="label">{t('batch')}</label>
                  <input className="input" placeholder={t('eg_batch_nr')}
                    value={iForm.batch_number} onChange={e => setIForm(f => ({ ...f, batch_number: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('quelle')}</label>
                  <input className="input" placeholder={t('eg_source_name')}
                    value={iForm.batch_source} onChange={e => setIForm(f => ({ ...f, batch_source: e.target.value }))} />
                </div>
              </div>

              {/* Datei */}
              <div>
                <label className="label">{t('analyse_dok_optional')}</label>
                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  invBatchFile ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <FileUp size={18} className={invBatchFile ? 'text-sky-400' : 'text-slate-500'} />
                  <div className="flex-1 min-w-0">
                    {invBatchFile
                      ? <p className="text-sky-400 text-sm font-medium truncate">{invBatchFile.name}</p>
                      : iForm.batch_file_url
                        ? <p className="text-slate-300 text-sm">{t('datei_vorhanden_text')}</p>
                        : <p className="text-slate-500 text-sm">{t('pdf_bild_auswaehlen')}</p>
                    }
                    <p className="text-slate-600 text-xs">{t('coa_label')}</p>
                  </div>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => { if (e.target.files?.[0]) setInvBatchFile(e.target.files[0]) }} />
                </label>
                {iForm.batch_file_url && !invBatchFile && (
                  <div className="flex items-center gap-2 mt-2">
                    <a href={iForm.batch_file_url} target="_blank" rel="noopener noreferrer"
                      className="text-sky-400 text-xs hover:underline flex-1 truncate">
                      {t('dokument_anzeigen')}
                    </a>
                    <button className="text-red-400 text-xs hover:text-red-300"
                      onClick={() => setIForm(f => ({ ...f, batch_file_url: '' }))}>
                      {t('entfernen')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowInvForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-inv-save" className="btn-primary flex-1" onClick={saveInventory}
                disabled={savingInv || uploadingInvFile}>
                {uploadingInvFile ? t('laedt_hoch') : savingInv ? t('loading') : t('einlagern')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PEPTID-FORMULAR ══════════════════════════════════════════════════ */}
      {showPeptideForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowPeptideForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[95vh]"
            onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-sky-400" />
                <h2 className="font-bold text-white text-lg">
                  {editingPeptideId ? t('peptid_bearbeiten_title') : t('neues_peptid_title')}
                </h2>
              </div>
              <button onClick={() => setShowPeptideForm(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* ── Aus Inventar (nur bei neuen Peptiden) ────────────────── */}
            {!editingPeptideId && (
              <div className="px-5 py-4 border-b border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Archive size={12} /> {t('aus_inventar_section')}
                </p>
                <select className="select"
                  value={pForm.inventory_item_id}
                  onChange={e => {
                    const item = inventory.find(i => i.id === e.target.value)
                    if (item) {
                      setPForm(f => ({
                        ...f,
                        inventory_item_id: item.id,
                        name:           item.name,
                        vial_amount_mg: item.mg_per_vial.toString(),
                        vials_in_stock: item.vials_count.toString(),
                        batch_number:   item.batch_number  ?? '',
                        batch_source:   item.batch_source  ?? '',
                        batch_file_url: item.batch_file_url ?? '',
                      }))
                    } else {
                      setPForm(f => ({ ...f, inventory_item_id: '' }))
                    }
                  }}>
                  <option value="">{t('inventar_select_ph')}</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.mg_per_vial} mg · {item.vials_count} Vials
                    </option>
                  ))}
                </select>
                {!pForm.inventory_item_id && (
                  <p className="text-xs text-amber-400/80">{t('inventar_auswahl_hinweis')}</p>
                )}
              </div>
            )}

            {/* Inventar-Badge bei Bearbeitung */}
            {editingPeptideId && pForm.inventory_item_id && (() => {
              const item = inventory.find(i => i.id === pForm.inventory_item_id)
              return item ? (
                <div className="px-5 pt-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <Archive size={13} className="text-sky-400 shrink-0" />
                    <p className="text-sky-400 text-xs">{t('aus_inventar_badge')} <span className="font-medium">{item.name}</span></p>
                  </div>
                </div>
              ) : null
            })()}

            {/* ── 1. Peptid ──────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FlaskConical size={12} /> {t('peptid_section')}
              </p>
              <div className="relative flex gap-2">
                <input className="input flex-1" placeholder={t('peptidname_star')}
                  value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
                <button className="btn-secondary flex items-center gap-1 shrink-0 text-sm px-3"
                  onClick={() => setShowDropdown(d => !d)}>
                  {t('bekannte_btn')} <ChevronDown size={14} />
                </button>
                {showDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 w-56 max-h-52 overflow-y-auto">
                    {POPULAR_PEPTIDES.map(name => (
                      <button key={name} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => { setPForm(f => ({ ...f, name })); setShowDropdown(false) }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 2. Wirkstoff & Rekonstitution ──────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets size={12} /> {t('wirkstoff_rekonstitution')}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('wirkstoff_pro_vial_form')}</label>
                  {isLinked ? (
                    <div className="input bg-slate-800/30 text-slate-300 flex items-center justify-between cursor-default">
                      <span>{pForm.vial_amount_mg || '—'}</span>
                      <span className="text-xs text-slate-600 flex items-center gap-0.5 shrink-0 ml-1"><Lock size={9}/> {t('nav_lager')}</span>
                    </div>
                  ) : (
                    <input className="input" type="number" placeholder={t('eg_10')}
                      value={pForm.vial_amount_mg} onChange={e => setPForm(f => ({ ...f, vial_amount_mg: e.target.value }))} />
                  )}
                </div>
                <div data-ob="pep-liquid">
                  <label className="label">{t('zugefuegte_fl_ml')}</label>
                  <input className="input" type="number" step="0.1" placeholder={t('eg_2')}
                    value={pForm.reconstitution_ml} onChange={e => setPForm(f => ({ ...f, reconstitution_ml: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('datum_rekonstitution')}</label>
                  <input className="input" type="date" value={pForm.reconstitution_date}
                    onChange={e => setPForm(f => ({ ...f, reconstitution_date: e.target.value }))} />
                </div>
              </div>

              <div data-ob="pep-expiry">
                <label className="label">{t('haltbarkeit')}</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {EXPIRY_PRESETS.map(d => (
                    <button key={d} type="button"
                      onClick={() => setPForm(f => ({ ...f, expiry_days: d.toString() }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        pForm.expiry_days === d.toString() ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {t('n_tage_expiry', { n: d })}
                    </button>
                  ))}
                  <input className="input w-24 py-1.5 text-xs" type="number" placeholder={t('individuel_ph')}
                    value={EXPIRY_PRESETS.includes(parseInt(pForm.expiry_days)) ? '' : pForm.expiry_days}
                    onChange={e => setPForm(f => ({ ...f, expiry_days: e.target.value }))} />
                </div>
                {pForm.reconstitution_date && pForm.expiry_days && (() => {
                  const exp  = addDays(parseISO(pForm.reconstitution_date), parseInt(pForm.expiry_days))
                  const days = differenceInDays(exp, new Date())
                  return (
                    <p className={`text-xs ${days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {days > 0 ? t('ablaufdatum_text', { date: format(exp, 'dd.MM.yyyy'), n: days }) : t('ablaufdatum_abgelaufen', { date: format(exp, 'dd.MM.yyyy') })}
                    </p>
                  )
                })()}
              </div>
            </div>

            {/* ── 3. Bestand ─────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={12} /> {t('bestand_section')}
              </p>
              <div>
                <label className="label">{t('vorraetige_vials')}</label>
                {isLinked ? (
                  <div className="input bg-slate-800/30 text-slate-300 flex items-center justify-between cursor-default">
                    <span>{pForm.vials_in_stock}</span>
                    <span className="text-xs text-slate-600 flex items-center gap-0.5 shrink-0 ml-1"><Lock size={9}/> {t('aus_inventar_vials')}</span>
                  </div>
                ) : (
                  <input className="input" type="number" min="0" step="0.5" placeholder="0"
                    value={pForm.vials_in_stock} onChange={e => setPForm(f => ({ ...f, vials_in_stock: e.target.value }))} />
                )}
                <p className="text-slate-600 text-xs mt-1">
                  {isLinked
                    ? t('inventar_uebernommen_hint')
                    : t('basis_info')}
                </p>
              </div>
            </div>

            {/* ── 4. Batch & Herkunft ─────────────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileUp size={12} /> {t('batch_herkunft_section')}
              </p>
              {isLinked ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t('batch')}</label>
                    <div className="input bg-slate-800/30 text-slate-300 flex items-center justify-between cursor-default">
                      <span className="truncate">{pForm.batch_number || '—'}</span>
                      <Lock size={9} className="text-slate-600 shrink-0 ml-1"/>
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('quelle')}</label>
                    <div className="input bg-slate-800/30 text-slate-300 flex items-center justify-between cursor-default">
                      <span className="truncate">{pForm.batch_source || '—'}</span>
                      <Lock size={9} className="text-slate-600 shrink-0 ml-1"/>
                    </div>
                  </div>
                  {pForm.batch_file_url && (
                    <div className="col-span-2">
                      <a href={pForm.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sky-400 text-xs hover:underline">
                        <ExternalLink size={12} /> {t('analyse_inventar_link')}
                      </a>
                    </div>
                  )}
                  <p className="col-span-2 text-xs text-slate-600">{t('batch_uebernommen_text')}</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{t('batch')}</label>
                      <input className="input" placeholder={t('eg_batch_nr')}
                        value={pForm.batch_number} onChange={e => setPForm(f => ({ ...f, batch_number: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">{t('quelle')}</label>
                      <input className="input" placeholder={t('eg_source_name')}
                        value={pForm.batch_source} onChange={e => setPForm(f => ({ ...f, batch_source: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('analyse_dok_pdf_bild')}</label>
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      batchFile ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-700 hover:border-slate-600'
                    }`}>
                      <FileUp size={18} className={batchFile ? 'text-sky-400' : 'text-slate-500'} />
                      <div className="flex-1 min-w-0">
                        {batchFile
                          ? <p className="text-sky-400 text-sm font-medium truncate">{batchFile.name}</p>
                          : pForm.batch_file_url
                            ? <p className="text-slate-300 text-sm truncate">{t('datei_vorhanden_text')}</p>
                            : <p className="text-slate-500 text-sm">{t('pdf_bild_auswaehlen')}</p>
                        }
                        <p className="text-slate-600 text-xs">{t('coa_rechnung_label')}</p>
                      </div>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={e => { if (e.target.files?.[0]) setBatchFile(e.target.files[0]) }} />
                    </label>
                    {pForm.batch_file_url && !batchFile && (
                      <div className="flex items-center gap-2 mt-2">
                        <a href={pForm.batch_file_url} target="_blank" rel="noopener noreferrer"
                          className="text-sky-400 text-xs hover:underline flex-1 truncate">
                          {t('dokument_anzeigen')}
                        </a>
                        <button className="text-red-400 text-xs hover:text-red-300"
                          onClick={() => setPForm(f => ({ ...f, batch_file_url: '' }))}>
                          {t('entfernen')}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── 5. Dosierung & Applikation ──────────────────────────────── */}
            <div className="px-5 py-4 border-b border-slate-800 space-y-3" data-ob="pep-dose">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t('dosierung_applikation_section')}
              </p>
              <div>
                <label className="label">{t('standard_dosis_label')}</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="number" placeholder={t('eg_500')}
                    value={pForm.default_dose} onChange={e => setPForm(f => ({ ...f, default_dose: e.target.value }))} />
                  <select className="select w-24" value={pForm.default_unit}
                    onChange={e => setPForm(f => ({ ...f, default_unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <p className="text-slate-600 text-xs mt-1">{t('fallback_info')}</p>
              </div>
              <div>
                <label className="label">{t('applikationsart_label')}</label>
                <select className="select" value={pForm.default_method}
                  onChange={e => setPForm(f => ({ ...f, default_method: e.target.value }))}>
                  {METHODS.map(m => <option key={m} value={m}>{t(METHOD_KEYS[m] ?? m)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('notizen_optional')}</label>
                <textarea className="input resize-none" rows={2}
                  value={pForm.notes} onChange={e => setPForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="px-5 py-4 flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowPeptideForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-pep-save" className="btn-primary flex-1" onClick={savePeptide}
                disabled={savingPeptide || uploadingFile}>
                {uploadingFile ? t('laedt_hoch') : savingPeptide ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {showCycleForm && cForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowCycleForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-400" />
                <h2 className="text-lg font-bold">{editingCycleId ? t('zyklus_bearbeiten') : t('neuer_zyklus_title')}</h2>
              </div>
              {cycleForPeptide && <p className="text-sky-400 text-sm mt-0.5 ml-6">{cycleForPeptide.name}</p>}
            </div>

            <div data-ob="cycle-core" className="space-y-4">
            <div>
              <label className="label">{t('zyklus_name')}</label>
              <input className="input" placeholder={t('zyklus_name_placeholder')}
                value={cForm.name} onChange={e => setCForm(f => f ? { ...f, name: e.target.value } : f)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('dosis_label')}</label>
                <input className="input" type="number" value={cForm.dose}
                  onChange={e => setCForm(f => f ? { ...f, dose: e.target.value } : f)} />
              </div>
              <div>
                <label className="label">{t('einheit_label')}</label>
                <select className="select" value={cForm.unit}
                  onChange={e => setCForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">{t('applikationsart_label')}</label>
              <select className="select" value={cForm.method}
                onChange={e => setCForm(f => f ? { ...f, method: e.target.value } : f)}>
                {METHODS.map(m => <option key={m} value={m}>{t(METHOD_KEYS[m] ?? m)}</option>)}
              </select>
            </div>

            <div>
              <label className="label">{t('frequenz')}</label>
              <select className="select" value={cForm.frequency}
                onChange={e => setCForm(f => {
                  if (!f) return f
                  const newFreq = e.target.value
                  const newSlots = intakeSlots(newFreq)
                  const keepDays = ['Wochentage wählen', '2x täglich', '3x täglich', 'Alle X Tage'].includes(newFreq)
                  return {
                    ...f,
                    frequency: newFreq,
                    intake_times: f.intake_times.slice(0, newSlots),
                    intake_time_customs: f.intake_time_customs.slice(0, newSlots),
                    schedule_days: keepDays ? f.schedule_days : [],
                  }
                })}>
                {BASE_FREQUENCIES.map(freq => <option key={freq} value={freq}>{t(FREQ_KEYS[freq] ?? freq)}</option>)}
              </select>
            </div>
            </div>

            {cForm.frequency === 'Alle X Tage' && (
              <div>
                <label className="label">{t('alle_x_tage_frage')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{t('alle_prefix')}</span>
                  <input className="input w-24" type="number" min="2" max="30"
                    value={cForm.x_days_interval}
                    onChange={e => setCForm(f => f ? { ...f, x_days_interval: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm">{t('tage_suffix')}</span>
                </div>
              </div>
            )}

            {(['Wochentage wählen', '2x täglich', '3x täglich', 'Alle X Tage'].includes(cForm.frequency)) && (
              <div>
                <label className="label">{t('injektionstage_label')}</label>
                <div className="flex gap-2">
                  {WOCHENTAGE.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                        cForm.schedule_days.includes(day) ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
                {cForm.schedule_days.length > 0 && (
                  <p className="text-sky-400 text-xs mt-2">{t('ausgewaehlt_label')} {cForm.schedule_days.join(', ')}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t('startdatum_label')}</label>
                <input className="input" type="date" value={cForm.start_date}
                  onChange={e => setCForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
              <div>
                <label className="label">{t('enddatum_optional_label')}</label>
                <input className="input" type="date" value={cForm.end_date}
                  onChange={e => setCForm(f => f ? { ...f, end_date: e.target.value } : f)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{t('einnahmezeitpunkt')}</label>
                <span className="text-xs text-slate-500">optional</span>
              </div>
              {Array.from({ length: intakeSlots(cForm.frequency) }, (_, slotIdx) => (
                <div key={slotIdx} className={slotIdx > 0 ? 'mt-3' : ''}>
                  {intakeSlots(cForm.frequency) > 1 && (
                    <p className="text-xs text-slate-400 mb-1.5 font-medium">
                      {t('einnahme_nr', { n: slotIdx + 1 })}
                    </p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.entries(INTAKE_TIME_CONFIG) as [string, { labelKey: string; emoji: string }][]).map(([key, cfg]) => {
                      const isActive = cForm.intake_times[slotIdx] === key
                      return (
                        <button key={key} type="button"
                          onClick={() => setCForm(f => {
                            if (!f) return f
                            const newTimes = [...f.intake_times]
                            const newCustoms = [...f.intake_time_customs]
                            newTimes[slotIdx] = isActive ? '' : key
                            if (isActive) newCustoms[slotIdx] = ''
                            return { ...f, intake_times: newTimes, intake_time_customs: newCustoms }
                          })}
                          className={`py-2.5 rounded-xl text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                            isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}>
                          <span className="text-base">{cfg.emoji}</span>
                          {t(cfg.labelKey)}
                        </button>
                      )
                    })}
                  </div>
                  {cForm.intake_times[slotIdx] === 'custom' && (
                    <input className="input mt-2" type="time"
                      value={cForm.intake_time_customs[slotIdx] ?? ''}
                      onChange={e => setCForm(f => {
                        if (!f) return f
                        const newCustoms = [...f.intake_time_customs]
                        newCustoms[slotIdx] = e.target.value
                        return { ...f, intake_time_customs: newCustoms }
                      })} />
                  )}
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Bell size={13} className="text-sky-400" /> {t('erinnerung_label')}
                </label>
                <span className="text-xs text-slate-500">{t('mehrfachauswahl_hint')}</span>
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
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
                        active ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      <span>{t(opt.labelKey)}</span>
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
                  {t('erinnerung_info', { n: cForm.reminder.length })}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowCycleForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-cycle-save" className="btn-primary flex-1" onClick={saveCycle} disabled={savingCycle}>
                {savingCycle ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DOSISERHÖHUNG-FORMULAR ═══════════════════════════════════════════ */}
      {showEscForm && eForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowEscForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-orange-400" />
                <h2 className="text-lg font-bold">
                  {editingEscId ? t('esc_bearbeiten') : t('esc_hinzufuegen')}
                </h2>
              </div>
              {escForCycle && <p className="text-slate-400 text-sm mt-0.5 ml-6">{escForCycle.name}</p>}
            </div>

            <div>
              <label className="label">{t('dosis_erhoeht_um')}</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="number" placeholder={t('eg_100')}
                  value={eForm.increase_amount}
                  onChange={e => setEForm(f => f ? { ...f, increase_amount: e.target.value } : f)} />
                <select className="select w-28" value={eForm.unit}
                  onChange={e => setEForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">{t('ab_wann_label')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'date',        labelKey: 'festes_datum' },
                  { value: 'after_days',  labelKey: 'nach_x_tagen' },
                  { value: 'after_weeks', labelKey: 'nach_x_wochen' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEForm(f => f ? { ...f, start_type: opt.value } : f)}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      eForm.start_type === opt.value ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {eForm.start_type === 'date' && (
              <div>
                <label className="label">{t('datum_label')}</label>
                <input className="input" type="date" value={eForm.start_date}
                  onChange={e => setEForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
            )}
            {eForm.start_type === 'after_days' && (
              <div>
                <label className="label">{t('tage_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">{t('tagen_suffix')}</span>
                </div>
              </div>
            )}
            {eForm.start_type === 'after_weeks' && (
              <div>
                <label className="label">{t('wochen_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">{t('wochen_suffix')}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label">{t('notizen_optional')}</label>
              <textarea className="input resize-none" rows={2}
                placeholder={t('esc_notes_placeholder')}
                value={eForm.notes}
                onChange={e => setEForm(f => f ? { ...f, notes: e.target.value } : f)} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowEscForm(false)}>{t('cancel')}</button>
              <button className="btn-primary flex-1" onClick={saveEsc} disabled={savingEsc}>
                {savingEsc ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ VERWERFEN DIALOG ═════════════════════════════════════════════════ */}
      {verwerfenTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" data-app-modal>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-lg">{t('peptid_verwerfen_title')}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              <span className="text-white font-medium">{verwerfenTarget.name}</span> {t('peptid_verwerfen_desc')}
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-sky-500"
                checked={verwerfenDontAsk}
                onChange={e => setVerwerfenDontAsk(e.target.checked)} />
              {t('nicht_mehr_fragen')}
            </label>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setVerwerfenTarget(null)}>{t('no')}</button>
              <button onClick={confirmVerwerfen}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors text-sm">
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REKONSTITUTION DIALOG ═════════════════════════════════════════════ */}
      {rekonstitutionTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" data-app-modal>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-lg">{t('rekonstitution_wdh_title')}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('rekonstitution_wdh_desc')}
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-sky-500"
                checked={rekonstitutionDontAsk}
                onChange={e => setRekonstitutionDontAsk(e.target.checked)} />
              {t('nicht_mehr_fragen')}
            </label>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setRekonstitutionTarget(null)}>{t('no')}</button>
              <button onClick={confirmRekonstitution}
                className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors text-sm">
                {t('yes')}
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
        const invItem = inventory.find(i => i.id === p.inventory_item_id)

        let expiryDays: number | null = null
        let expiryDate: string | null = null
        if (p.reconstitution_date && p.expiry_days) {
          const exp = addDays(parseISO(p.reconstitution_date), p.expiry_days)
          expiryDays = differenceInDays(exp, new Date())
          expiryDate = format(exp, 'dd.MM.yyyy')
        }

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
            onClick={() => setInfoPeptide(null)}>
            <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]"
              onClick={e => e.stopPropagation()}>

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

                {/* Inventar-Verknüpfung */}
                {invItem && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <Archive size={13} className="text-sky-400 shrink-0" />
                    <p className="text-sky-400 text-xs">{t('aus_inventar_badge')} <span className="font-medium">{invItem.name}</span> · {invItem.mg_per_vial} mg/Vial</p>
                  </div>
                )}

                {/* Dosierung */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('dosierung_section')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">{t('standard_dosis_label')}</p>
                      <p className="text-white font-semibold mt-0.5">
                        {p.default_dose ? `${p.default_dose} ${p.default_unit}` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">{t('applikation_info')}</p>
                      <p className="text-white font-semibold mt-0.5">{t(METHOD_KEYS[p.default_method] ?? p.default_method)}</p>
                    </div>
                  </div>
                </div>

                {/* Rekonstitution */}
                {(p.vial_amount_mg || p.reconstitution_ml) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('wirkstoff_rekonstitution')}</p>
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
                          <p className="text-slate-500 text-xs mt-0.5">{t('ml_fluessigkeit')}</p>
                        </div>
                      )}
                      {syringeMl && syringeUnits && (
                        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{syringeMl} mL</p>
                          <p className="text-slate-500 text-xs mt-0.5">{syringeUnits} {t('einh_kurz')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Haltbarkeit */}
                {(p.reconstitution_date || expiryDate) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('haltbarkeit_section_info')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.reconstitution_date && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('datum_rekonstitution')}</p>
                          <p className="text-white font-semibold mt-0.5">{format(parseISO(p.reconstitution_date), 'dd.MM.yyyy')}</p>
                        </div>
                      )}
                      {expiryDate && expiryDays !== null && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('ablauf_label')}</p>
                          <p className={`font-semibold mt-0.5 ${expiryDays > 7 ? 'text-emerald-400' : expiryDays > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {expiryDate}
                          </p>
                          <p className={`text-xs ${expiryDays > 7 ? 'text-emerald-500' : expiryDays > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                            {expiryDays > 0 ? t('noch_n_tage_ablauf', { n: expiryDays }) : t('abgelaufen_warn')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bestand */}
                {(p.vials_in_stock !== null || p.vials_initial) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('bestand_section')}</p>
                    <div className="bg-slate-800/60 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold">{p.vials_in_stock ?? 0} Vials</span>
                        {(p.vials_initial ?? 0) > 0 && (
                          <span className="text-slate-400 text-xs">{t('von_n_gesamt', { n: p.vials_initial })}</span>
                        )}
                      </div>
                      {(p.vials_initial ?? 0) > 0 && (() => {
                        const pct = Math.max(0, Math.min(100, ((p.vials_in_stock ?? 0) / p.vials_initial!) * 100))
                        const bar = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
                        const txt = pct > 50 ? 'text-emerald-400' : pct > 25 ? 'text-amber-400' : 'text-red-400'
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('batch_herkunft_section')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.batch_number && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('batch')}</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_number}</p>
                        </div>
                      )}
                      {p.batch_source && (
                        <div className="bg-slate-800/60 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('quelle')}</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_source}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dokument */}
                {p.batch_file_url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('analyse_dokument_section')}</p>
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
                          <p className="text-white text-sm font-medium">{t('pdf_oeffnen')}</p>
                          <p className="text-slate-500 text-xs truncate">{p.batch_file_url.split('/').pop()}</p>
                        </div>
                        <ExternalLink size={14} className="text-slate-500 shrink-0" />
                      </a>
                    )}
                    {!isImage && !isPdf && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sky-400 text-sm hover:underline">
                        <ExternalLink size={14} /> {t('dokument_oeffnen')}
                      </a>
                    )}
                  </div>
                )}

                {/* Notizen */}
                {p.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('notizen_section')}</p>
                    <p className="text-slate-300 text-sm bg-slate-800/60 rounded-xl px-4 py-3 whitespace-pre-wrap">{p.notes}</p>
                  </div>
                )}
              </div>

              <div className="px-5 pb-8 pt-2">
                <button className="btn-secondary w-full" onClick={() => setInfoPeptide(null)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
