import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FlaskConical, Lock, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { WiederNehmen } from '../features/reviews/lib/reviewModel'

/**
 * Oeffentliches Profil (/u/<name>): Anzeigename, Bio und die Bewertungen,
 * die der Nutzer einzeln freigegeben hat — mehr nicht. Alles kommt aus
 * einer Datenbankfunktion (`public_profile_reviews`), die nur genau das
 * herausgibt; die Tabellen selbst bleiben fuer Besucher zu. Dosis, Zyklus,
 * Alter, Geschlecht und genaue Daten erscheinen hier nie.
 */

interface OeffentlicheBewertung {
  id: string
  substanz: string
  rating: number
  title: string | null
  body: string | null
  pros: string | null
  cons: string | null
  wirkung: number | null
  vertraeglichkeit: number | null
  wieder_nehmen: WiederNehmen | null
  /** „2026-09" — nur der Monat. */
  monat: string
}

interface OeffentlichesProfil {
  username: string
  display_name: string | null
  public_bio: string | null
  reviews: OeffentlicheBewertung[]
}

export function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  // Das Ergebnis merkt sich, fuer wen es geladen wurde: wechselt die
  // Adresse, gilt es nicht mehr — das alte Profil steht nie unter dem neuen Namen.
  const [ergebnis, setErgebnis] = useState<{
    fuer: string
    zustand: 'da' | 'nicht_da' | 'fehler'
    profil: OeffentlichesProfil | null
  } | null>(null)

  useEffect(() => {
    let aktuell = true
    const fuer = username ?? ''
    void supabase.rpc('public_profile_reviews', { p_username: fuer }).then(({ data, error }) => {
      if (!aktuell) return
      if (error) return setErgebnis({ fuer, zustand: 'fehler', profil: null })
      setErgebnis({ fuer, zustand: data ? 'da' : 'nicht_da', profil: (data as OeffentlichesProfil | null) ?? null })
    })
    return () => { aktuell = false }
  }, [username])

  const gilt = ergebnis && ergebnis.fuer === (username ?? '') ? ergebnis : null
  const zustand = gilt?.zustand ?? 'laedt'
  const profil = gilt?.profil ?? null

  if (zustand === 'laedt') return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
    </div>
  )

  // Nicht gefunden und privat sehen gleich aus: von aussen soll man nicht
  // erkennen, ob es ein Konto gibt.
  if (zustand !== 'da' || !profil) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-400">
      <Lock size={40} aria-hidden="true" className="opacity-30" />
      <p className="text-lg font-semibold text-white">
        {zustand === 'fehler' ? t('public_profile_error') : t('public_profile_unavailable')}
      </p>
      <p className="text-sm">{zustand === 'fehler' ? null : t('public_profile_unavailable_desc', { name: username })}</p>
      <Link to="/auth" className="btn-primary mt-2 px-6 py-2">{t('public_profile_to_app')}</Link>
    </div>
  )

  const monat = (wert: string) => new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${wert}-01T00:00:00.000Z`))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">{profil.display_name || profil.username}</h1>
          <p className="mt-0.5 text-sm text-slate-400">@{profil.username}</p>
          {profil.public_bio && <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-300">{profil.public_bio}</p>}
          <p className="mt-4 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-500">
            <FlaskConical size={11} aria-hidden="true" /> {t('public_profile_badge')}
          </p>
        </header>

        <section aria-labelledby="public-reviews">
          <h2 id="public-reviews" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Star size={13} aria-hidden="true" /> {t('bewertungen_title')}
          </h2>
          {profil.reviews.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-8 text-center text-sm text-slate-500">
              {t('public_profile_no_reviews')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {profil.reviews.map(r => {
                const kriterien = [
                  r.wirkung ? `${t('review_effect')} ${r.wirkung}/5` : null,
                  r.vertraeglichkeit ? `${t('review_tolerability')} ${r.vertraeglichkeit}/5` : null,
                  r.wieder_nehmen ? `${t('review_again')} ${t(`review_again_${r.wieder_nehmen}`)}` : null,
                ].filter(Boolean)
                return (
                  <li key={r.id} data-public-review className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-sky-400">{r.substanz}</p>
                      <span className="flex shrink-0 gap-0.5" role="img" aria-label={String(t(r.rating === 1 ? 'review_star_one' : 'review_star_many', { n: r.rating }))}>
                        {[1, 2, 3, 4, 5].map(stern => (
                          <Star key={stern} size={13} aria-hidden="true" className={stern <= r.rating ? 'text-amber-400' : 'text-slate-700'} fill={stern <= r.rating ? 'currentColor' : 'transparent'} />
                        ))}
                      </span>
                    </div>
                    {r.title && <p className="mt-1 font-semibold text-white">{r.title}</p>}
                    {kriterien.length > 0 && <p className="mt-1 text-xs text-slate-400">{kriterien.join(' · ')}</p>}
                    {r.body && <p className="mt-1.5 text-sm text-slate-300">{r.body}</p>}
                    {r.pros && <p className="mt-1.5 text-xs"><span className="font-semibold text-emerald-400">+ </span><span className="text-slate-300">{r.pros}</span></p>}
                    {r.cons && <p className="mt-1 text-xs"><span className="font-semibold text-red-400">− </span><span className="text-slate-300">{r.cons}</span></p>}
                    <p className="mt-2 text-[11px] text-slate-600">{monat(r.monat)}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="mt-8 pb-4 text-center text-xs text-slate-600">{t('public_profile_footer')}</p>
      </div>
    </div>
  )
}
