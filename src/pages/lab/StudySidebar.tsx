// src/pages/lab/StudySidebar.tsx
import type { FilterState, SortMode, StudyTypeFilter, YearFilter } from './pubmed'

interface StudySidebarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[0.55rem] uppercase tracking-widest text-slate-600 mb-2"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </p>
  )
}

function FilterOption({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 text-xs w-full text-left py-0.5 transition-colors duration-150 ${
        active ? 'text-sky-400' : 'text-slate-400 hover:text-slate-300'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 ${
          active ? 'bg-sky-400 shadow-[0_0_6px_rgba(0,204,245,0.6)]' : 'bg-slate-700'
        }`}
      />
      {label}
    </button>
  )
}

const STUDY_TYPE_OPTIONS: Array<{ label: string; value: StudyTypeFilter }> = [
  { label: 'Alle',             value: '' },
  { label: 'Human Studien',    value: 'human' },
  { label: 'Tier / Labor',     value: 'animal' },
  { label: 'Meta-Analysen',    value: 'meta' },
  { label: 'Klinische Trials', value: 'clinical' },
]

export function StudySidebar({ filters, onFilterChange }: StudySidebarProps) {
  function set(patch: Partial<FilterState>) {
    onFilterChange({ ...filters, ...patch })
  }

  return (
    <aside className="space-y-6">
      <div className="space-y-1.5">
        <SectionLabel>Studientyp</SectionLabel>
        {STUDY_TYPE_OPTIONS.map(opt => (
          <FilterOption
            key={opt.value}
            label={opt.label}
            active={filters.studyType === opt.value}
            onClick={() => set({ studyType: opt.value })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Sortieren</SectionLabel>
        {(['date', 'relevance'] as SortMode[]).map(s => (
          <FilterOption
            key={s}
            label={s === 'date' ? 'Neueste' : 'Relevanz'}
            active={filters.sort === s}
            onClick={() => set({ sort: s })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Jahr</SectionLabel>
        {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
          <FilterOption
            key={y}
            label={y === 'all' ? 'Alle' : y === '2024plus' ? '2024+' : '2025'}
            active={filters.year === y}
            onClick={() => set({ year: y })}
          />
        ))}
      </div>
    </aside>
  )
}
