import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadProtocolData } from '../lib/protocolPdf/loadProtocolData'
import { SECTIONS } from '../lib/protocolPdf/sections'
import { PRESETS, applyPreset, matchPreset, type ActivePreset, type PresetId } from '../lib/protocolPdf/presets'
import { loadPdfExportPrefs, savePdfExportPrefs } from '../lib/protocolPdf/persistence'
import { buildProtocolPdf, downloadProtocolPdf } from '../lib/protocolPdf/renderProtocolPdf'
import type { ProtocolData, PdfLang, PdfDateRange, SectionId } from '../lib/protocolPdf/types'

interface Props {
  userId: string
  initialRange: PdfDateRange
  uiLang: string
  onClose: () => void
  /** Optional: Demo/Preview ohne Supabase-Load (z. B. /__pdfpreview). */
  previewData?: ProtocolData
  /** page = Vollseite im Layout statt Overlay-Modal. */
  variant?: 'modal' | 'page'
}

type UILang = PdfLang

const T: Record<UILang, {
  title: string; intro: string; presets: string; custom: string; sections: string
  period: string; from: string; to: string
  note: string; notePlaceholder: string; language: string; download: string; generating: string
  loading: string; noneSelected: string; empty: string; loadError: string; genError: string
  personalHint: string
  livePreview: string; previewUpdating: string; previewEmpty: string; previewError: string
}> = {
  de: {
    title: 'PDF-Protokoll erstellen',
    intro: 'Wähle ein Muster oder setze die Häkchen selbst. Die Vorschau aktualisiert sich live.',
    presets: 'Muster',
    custom: 'Benutzerdefiniert',
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
    livePreview: 'Live-Vorschau',
    previewUpdating: 'Vorschau wird aktualisiert …',
    previewEmpty: 'Wähle Inhalte, um die Vorschau zu sehen.',
    previewError: 'Vorschau konnte nicht erzeugt werden.',
  },
  en: {
    title: 'Create PDF report',
    intro: 'Pick a template or tick the boxes yourself. The preview updates live.',
    presets: 'Templates',
    custom: 'Custom',
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
    livePreview: 'Live preview',
    previewUpdating: 'Updating preview …',
    previewEmpty: 'Select contents to see the preview.',
    previewError: 'Could not generate preview.',
  },
}

const DEFAULT_PRESET: PresetId = 'arzt'

function initialLang(uiLang: string): UILang {
  return uiLang.toLowerCase().startsWith('en') ? 'en' : 'de'
}

function restoreSelection(
  data: ProtocolData,
  prefs: ReturnType<typeof loadPdfExportPrefs>,
): { selected: Set<SectionId>; lang?: UILang } {
  if (!prefs) {
    return { selected: new Set(applyPreset(DEFAULT_PRESET, data)) }
  }

  if (prefs.preset !== 'custom') {
    return {
      selected: new Set(applyPreset(prefs.preset, data)),
      lang: prefs.lang,
    }
  }

  const available = new Set(
    SECTIONS.filter(s => s.alwaysAvailable || s.hasData(data)).map(s => s.id),
  )
  const restored = prefs.sections.filter(id => available.has(id))
  if (restored.length === 0) {
    return { selected: new Set(applyPreset(DEFAULT_PRESET, data)), lang: prefs.lang }
  }
  return { selected: new Set(restored), lang: prefs.lang }
}

