import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import { applyDirection } from './i18n'
import App from './App.tsx'

// Sprach-Richtung beim Start setzen
const savedLang = localStorage.getItem('tyd_lang') || navigator.language.split('-')[0]
applyDirection(savedLang)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
