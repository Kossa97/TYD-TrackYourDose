// Sichtbare Vorschau der gerenderten PDF-Muster (Arzt / Coach / Forum), ohne Login.
const PRESETS = [
  {
    id: 'arzt',
    title: 'Arzt · Befund',
    pages: [
      { src: '/pdf-preview/arzt-page-1.png', label: 'Seite 1 — Deckblatt' },
      { src: '/pdf-preview/arzt-page-2.png', label: 'Seite 2 — Inhalt' },
    ],
    pdf: '/pdf-preview/TYD-arzt-demo.pdf',
  },
  {
    id: 'coach',
    title: 'Coach · Report',
    pages: [
      { src: '/pdf-preview/coach-page-1.png', label: 'Seite 1 — Deckblatt' },
      { src: '/pdf-preview/coach-page-2.png', label: 'Seite 2 — Inhalt' },
    ],
    pdf: '/pdf-preview/TYD-coach-demo.pdf',
  },
  {
    id: 'forum',
    title: 'Forum · Community',
    pages: [
      { src: '/pdf-preview/forum-page-1.png', label: 'Seite 1 — Deckblatt' },
      { src: '/pdf-preview/forum-page-2.png', label: 'Seite 2 — Inhalt' },
    ],
    pdf: '/pdf-preview/TYD-forum-demo.pdf',
  },
] as const

export function PdfThemesPreview() {
  const bust = Date.now()
  return (
    <div className="min-h-screen bg-slate-200 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">PDF-Muster · Vorschau</h1>
            <p className="text-sm text-slate-500">
              Arzt, Coach und Forum — gerenderte Seiten zum Vergleich. Live-Vorschau im Modal unter{' '}
              <a className="underline" href="/__pdfpreview">/__pdfpreview</a>.
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-8">
        {PRESETS.map(preset => (
          <section key={preset.id} className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-bold">{preset.title}</h2>
              <a
                href={preset.pdf}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                PDF öffnen
              </a>
            </div>
            {preset.pages.map(page => (
              <div key={page.src} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{page.label}</h3>
                <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
                  <img src={`${page.src}?t=${bust}`} alt={`${preset.title} ${page.label}`} className="block h-auto w-full" />
                </div>
              </div>
            ))}
          </section>
        ))}
      </main>
    </div>
  )
}
