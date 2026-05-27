import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { format } from 'date-fns'
import { Pencil, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { hasAnyRating, type DailyLogRow } from '../lib/dailyLogs'

type RatingField = 'energie' | 'schlaf' | 'libido'

interface Ratings {
  energie: number | null
  schlaf: number | null
  libido: number | null
}

const EMPTY_RATINGS: Ratings = { energie: null, schlaf: null, libido: null }

const ROWS: { field: RatingField; emoji: string; labelKey: string }[] = [
  { field: 'energie', emoji: '⚡', labelKey: 'daily_log_energie' },
  { field: 'schlaf', emoji: '😴', labelKey: 'daily_log_schlaf' },
  { field: 'libido', emoji: '🔥', labelKey: 'daily_log_libido' },
]

const panelStyle: CSSProperties = {
  background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 20,
  boxShadow: '0 12px 40px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: '14px 16px',
}

function ratingsFromRow(row: DailyLogRow | null): Ratings {
  if (!row) return { ...EMPTY_RATINGS }
  return { energie: row.energie, schlaf: row.schlaf, libido: row.libido }
}

function StarRow({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string
  value: number | null
  readOnly: boolean
  onChange?: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(234,238,252,0.88)', minWidth: 108 }}>
        {label}
      </span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110 active:scale-95'}
            aria-label={`${star}`}
          >
            <Star
              size={20}
              style={
                value != null && star <= value
                  ? {
                      color: '#f5a800',
                      fill: '#f5a800',
                      filter: 'drop-shadow(0 0 5px rgba(245,168,0,0.55))',
                    }
                  : { color: 'rgba(255,255,255,0.14)', fill: 'transparent' }
              }
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function DailyLogCard({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [savedRow, setSavedRow] = useState<DailyLogRow | null>(null)
  const [draft, setDraft] = useState<Ratings>(EMPTY_RATINGS)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadToday = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('daily_logs')
      .select('id, log_date, energie, schlaf, libido, notes')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .maybeSingle()

    if (error) {
      toast.error(t('daily_log_load_error'))
      setSavedRow(null)
      setDraft(EMPTY_RATINGS)
      setEditing(true)
    } else if (data) {
      const row = data as DailyLogRow
      setSavedRow(row)
      setDraft(ratingsFromRow(row))
      setEditing(false)
    } else {
      setSavedRow(null)
      setDraft(EMPTY_RATINGS)
      setEditing(true)
    }
    setLoading(false)
  }, [today, user, t])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  const readOnly = savedRow != null && !editing
  const canSave = hasAnyRating(draft) && !readOnly

  const save = async () => {
    if (!user || !canSave) return
    setSaving(true)
    const payload = {
      user_id: user.id,
      log_date: today,
      energie: draft.energie,
      schlaf: draft.schlaf,
      libido: draft.libido,
    }
    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(payload, { onConflict: 'user_id,log_date' })
      .select('id, log_date, energie, schlaf, libido, notes')
      .single()

    setSaving(false)
    if (error) {
      toast.error(t('daily_log_save_error'))
      return
    }
    const row = data as DailyLogRow
    setSavedRow(row)
    setDraft(ratingsFromRow(row))
    setEditing(false)
    toast.success(t('daily_log_saved'))
    onSaved?.()
  }

  const startEdit = () => {
    setDraft(ratingsFromRow(savedRow))
    setEditing(true)
  }

  if (loading) {
    return (
      <section style={panelStyle}>
        <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.55)', textAlign: 'center', padding: '8px 0' }}>
          {t('loading')}
        </p>
      </section>
    )
  }

  return (
    <section style={panelStyle} id="home-befinden-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 850, color: '#f8fbff', letterSpacing: '-0.02em' }}>
          {t('daily_log_title')}
        </h2>
        {readOnly && (
          <button
            type="button"
            onClick={startEdit}
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Pencil size={13} />
            {t('edit')}
          </button>
        )}
      </div>
      <p style={{ fontSize: '0.68rem', color: 'rgba(154,170,191,0.58)', lineHeight: 1.45, marginBottom: 12 }}>
        {t('home_befinden_sub')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ROWS.map(row => (
          <StarRow
            key={row.field}
            label={`${row.emoji} ${t(row.labelKey)}`}
            value={draft[row.field]}
            readOnly={readOnly}
            onChange={v => setDraft(current => ({ ...current, [row.field]: v }))}
          />
        ))}
      </div>

      {canSave && (
        <button
          type="button"
          className="btn-primary w-full mt-4"
          onClick={() => void save()}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1 }}
        >
          {saving ? t('saving') : t('save')}
        </button>
      )}
    </section>
  )
}
