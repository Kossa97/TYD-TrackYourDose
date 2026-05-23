import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Shared dashboard primitives used to keep refreshed screens visually consistent.
const accentAlpha = (accent: string, alpha: string) => `${accent}${alpha}`

type PaddingSize = 'sm' | 'md' | 'lg'

const paddingMap: Record<PaddingSize, string> = {
  sm: '12px',
  md: '14px',
  lg: '18px',
}

function combineClassNames(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ')
}

export function PageShell({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        paddingBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function GlassPanel({
  children,
  className,
  style,
  accent = '#00ccf5',
  padding = 'md',
  asButton = false,
  onClick,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  accent?: string
  padding?: PaddingSize
  asButton?: boolean
  onClick?: () => void
}) {
  const Component = asButton ? 'button' : 'div'

  return (
    <Component
      className={className}
      onClick={onClick}
      style={{
        width: asButton ? '100%' : undefined,
        textAlign: asButton ? 'left' : undefined,
        cursor: asButton ? 'pointer' : undefined,
        transition: asButton ? 'transform 0.16s ease, border-color 0.16s ease' : undefined,
        padding: paddingMap[padding],
        borderRadius: 24,
        border: `1px solid ${accentAlpha(accent, '18')}`,
        background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
        boxShadow: '0 18px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -58,
          bottom: -64,
          width: 128,
          height: 128,
          borderRadius: '50%',
          background: accent,
          opacity: 0.035,
          filter: 'blur(18px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>{children}</div>
    </Component>
  )
}

export function IconBadge({
  icon: Icon,
  accent = '#00ccf5',
  size = 40,
}: {
  icon: LucideIcon
  accent?: string
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.38),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: accentAlpha(accent, '18'),
        border: `1px solid ${accentAlpha(accent, '28')}`,
        color: accent,
        boxShadow: `0 0 22px ${accentAlpha(accent, '18')}`,
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.45)} />
    </div>
  )
}

export function PageHero({
  kicker,
  title,
  subtitle,
  icon,
  accent = '#00ccf5',
  action,
  children,
}: {
  kicker?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  accent?: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <GlassPanel padding="lg" accent={accent}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 82% 22%, ${accentAlpha(accent, '24')}, transparent 38%), radial-gradient(circle at 18% 78%, rgba(139,92,246,0.12), transparent 42%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
          {icon && <IconBadge icon={icon} accent={accent} size={44} />}
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <p
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 850,
                  letterSpacing: '0.13em',
                  textTransform: 'uppercase',
                  color: accentAlpha(accent, 'c9'),
                  marginBottom: 5,
                }}
              >
                {kicker}
              </p>
            )}
            <h1
              style={{
                fontSize: '1.72rem',
                fontWeight: 900,
                letterSpacing: '-0.045em',
                color: '#f8fbff',
                lineHeight: 1.05,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '0.82rem', color: 'rgba(213,224,242,0.70)', lineHeight: 1.55, marginTop: 8 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </GlassPanel>
  )
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
  action,
  icon,
  accent = '#00ccf5',
}: {
  kicker?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  accent?: string
}) {
  const Icon = icon

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <p
            style={{
              fontSize: '0.62rem',
              fontWeight: 850,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              color: 'rgba(154,170,191,0.52)',
            }}
          >
            {kicker}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: kicker ? 2 : 0 }}>
          {Icon && <Icon size={17} color={accent} />}
          <h2 style={{ fontSize: '1rem', fontWeight: 850, color: '#eaeefc', lineHeight: 1.25 }}>{title}</h2>
        </div>
        {subtitle && (
          <p style={{ fontSize: '0.7rem', color: 'rgba(154,170,191,0.58)', marginTop: 3, lineHeight: 1.45 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = '#00ccf5',
  onClick,
}: {
  icon: LucideIcon
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  accent?: string
  onClick?: () => void
}) {
  return (
    <GlassPanel asButton={!!onClick} onClick={onClick} padding="sm" accent={accent} style={{ minHeight: 112 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <IconBadge icon={icon} accent={accent} size={36} />
      </div>
      <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fbff', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 13 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.72rem', color: 'rgba(234,238,252,0.82)', fontWeight: 760, marginTop: 5 }}>
        {label}
      </p>
      {hint && <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.50)', marginTop: 2 }}>{hint}</p>}
    </GlassPanel>
  )
}

export function ActionTile({
  icon,
  label,
  description,
  accent = '#00ccf5',
  onClick,
  className,
}: {
  icon: LucideIcon
  label: ReactNode
  description?: ReactNode
  accent?: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={combineClassNames('transition-transform active:scale-[0.99]', className)}
      style={{
        minHeight: 104,
        width: '100%',
        padding: '12px 10px',
        borderRadius: 20,
        border: `1px solid ${accentAlpha(accent, '33')}`,
        background: `linear-gradient(155deg, ${accentAlpha(accent, '20')}, rgba(8,12,30,0.88))`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 9,
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <IconBadge icon={icon} accent={accent} size={34} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 850, color: '#f8fbff', lineHeight: 1.16 }}>{label}</p>
        {description && (
          <p style={{ fontSize: '0.61rem', color: 'rgba(213,224,242,0.58)', lineHeight: 1.32, marginTop: 3 }}>
            {description}
          </p>
        )}
      </div>
    </button>
  )
}
