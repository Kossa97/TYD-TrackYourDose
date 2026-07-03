import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type { DailyLogEntry } from '../types'
import { fieldLabel, inputStyle, SLIDER_CSS } from '../styles'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

interface Props {
  logs: DailyLogEntry[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function TodayLogSheet({ logs, open, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [date, setDate] = useState(todayStr())
  const [energie, setEnergie] = useState<number | null>(null)
  const [schlaf, setSchlaf] = useState<number | null>(null)
  const [wohlbefinden, setWohlbefinden] = useState<number | null>(null)
  const [libido, setLibido] = useState<number | null>(null)
  const [weight, setWeight] = useState('')
  // id des bestehenden Tageseintrags — beim Speichern wird er aktualisiert
  // statt einen zweiten Punkt für denselben Tag anzulegen
  const [weightRowId, setWeightRowId] = useState<string | null>(null)
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const existing = logs.find(l => l.log_date === date)
    setEnergie(existing?.energie ?? null)
    setSchlaf(existing?.schlaf ?? null)
    setWohlbefinden(existing?.wohlbefinden ?? null)
    setLibido(existing?.libido ?? null)
    setBodyFat(existing?.body_fat_pct != null ? String(existing.body_fat_pct) : '')
    setWeight('')
    setWeightRowId(null)
  }, [date, logs, open])

  useEffect(() => {
    if (!open || !user) return
    void supabase
      .from('weight_logs')
      .select('id, weight_kg')
      .eq('user_id', user.id)
      .gte('logged_at', `${date}T00:00:00`)
      .lte('logged_at', `${date}T23:59:59`)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.weight_kg != null) setWeight(String(data.weight_kg))
        setWeightRowId(data?.id != null ? String(data.id) : null)
      })
  }, [date, open, user])

  if (!open) return null

  const save = async () => {
    if (!user) return

    const hasWellness =
      energie != null || schlaf != null || wohlbefinden != null || libido != null || bodyFat.trim() !== ''
    const hasWeight = weight.trim() !== ''

    if (!hasWellness && !hasWeight) {
      toast.error('Bitte mindestens einen Wert eintragen')
      return
    }

    setSaving(true)

    if (hasWellness) {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        log_date: date,
        energie,
        schlaf,
        wohlbefinden,
        libido,
        body_fat_pct: bodyFat.trim() ? Number(bodyFat) : null,
      }
      const { error } = await supabase
        .from('daily_logs')
        .upsert(payload, { onConflict: 'user_id,log_date' })
      if (error) {
        setSaving(false)
        toast.error(`Speichern fehlgeschlagen: ${error.message}`)
        return
      }
    }

    if (hasWeight) {
      const kg = Number(weight)
      if (!Number.isFinite(kg)) {
        setSaving(false)
        toast.error('Ungültiges Gewicht')
        return
      }
      const { error } = weightRowId
        ? await supabase.from('weight_logs').update({ weight_kg: kg }).eq('id', weightRowId)
        : await supabase.from('weight_logs').insert({
            user_id: user.id,
            logged_at: `${date}T12:00:00`,
            weight_kg: kg,
          })
      if (error) {
        setSaving(false)
        toast.error(`Gewicht speichern fehlgeschlagen: ${error.message}`)
        return
      }
    }

    setSaving(false)
    toast.success('Fortschritt gespeichert')
    onSaved()
    onClose()
  }

  const sliders = [
    { label: 'Energie', value: energie, set: setEnergie },
    { label: 'Schlafqualität', value: schlaf, set: setSchlaf },
    { label: 'Wohlbefinden', value: wohlbefinden, set: setWohlbefinden },
    { label: 'Libido', value: libido, set: setLibido },
  ]

  return (
    <>
      <style>{SLIDER_CSS}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 49 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>Fortschritt eintragen</h2>
            <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Datum</label>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        {sliders.map(s => (
          <div key={s.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>
                {s.label} <span style={{ fontWeight: 600, opacity: 0.65 }}>(optional)</span>
              </label>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: s.value != null ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {s.value != null ? `${s.value}/10` : '–'}
                </span>
                {s.value != null && (
                  <button
                    type="button"
                    aria-label={`${s.label} zurücksetzen`}
                    onClick={() => s.set(null)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: 7, padding: 0,
                      background: 'var(--surface-input)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            </div>
            <input
              className="tyd-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={s.value ?? 5}
              onChange={e => s.set(Number(e.target.value))}
              // ein Tap ohne Bewegung feuert kein change-Event, wenn der Thumb
              // schon dort steht — der Wert soll trotzdem als gesetzt gelten
              onPointerUp={e => {
                if (s.value == null) s.set(Number(e.currentTarget.value))
              }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Gewicht in kg (optional)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="z.B. 82.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>Körperfett % (optional)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="z.B. 18.5"
            value={bodyFat}
            onChange={e => setBodyFat(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </>
  )
}
