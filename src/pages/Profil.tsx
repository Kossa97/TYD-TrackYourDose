import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { LogOut, Save, User, Globe, Lock, Copy, Check, FlaskConical, CalendarDays, BookHeart, Star, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OnboardingRestartButton } from '../components/Onboarding'
import { LANGUAGES, applyDirection } from '../i18n'

interface Profile {
  username: string; display_name: string; age: number | null
  weight_kg: number | null; height_cm: number | null
  gender: string; notes: string
  is_public: boolean; public_bio: string
  share_peptide: boolean; share_kalender: boolean
  share_tagebuch: boolean; share_bewertungen: boolean
}

const defaultProfile = (): Profile => ({
  username: '', display_name: '', age: null, weight_kg: null,
  height_cm: null, gender: '', notes: '',
  is_public: false, public_bio: '',
  share_peptide: true, share_kalender: false,
  share_tagebuch: false, share_bewertungen: true,
})

interface ShareToggleProps {
  icon: React.ReactNode
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

function ShareToggle({ icon, label, description, value, onChange, disabled }: ShareToggleProps) {
  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
      value && !disabled ? 'border-sky-500/30 bg-sky-500/5' : 'border-slate-800 bg-slate-800/30'
    } ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`shrink-0 ${value && !disabled ? 'text-sky-400' : 'text-slate-500'}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 truncate">{description}</p>
        </div>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          value && !disabled ? 'bg-sky-500' : 'bg-slate-700'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
          value && !disabled ? 'left-6' : 'left-1'
        }`} />
      </button>
    </div>
  )
}

