import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

type CarouselDirection = 'horizontal' | 'vertical'

export function CarouselNavButton({
  direction,
  nav,
  disabled,
  onClick,
  label,
}: {
  direction: CarouselDirection
  nav: 'prev' | 'next'
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  const Icon = direction === 'horizontal'
    ? (nav === 'prev' ? ChevronLeft : ChevronRight)
    : (nav === 'prev' ? ChevronUp : ChevronDown)

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'carousel-nav-btn',
        disabled ? 'carousel-nav-btn--disabled' : '',
      ].filter(Boolean).join(' ')}
    >
      <Icon size={18} strokeWidth={2.25} aria-hidden />
    </button>
  )
}

export function CarouselPagination({
  count,
  activeIndex,
  onSelect,
  accent = 'var(--accent)',
  label,
}: {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
  accent?: string
  label: string
}) {
  if (count <= 1) return null

  return (
    <div className="carousel-pagination" role="tablist" aria-label={label}>
      {Array.from({ length: count }, (_, i) => {
        const active = i === activeIndex
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${label} ${i + 1}`}
            onClick={() => onSelect(i)}
            className={active ? 'carousel-dot carousel-dot--active' : 'carousel-dot'}
            style={active ? { background: accent } : undefined}
          />
        )
      })}
    </div>
  )
}

export function CarouselCounter({
  activeIndex,
  count,
  tone = 'accent',
}: {
  activeIndex: number
  count: number
  tone?: 'accent' | 'amber'
}) {
  if (count <= 1) return null

  return (
    <span
      className={tone === 'amber' ? 'carousel-counter carousel-counter--amber' : 'carousel-counter'}
      aria-live="polite"
    >
      {activeIndex + 1} / {count}
    </span>
  )
}
