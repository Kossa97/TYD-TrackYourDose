import { Haptics, ImpactStyle } from '@capacitor/haptics'

/** Leichter Klick — für Scroll-Ticks beim Wischen im Graph. */
export async function hapticTick(): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Web-Fallback: Vibrations API (Android Chrome); iOS Safari ignoriert das still.
    try { navigator.vibrate?.(2) } catch { /* ignore */ }
  }
}
