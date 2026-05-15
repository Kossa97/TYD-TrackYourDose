import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Peptide } from './pages/Peptide'
import { Tagebuch } from './pages/Tagebuch'
import { Bewertungen } from './pages/Bewertungen'
import { Profil } from './pages/Profil'
import { PublicProfile } from './pages/PublicProfile'
import { FAQ } from './pages/FAQ'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
          }}
        />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="peptide" element={<Peptide />} />
            <Route path="tagebuch" element={<Tagebuch />} />
            <Route path="bewertungen" element={<Bewertungen />} />
            <Route path="profil" element={<Profil />} />
            <Route path="faq" element={<FAQ />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
