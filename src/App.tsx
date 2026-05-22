import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { Peptide } from './pages/Peptide'
import { Tagebuch } from './pages/Tagebuch'
import { Bewertungen } from './pages/Bewertungen'
import { Profil } from './pages/Profil'
import { PublicProfile } from './pages/PublicProfile'
import { FAQ } from './pages/FAQ'
import { Rechner } from './pages/Rechner'
import { Blutwerte } from './pages/Blutwerte'
import { Health } from './pages/Health'
import { TheLab } from './pages/TheLab'
import { StudyDetail } from './pages/StudyDetail'
import { PeptideLibrary } from './pages/PeptideLibrary'
import { PeptideDetailPage } from './pages/PeptideDetailPage'
import { AdminPanel } from './pages/lab/AdminPanel'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#07091a', color: '#eaeefc', border: '1px solid rgba(0,204,245,0.15)' },
          }}
        />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Home />} />
            <Route path="kalender" element={<Dashboard />} />
            <Route path="peptide" element={<Peptide />} />
            <Route path="lab" element={<TheLab />} />
            <Route path="lab/study/:id" element={<StudyDetail />} />
            <Route path="lab/library" element={<PeptideLibrary />} />
            <Route path="lab/library/:slug" element={<PeptideDetailPage />} />
            <Route path="lab/admin" element={<AdminPanel />} />
            <Route path="rechner" element={<Rechner />} />
            <Route path="blutwerte" element={<Blutwerte />} />
            <Route path="health" element={<Health />} />
            <Route path="the-lab" element={<TheLab />} />
            <Route path="tagebuch" element={<Tagebuch />} />
            <Route path="bewertungen" element={<Bewertungen />} />
            <Route path="profil" element={<Profil />} />
            <Route path="faq" element={<FAQ />} />
          </Route>
        </Routes>
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
