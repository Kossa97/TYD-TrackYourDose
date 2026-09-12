import { useEffect, useRef } from 'react'
import type { PeptipediaLocale } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import { peptipediaTabs, type PeptipediaMode, type PeptipediaTabId } from '../routing'

export function PeptipediaTabs({ locale, activeTab, onSelect, mode = 'public' }: {
  locale: PeptipediaLocale
  activeTab: PeptipediaTabId
  onSelect: (id: PeptipediaTabId) => void
  mode?: PeptipediaMode
}) {
  const tabs = peptipediaTabs(mode)
  const strip = useRef<HTMLDivElement>(null)
  const buttons = useRef<Partial<Record<PeptipediaTabId, HTMLButtonElement | null>>>({})
  useEffect(() => {
    const button = buttons.current[activeTab]
    const container = strip.current
    if (!button || !container) return
    if (button.offsetLeft < container.scrollLeft) container.scrollLeft = button.offsetLeft
    else if (button.offsetLeft + button.offsetWidth > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = button.offsetLeft + button.offsetWidth - container.clientWidth
    }
  }, [activeTab])

  return (
    <div className={`sticky ${mode === 'public' ? 'top-14' : 'top-0'} z-20 bg-[#070B11] border-b border-white/[0.08]`}>
      <div ref={strip} role="tablist" aria-label={locale === 'de' ? 'Peptidinformationen' : 'Peptide information'}
        className="relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((id, index) => (
          <button key={id} ref={button => { buttons.current[id] = button }} type="button" role="tab"
            id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={activeTab === id}
            tabIndex={activeTab === id ? 0 : -1} onClick={() => onSelect(id)}
            onKeyDown={event => {
              let next: number | undefined
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
              if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
              if (event.key === 'Home') next = 0
              if (event.key === 'End') next = tabs.length - 1
              if (next === undefined) return
              event.preventDefault()
              const nextId = tabs[next]
              onSelect(nextId)
              buttons.current[nextId]?.focus({ preventScroll: true })
            }}
            className={`shrink-0 min-h-11 px-4 text-xs font-medium border-b-2 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 focus-visible:-outline-offset-2 ${activeTab === id ? 'text-sky-400 border-sky-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
            {PEPTIPEDIA_UI_COPY[locale].tabs[id]}
          </button>
        ))}
      </div>
    </div>
  )
}