export function ProtocolPdfModal({ userId, initialRange, uiLang, onClose, previewData, variant = 'modal' }: Props) {
  const isPage = variant === 'page'
  const [lang, setLang] = useState<UILang>(() => {
    const prefs = loadPdfExportPrefs(userId)
    return prefs?.lang ?? initialLang(uiLang)
  })
  const [range, setRange] = useState<PdfDateRange>(initialRange)
  const [data, setData] = useState<ProtocolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<SectionId>>(new Set())
  const [note, setNote] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const t = T[lang]
  const prefsReady = useRef(false)
  const previewUrlRef = useRef<string | null>(null)

  // Sprache nur für Fehlermeldungen — nicht als load-Dependency, sonst setzt ein
  // Sprachwechsel die Häkchen-Auswahl durch einen Reload zurück.
  const langRef = useRef(lang)
  langRef.current = lang

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = previewData ?? await loadProtocolData(userId, range)
      setData(d)
      const prefs = loadPdfExportPrefs(userId)
      const restored = restoreSelection(d, prefs)
      setSelected(restored.selected)
      if (restored.lang) setLang(restored.lang)
      prefsReady.current = true
    } catch {
      toast.error(T[langRef.current].loadError)
    } finally {
      setLoading(false)
    }
  }, [userId, range, previewData])

  useEffect(() => { void load() }, [load])

  const activePreset: ActivePreset = data
    ? matchPreset([...selected], data)
    : DEFAULT_PRESET

  useEffect(() => {
    if (!prefsReady.current || loading || !data) return
    savePdfExportPrefs(userId, {
      preset: activePreset,
      sections: [...selected],
      lang,
    })
  }, [userId, activePreset, selected, lang, loading, data])

  const availability = useMemo(() => {
    const map = new Map<SectionId, boolean>()
    if (data) {
      for (const s of SECTIONS) map.set(s.id, Boolean(s.alwaysAvailable || s.hasData(data)))
    }
    return map
  }, [data])

  const selectPreset = (id: PresetId) => {
    if (!data) return
    setSelected(new Set(applyPreset(id, data)))
  }

  const toggle = (id: SectionId) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedKey = useMemo(() => [...selected].sort().join('|'), [selected])

  // Live-Vorschau: debounced Rebuild bei Muster-/Häkchen-/Sprach-/Notiz-Änderung.
  useEffect(() => {
    if (!data || selected.size === 0) {
      setPreviewBusy(false)
      setPreviewError(false)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
      return
    }

    let cancelled = false
    setPreviewBusy(true)
    setPreviewError(false)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const doc = await buildProtocolPdf(data, {
            lang,
            range,
            sections: [...selected],
            note,
            preset: activePreset === 'custom' ? undefined : activePreset,
          })
          if (cancelled) return
          // dataurl is more reliable in iframe than bloburl across browsers
          const url = doc.output('datauristring')
          if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = url
          setPreviewUrl(url)
        } catch (err) {
          console.error('[pdf-preview]', err)
          if (!cancelled) {
            setPreviewError(true)
            if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
            setPreviewUrl(null)
          }
        } finally {
          if (!cancelled) setPreviewBusy(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [data, selectedKey, lang, range, note, activePreset, selected])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const canGenerate = data != null && selected.size > 0 && !generating

  const generate = async () => {
    if (!data) return
    if (selected.size === 0) {
      toast.error(t.noneSelected)
      return
    }
    setGenerating(true)
    try {
      await downloadProtocolPdf(data, {
        lang,
        range,
        sections: [...selected],
        note,
        preset: activePreset,
      })
      if (!isPage) onClose()
    } catch {
      toast.error(t.genError)
    } finally {
      setGenerating(false)
    }
  }

  const showNoteField = selected.has('notes')

  return (
    <div
      className={isPage
        ? 'w-full flex flex-col min-h-[calc(100dvh-7rem)]'
        : 'fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center'}
      data-app-modal={isPage ? undefined : true}
      onClick={isPage ? undefined : onClose}
    >
      <div
        className={isPage
          ? 'bg-slate-900 rounded-2xl w-full flex flex-col flex-1 min-h-0 border border-slate-800'
          : 'bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-5xl flex flex-col max-h-[94dvh] pt-[env(safe-area-inset-top)] sm:pt-0'}
        onClick={isPage ? undefined : (e => e.stopPropagation())}
      >
        <div className="shrink-0 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-sky-400" />
            <h2 className="font-bold text-white text-lg">{t.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className={`lg:w-[380px] lg:shrink-0 overflow-y-auto px-5 py-4 space-y-5 ${isPage ? '' : 'max-h-[46vh] lg:max-h-none'}`}>
          <p className="text-sm text-slate-400">{t.intro}</p>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.presets}</p>
              {activePreset === 'custom' && (
                <span className="text-[0.7rem] font-medium text-slate-400">{t.custom}</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map(p => {
                const active = activePreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={loading || !data}
                    onClick={() => selectPreset(p.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-sky-500/50 bg-sky-500/10'
                        : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'
                    } disabled:opacity-50`}
                  >
                    <span className={`block text-sm font-semibold ${active ? 'text-sky-300' : 'text-slate-200'}`}>
                      {p.label[lang]}
                    </span>
                    <span className="mt-0.5 block text-[0.72rem] leading-relaxed text-slate-500">
                      {p.description[lang]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

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

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.period}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[0.7rem] text-slate-500">{t.from}</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
                  className="input mt-0.5"
                />
              </label>
              <label className="block">
                <span className="text-[0.7rem] text-slate-500">{t.to}</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
                  className="input mt-0.5"
                />
              </label>
            </div>
          </div>

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

          <div className={`flex-1 ${isPage ? 'min-h-[50vh]' : 'min-h-[38vh]'} lg:min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/40`}>
            <div className="shrink-0 px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.livePreview}</p>
              {previewBusy && (
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> {t.previewUpdating}
                </span>
              )}
            </div>
            <div className="relative flex-1 min-h-0 bg-slate-300">
              {previewUrl ? (
                <iframe
                  title={t.livePreview}
                  src={previewUrl}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-600">
                  {previewError ? t.previewError : t.previewEmpty}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => { void generate() }}
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
