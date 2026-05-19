import { useEffect, useRef } from 'react'
import { X, Clock, TrendingUp, RotateCcw, Syringe, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { InjectionZone } from '../../pages/InjectionTracker3D'

interface ZoneDetailSheetProps {
  zone:      InjectionZone | null
  days:      number | undefined
  isRec:     boolean
  onClose:   () => void
  onLog:     (key: string) => void
}

function recoveryScore(days: number | undefined): { pct: number; label: string; color: string } {
  if (days === undefined) return { pct: 100, label: 'Vollständig erholt',  color: '#10b981' }
  if (days === 0)  return { pct: 10,  label: 'Frisch injiziert',          color: '#ef4444' }
  if (days === 1)  return { pct: 30,  label: '~30% erholt',               color: '#f97316' }
  if (days === 2)  return { pct: 55,  label: '~55% erholt',               color: '#eab308' }
  if (days === 3)  return { pct: 72,  label: '~72% erholt',               color: '#eab308' }
  if (days === 4)  return { pct: 85,  label: '~85% erholt',               color: '#22c55e' }
  if (days === 5)  return { pct: 94,  label: '~94% erholt',               color: '#10b981' }
  return                  { pct: 100, label: 'Vollständig erholt',         color: '#10b981' }
}

function statusBadge(days: number | undefined) {
  if (days === undefined) return { text: 'Nie benutzt', color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
  if (days === 0)  return { text: 'Heute injiziert',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  }
  if (days === 1)  return { text: 'Gestern',            color: '#f97316', bg: 'rgba(249,115,22,0.12)' }
  if (days <= 3)   return { text: `vor ${days} Tagen`,  color: '#eab308', bg: 'rgba(234,179,8,0.12)'  }
  if (days <= 5)   return { text: `vor ${days} Tagen`,  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  }
  return                  { text: `vor ${days} Tagen`,  color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
}

function canInject(days: number | undefined): boolean {
  return days === undefined || days >= 2
}

export function ZoneDetailSheet({ zone, days, isRec, onClose, onLog }: ZoneDetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const recovery = recoveryScore(days)
  const badge    = statusBadge(days)
  const ok       = canInject(days)

  // Animate in
  useEffect(() => {
    if (!zone || !sheetRef.current) return
    sheetRef.current.style.transform = 'translateY(100%)'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (sheetRef.current) sheetRef.current.style.transform = 'translateY(0%)'
      })
    })
  }, [zone?.key])

  if (!zone) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(3,5,16,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'ob-step-enter 0.18s ease-out',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 210, maxWidth: 520, margin: '0 auto',
          background: 'linear-gradient(180deg, rgba(10,16,38,0.99) 0%, rgba(6,10,26,1) 100%)',
          border: '1px solid rgba(0,204,245,0.14)',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '0 0 env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          transform: 'translateY(100%)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.25)' }} />
        </div>

        <div style={{ padding: '4px 20px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            {/* Zone icon */}
            <div style={{
              width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
              background: `radial-gradient(circle at 38% 35%, ${badge.bg}, rgba(0,0,0,0))`,
              border: `1.5px solid ${badge.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px ${badge.color}30`,
            }}>
              <Syringe size={18} color={badge.color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eaeefc', letterSpacing: '-0.02em' }}>
                  {zone.label}
                </h2>
                {isRec && (
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                    background: 'rgba(0,204,245,0.12)', color: '#00ccf5',
                    border: '1px solid rgba(0,204,245,0.25)', padding: '2px 7px', borderRadius: 5,
                  }}>⭐ Empfohlen</span>
                )}
              </div>
              <span style={{
                display: 'inline-block', fontSize: '0.68rem', fontWeight: 600,
                background: badge.bg, color: badge.color,
                border: `1px solid ${badge.color}30`, padding: '3px 9px', borderRadius: 6,
              }}>
                {badge.text}
              </span>
            </div>

            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}>
              <X size={15} color="rgba(148,163,184,0.7)" />
            </button>
          </div>

          {/* Recovery score bar */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={13} color={recovery.color} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(154,170,191,0.55)' }}>
                  Recovery
                </span>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: recovery.color }}>
                {recovery.pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${recovery.pct}%`,
                background: `linear-gradient(90deg, ${recovery.color}88, ${recovery.color})`,
                transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: `0 0 8px ${recovery.color}66`,
              }} />
            </div>

            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.45)', marginTop: 6 }}>
              {recovery.label}
            </p>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              {
                icon: <Clock size={13} color="rgba(0,204,245,0.65)" />,
                label: 'Letzte Injektion',
                value: days === undefined ? 'Noch nie' : days === 0 ? 'Heute' : days === 1 ? 'Gestern' : `vor ${days} Tagen`,
                color: badge.color,
              },
              {
                icon: <RotateCcw size={13} color="rgba(0,204,245,0.65)" />,
                label: 'Nächstes Mal',
                value: days === undefined ? 'Jetzt verfügbar' : days === 0 ? 'In 2 Tagen' : days === 1 ? 'Morgen' : 'Jetzt',
                color: ok ? '#10b981' : '#eab308',
              },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.055)',
                borderRadius: 12, padding: '11px 13px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  {s.icon}
                  <span style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(154,170,191,0.42)' }}>
                    {s.label}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Warning / OK hint */}
          {!ok ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px',
              background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)',
              borderRadius: 11, marginBottom: 16,
            }}>
              <AlertTriangle size={14} color="#f97316" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.66rem', color: 'rgba(253,186,116,0.85)', lineHeight: 1.45 }}>
                Diese Zone wurde kürzlich genutzt. Mindestens <strong>2 Tage</strong> zwischen Injektionen einhalten.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px',
              background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 11, marginBottom: 16,
            }}>
              <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.66rem', color: 'rgba(110,231,183,0.85)', lineHeight: 1.45 }}>
                Zone ist bereit. {isRec ? 'Dies ist die optimale Stelle für heute.' : 'Injektion kann hier durchgeführt werden.'}
              </p>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={() => { if (ok) { onLog(zone.key); onClose() } }}
            disabled={!ok}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              fontWeight: 800, fontSize: '0.92rem', letterSpacing: '-0.01em',
              cursor: ok ? 'pointer' : 'not-allowed',
              background: ok
                ? 'linear-gradient(135deg, rgba(0,204,245,0.22) 0%, rgba(0,140,200,0.15) 100%)'
                : 'rgba(255,255,255,0.04)',
              border: ok ? '1px solid rgba(0,204,245,0.35)' : '1px solid rgba(255,255,255,0.06)',
              color: ok ? '#00ccf5' : 'rgba(154,170,191,0.3)',
              boxShadow: ok ? '0 0 20px rgba(0,204,245,0.12), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {ok ? '💉 Hier injizieren — Jetzt markieren' : '⏳ Zone noch in Erholung'}
          </button>
        </div>
      </div>
    </>
  )
}
