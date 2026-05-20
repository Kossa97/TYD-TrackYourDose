import { FlaskConical, Microscope, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LAB_FEATURES = [
  {
    icon: FlaskConical,
    title: 'Protocol experiments',
    description: 'Explore experimental protocol ideas before adding them to your active tracking flow.',
  },
  {
    icon: Microscope,
    title: 'Research workspace',
    description: 'Keep peptide research, hypotheses, and observations grouped in one focused lab view.',
  },
  {
    icon: Sparkles,
    title: 'Coming next',
    description: 'The Lab is ready in navigation while the dedicated research tools are prepared.',
  },
]

export function TheLab() {
  const { t } = useTranslation()

  return (
    <div>
      <div className="mb-5 pt-1">
        <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.65)', marginBottom: 4 }}>
          Research workspace
        </p>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc', lineHeight: 1.1 }}>
          {t('nav_lab')}
        </h1>
      </div>

      <section style={{ background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(0,204,245,0.12)', borderRadius: 24, padding: '20px 18px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: 52, height: 52, borderRadius: 18, background: 'rgba(0,204,245,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Microscope size={24} color="#00ccf5" />
        </div>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eaeefc', marginBottom: 8 }}>
          Build and refine research ideas
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.68)', lineHeight: 1.55, maxWidth: 520 }}>
          Use The Lab as a dedicated space for upcoming research-focused tools, protocol exploration, and experiment notes.
        </p>
        <div style={{ position: 'absolute', right: -36, bottom: -44, width: 140, height: 140, borderRadius: '50%', background: '#00ccf5', opacity: 0.08, filter: 'blur(24px)', pointerEvents: 'none' }} />
      </section>

      <div className="grid grid-cols-1 gap-3">
        {LAB_FEATURES.map((feature) => (
          <div
            key={feature.title}
            style={{ background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '15px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(34,211,238,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <feature.icon size={18} color="#22d3ee" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 750, color: '#eaeefc', marginBottom: 4 }}>
                {feature.title}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.58)', lineHeight: 1.45 }}>
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
