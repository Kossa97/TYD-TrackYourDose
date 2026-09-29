import { useEffect, useState } from 'react'

const MINUTE = 60_000

/**
 * Eine Uhr, die jede Minute weiterspringt — damit „Tag N" und die naechste
 * Einnahme nicht stehen bleiben, und damit alles, was davon abhaengt, sich
 * per `useMemo` an `now.getTime()` nur einmal je Minute neu rechnet.
 * Mit `fixed` (Tests) steht die Uhr.
 */
export function useMinuteClock(fixed?: Date): Date {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    if (fixed) return
    const timer = window.setInterval(() => setTick(Date.now()), MINUTE)
    return () => window.clearInterval(timer)
  }, [fixed])
  return fixed ?? new Date(Math.floor(tick / MINUTE) * MINUTE)
}
