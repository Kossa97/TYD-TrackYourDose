import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type { DailyLogEntry } from '../types'
import { fieldLabel } from '../styles'
import { compactInputStyle, dateFieldStyle, WELLNESS_SLIDER_CSS, WellnessSliderRow } from './WellnessSliderRow'

const SHEET_Z = 10070

/** Volldeckend — var(--surface) ist im Dark-Theme halbtransparent. */
const SHEET_BG = 'var(--app-bg)'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    const scrollY = window.scrollY
    const { documentElement: html, body } = document

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    }

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'

    return () => {
      html.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.bodyOverflow
      body.style.position = prev.bodyPosition
      body.style.top = prev.bodyTop
      body.style.left = prev.bodyLeft
      body.style.right = prev.bodyRight
      body.style.width = prev.bodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [active])
}

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
  const [weightRowId, setWeightRowId] = useState<string | null>(null)
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving] = useState(false)

  useScrollLock(open)

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

  /** Unten → oben: häufigste Eingaben stehen zuletzt (Daumen-Zone). */
  const sliders = [
    { label: 'Libido', value: libido, set: setLibido },
    { label: 'Wohlbefinden', value: wohlbefinden, set: setWohlbefinden },
    { label: 'Schlafqualität', value: schlaf, set: setSchlaf },
    { label: 'Energie', value: energie, set: setEnergie },
  ]

  return createPortal(
    <>
      <style>{WELLNESS_SLIDER_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-log-title"
        className="fixed inset-0 flex min-h-dvh flex-col overflow-hidden overflow-x-hidden overscroll-y-contain"
        style={{
          zIndex: SHEET_Z,
          background: SHEET_BG,
          width: '100%',
          maxWidth: '100vw',
          overscrollBehavior: 'none',
          touchAction: 'manipulation',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          style={{
            position: 'absolute',
            top: 'max(10px, env(safe-area-inset-top))',
            right: 14,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-raised)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div aria-hidden style={{ flex: 1, minHeight: 24 }} />

          <div style={{
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: 'max(48px, calc(env(safe-area-inset-top) + 36px)) 14px 4px',
            background: SHEET_BG,
          }}>
            <h2
              id="today-log-title"
              style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: 'var(--text)',
                marginBottom: 10,
                paddingRight: 44,
              }}
            >
              Fortschritt eintragen
            </h2>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: 'var(--surface-input)',
              border: '1px solid var(--border)',
            }}>
              <label style={{ ...fieldLabel, marginBottom: 0, flexShrink: 0 }}>Datum</label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={e => setDate(e.target.value)}
                style={dateFieldStyle}
              />
            </div>

            {sliders.map(s => (
              <WellnessSliderRow
                key={s.label}
                label={s.label}
                value={s.value}
                onChange={s.set}
              />
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <div>
                <label style={{ ...fieldLabel, fontSize: '0.56rem', marginBottom: 5 }}>Gewicht kg</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="82.5"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  style={compactInputStyle}
                />
              </div>
              <div>
                <label style={{ ...fieldLabel, fontSize: '0.56rem', marginBottom: 5 }}>KFA %</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="18.5"
                  value={bodyFat}
                  onChange={e => setBodyFat(e.target.value)}
                  style={compactInputStyle}
                />
              </div>
            </div>
          </div>
        </div>

        <footer style={{
          flexShrink: 0,
          padding: '6px 14px max(8px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          background: SHEET_BG,
        }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  )
}
