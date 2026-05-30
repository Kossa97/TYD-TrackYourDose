import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Languages, ChevronRight } from 'lucide-react'
import { LANGUAGES, applyDirection } from '../i18n'
import { useOnboarding } from '../context/OnboardingContext'

export function LanguageGate() {
  const { needsLanguagePick, confirmLanguage } = useOnboarding()
  const { i18n, t } = useTranslation()

  const detectedBase = i18n.language?.split('-')[0] ?? ''
  const initialCode =
    LANGUAGES.find(l => l.code === detectedBase)?.code ??
    LANGUAGES.find(l => l.code === localStorage.getItem('tyd_lang'))?.code ??
    'de'

  const [selected, setSelected] = useState(initialCode)

  if (!needsLanguagePick) return null

  const panelStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--accent-weak)',
    borderRadius: 20,
    padding: '22px 18px 18px',
    boxShadow: '0 -4px 40px rgba(0,0,0,0.7), 0 0 40px rgba(0,204,245,0.06)',
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-4"
      style={{
        background: 'rgba(3, 4, 16, 0.97)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="w-full max-w-md" style={panelStyle}>
        <div className="flex items-center justify-center mb-2" style={{ color: 'var(--accent)' }}>
          <Languages size={20} />
        </div>
        <h1
          className="text-center font-bold mb-1"
          style={{ fontSize: '1.15rem', color: 'var(--text-dim)', letterSpacing: '-0.02em' }}
        >
          {t('lang_gate_title')}
        </h1>
        <p
          className="text-center mb-4"
          style={{ fontSize: '0.8rem', color: 'rgba(200,215,235,0.65)', lineHeight: 1.5 }}
        >
          {t('lang_gate_subtitle')}
        </p>

        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{
            border: '1px solid var(--border)',
            background: 'rgba(8,10,24,0.98)',
            maxHeight: 'min(52vh, 360px)',
            overflowY: 'auto',
          }}
        >
          {LANGUAGES.map(lang => {
            const isSelected = lang.code === selected
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setSelected(lang.code)
                  void i18n.changeLanguage(lang.code)
                  applyDirection(lang.code)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  textAlign: 'start',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'var(--accent-weak)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'rgba(200,215,235,0.85)',
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: '0.9rem',
                }}
              >
                <span style={{ fontSize: 20 }}>{lang.flag}</span>
                <span>{lang.name}</span>
                {isSelected && (
                  <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', color: 'var(--accent)' }}>
                    <Check size={14} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => confirmLanguage(selected)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '12px 18px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #00ccf5, #0088dd)',
            border: '1px solid var(--accent-border)',
            color: '#07091a',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(0,204,245,0.25)',
          }}
        >
          {t('lang_gate_continue')}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
