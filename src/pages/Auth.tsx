import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { FlaskConical } from 'lucide-react'

export function Auth() {
  const { session } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        toast.error(error.message)
      } else if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username,
        })
        toast.success('Konto erstellt! Bitte E-Mail bestätigen.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) toast.error('Falsche E-Mail oder Passwort')
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
          <h1 className="text-2xl font-bold text-white">Peptid Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Forschungs-Protokollierung</p>
        </div>

        <div className="card">
          <div className="flex bg-slate-800 rounded-lg p-1 mb-6">
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('login')}
            >
              Anmelden
            </button>
            <button
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'register' ? 'bg-sky-500 text-white' : 'text-slate-400'}`}
              onClick={() => setMode('register')}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Benutzername *</label>
                <input className="input" placeholder="mein_username" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" placeholder="email@beispiel.de" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Passwort</label>
              <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
              {loading ? 'Lädt...' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Nur für persönliche Forschungszwecke
        </p>
      </div>
    </div>
  )
}
