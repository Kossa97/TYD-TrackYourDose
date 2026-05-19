import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
function SyringeScale({ drawUnits, maxUnits, t }: { drawUnits: number; maxUnits: number; t: (key: string) => string }) {
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
      {/* Label */}
      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-center mb-1"
        style={{ color: 'rgba(0,204,245,0.55)' }}>
        {t('einheiten_aufziehen')}
      </p>

      {/* Large HUD number */}
      <p className="text-6xl font-bold text-center mb-5 tabular-nums"
        style={{
          background: 'linear-gradient(160deg, #ffffff 0%, #a0eeff 40%, #00ccf5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none',
          filter: 'drop-shadow(0 0 18px rgba(0,204,245,0.35))',
          letterSpacing: '-0.03em',
        }}>
        {drawUnits}
      </p>

      {/* Scale labels */}
      <div className="flex justify-between px-0.5 mb-1.5">
        {labels.map(l => (
          <span key={l} className="text-[9px] font-mono tabular-nums leading-none"
            style={{ color: 'rgba(0,204,245,0.40)' }}>
            {l}
          </span>
        ))}
      </div>

      {/* HUD Scale bar */}
      <div className="relative h-10 overflow-hidden"
        style={{
          borderRadius: '10px',
          background: 'rgba(1, 3, 12, 0.92)',
          border: '1px solid rgba(0,204,245,0.12)',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(0,0,0,0.5)',
        }}>

        {/* Cyan fill with glow */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(0,180,240,0.18) 0%, rgba(0,204,245,0.30) 70%, rgba(0,220,255,0.40) 100%)',
            borderRight: pct > 1 ? '1px solid rgba(0,220,255,0.50)' : 'none',
            boxShadow: 'inset -4px 0 12px rgba(0,204,245,0.15)',
          }}
        />

        {/* Glow stripe at fill edge */}
        {pct > 1 && (
          <div
            className="absolute top-0 bottom-0 transition-all duration-500"
            style={{
              left: `calc(${pct}% - 2px)`,
              width: '3px',
              background: 'linear-gradient(180deg, rgba(0,230,255,0.0) 0%, rgba(0,230,255,0.8) 45%, rgba(0,230,255,0.8) 55%, rgba(0,230,255,0.0) 100%)',
              boxShadow: '0 0 10px rgba(0,220,255,0.6)',
              filter: 'blur(0.5px)',
            }}
          />
        )}

        {/* Precision tick marks */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          viewBox={`0 0 ${tickCount} 1`}
        >
          {Array.from({ length: tickCount + 1 }, (_, i) => {
            const isMajor = i % 2 === 0
            return (
              <line
                key={i}
                x1={i} y1={isMajor ? 0 : 0.3}
                x2={i} y2={isMajor ? 0.7 : 0.55}
                stroke={isMajor ? 'rgba(0,204,245,0.30)' : 'rgba(255,255,255,0.10)'}
                strokeWidth={isMajor ? 0.12 : 0.07}
              />
            )
          })}
        </svg>

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-full"
          style={{ background: 'linear-gradient(90deg, rgba(0,204,245,0.08), transparent)' }} />
      </div>

      {/* mL readout */}
      <p className="text-right mt-1.5 pr-0.5"
        style={{ fontSize: '10px', color: 'rgba(0,204,245,0.45)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
        ≈ <span style={{ color: 'rgba(0,204,245,0.80)', fontWeight: 600 }}>
          {(drawUnits / (maxUnits / (maxUnits <= 50 ? 0.5 : 1))).toFixed(3)}
        </span> mL
      </p>
    </div>
  )
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export function Rechner() {
  const { t } = useTranslation()
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
  )?.label ?? `${sMl} mL · ${sUnits} ${t('einh_kurz')}`

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={20} className="text-sky-400" />
        <h1 className="text-xl font-bold">{t('rechner_title')}</h1>
      </div>

      {/* ── Ergebnis-Karte ─────────────────────────────────────────────── */}
      <div className="card mb-4">
        {result ? (
          <>
            <SyringeScale drawUnits={result.drawUnits} maxUnits={result.maxUnits} t={t} />
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: result.concMgPerMl, unit: 'mg/mL',   label: t('konzentration'), sub: null },
                { value: `${result.fillPct}%`, unit: t('spritze_unit'), label: t('gefuellt'),     sub: `${result.doseMl} mL` },
                { value: String(result.dosesPerVial), unit: t('dosen_unit'), label: t('pro_vial'), sub: null },
              ].map(({ value, unit, label, sub }) => (
                <div key={label} style={{
                  background: 'rgba(0,10,24,0.82)',
                  border: '1px solid rgba(0,204,245,0.10)',
                  borderRadius: '13px',
                  padding: '10px 6px',
                  textAlign: 'center' as const,
                  boxShadow: 'inset 0 1px 0 rgba(0,204,245,0.05), 0 4px 14px rgba(0,0,0,0.55)',
                }}>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: '#e8f4ff', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </p>
                  <p style={{ fontSize: '9px', color: 'rgba(0,204,245,0.55)', marginTop: '3px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {unit}
                  </p>
                  <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.20)', marginTop: '1px' }}>
                    {sub ?? label}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Calculator size={32} className="mx-auto mb-3 text-slate-700" />
            <p className="text-slate-500 text-sm">{t('felder_ausfullen')}</p>
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
                {t('peptid_uebernehmen')}
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
                    <span className="text-slate-500 text-sm">{t('auswaehlen')}</span>
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
                {t('wirkstoff_uebernommen')}
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
            <span className="text-slate-300 text-sm font-medium">{t('spritzengroesse')}</span>
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
                <p className="text-xs text-slate-500 mb-2">{t('eigene_werte')}</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input className="input py-1.5 text-sm pr-7" type="number" step="0.1" placeholder="mL"
                      value={sMl} onChange={e => setSMl(e.target.value)} onClick={e => e.stopPropagation()} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mL</span>
                  </div>
                  <div className="relative flex-1">
                    <input className="input py-1.5 text-sm pr-10" type="number" placeholder={t('einh_kurz')}
                      value={sUnits} onChange={e => setSUnits(e.target.value)} onClick={e => e.stopPropagation()} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{t('einh_kurz')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wirkstoff pro Vial */}
        <div className="flex items-center justify-between py-3.5 px-1">
          <span className="text-slate-300 text-sm font-medium">{t('wirkstoff_pro_vial')}</span>
          <div className="relative w-32">
            <input
              className="input py-1.5 text-sm text-right pr-8"
              type="number" placeholder={t('eg_10')}
              value={vialMg} onChange={e => { setVialMg(e.target.value); setSelectedPeptide(null) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mg</span>
          </div>
        </div>

        {/* Zugefügte Flüssigkeit */}
        <div className="flex items-center justify-between py-3.5 px-1">
          <span className="text-slate-300 text-sm font-medium">{t('zugefuegte_fluessigkeit')}</span>
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
          <span className="text-slate-300 text-sm font-medium">{t('dosis_label')}</span>
          <div className="flex gap-1.5 items-center">
            <div className="relative w-24">
              <input
                className="input py-1.5 text-sm text-right"
                type="number" placeholder={t('eg_500')}
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
        {t('info_disclaimer')}
      </p>
    </div>
  )
}
