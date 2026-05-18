import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react'
import { useOnboarding } from '../context/OnboardingContext'

interface StepDef {
  emoji: string
  title: string
  subtitle: string
  description: string
  hint: string | null
  targetSelector: string | null
  tooltipPos: 'above' | 'below'
  tooltipText: string | null
  // Panel-Verhalten
  panelPos: 'top' | 'bottom'
  panelCompact: boolean
}

const STEPS: StepDef[] = [
  {
    emoji: '👋', title: 'Willkommen bei TYD', subtitle: 'Track Your Dose',
    description: 'Deine persönliche Peptid-Management-App für Inventar, Zyklen, Kalender und Tagebuch. Wir führen dich jetzt Schritt für Schritt durch alle Funktionen.',
    hint: null, targetSelector: null, tooltipPos: 'above', tooltipText: null,
    panelPos: 'bottom', panelCompact: false,
  },
  {
    emoji: '🧭', title: 'Navigation', subtitle: 'Schritt 1 · Starte hier',
    description: 'Unten findest du 7 Bereiche der App. Tippe jetzt auf „Peptide" um loszulegen.',
    hint: '👇 Tippe auf „Peptide" in der Navigation',
    targetSelector: '[data-ob="nav-peptide"]', tooltipPos: 'above', tooltipText: null,
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '📦', title: 'Inventar', subtitle: 'Schritt 2 · Rohstofflager',
    description: 'Hier lagerst du deine rohen, gefriertrockneten Peptid-Vials ein. Wähle zuerst den Tab „Inventar".',
    hint: '👆 Tippe auf den Tab „Inventar"',
    targetSelector: '[data-ob="tab-inventar"]', tooltipPos: 'below', tooltipText: 'Hier tippen',
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '➕', title: 'Einlagern', subtitle: 'Schritt 3 · Vials aufnehmen',
    description: 'Gib Peptidname, Anzahl Vials und mg/Vial ein. Batch-Nummer und Quelle sind optional.',
    hint: '👆 Tippe auf „+ Einlagern"',
    targetSelector: '[data-ob="btn-einlagern"]', tooltipPos: 'below', tooltipText: 'Hier tippen',
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '🧪', title: 'Peptid anlegen', subtitle: 'Schritt 4 · Rekonstitution',
    description: 'Tippe auf „Peptid anlegen" bei einem Inventar-Eintrag. Wirkstoff und Batch werden automatisch übernommen.',
    hint: '👉 Tippe auf „Peptid anlegen"',
    targetSelector: '[data-ob="btn-peptid-anlegen"]', tooltipPos: 'above', tooltipText: 'Hier tippen',
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '💧', title: 'Formular ausfüllen', subtitle: 'Schritt 5 · Flüssigkeit & Dosis',
    description: 'Gib die zugefügte Flüssigkeit (z.B. 2 mL BAC-Wasser) und deine Standard-Dosis ein. Alles andere kommt aus dem Inventar.',
    hint: '✏️ Formular ausfüllen → „Speichern" tippen',
    targetSelector: null, tooltipPos: 'above', tooltipText: null,
    panelPos: 'top', panelCompact: true,  // Form belegt das untere Bildschirmende
  },
  {
    emoji: '🔄', title: 'Zyklus anlegen', subtitle: 'Schritt 6 · Einnahmeplan',
    description: 'Lege Dosis, Frequenz (täglich, jeden 2. Tag…) und Einnahmezeit für dein Peptid fest.',
    hint: '👉 Tippe auf „+ Zyklus hinzufügen"',
    targetSelector: '[data-ob="btn-zyklus-add"]', tooltipPos: 'above', tooltipText: 'Hier tippen',
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '📅', title: 'Kalender', subtitle: 'Schritt 7 · Tagesübersicht',
    description: 'Der Kalender zeigt deine aktiven Zyklen mit farbigen Punkten. Tippe auf einen Tag um Einnahmen zu sehen.',
    hint: '👇 Tippe auf „Kalender" in der Navigation',
    targetSelector: '[data-ob="nav-kalender"]', tooltipPos: 'above', tooltipText: null,
    panelPos: 'bottom', panelCompact: true,
  },
  {
    emoji: '🚀', title: 'Alles klar!', subtitle: 'Fertig · Du kennst dich aus',
    description: 'Der Rechner berechnet die aufzuziehende Menge. Im Tagebuch hältst du Wirkungen und Nebenwirkungen fest. Bewertungen helfen dir den Überblick zu behalten.\n\nViel Erfolg mit TYD!',
    hint: null,
    targetSelector: null, tooltipPos: 'above', tooltipText: null,
    panelPos: 'bottom', panelCompact: false,
  },
]

