import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadProtocolData } from '../lib/protocolPdf/loadProtocolData'
import { SECTIONS, defaultSelection } from '../lib/protocolPdf/sections'
import { downloadProtocolPdf } from '../lib/protocolPdf/renderProtocolPdf'
import type { ProtocolData, PdfLang, PdfDateRange, SectionId } from '../lib/protocolPdf/types'

interface Props {
  userId: string
  initialRange: PdfDateRange
  uiLang: string
  onClose: () => void
}

type UILang = PdfLang

const T: Record<UILang, {
  title: string; intro: string; sections: string; period: string; from: string; to: string
  note: string; notePlaceholder: string; language: string; download: string; generating: string
  loading: string; noneSelected: string; empty: string; loadError: string; genError: string
  personalHint: string
}> = {
  de: {
    title: 'PDF-Protokoll erstellen',
    intro: 'Wähle aus, was ins PDF kommt. Leere Bereiche sind ausgegraut.',
    sections: 'Inhalte',
    period: 'Zeitraum',
    from: 'Von', to: 'Bis',
    note: 'Notizen / Fragen',
    notePlaceholder: 'z. B. Fragen an den Arzt oder Coach …',
    language: 'Sprache',
    download: 'PDF herunterladen',
    generating: 'PDF wird erstellt …',
    loading: 'Daten werden geladen …',
    noneSelected: 'Wähle mindestens einen Inhalt aus.',
    empty: 'keine Daten',
    loadError: 'Daten konnten nicht geladen werden',
    genError: 'PDF konnte nicht erstellt werden',
    personalHint: 'Ohne „Persönliche Angaben“ wird das PDF anonymisiert (z. B. fürs Forum).',
  },
  en: {
    title: 'Create PDF report',
    intro: 'Choose what goes into the PDF. Empty areas are greyed out.',
    sections: 'Contents',
    period: 'Period',
    from: 'From', to: 'To',
    note: 'Notes / questions',
    notePlaceholder: 'e.g. questions for your doctor or coach …',
    language: 'Language',
    download: 'Download PDF',
    generating: 'Generating PDF …',
    loading: 'Loading data …',
    noneSelected: 'Select at least one section.',
    empty: 'no data',
    loadError: 'Could not load data',
    genError: 'Could not create PDF',
    personalHint: 'Without “Personal details” the PDF is anonymised (e.g. for forums).',
  },
}

export function ProtocolPdfModal({ userId, initialRange, uiLang, onClose }: Props) {
  const [lang, setLang] = useState<UILang>(uiLang.toLowerCase().startsWith('en') ? 'en' : 'de')
  const [range, setRange] = useState<PdfDateRange>(initialRange)
  const [data, setData] = useState<ProtocolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<SectionId>>(new Set())
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const t = T[lang]

  // Sprache nur für die Fehlermeldung; NICHT als load-Dependency, sonst würde ein
  // Sprachwechsel Daten neu laden und die Häkchen-Auswahl zurücksetzen.
  const langRef = useRef(lang)
  langRef.current = lang

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await loadProtocolData(userId, range)
      setData(d)
      setSelected(new Set(defaultSelection(d)))
    } catch {
      toast.error(T[langRef.current].loadError)
    } finally {
      setLoading(false)
    }
  }, [userId, range])

  useEffect(() => { void load() }, [load])

  const availability = useMemo(() => {
    const map = new Map<SectionId, boolean>()
    if (data) for (const s of SECTIONS) map.set(s.id, s.alwaysAvailable || s.hasData(data))
    return map
  }, [data])

  const toggle = (id: SectionId) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canGenerate = data != null && selected.size > 0 && !generating

  const generate = async () => {
    if (!data) return
    if (selected.size === 0) { toast.error(t.noneSelected); return }
    setGenerating(true)
    try {
      await downloadProtocolPdf(data, {
        lang, range,
        sections: [...selected],
        note,
      })
      onClose()
    } catch {
      toast.error(t.genError)
    } finally {
      setGenerating(false)
    }
  }

  const showNoteField = selected.has('notes')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-app-modal onClick={onClose}>
      <div
        className="bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92dvh] pt-[env(safe-area-inset-top)] sm:pt-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-sky-400" />
            <h2 className="font-bold text-white text-lg">{t.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm text-slate-400">{t.intro}</p>

          {/* Sprache */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.language}</span>
            <div className="flex gap-1 rounded-lg bg-slate-800 p-0.5">
              {(['de', 'en'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                    lang === l ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Zeitraum */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.period}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[0.7rem] text-slate-500">{t.from}</span>
                <input
                  type="date" value={range.from} max={range.to}
                  onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                  className="input mt-0.5"
                />
              </label>
              <label className="block">
                <span className="text-[0.7rem] text-slate-500">{t.to}</span>
                <input
                  type="date" value={range.to} min={range.from}
                  onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                  className="input mt-0.5"
                />
              </label>
            </div>
          </div>

          {/* Sektionen */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.sections}</p>
            {loading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin" /> {t.loading}
              </div>
            ) : (
              <div className="space-y-1">
                {SECTIONS.map(s => {
                  const has = availability.get(s.id) ?? false
                  const checked = selected.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!has}
                      onClick={() => toggle(s.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        !has
                          ? 'border-slate-800/60 bg-slate-900/40 opacity-45 cursor-not-allowed'
                          : checked
                            ? 'border-sky-500/40 bg-sky-500/10'
                            : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          checked && has ? 'border-sky-500 bg-sky-500' : 'border-slate-600 bg-transparent'
                        }`}
                      >
                        {checked && has && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M2.5 6.5l2.2 2.2L9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className={`flex-1 text-sm font-medium ${has ? 'text-slate-200' : 'text-slate-500'}`}>
                        {s.label[lang]}
                      </span>
                      {!has && <span className="text-[0.7rem] text-slate-600">{t.empty}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-500">{t.personalHint}</p>
          </div>

          {/* Notiz-Feld (nur wenn Notizen gewählt) */}
          {showNoteField && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.note}</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t.notePlaceholder}
                rows={3}
                className="input resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {generating
              ? <><Loader2 size={16} className="animate-spin" /> {t.generating}</>
              : <><Download size={16} /> {t.download}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
