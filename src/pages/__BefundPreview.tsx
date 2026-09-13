// Sichtbare Vorschau der gerenderten Arzt-Befund-PDF-Seiten (ohne Login).
// Bilder liegen in public/pdf-preview/ und werden nach jedem Rebuild aktualisiert.

const PAGES = [
  { src: '/pdf-preview/befund-page-1.png', label: 'Seite 1 — Deckblatt' },
  { src: '/pdf-preview/befund-page-2.png', label: 'Seite 2 — Daten & Labor' },
  { src: '/pdf-preview/befund-page-3.png', label: 'Seite 3 — Verlauf & Fragen' },
]

export function BefundPreview() {
  const bust = Date.now()

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Arzt-Befund · PDF-Vorschau</h1>
            <p className="text-sm text-slate-500">
              Gerenderte Seiten aus dem aktuellen Demo-PDF — zum gemeinsamen Durchgehen.
            </p>
          </div>
          <a
            href="/pdf-preview/TYD-Befund-demo.pdf"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            PDF öffnen
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8">
        {PAGES.map(page => (
          <section key={page.src} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              {page.label}
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md">
              <img
                src={`${page.src}?t=${bust}`}
                alt={page.label}
                className="block w-full h-auto"
              />
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
