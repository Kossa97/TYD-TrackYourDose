// src/components/LabLoader.tsx
// Cinematic full-screen loading screen for The Lab.

import { FlaskConical } from 'lucide-react'

interface LabLoaderProps {
  fadingOut?: boolean
}

export function LabLoader({ fadingOut = false }: LabLoaderProps) {
  return (
    <div
      // z-40 und nicht z-50: die Navigationsleiste (z-41) bleibt SICHTBAR,
      // waehrend geladen wird. Sie ist Geruest der App, kein Seiteninhalt —
      // wer auf eine Seite wechselt, die noch laedt, soll nicht das Gefuehl
      // haben, die App sei weg. Der schwebende Glaskoerper legt sich dabei auf
      // die Ladeflaeche und zeichnet sie weich, was gut aussieht.
      //
      // Ueber dem FAQ-Knopf (z-39) liegt sie weiterhin: der gehoert zur Seite
      // und hat auf einem Ladebildschirm nichts zu suchen. Dialoge (z-45
      // aufwaerts) liegen weiterhin ueber allem.
      className={`fixed inset-0 z-40 bg-[#070B11] flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full bg-sky-400/8 blur-2xl animate-pulse" />
        <div className="absolute w-16 h-16 rounded-full bg-sky-400/10 blur-lg animate-pulse" />

        {/* Spinning vial */}
        <FlaskConical
          size={48}
          className="relative text-sky-400 drop-shadow-[0_0_12px_rgba(0,204,245,0.5)]"
          style={{ animation: 'spin 2s linear infinite' }}
        />
      </div>
    </div>
  )
}
