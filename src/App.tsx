import { lazy, Suspense, type ReactNode } from 'react'
import { importWithReload } from './lib/staleChunkReload'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { VialPreview } from './pages/__VialPreview'
import { publicPeptipediaRoutes } from './features/peptipedia/publicRoutes'
import { PeptipediaAppPage } from './features/peptipedia/PeptipediaAppPage'
import { PdfPreview } from './pages/__PdfPreview'
import { BefundPreview } from './pages/__BefundPreview'
import { PdfThemesPreview } from './pages/__PdfThemesPreview'
import { AppBackNavigation } from './components/navigation/AppBackNavigation'

const Home = lazy(importWithReload(() => import('./pages/Home').then(m => ({ default: m.Home }))))
const Dashboard = lazy(importWithReload(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard }))))
const MyStackPage = lazy(importWithReload(() => import('./features/my-stack/MyStackPage').then(m => ({ default: m.MyStackPage }))))
const Tagebuch = lazy(importWithReload(() => import('./pages/Tagebuch').then(m => ({ default: m.Tagebuch }))))
const Bewertungen = lazy(importWithReload(() => import('./pages/Bewertungen').then(m => ({ default: m.Bewertungen }))))
const Profil = lazy(importWithReload(() => import('./pages/Profil').then(m => ({ default: m.Profil }))))
const PublicProfile = lazy(importWithReload(() => import('./pages/PublicProfile').then(m => ({ default: m.PublicProfile }))))
const FAQ = lazy(importWithReload(() => import('./pages/FAQ').then(m => ({ default: m.FAQ }))))
const Rechner = lazy(importWithReload(() => import('./pages/Rechner').then(m => ({ default: m.Rechner }))))
const Blutwerte = lazy(importWithReload(() => import('./pages/Blutwerte').then(m => ({ default: m.Blutwerte }))))
const Health = lazy(importWithReload(() => import('./pages/Health').then(m => ({ default: m.Health }))))
const TheLab = lazy(importWithReload(() => import('./pages/TheLab').then(m => ({ default: m.TheLab }))))
const StudyDetail = lazy(importWithReload(() => import('./pages/StudyDetail').then(m => ({ default: m.StudyDetail }))))
const AdminPanel = lazy(importWithReload(() => import('./pages/lab/AdminPanel').then(m => ({ default: m.AdminPanel }))))
const InjektionsTracker = lazy(importWithReload(() => import('./pages/InjektionsTracker').then(m => ({ default: m.InjektionsTracker }))))
const Progress = lazy(importWithReload(() => import('./pages/Progress').then(m => ({ default: m.Progress }))))
const PdfProtokoll = lazy(importWithReload(() => import('./pages/PdfProtokoll').then(m => ({ default: m.PdfProtokoll }))))
const Protokoll = lazy(importWithReload(() => import('./pages/Protokoll').then(m => ({ default: m.Protokoll }))))
const BlutspiegelSimulation = lazy(importWithReload(() => import('./pages/BlutspiegelSimulation').then(m => ({ default: m.BlutspiegelSimulation }))))

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-slate-500">
      …
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

function PersonalApp() {
  return (
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
          <Route path="/__vialpreview" element={<VialPreview />} />
          <Route path="/__pdfpreview" element={<PdfPreview />} />
          <Route path="/__befundpreview" element={<BefundPreview />} />
          <Route path="/__pdfthemes" element={<PdfThemesPreview />} />
          <Route path="/u/:username" element={<LazyPage><PublicProfile /></LazyPage>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<LazyPage><Home /></LazyPage>} />
            <Route path="kalender" element={<LazyPage><Dashboard /></LazyPage>} />
            <Route path="my-stack" element={<LazyPage><MyStackPage /></LazyPage>} />
            <Route path="peptide" element={<Navigate to="/my-stack" replace />} />
            <Route path="lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="lab/peptipedia" element={<PeptipediaAppPage />} />
            <Route path="lab/peptipedia/:slug" element={<PeptipediaAppPage detail />} />
            <Route path="lab/study/:id" element={<LazyPage><StudyDetail /></LazyPage>} />
            <Route path="lab/admin" element={<LazyPage><AdminPanel /></LazyPage>} />
            <Route path="rechner" element={<LazyPage><Rechner /></LazyPage>} />
            <Route path="blutwerte" element={<LazyPage><Blutwerte /></LazyPage>} />
            <Route path="health" element={<LazyPage><Health /></LazyPage>} />
            <Route path="protokoll" element={<LazyPage><PdfProtokoll /></LazyPage>} />
            <Route path="protokoll/analyse" element={<LazyPage><Protokoll /></LazyPage>} />
            <Route path="the-lab" element={<LazyPage><TheLab /></LazyPage>} />
            <Route path="tagebuch" element={<LazyPage><Tagebuch /></LazyPage>} />
            <Route path="bewertungen" element={<LazyPage><Bewertungen /></LazyPage>} />
            <Route path="profil" element={<LazyPage><Profil /></LazyPage>} />
            <Route path="faq" element={<LazyPage><FAQ /></LazyPage>} />
            <Route path="injektionen" element={<LazyPage><InjektionsTracker /></LazyPage>} />
            <Route path="progress" element={<LazyPage><Progress /></LazyPage>} />
            <Route path="simulation" element={<LazyPage><BlutspiegelSimulation /></LazyPage>} />
          </Route>
        </Routes>
        </OnboardingProvider>
      </AuthProvider>
  )
}

export default function App() {
  return <BrowserRouter><AppBackNavigation><Routes>
      {publicPeptipediaRoutes()}
      <Route path="*" element={<PersonalApp />} />
    </Routes></AppBackNavigation></BrowserRouter>
}
