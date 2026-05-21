// src/components/LabLoader.tsx
// Cinematic full-screen loading screen for The Lab.

import { FlaskConical } from 'lucide-react'

interface LabLoaderProps {
  fadingOut?: boolean
}

export function LabLoader({ fadingOut = false }: LabLoaderProps) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-[#070B11] flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${
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

      {/* Label */}
      <div className="flex flex-col items-center gap-1.5">
        <p
          className="text-[0.65rem] font-black uppercase tracking-[0.35em] text-sky-400/60"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          The Lab
        </p>
        <p
          className="text-[0.52rem] uppercase tracking-[0.2em] text-slate-700 animate-pulse"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Lade Studien…
        </p>
      </div>
    </div>
  )
}
