import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, addDays, parseISO, differenceInDays } from 'date-fns'
import { Package, Minus, Plus, AlertTriangle, Boxes } from 'lucide-react'
import toast from 'react-hot-toast'

interface PeptideStock {
  id: string
  name: string
  vials_in_stock: number | null
  vials_initial: number | null
  vial_amount_mg: number | null
  reconstitution_ml: number | null
  reconstitution_date: string | null
  expiry_days: number | null
  batch_number: string | null
  batch_source: string | null
}

export function Vorrat() {
  const { user } = useAuth()
  const [peptides, setPeptides] = useState<PeptideStock[]>([])

  const load = async () => {
    const { data } = await supabase
      .from('peptides')
      .select('id, name, vials_in_stock, vials_initial, vial_amount_mg, reconstitution_ml, reconstitution_date, expiry_days, batch_number, batch_source')
      .eq('user_id', user!.id)
      .order('name')
    if (data) setPeptides(data as PeptideStock[])
  }

  useEffect(() => { load() }, [])

  const updateStock = async (id: string, newStock: number) => {
    if (newStock < 0) return
    const { error } = await supabase.from('peptides').update({ vials_in_stock: newStock }).eq('id', id)
    if (!error) {
      setPeptides(ps => ps.map(p => p.id === id ? { ...p, vials_in_stock: newStock } : p))
      toast.success('Bestand aktualisiert')
    }
  }

  const withStock    = peptides.filter(p => (p.vials_in_stock ?? 0) > 0 || (p.vials_initial ?? 0) > 0)
  const withoutStock = peptides.filter(p => (p.vials_in_stock ?? 0) === 0 && (p.vials_initial ?? 0) === 0)

  const renderCard = (p: PeptideStock) => {
    const stock   = p.vials_in_stock ?? 0
    const initial = p.vials_initial ?? 0
    const pct     = initial > 0 ? Math.max(0, Math.min(100, (stock / initial) * 100)) : null
    const barColor  = pct === null ? 'bg-slate-600'
      : pct > 50 ? 'bg-emerald-500'
      : pct > 25 ? 'bg-amber-500'
      : 'bg-red-500'
    const textColor = pct === null ? 'text-slate-300'
      : pct > 50 ? 'text-emerald-400'
      : pct > 25 ? 'text-amber-400'
      : 'text-red-400'
    const totalMg = p.vial_amount_mg ? stock * p.vial_amount_mg : null

    let expiryDays: number | null = null
    let expiryDate: Date | null = null
    if (p.reconstitution_date && p.expiry_days) {
      expiryDate = addDays(parseISO(p.reconstitution_date), p.expiry_days)
      expiryDays = differenceInDays(expiryDate, new Date())
    }

    return (
      <div key={p.id} className="card">
        {/* Kopfzeile */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">{p.name}</p>
            <div className="flex flex-wrap gap-x-3 text-xs text-slate-400 mt-0.5">
              {totalMg !== null && <span>{totalMg} mg gesamt</span>}
              {p.batch_source && <span>· {p.batch_source}</span>}
              {p.batch_number && <span>· #{p.batch_number}</span>}
            </div>
          </div>

          {/* +/- Steuerung */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => updateStock(p.id, stock - 1)}
              disabled={stock <= 0}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
              <Minus size={14} />
            </button>
            <span className={`text-lg font-bold w-10 text-center ${textColor}`}>{stock}</span>
            <button
              onClick={() => updateStock(p.id, stock + 1)}
              className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700
                transition-colors flex items-center justify-center">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Fortschrittsbalken */}
        {pct !== null && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-semibold shrink-0 ${textColor}`}>
              {Math.round(pct)}% · {stock}/{initial} Vials
            </span>
          </div>
        )}

        {/* Haltbarkeit */}
        {expiryDays !== null && expiryDate && (
          <div className={`flex items-center gap-1.5 text-xs mt-1 ${
            expiryDays > 7 ? 'text-emerald-400' : expiryDays > 0 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {expiryDays <= 7 && <AlertTriangle size={11} />}
            {expiryDays > 0
              ? `Haltbar noch ${expiryDays} Tag${expiryDays !== 1 ? 'e' : ''}`
              : '⚠ Abgelaufen!'}
            <span className="text-slate-600 ml-1">
              · bis {format(expiryDate, 'dd.MM.yyyy')}
            </span>
          </div>
        )}

        {/* Warnung: kein Vorrat mehr */}
        {stock === 0 && initial > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
            <AlertTriangle size={11} /> Vorrat aufgebraucht
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Boxes size={20} className="text-sky-400" />
        <h1 className="text-xl font-bold">Vorrat</h1>
      </div>

      {peptides.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <Package size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Peptide angelegt</p>
          <p className="text-xs mt-1">Gehe zu „Peptide" und trage Vials ein</p>
        </div>
      )}

      {/* Peptide mit Vorrat */}
      {withStock.length > 0 && (
        <div className="space-y-3">
          {withStock.map(renderCard)}
        </div>
      )}

      {/* Peptide ohne Vorrat-Eintrag */}
      {withoutStock.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Kein Vorrat eingetragen
          </p>
          <div className="space-y-2">
            {withoutStock.map(p => (
              <div key={p.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-sm">{p.name}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateStock(p.id, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700
                      transition-colors flex items-center justify-center">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
