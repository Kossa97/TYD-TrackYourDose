import type { ReactNode } from 'react'

/**
 * Unteres Sheet fuer Melden, Blockieren, Konto loeschen und Rechtstexte.
 * Gleiches Aussehen wie die Sheets der Erfahrungen; Escape und Tippen auf
 * den Hintergrund schliessen, ausser waehrend etwas laeuft.
 */
export function Sheet({ labelledBy, busy = false, onClose, children, role = 'dialog', tall = false, ...data }: {
  labelledBy: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  role?: 'dialog' | 'alertdialog'
  tall?: boolean
} & Record<`data-${string}`, boolean | string>) {
  return (
    <div
      data-app-modal
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10"
      onClick={() => { if (!busy) onClose() }}
    >
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        {...data}
        className={`w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl ${tall ? 'max-h-[85vh]' : 'max-h-[90vh]'}`}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape' || busy) return
          event.stopPropagation()
          onClose()
        }}
      >
        {children}
      </div>
    </div>
  )
}
