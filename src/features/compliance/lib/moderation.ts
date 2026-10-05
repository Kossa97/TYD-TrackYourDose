/**
 * Moderation oeffentlicher Erfahrungen: Meldegruende und die Fehler des
 * Textfilters (Trigger `reviews_check_public_text`, supabase-store-compliance.sql).
 */

export const MELDEGRUENDE = ['gefaehrlich', 'werbung', 'beleidigung', 'spam', 'sonstiges'] as const
export type Meldegrund = (typeof MELDEGRUENDE)[number]

const FILTER_FEHLER = {
  oeffentlicher_text_link: 'moderation_text_link',
  oeffentlicher_text_handel: 'moderation_text_trade',
  oeffentlicher_text_beleidigung: 'moderation_text_abuse',
} as const

/**
 * Uebersetzungsschluessel fuer eine Fehlermeldung des Textfilters, sonst null.
 * Die Datenbank meldet den Code im Text der Fehlermeldung.
 */
export function filterFehlerSchluessel(message: string | null | undefined): string | null {
  if (!message) return null
  for (const [code, key] of Object.entries(FILTER_FEHLER)) {
    if (message.includes(code)) return key
  }
  return null
}
