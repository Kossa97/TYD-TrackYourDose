import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConsentChecks } from '../features/compliance/components/ConsentChecks'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { LegalLinks } from '../features/compliance/components/LegalLinks'
import { KEINE_ZUSTIMMUNG, vollstaendig, zustimmungsZeile } from '../features/compliance/lib/consent'

export function Auth() {
  const { session } = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [zustimmung, setZustimmung] = useState(KEINE_ZUSTIMMUNG)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'register') {
      if (!vollstaendig(zustimmung)) {
        setLoading(false)
        return toast.error(t('consent_required'))
      }
      // Die Zustimmung steht auch in den Konto-Metadaten: muss die E-Mail
      // erst bestaetigt werden, darf das Profil noch nicht geschrieben werden
      // — dann uebernimmt die Zustimmungsseite sie beim ersten Start.
      const felder = zustimmungsZeile(new Date())
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, ...felder } } })
      if (error) {
        toast.error(error.message)
      } else if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, username, ...felder })
        toast.success(t('account_created'))
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error(t('wrong_credentials'))
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-sky-500/10 p-4 rounded-2xl mb-3">
            <FlaskConical className="text-sky-400" size={36} />
          </div>
          <h1 className="text-2xl font-bold text-white">TYD</h1>
          <p className="text-slate-400 text-sm mt-1">{t('auth_title')}</p>
        </div>

        <div className="card">
          <div className="flex bg-slate-800 rounded-lg p-1 mb-6">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('login')}
            >
              {t('auth_tab_login')}
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'register' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('register')}
            >
              {t('auth_tab_register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">{t('username')} *</label>
                <input className="input" placeholder={t('username_placeholder')} value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" placeholder={t('email_placeholder')} value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <input className="input" type="password" placeholder={t('password_placeholder')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {mode === 'register' && <ConsentChecks value={zustimmung} onChange={setZustimmung} />}
            <button className="btn-primary w-full mt-2" type="submit" disabled={loading} data-auth-submit>
              {loading ? t('loading') : mode === 'login' ? t('auth_tab_login') : t('create_account')}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          {t('research_only')}
        </p>
        <MedicalNotice className="mt-4" />
        <LegalLinks className="mt-4" />
      </div>
    </div>
  )
}
