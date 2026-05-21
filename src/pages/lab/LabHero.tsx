// src/pages/lab/LabHero.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Search, FlaskConical, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const QUICK_TAGS = ['BPC-157', 'TB-500', 'GLP-1', 'Recovery', 'Healing', 'Longevity']

interface LabHeroProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function LabHero({ onSearch, loading }: LabHeroProps) {
  const { t }      = useTranslation()
  const navigate   = useNavigate()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      setActiveTag('')
      onSearch(q)
    }
  }

  const handleTag = (tag: string) => {
    setQuery(tag)
    setActiveTag(tag)
    onSearch(tag)
  }

  return (
    <div className="relative -mx-4 px-4 pb-8 pt-6 mb-6 overflow-hidden">
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Fade-out gradient at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />

      <div className="relative">
        {/* Kicker */}
        <p
          className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-sky-400/65 mb-3"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {t('lab_kicker')}
        </p>

        {/* Title */}
        <h1
          className="text-3xl font-black text-white mb-1 leading-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('lab_title')}
        </h1>
        <p className="text-sm text-slate-400 mb-5">
          {t('lab_subtitle')}
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveTag('') }}
              disabled={loading}
              placeholder={t('lab_search_placeholder')}
              className="w-full bg-[#0B1220] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:border-sky-500/50 focus:shadow-[0_0_30px_rgba(0,204,245,0.12)]"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary shrink-0">
            {loading ? '…' : t('lab_search_button')}
          </button>
        </form>

        {/* Quick tags + Library link */}
        <div className="flex flex-wrap gap-2 items-center">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              disabled={loading}
              onClick={() => handleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                activeTag === tag
                  ? 'bg-sky-500 border-transparent text-white'
                  : 'border-white/10 text-slate-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400'
              }`}
            >
              {tag}
            </button>
          ))}

          {/* Separator */}
          <span className="text-slate-700 text-xs">·</span>

          {/* Library entry */}
          <button
            type="button"
            onClick={() => navigate('/lab/library')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-violet-500/25 text-violet-300/70 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-violet-300 transition-all duration-200"
          >
            <FlaskConical size={11} />
            Peptid-Bibliothek
            <ArrowRight size={10} className="opacity-60" />
          </button>
        </div>
      </div>
    </div>
  )
}
