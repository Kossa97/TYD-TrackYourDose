import { useEffect, useState } from 'react'
import { Calculator, ChevronDown, FlaskConical, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Konstanten ───────────────────────────────────────────────────────────────
const SYRINGE_PRESETS = [
  { label: '1 mL · 100 Einh. (U-100)', ml: 1,   units: 100 },
  { label: '0,5 mL · 50 Einh. (U-100)', ml: 0.5, units: 50  },
  { label: '0,3 mL · 30 Einh. (U-100)', ml: 0.3, units: 30  },
  { label: '2 mL · 200 Einh. (U-100)',  ml: 2,   units: 200 },
  { label: '1 mL · 40 Einh. (U-40)',    ml: 1,   units: 40  },
]
const DOSE_UNITS = ['mcg', 'mg', 'IU']

interface Peptide {
  id: string
  name: string
  vial_amount_mg: number | null
  reconstitution_ml: number | null
}

// ─── Rechnung ─────────────────────────────────────────────────────────────────
function calculate(
  vialMg: string, reconMl: string,
  dose: string, doseUnit: string,
  sMl: string, sUnits: string,
) {
  const vMg = parseFloat(vialMg)
  const rMl = parseFloat(reconMl)
  const d   = parseFloat(dose)
  const ml  = parseFloat(sMl)  || 1
  const u   = parseFloat(sUnits) || 100
  if (!vMg || !rMl || !d) return null

  const unitsPerMl   = u / ml
  const doseInMcg    = doseUnit === 'mg' ? d * 1000 : doseUnit === 'IU' ? d : d
  const concMcgPerMl = (vMg * 1000) / rMl
  const doseMl       = doseInMcg / concMcgPerMl
  const drawUnits    = doseMl * unitsPerMl
  const fillPct      = (doseMl / ml) * 100
  const dosesPerVial = (vMg * 1000) / doseInMcg

  return {
    drawUnits:    Math.round(drawUnits * 10) / 10,
    doseMl:       doseMl.toFixed(3),
    concMgPerMl:  (vMg / rMl).toFixed(2),
    fillPct:      Math.min(100, fillPct).toFixed(1),
    dosesPerVial: Math.floor(dosesPerVial),
    maxUnits:     u,
  }
}

// ─── Spritzenskala ────────────────────────────────────────────────────────────
function SyringeScale({ drawUnits, maxUnits }: { drawUnits: number; maxUnits: number }) {
  const pct        = Math.min(100, Math.max(0, (drawUnits / maxUnits) * 100))
  const majorStep  = maxUnits <= 50 ? 5 : 10
  const minorStep  = majorStep / 2
  const tickCount  = maxUnits / minorStep
  const labels     = Array.from(
    { length: Math.floor(maxUnits / majorStep) + 1 },
    (_, i) => i * majorStep,
  )

  return (
    <div className="mb-4">
      <p className="text-xs text-slate-400 text-center mb-0.5">Einheiten aufziehen</p>
      <p className="text-6xl font-bold text-center mb-4"
        style={{ background: 'linear-gradient(90deg,#38bdf8,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {drawUnits}
      </p>

      <div className="flex justify-between px-0.5 mb-1">
        {labels.map(l => (
          <span key={l} className="text-[10px] text-slate-500 leading-none">{l}</span>
        ))}
      </div>

      <div className="relative h-10 rounded-xl bg-slate-800 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-xl transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 60%, #c084fc 100%)',
            opacity: 0.85,
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${tickCount} 1`}
        >
          {Array.from({ length: tickCount + 1 }, (_, i) => {
            const isMajor = i % 2 === 0
            return (
              <line
                key={i}
                x1={i} y1={0}
                x2={i} y2={isMajor ? 0.65 : 0.4}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={isMajor ? 0.15 : 0.08}
              />
            )
          })}
        </svg>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/90 transition-all duration-500"
          style={{ left: `calc(${pct}% - 1px)` }}
        />
      </div>

      <p className="text-xs text-slate-500 text-right mt-1 pr-1">
        entspricht <span className="text-slate-300 font-medium">{(drawUnits / (maxUnits / (maxUnits <= 50 ? 0.5 : 1))).toFixed(3)} mL</span>
      </p>
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export function Rechner() {
  const { user } = useAuth()
  const [vialMg,    setVialMg]    = useState('')
  const [reconMl,   setReconMl]   = useState('2')
  const [dose,      setDose]      = useState('')
  const [doseUnit,  setDoseUnit]  = useState('mcg')
  const [sMl,       setSMl]       = useState('1')
  const [sUnits,    setSUnits]    = useState('100')
  const [syringeOpen, setSyringeOpen] = useState(false)

  // Peptid-Auswahl
  const [peptides,        setPeptides]        = useState<Peptide[]>([])
  const [selectedPeptide, setSelectedPeptide] = useState<Peptide | null>(null)
  const [peptideOpen,     setPeptideOpen]     = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('peptides')
      .select('id, name, vial_amount_mg, reconstitution_ml')
      .eq('user_id', user.id)
      .not('vial_amount_mg', 'is', null)
      .order('name')
      .then(({ data }) => { if (data) setPeptides(data as Peptide[]) })
  }, [user])

  const selectPeptide = (p: Peptide) => {
    setSelectedPeptide(p)
    if (p.vial_amount_mg)    setVialMg(p.vial_amount_mg.toString())
    if (p.reconstitution_ml) setReconMl(p.reconstitution_ml.toString())
    setPeptideOpen(false)
  }

  const clearPeptide = () => {
    setSelectedPeptide(null)
    setVialMg('')
  }

  const result = calculate(vialMg, reconMl, dose, doseUnit, sMl, sUnits)

  const selectSyringe = (p: typeof SYRINGE_PRESETS[0]) => {
    setSMl(p.ml.toString())
    setSUnits(p.units.toString())
    setSyringeOpen(false)
  }

  const currentSyringeLabel = SYRINGE_PRESETS.find(
    p => p.ml === parseFloat(sMl) && p.units === parseFloat(sUnits)
  )?.label ?? `${sMl} mL · ${sUnits} Einh.`

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={20} className="text-sky-400" />
        <h1 className="text-xl font-bold">Rechner</h1>
      </div>

      {/* ── Ergebnis-Karte ─────────────────────────────────────────────── */}
      <div className="card mb-4">
        {result ? (
          <>
            <SyringeScale drawUnits={result.drawUnits} maxUnits={result.maxUnits} />
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-base">{result.concMgPerMl}</p>
                <p className="text-slate-500 text-xs mt-0.5">mg/mL</p>
                <p className="text-slate-600 text-xs">Konzentration</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-base">{result.fillPct}%</p>
                <p className="text-slate-500 text-xs mt-0.5">Spritze gefüllt</p>
                <p className="text-slate-600 text-xs">{result.doseMl} mL</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-base">{result.dosesPerVial}</p>
                <p className="text-slate-500 text-xs mt-0.5">Dosen / Vial</p>
                <p className="text-slate-600 text-xs">bei dieser Dosis</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Calculator size={32} className="mx-auto mb-3 text-slate-700" />
            <p className="text-slate-500 text-sm">Felder ausfüllen um das Ergebnis zu sehen</p>
          </div>
        )}
      </div>

      {/* ── Eingaben ───────────────────────────────────────────────────── */}
      <div className="card space-y-0 divide-y divide-slate-800">

        {/* Peptid aus Meine Peptide */}
        {peptides.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setPeptideOpen(o => !o)}
              className="w-full flex items-center justify-between py-3.5 px-1 text-left"
            >
              <span className="text-slate-300 text-sm font-medium flex items-center gap-1.5">
                <FlaskConical size={13} className="text-sky-400" />
                Peptid übernehmen
              </span>
              <div className="flex items-center gap-1.5">
                {selectedPeptide ? (
                  <>
                    <span className="text-sky-400 text-sm font-medium">{selectedPeptide.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); clearPeptide() }}
                      className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-slate-500 text-sm">auswählen</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${peptideOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </div>
            </button>
            {peptideOpen && (
              <div className="absolute left-0 right-0 top-full bg-slate-800 border border-slate-700 rounded-xl z-10 overflow-hidden shadow-xl max-h-52 overflow-y-auto">
                {peptides.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPeptide(p)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between
                      ${selectedPeptide?.id === p.id
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'hover:bg-slate-700 text-slate-300'}`}
                  >
                    <span>{p.name}</span>
                    <span className="text-slate-500 text-xs ml-2 shrink-0">
                      {p.vial_amount_mg} mg
                      {p.reconstitution_ml ? ` · ${p.reconstitution_ml} mL` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedPeptide && (
              <p className="text-xs text-slate-600 px-1 pb-2 -mt-1">
                Wirkstoff und Flüssigkeit wurden übernommen — du kannst sie unten anpassen.
              </p>
            )}
          </div>
        )}

        {/* Spritzengröße */}
        <div className="relative">
          <button
            onClick={() => setSyringeOpen(o => !o)}
            className="w-full flex items-center justify-between py-3.5 px-1 text-left"
          >
            <span className="text-slate-300 text-sm font-medium">Spritzengröße</span>
            <div className="flex items-center gap-1.5 text-slate-400 text-sm">
              <span>{currentSyringeLabel}</span>
              <ChevronDown size={14} className={`transition-transform ${syringeOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {syringeOpen && (
            <div className="absolute left-0 right-0 top-full bg-slate-800 border border-slate-700 rounded-xl z-10 overflow-hidden shadow-xl">
              {SYRINGE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => selectSyringe(p)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors
                    ${p.ml === parseFloat(sMl) && p.units === parseFloat(sUnits)
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'hover:bg-slate-700 text-slate-300'}`}
                >
                  {p.label}
                </button>
              ))}
              <div className="px-4 py-3 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Eigene Werte</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input className="input py-1.5 text-sm pr-7" type="number" step="0.1" placeholder="mL"
                      value={sMl} onChange={e => setSMl(e.target.value)} onClick={e => e.stopPropagation()} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mL</span>
                  </div>
                  <div className="relative flex-1">
                    <input className="input py-1.5 text-sm pr-10" type="number" placeholder="Einh."
                      value={sUnits} onChange={e => setSUnits(e.target.value)} onClick={e => e.stopPropagation()} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">Einh.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wirkstoff pro Vial */}
        <div className="flex items-center justify-between py-3.5 px-1">
          <span className="text-slate-300 text-sm font-medium">Wirkstoff pro Vial</span>
          <div className="relative w-32">
            <input
              className="input py-1.5 text-sm text-right pr-8"
              type="number" placeholder="z.B. 10"
              value={vialMg} onChange={e => { setVialMg(e.target.value); setSelectedPeptide(null) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mg</span>
          </div>
        </div>

        {/* Zugefügte Flüssigkeit */}
        <div className="flex items-center justify-between py-3.5 px-1">
          <span className="text-slate-300 text-sm font-medium">Zugefügte Flüssigkeit</span>
          <div className="relative w-32">
            <input
              className="input py-1.5 text-sm text-right pr-8"
              type="number" step="0.1" placeholder="2"
              value={reconMl} onChange={e => setReconMl(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mL</span>
          </div>
        </div>

        {/* Dosis */}
        <div className="flex items-center justify-between py-3.5 px-1">
          <span className="text-slate-300 text-sm font-medium">Dosis</span>
          <div className="flex gap-1.5 items-center">
            <div className="relative w-24">
              <input
                className="input py-1.5 text-sm text-right"
                type="number" placeholder="z.B. 500"
                value={dose} onChange={e => setDose(e.target.value)}
              />
            </div>
            <select
              className="select py-1.5 text-sm w-20"
              value={doseUnit} onChange={e => setDoseUnit(e.target.value)}
            >
              {DOSE_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

      </div>

      <p className="text-slate-600 text-xs text-center mt-4 px-4">
        Nur zu Informationszwecken. Keine medizinische Beratung.
      </p>
    </div>
  )
}