export function Profil() {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<Profile>(defaultProfile())
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user!.id).single().then(({ data }) => {
      if (data) setProfile({
        username: data.username ?? '', display_name: data.display_name ?? '',
        age: data.age, weight_kg: data.weight_kg, height_cm: data.height_cm,
        gender: data.gender ?? '', notes: data.notes ?? '',
        is_public: data.is_public ?? false, public_bio: data.public_bio ?? '',
        share_peptide: data.share_peptide ?? true,
        share_kalender: data.share_kalender ?? false,
        share_tagebuch: data.share_tagebuch ?? false,
        share_bewertungen: data.share_bewertungen ?? true,
      })
    })
  }, [])

  const save = async () => {
    if (!profile.username.trim()) return toast.error(t('benutzername_req'))
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user!.id,
      username: profile.username.trim().toLowerCase(),
      display_name: profile.display_name || null,
      age: profile.age, weight_kg: profile.weight_kg, height_cm: profile.height_cm,
      gender: profile.gender || null, notes: profile.notes || null,
      is_public: profile.is_public, public_bio: profile.public_bio || null,
      share_peptide: profile.share_peptide,
      share_kalender: profile.share_kalender,
      share_tagebuch: profile.share_tagebuch,
      share_bewertungen: profile.share_bewertungen,
    })
    if (error) toast.error(t('fehler_speichern'))
    else toast.success(t('profil_gespeichert'))
    setSaving(false)
  }

  const profileUrl = `${window.location.origin}/u/${profile.username?.toLowerCase() || '...'}`

  const copyLink = async () => {
    if (!profile.username) return toast.error(t('zuerst_username'))
    await navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    toast.success(t('link_kopiert'))
    setTimeout(() => setCopied(false), 2000)
  }

  const set = (field: keyof Profile) => (val: any) =>
    setProfile(p => ({ ...p, [field]: val }))

  const sharedCount = [
    profile.share_peptide, profile.share_kalender,
    profile.share_tagebuch, profile.share_bewertungen,
  ].filter(Boolean).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('mein_profil')}</h1>
        <button className="btn-danger flex items-center gap-2 text-sm"
          onClick={() => { if (confirm(t('abmelden_confirm'))) signOut() }}>
          <LogOut size={15} /> {t('abmelden_btn')}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="bg-sky-500/10 p-5 rounded-full mb-2">
          <User size={36} className="text-sky-400" />
        </div>
        <p className="text-slate-400 text-sm">{user?.email}</p>
      </div>

      {/* ── Profil teilen ─────────────────────────────────────────────────── */}
      <div className={`card mb-4 border transition-colors ${
        profile.is_public ? 'border-sky-500/30' : 'border-slate-800'
      }`}>
        {/* Haupt-Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {profile.is_public
              ? <Globe size={16} className="text-sky-400" />
              : <Lock size={16} className="text-slate-400" />}
            <h2 className="font-semibold text-slate-300">{t('profil_teilen')}</h2>
            {profile.is_public && (
              <span className="badge bg-sky-500/10 text-sky-400 text-xs">
                {t('bereiche_count', { n: sharedCount })}
              </span>
            )}
          </div>
          <button
            onClick={() => setProfile(p => ({ ...p, is_public: !p.is_public }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              profile.is_public ? 'bg-sky-500' : 'bg-slate-700'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
              profile.is_public ? 'left-7' : 'left-1'
            }`} />
          </button>
        </div>

        {profile.is_public ? (
          <div className="space-y-3">
            {/* Teilen-Link */}
            <div className="flex gap-2">
              <div className="input flex-1 text-sky-400 text-sm truncate py-2 cursor-default">
                {profileUrl}
              </div>
              <button className="btn-secondary px-3 shrink-0" onClick={copyLink}>
                {copied
                  ? <Check size={16} className="text-emerald-400" />
                  : <Copy size={16} />}
              </button>
            </div>

            {/* Öffentliche Bio */}
            <div>
              <label className="label">{t('public_bio_label')}</label>
              <textarea className="input resize-none" rows={2}
                placeholder={t('public_bio_placeholder')}
                value={profile.public_bio}
                onChange={e => setProfile(p => ({ ...p, public_bio: e.target.value }))} />
            </div>

            {/* Inhalts-Schalter */}
            <div>
              <p className="label mb-2">{t('inhalte_sichtbar')}</p>
              <div className="space-y-2">
                <ShareToggle
                  icon={<FlaskConical size={16} />}
                  label={t('nav_peptide')}
                  description={t('share_peptide_desc')}
                  value={profile.share_peptide}
                  onChange={set('share_peptide')}
                />
                <ShareToggle
                  icon={<CalendarDays size={16} />}
                  label={t('share_kalender_voll')}
                  description={t('share_kalender_desc_t')}
                  value={profile.share_kalender}
                  onChange={set('share_kalender')}
                />
                <ShareToggle
                  icon={<BookHeart size={16} />}
                  label={t('tile_tagebuch')}
                  description={t('share_tagebuch_desc_t')}
                  value={profile.share_tagebuch}
                  onChange={set('share_tagebuch')}
                />
                <ShareToggle
                  icon={<Star size={16} />}
                  label={t('tile_bewertungen')}
                  description={t('share_bewertungen_desc_t')}
                  value={profile.share_bewertungen}
                  onChange={set('share_bewertungen')}
                />
              </div>
            </div>

            {sharedCount === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-400 text-xs">
                  {t('kein_bereich_warning')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            {t('profil_teilen_hint')}
          </p>
        )}
      </div>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <div className="card space-y-4 mb-4">
        <h2 className="font-semibold text-slate-300">Account</h2>
        <div>
          <label className="label">{t('benutzername_pflicht')}</label>
          <input className="input" placeholder={t('username_placeholder')}
            value={profile.username}
            onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} />
          <p className="text-slate-600 text-xs mt-1">{t('benutzername_hinweis')}</p>
        </div>
        <div>
          <label className="label">{t('anzeigename')}</label>
          <input className="input" placeholder={t('anzeigename_ph')}
            value={profile.display_name}
            onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} />
        </div>
      </div>

      {/* ── Gesundheitsdaten ─────────────────────────────────────────────── */}
      <div className="card space-y-4 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-300">{t('gesundheitsdaten')}</h2>
          <span className="badge bg-slate-700 text-slate-400">{t('freiwillig')}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('alter')}</label>
            <input className="input" type="number" placeholder={t('jahre_einheit')}
              value={profile.age ?? ''}
              onChange={e => setProfile(p => ({ ...p, age: e.target.value ? parseInt(e.target.value) : null }))} />
          </div>
          <div>
            <label className="label">{t('geschlecht')}</label>
            <select className="select" value={profile.gender}
              onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}>
              <option value="">—</option>
              <option value="männlich">{t('maennlich')}</option>
              <option value="weiblich">{t('weiblich')}</option>
              <option value="divers">{t('divers')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('gewicht_label')}</label>
            <input className="input" type="number" placeholder="kg"
              value={profile.weight_kg ?? ''}
              onChange={e => setProfile(p => ({ ...p, weight_kg: e.target.value ? parseFloat(e.target.value) : null }))} />
          </div>
          <div>
            <label className="label">{t('groesse_label')}</label>
            <input className="input" type="number" placeholder="cm"
              value={profile.height_cm ?? ''}
              onChange={e => setProfile(p => ({ ...p, height_cm: e.target.value ? parseFloat(e.target.value) : null }))} />
          </div>
        </div>
        <div>
          <label className="label">{t('pers_notizen_label')}</label>
          <textarea className="input resize-none" rows={3}
            placeholder={t('pers_notizen_ph')}
            value={profile.notes}
            onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? t('saving') : t('profil_speichern')}
      </button>

      {/* ── Sprache / Language ── */}
      <LanguageSwitcher />

      {/* App-Anleitung */}
      <div className="mt-3">
        <OnboardingRestartButton />
      </div>
    </div>
  )
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(i18n.language)
  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0]
  const selectedLang = LANGUAGES.find(l => l.code === selected) ?? current

  function apply() {
    i18n.changeLanguage(selected)
    localStorage.setItem('tyd_lang', selected)
    applyDirection(selected)
    setOpen(false)
  }

  return (
    <div className="mt-4">
      <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.5)', marginBottom: 8 }}>
        {t('language')}
      </p>

      <button
        onClick={() => { setOpen(o => !o); setSelected(i18n.language) }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderRadius: 13,
          background: 'rgba(0,204,245,0.06)', border: '1px solid rgba(0,204,245,0.14)',
          color: 'rgba(0,204,245,0.85)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Languages size={15} />
          <span>{current.flag} {current.name}</span>
        </div>
        <span style={{ fontSize: 12, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: 6, borderRadius: 13, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(8,10,24,0.98)',
        }}>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {LANGUAGES.map(lang => {
              const isSelected = lang.code === selected
              return (
                <div
                  key={lang.code}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isSelected ? 'rgba(0,204,245,0.10)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => setSelected(lang.code)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', textAlign: 'left', cursor: 'pointer',
                      color: isSelected ? '#00ccf5' : 'rgba(200,215,235,0.8)',
                      fontWeight: isSelected ? 700 : 400,
                      fontSize: '0.875rem',
                      background: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>

                  {isSelected && (
                    <button
                      onClick={apply}
                      style={{
                        margin: '6px 10px 6px 0',
                        padding: '6px 14px',
                        borderRadius: 8,
                        background: lang.code !== i18n.language
                          ? 'linear-gradient(135deg, #00ccf5, #0088dd)'
                          : 'rgba(0,204,245,0.15)',
                        border: '1px solid rgba(0,204,245,0.4)',
                        color: lang.code !== i18n.language ? '#07091a' : '#00ccf5',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lang.code !== i18n.language ? t('apply') : '✓'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
