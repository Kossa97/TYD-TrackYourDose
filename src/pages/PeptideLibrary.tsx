// src/pages/PeptideLibrary.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  getAllPeptides,
  searchPeptides,
  CATEGORY_LABELS,
} from '../services/peptideLibrary'
import type { PeptideEntry, PeptideCategory } from '../services/peptideLibrary'
import { PeptideCard, PeptideCardSkeleton } from './lab/PeptideCard'

const CATEGORIES: Array<{ value: PeptideCategory | 'all'; label: string }> = [
  { value: 'all',           label: 'Alle' },
  { value: 'heilung',       label: 'Heilung' },
  { value: 'wachstumshormon', label: 'Wachstumshormon' },
  { value: 'stoffwechsel',  label: 'Stoffwechsel' },
  { value: 'nootropikum',   label: 'Nootropikum' },
  { value: 'anti_aging',    label: 'Anti-Aging' },
]

export function PeptideLibrary() {
  const navigate                  = useNavigate()
  const { t }                     = useTranslation()
  const [peptides, setPeptides]   = useState<PeptideEntry[]>([])
  const [filtered, setFiltered]   = useState<PeptideEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [category, setCategory]   = useState<PeptideCategory | 'all'>('all')
  const [query, setQuery]         = useState('')

  // Initial load
  useEffect(() => {
    getAllPeptides()
      .then(data => { setPeptides(data); setFiltered(data) })
      .catch(err => setError(err instanceof Error ? err.message : 'Ladefehler'))
      .finally(() => setLoading(false))
  }, [])

  // Filter by category + search query
  useEffect(() => {
    let list = peptides
    if (category !== 'all') list = list.filter(p => p.category === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tldr.toLowerCase().includes(q) ||
        (p.full_name ?? '').toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [category, query, peptides])

  return (
    <div>
      {/* Hero */}
      <div className="relative -mx-4 px-4 pb-8 pt-6 mb-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />

        <div className="relative">
          {/* Breadcrumb */}
          <button
            type="button"
            onClick={() => navigate('/lab')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4"
          >
            <ArrowLeft size={12} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>The Lab</span>
          </button>

          <p
            className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-sky-400/65 mb-2"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Forschungsdatenbank
          </p>
          <h1
            className="text-3xl font-black text-white mb-1 leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Peptid-Bibliothek
          </h1>
          <p className="text-sm text-slate-400 mb-5">
            Evidenzbasierte Forschungsprofile. Kein medizinischer Rat.
          </p>

          {/* Search */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Peptid suchen…"
              className="w-full bg-[#0B1220] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:border-sky-500/50 focus:shadow-[0_0_20px_rgba(0,204,245,0.08)]"
            />
          </div>
        </div>
      </div>

      {/* Research disclaimer */}
      <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 mb-5">
        <FlaskConical size={14} className="text-amber-400/70 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/60 leading-relaxed">
          Alle Angaben basieren auf veröffentlichten Forschungsstudien und stellen keine medizinische Beratung, Diagnose oder Therapieempfehlung dar. Dosierungsangaben stammen aus Studienprotokollen, nicht aus klinischen Leitlinien.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
              category === cat.value
                ? 'bg-sky-500 border-transparent text-white'
                : 'border-white/10 text-slate-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <p
          className="text-[0.6rem] text-slate-700 mb-4"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {filtered.length} {filtered.length === 1 ? 'Peptid' : 'Peptide'} · peptide_library v2
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="card border border-red-500/20 bg-red-950/20 text-center py-8">
          <p className="text-sm text-red-300 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => { setError(null); setLoading(true); getAllPeptides().then(setPeptides).catch(e => setError(e.message)).finally(() => setLoading(false)) }}
            className="btn-secondary text-sm"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <PeptideCardSkeleton key={i} />)
          : filtered.map(peptide => (
              <PeptideCard key={peptide.id} peptide={peptide} />
            ))
        }
      </div>

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <FlaskConical size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Peptide für diese Auswahl gefunden.</p>
        </div>
      )}

      {/* Bottom disclaimer */}
      <div className="mt-8 pt-6 border-t border-white/[0.05]">
        <p
          className="text-[0.58rem] text-slate-700 text-center leading-relaxed"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          FORSCHUNGSDATEN ONLY · KEIN MEDIZINISCHER RAT · CONSULT A HEALTHCARE PROFESSIONAL
        </p>
      </div>
    </div>
  )
}