// ─── Komponente ───────────────────────────────────────────────────────────────
export function Onboarding() {
  const { step, total, active, next, prev, skip } = useOnboarding()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const nextRef = useRef(next)
  nextRef.current = next

  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setTargetRect(null)

    if (!active) return

    const s = STEPS[step]
    if (!s.targetSelector) return

    let listenerAdded = false

    const setup = () => {
      const el = document.querySelector(s.targetSelector!) as HTMLElement | null
      if (!el) return
      setTargetRect(el.getBoundingClientRect())
      if (!listenerAdded) {
        listenerAdded = true
        const handler = () => nextRef.current()
        el.addEventListener('click', handler, { once: true })
        cleanupRef.current = () => el.removeEventListener('click', handler)
      }
    }

    setup()
    const t = setTimeout(setup, 350)

    const onResize = () => {
      const el = document.querySelector(s.targetSelector!) as HTMLElement | null
      if (el) setTargetRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onResize)

    return () => {
      clearTimeout(t)
      cleanupRef.current?.()
      cleanupRef.current = null
      window.removeEventListener('resize', onResize)
    }
  }, [step, active])

  if (!active) return null

  const s = STEPS[step]
  const pct = ((step + 1) / total) * 100
  const isFirst = step === 0
  const isLast  = step === total - 1

  // ── Panel-Position ───────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = s.panelPos === 'top'
    ? { top: '16px', left: 0, right: 0 }
    : { bottom: '76px', left: 0, right: 0 }

  // ── Padding & Schriftgröße je nach Kompaktheit ───────────────────────────
  const pad      = s.panelCompact ? '13px 16px 11px' : '22px 20px 18px'
  const descSize = s.panelCompact ? '0.775rem' : '0.8375rem'
  const emojiSize = (isFirst || isLast) ? '2.4rem' : '1.5rem'

  return (
    <>
      {/* Backdrop — kein pointer-events, damit alles noch klickbar ist */}
      <div
        className="fixed inset-0 z-30 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.50)' }}
      />

      {/* ── Highlight-Ring um Ziel-Element ── z-45 damit er über der Nav (z-40) sichtbar ist */}
      {targetRect && (
        <div
          className="fixed pointer-events-none"
          style={{
            top:    targetRect.top    - 5,
            left:   targetRect.left   - 5,
            width:  targetRect.width  + 10,
            height: targetRect.height + 10,
            borderRadius: '14px',
            border: '2px solid rgba(0,204,245,0.92)',
            boxShadow: [
              '0 0 0 4px rgba(0,204,245,0.14)',
              '0 0 20px rgba(0,204,245,0.55)',
              '0 0 40px rgba(0,204,245,0.22)',
            ].join(', '),
            zIndex: 45,
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      )}

      {/* ── Tooltip-Bubble neben Ziel-Element ── */}
      {targetRect && s.tooltipText && (
        <div
          className="fixed pointer-events-none"
          style={{
            zIndex: 46,
            ...(s.tooltipPos === 'above'
              ? { top: targetRect.top - 5 - 10 - 28, left: targetRect.left + targetRect.width / 2 }
              : { top: targetRect.top + targetRect.height + 5 + 10, left: targetRect.left + targetRect.width / 2 }),
            transform: 'translateX(-50%)',
          }}
        >
          <div style={{
            background: 'rgba(0,204,245,0.14)',
            border: '1px solid rgba(0,204,245,0.6)',
            borderRadius: '8px',
            padding: '4px 10px',
            color: '#00eeff',
            fontSize: '0.72rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 0 12px rgba(0,204,245,0.35)',
          }}>
            {s.tooltipText}
          </div>
          {s.tooltipPos === 'above' && (
            <div style={{
              position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(0,204,245,0.6)',
            }} />
          )}
          {s.tooltipPos === 'below' && (
            <div style={{
              position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderBottom: '5px solid rgba(0,204,245,0.6)',
            }} />
          )}
        </div>
      )}

      {/* ── Panel ── */}
      <div className="fixed z-40 px-3" style={panelStyle}>
        <div style={{
          background: 'rgba(5, 6, 18, 0.98)',
          border: '1px solid rgba(0, 204, 245, 0.18)',
          borderRadius: '20px',
          padding: pad,
          boxShadow: '0 -4px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,204,245,0.06), 0 0 40px rgba(0,204,245,0.06)',
          backdropFilter: 'none',
          transition: 'padding 0.3s ease',
        }}>

          {/* ── Willkommen / Abschluss: zentriert & prominent ── */}
          {(isFirst || isLast) ? (
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: emojiSize, lineHeight: 1, marginBottom: '10px' }}>{s.emoji}</div>
              <p style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.55)', marginBottom: '4px' }}>
                {s.subtitle}
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#eaeefc', letterSpacing: '-0.02em', marginBottom: '10px' }}>
                {s.title}
              </p>
              <p style={{ fontSize: descSize, color: 'rgba(200,215,235,0.80)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {s.description}
              </p>
            </div>
          ) : (
            /* ── Reguläre Schritte: kompakte Zeile ── */
            <>
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{s.emoji}</span>
                  <div>
                    <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.55)', marginBottom: '1px' }}>
                      {s.subtitle}
                    </p>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#eaeefc', letterSpacing: '-0.01em' }}>
                      {s.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={skip}
                  style={{ padding: '4px', color: 'rgba(255,255,255,0.22)', transition: 'color 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}>
                  <X size={15} />
                </button>
              </div>

              <p style={{ fontSize: descSize, color: 'rgba(200,215,235,0.80)', lineHeight: 1.50, marginBottom: s.hint ? '10px' : '12px' }}>
                {s.description}
              </p>

              {s.hint && (
                <div style={{
                  background: 'rgba(0,204,245,0.07)', border: '1px solid rgba(0,204,245,0.15)',
                  borderRadius: '9px', padding: '7px 11px', marginBottom: '12px',
                  fontSize: '0.775rem', color: 'rgba(0,220,255,0.85)', fontWeight: 600,
                }}>
                  {s.hint}
                </div>
              )}
            </>
          )}

          {/* ── Progress-Bar ── */}
          <div style={{ height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: s.panelCompact ? '10px' : '14px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '1px', width: `${pct}%`,
              background: 'linear-gradient(90deg, rgba(0,180,240,0.7), rgba(0,220,255,0.9))',
              boxShadow: '0 0 8px rgba(0,204,245,0.5)',
              transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>

          {/* ── Navigation ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={isFirst}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                color: isFirst ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)',
                cursor: isFirst ? 'not-allowed' : 'pointer', transition: 'all 0.15s', flexShrink: 0,
              }}>
              <ChevronLeft size={15} />
            </button>

            <div className="flex gap-1 flex-1 justify-center">
              {Array.from({ length: total }, (_, i) => (
                <div key={i} style={{
                  width: i === step ? '14px' : '4px', height: '4px', borderRadius: '3px',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  background: i === step
                    ? 'rgba(0,204,245,0.85)'
                    : i < step ? 'rgba(0,204,245,0.30)' : 'rgba(255,255,255,0.10)',
                  boxShadow: i === step ? '0 0 6px rgba(0,204,245,0.5)' : undefined,
                }} />
              ))}
            </div>

            {!isFirst && !isLast && (
              <button
                onClick={skip}
                style={{
                  fontSize: '0.70rem', color: 'rgba(255,255,255,0.22)', padding: '0 2px',
                  cursor: 'pointer', transition: 'color 0.15s', whiteSpace: 'nowrap', flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.48)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}>
                Überspringen
              </button>
            )}

            <button
              onClick={next}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: isLast ? '10px 20px' : '8px 14px',
                borderRadius: '10px',
                background: isLast
                  ? 'linear-gradient(135deg, #00ccf5, #0088dd)'
                  : s.targetSelector
                    ? 'rgba(0,204,245,0.08)'     // Hat Ziel-Button → dezenter "Weiter"
                    : 'rgba(0,204,245,0.13)',
                border: '1px solid rgba(0,204,245,0.28)',
                color: isLast ? 'rgba(0,8,20,0.95)' : 'rgba(0,204,245,0.85)',
                fontWeight: 700,
                fontSize: isLast ? '0.875rem' : '0.8rem',
                cursor: 'pointer',
                boxShadow: isLast ? '0 0 20px rgba(0,204,245,0.3)' : undefined,
                transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              {isLast ? 'Los geht\'s!' : 'Weiter'}
              <ChevronRight size={14} />
            </button>
          </div>

          {isLast && (
            <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.68rem', color: 'rgba(255,255,255,0.18)' }}>
              Anleitung jederzeit im Profil neu starten
            </p>
          )}

          {/* Skip-Button nur auf Welcome-Screen */}
          {isFirst && (
            <button
              onClick={skip}
              style={{
                display: 'block', margin: '10px auto 0', fontSize: '0.70rem',
                color: 'rgba(255,255,255,0.22)', cursor: 'pointer', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.48)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}>
              Anleitung überspringen
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Restart-Button für Profil ────────────────────────────────────────────────
export function OnboardingRestartButton() {
  const { restart } = useOnboarding()
  return (
    <button
      onClick={restart}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '12px 14px', borderRadius: '13px',
        background: 'rgba(0,204,245,0.06)', border: '1px solid rgba(0,204,245,0.14)',
        color: 'rgba(0,204,245,0.80)', fontWeight: 600, fontSize: '0.875rem',
        cursor: 'pointer', transition: 'all 0.18s', textAlign: 'left' as const,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0,204,245,0.10)'
        e.currentTarget.style.borderColor = 'rgba(0,204,245,0.25)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(0,204,245,0.06)'
        e.currentTarget.style.borderColor = 'rgba(0,204,245,0.14)'
      }}>
      <RotateCcw size={15} />
      App-Anleitung neu starten
    </button>
  )
}
