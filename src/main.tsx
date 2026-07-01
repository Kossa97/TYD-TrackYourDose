import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyDirection, i18nReady } from './i18n'
import App from './App.tsx'
const DEV_SW_RESET_KEY = 'tyd_dev_sw_reset'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  const clearStalePwaState = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(registration => registration.unregister()))

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
    }

    if (navigator.serviceWorker.controller && !sessionStorage.getItem(DEV_SW_RESET_KEY)) {
      sessionStorage.setItem(DEV_SW_RESET_KEY, '1')
      window.location.reload()
    }
  }

  void clearStalePwaState()
}

// Sprach-Richtung beim Start setzen
const savedLang = localStorage.getItem('tyd_lang') || navigator.language.split('-')[0]
applyDirection(savedLang)

// Erst rendern, wenn das Locale-Bundle der aktiven Sprache geladen ist —
// verhindert kurzes Aufblitzen roher i18n-Keys. .finally: auch bei
// fehlgeschlagenem Laden rendern (i18next fällt dann auf 'de' zurück).
i18nReady.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
