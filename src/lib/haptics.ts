import { Haptics, ImpactStyle } from '@capacitor/haptics'

/** Leichter Klick — für Scroll-Ticks beim Wischen im Graph. */
export async function hapticTick(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Web-Fallback: Vibrations API (Android Chrome); iOS Safari ignoriert das still.
    // Chrome blockiert (und protokolliert) den Aufruf ohne noch aktive
    // Nutzer-Geste — etwa wenn das native Promise erst spaeter abgelehnt wird.
    if (navigator.userActivation?.isActive === false) return
    try { navigator.vibrate?.(2) } catch { /* ignore */ }
  }
}
