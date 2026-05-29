import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FEATURES } from './config/features'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })))
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Peptide = lazy(() => import('./pages/Peptide').then(m => ({ default: m.Peptide })))
const Tagebuch = lazy(() => import('./pages/Tagebuch').then(m => ({ default: m.Tagebuch })))
const Bewertungen = lazy(() => import('./pages/Bewertungen').then(m => ({ default: m.Bewertungen })))
const Profil = lazy(() => import('./pages/Profil').then(m => ({ default: m.Profil })))
const PublicProfile = lazy(() => import('./pages/PublicProfile').then(m => ({ default: m.PublicProfile })))
const FAQ = lazy(() => import('./pages/FAQ').then(m => ({ default: m.FAQ })))
const Rechner = lazy(() => import('./pages/Rechner').then(m => ({ default: m.Rechner })))
const Blutwerte = lazy(() => import('./pages/Blutwerte').then(m => ({ default: m.Blutwerte })))
const Health = lazy(() => import('./pages/Health').then(m => ({ default: m.Health })))
const Protokoll = lazy(() => import('./pages/Protokoll').then(m => ({ default: m.Protokoll })))
const TheLab = lazy(() => import('./pages/TheLab').then(m => ({ default: m.TheLab })))
const StudyDetail = lazy(() => import('./pages/StudyDetail').then(m => ({ default: m.StudyDetail })))
const PeptideLibrary = lazy(() => import('./pages/PeptideLibrary').then(m => ({ default: m.PeptideLibrary })))
const PeptideDetailPage = lazy(() => import('./pages/PeptideDetailPage').then(m => ({ default: m.PeptideDetailPage })))
const AdminPanel = lazy(() => import('./pages/lab/AdminPanel').then(m => ({ default: m.AdminPanel })))
const InjektionsTracker = lazy(() => import('./pages/InjektionsTracker').then(m => ({ default: m.InjektionsTracker })))
const Progress = lazy(() => import('./pages/Progress').then(m => ({ default: m.Progress })))
const BlutspiegelSimulation = lazy(() => import('./pages/BlutspiegelSimulation').then(m => ({ default: m.BlutspiegelSimulation })))

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-slate-500">
      …
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

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
          <Route path="/u/:username" element={<LazyPage><PublicProfile /></LazyPage>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<LazyPage><Home /></LazyPage>} />
            <Route path="kalender" element={<LazyPage><Dashboard /></LazyPage>} />
            <Route path="peptide" element={<LazyPage><Peptide /></LazyPage>} />
            <Route path="lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="lab/study/:id" element={<LazyPage><StudyDetail /></LazyPage>} />
            <Route path="lab/library" element={<LazyPage><PeptideLibrary /></LazyPage>} />
            <Route path="lab/library/:slug" element={<LazyPage><PeptideDetailPage /></LazyPage>} />
            <Route path="lab/admin" element={<LazyPage><AdminPanel /></LazyPage>} />
            <Route path="rechner" element={<LazyPage><Rechner /></LazyPage>} />
            <Route path="blutwerte" element={<LazyPage><Blutwerte /></LazyPage>} />
            <Route path="health" element={<LazyPage><Health /></LazyPage>} />
            <Route path="protokoll" element={<LazyPage><Protokoll /></LazyPage>} />
            <Route path="the-lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="tagebuch" element={<LazyPage><Tagebuch /></LazyPage>} />
            <Route path="bewertungen" element={<LazyPage><Bewertungen /></LazyPage>} />
            <Route path="profil" element={<LazyPage><Profil /></LazyPage>} />
            <Route path="faq" element={<LazyPage><FAQ /></LazyPage>} />
            <Route path="injektionen" element={<LazyPage><InjektionsTracker /></LazyPage>} />
            {FEATURES.FOTO_PROGRESS && (
              <Route path="progress" element={<LazyPage><Progress /></LazyPage>} />
            )}
            <Route path="simulation" element={<LazyPage><BlutspiegelSimulation /></LazyPage>} />
          </Route>
        </Routes>
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
