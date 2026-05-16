/** Pulsing indicator dot for undiscovered features. */
export function NewDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 shrink-0 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
    </span>
  )
}
