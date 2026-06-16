import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FlaskConical, Star, BookHeart, User, Lock, CalendarDays, Zap, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface Profile {
  id: string; username: string; display_name: string | null
  age: number | null; gender: string | null; is_public: boolean
  public_bio: string | null; share_peptide: boolean
  share_kalender: boolean; share_tagebuch: boolean; share_bewertungen: boolean
}
interface Peptide { id: string; name: string; default_method: string }
interface Review { id: string; rating: number; title: string; body: string | null; created_at: string; peptides: { name: string } | null }
interface Effect { id: string; type: string; description: string; severity: number; status: string; duration: string | null; occurred_at: string }
interface DoseLog { id: string; dose: number; unit: string; method: string; logged_at: string; peptides: { name: string } | null }

const SEVERITY_COLORS: Record<number, string> = {
  1: 'text-emerald-400', 2: 'text-lime-400', 3: 'text-amber-400', 4: 'text-orange-400', 5: 'text-red-400',
}
const SEVERITY_LABELS: Record<number, string> = {
  1: 'Sehr leicht', 2: 'Leicht', 3: 'Mittel', 4: 'Stark', 5: 'Sehr stark',
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
      ))}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
      {icon} {title}
    </h2>
  )
}

export function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [effects, setEffects] = useState<Effect[]>([])
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, display_name, age, gender, is_public, public_bio, share_peptide, share_kalender, share_tagebuch, share_bewertungen')
        .eq('username', username?.toLowerCase())
        .single()

      if (!prof) { setNotFound(true); setLoading(false); return }
      setProfile(prof as Profile)
      if (!prof.is_public) { setLoading(false); return }

      const uid = prof.id

      const fetches = await Promise.all([
        prof.share_peptide
          ? supabase.from('peptides').select('id, name, default_method').eq('user_id', uid).order('name')
          : Promise.resolve({ data: [] }),
        prof.share_bewertungen
          ? supabase.from('reviews').select('id, rating, title, body, created_at, peptides(name)').eq('user_id', uid).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        prof.share_tagebuch
          ? supabase.from('effects').select('id, type, description, severity, status, duration, occurred_at').eq('user_id', uid).order('occurred_at', { ascending: false }).limit(20)
          : Promise.resolve({ data: [] }),
        prof.share_kalender
          ? supabase.from('dose_logs').select('id, dose, unit, method, logged_at, peptides(name)').eq('user_id', uid).order('logged_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] }),
      ])

      if (fetches[0].data) setPeptides(fetches[0].data as Peptide[])
      if (fetches[1].data) setReviews(fetches[1].data as Review[])
      if (fetches[2].data) setEffects(fetches[2].data as Effect[])
      if (fetches[3].data) setLogs(fetches[3].data as DoseLog[])
      setLoading(false)
    }
    load()
  }, [username])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 gap-4 px-6 text-center">
      <User size={40} className="opacity-30" />
      <p className="text-lg font-semibold text-white">Profil nicht gefunden</p>
      <p className="text-sm">@{username} existiert nicht.</p>
      <Link to="/auth" className="btn-primary px-6 py-2">Zur App</Link>
    </div>
  )

  if (!profile?.is_public) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 gap-4 px-6 text-center">
      <Lock size={40} className="opacity-30" />
      <p className="text-lg font-semibold text-white">Dieses Profil ist privat</p>
      <p className="text-sm">@{username} hat sein Profil nicht öffentlich geteilt.</p>
      <Link to="/auth" className="btn-primary px-6 py-2 mt-2">Zur App</Link>
    </div>
  )

  const hasContent = peptides.length > 0 || reviews.length > 0 || effects.length > 0 || logs.length > 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Profil-Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-sky-500/10 p-6 rounded-full mb-3">
            <User size={40} className="text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
          <p className="text-slate-400 text-sm mt-0.5">@{profile.username}</p>
          {(profile.age || profile.gender) && (
            <p className="text-slate-500 text-sm mt-1">
              {[profile.age && `${profile.age} Jahre`, profile.gender].filter(Boolean).join(' · ')}
            </p>
          )}
          {profile.public_bio && (
            <p className="text-slate-300 text-sm mt-3 max-w-xs leading-relaxed">{profile.public_bio}</p>
          )}
          <div className="flex items-center gap-2 mt-4 text-xs text-slate-500 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
            <FlaskConical size={11} /> Peptid Tracker · Forschungsprofil
          </div>
        </div>

        {!hasContent && (
          <div className="card text-center py-10 text-slate-500">
            <p>Keine Inhalte freigegeben</p>
          </div>
        )}

        {/* Peptide */}
        {peptides.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<FlaskConical size={13} />} title="Verwendete Peptide" />
            <div className="space-y-2">
              {peptides.map(p => (
                <div key={p.id} className="card flex items-center justify-between">
                  <p className="font-medium text-white">{p.name}</p>
                  <div className="text-slate-400 text-xs text-right">
                    <span>{p.default_method}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Kalender / Dosen */}
        {logs.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<CalendarDays size={13} />} title="Protokollierte Dosen (letzte 30)" />
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="card flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white text-sm">{l.peptides?.name ?? '—'}</p>
                    <p className="text-slate-400 text-xs">{l.dose} {l.unit} · {l.method}</p>
                  </div>
                  <p className="text-slate-500 text-xs shrink-0">
                    {format(new Date(l.logged_at), 'dd.MM.yy HH:mm', { locale: de })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tagebuch */}
        {effects.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<BookHeart size={13} />} title="Tagebuch" />
            <div className="space-y-2">
              {effects.map(e => (
                <div key={e.id} className={`card border ${e.type === 'effect' ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {e.type === 'effect'
                      ? <Zap size={12} className="text-emerald-400" />
                      : <AlertTriangle size={12} className="text-amber-400" />}
                    <span className={`text-xs font-medium ${e.type === 'effect' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {e.type === 'effect' ? 'Wirkung' : 'Nebenwirkung'}
                    </span>
                    <span className={`text-xs ml-auto ${SEVERITY_COLORS[e.severity]}`}>
                      {SEVERITY_LABELS[e.severity]}
                    </span>
                  </div>
                  <p className="text-white text-sm">{e.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 text-xs">
                    <span>{format(new Date(e.occurred_at), 'dd.MM.yyyy', { locale: de })}</span>
                    {e.duration && <span>· {e.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bewertungen */}
        {reviews.length > 0 && (
          <section className="mb-6">
            <SectionHeader icon={<Star size={13} />} title="Bewertungen" />
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="card">
                  <p className="text-sky-400 text-xs font-medium mb-1">{r.peptides?.name}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <StarRow rating={r.rating} />
                    <p className="font-semibold text-white text-sm">{r.title}</p>
                  </div>
                  {r.body && <p className="text-slate-300 text-sm">{r.body}</p>}
                  <p className="text-slate-600 text-xs mt-2">
                    {format(new Date(r.created_at), 'dd. MMMM yyyy', { locale: de })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-slate-700 text-xs mt-8 pb-4">
          Peptid Tracker · Nur für Forschungszwecke
        </p>
      </div>
    </div>
  )
}
