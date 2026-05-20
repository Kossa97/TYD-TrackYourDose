import { FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, ExternalLink, FlaskConical, Loader2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PubMedArticle {
  uid: string
  title: string
  source: string
  pubdate: string
  authors: string[]
  url: string
}

interface PubMedResponse {
  query?: string
  results?: PubMedArticle[]
  error?: string
}

const DEFAULT_QUERY = 'BPC-157 peptide'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      return `${error.message} (${context.status} ${context.statusText})`
    }
    return error.message
  }

  if (typeof error === 'string') return error

  return 'Unbekannter Fehler beim Laden der PubMed-Daten.'
}

export function TheLab() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [lastQuery, setLastQuery] = useState(DEFAULT_QUERY)
  const [articles, setArticles] = useState<PubMedArticle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function searchPubMed(nextQuery = query) {
    const trimmedQuery = nextQuery.trim()
    if (!trimmedQuery) {
      setError('Bitte gib einen Suchbegriff ein.')
      setArticles([])
      return
    }

    setIsLoading(true)
    setError(null)
    setLastQuery(trimmedQuery)

    try {
      const { data, error: functionError } = await supabase.functions.invoke<PubMedResponse>('pubmed', {
        body: { query: trimmedQuery, maxResults: 8 },
      })

      if (functionError) throw functionError
      if (!data) throw new Error('Die PubMed Edge Function hat keine Daten zuruckgegeben.')
      if (data.error) throw new Error(data.error)

      setArticles(data.results ?? [])
    } catch (err) {
      console.error('TheLab PubMed search failed', err)
      setError(getErrorMessage(err))
      setArticles([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void searchPubMed(DEFAULT_QUERY)
    // Run once on mount so function/config errors are visible immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void searchPubMed()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.25)',
            boxShadow: '0 0 22px rgba(168,85,247,0.12)',
          }}
        >
          <FlaskConical size={21} color="#c084fc" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgba(192,132,252,0.72)' }}>
            Research tools
          </p>
          <h1 className="text-2xl font-bold leading-tight">The Lab</h1>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'rgba(154,170,191,0.72)' }}>
            PubMed-Suche fur Peptid-Studien. Fehler der Edge Function werden hier sichtbar angezeigt.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="pubmed-query" className="label">
          PubMed Suchbegriff
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="pubmed-query"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z.B. TB-500 wound healing"
            disabled={isLoading}
          />
          <button type="submit" className="btn-primary px-3" disabled={isLoading}>
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            <span className="hidden sm:inline">Suchen</span>
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="card flex items-center gap-3" role="status" aria-live="polite">
          <Loader2 size={20} className="animate-spin text-sky-400" />
          <div>
            <p className="font-semibold">PubMed wird geladen...</p>
            <p className="text-sm" style={{ color: 'rgba(154,170,191,0.65)' }}>
              Supabase Edge Function <code>pubmed</code> wird aufgerufen.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          className="card"
          role="alert"
          style={{ borderColor: 'rgba(255,75,105,0.35)', background: 'rgba(45,8,18,0.82)' }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-200">The Lab konnte PubMed nicht laden</p>
              <p className="mt-1 break-words text-sm text-red-100/80">{error}</p>
              <p className="mt-3 text-xs leading-relaxed text-red-100/60">
                Prufe, ob <code>supabase/functions/pubmed/index.ts</code> deployed ist und ob der
                Funktionsname im Client <code>supabase.functions.invoke('pubmed')</code> entspricht.
              </p>
              <button type="button" className="btn-secondary mt-4" onClick={() => void searchPubMed(lastQuery)}>
                Erneut versuchen
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(154,170,191,0.48)' }}>
              Ergebnisse fur "{lastQuery}"
            </p>
            <span className="text-xs" style={{ color: 'rgba(154,170,191,0.42)' }}>
              {articles.length} Treffer
            </span>
          </div>

          {articles.length === 0 ? (
            <div className="card flex items-center gap-3">
              <BookOpen size={20} className="text-slate-400" />
              <p className="text-sm" style={{ color: 'rgba(154,170,191,0.72)' }}>
                Keine PubMed-Ergebnisse gefunden. Versuche einen anderen Suchbegriff.
              </p>
            </div>
          ) : (
            articles.map((article) => (
              <article key={article.uid} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-sky-300/75">
                      {[article.source, article.pubdate].filter(Boolean).join(' - ') || 'PubMed'}
                    </p>
                    <h2 className="mt-1 text-base font-bold leading-snug">{article.title}</h2>
                    {article.authors.length > 0 && (
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'rgba(154,170,191,0.68)' }}>
                        {article.authors.slice(0, 4).join(', ')}
                        {article.authors.length > 4 ? ' et al.' : ''}
                      </p>
                    )}
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary shrink-0 px-3"
                    aria-label={`PubMed-Artikel ${article.uid} offnen`}
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}
