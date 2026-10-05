/**
 * Moderation oeffentlicher Inhalte: Meldegruende und die Fehler des
 * Textfilters (Trigger auf Erfahrungen und oeffentlichen Profilen,
 * supabase-store-compliance-2.sql).
 */

export const MELDEGRUENDE = ['gefaehrlich', 'werbung', 'beleidigung', 'spam', 'sonstiges'] as const
export type Meldegrund = (typeof MELDEGRUENDE)[number]

const FILTER_FEHLER = {
  oeffentliches_profil_link: 'moderation_profile_link',
  oeffentliches_profil_handel: 'moderation_profile_trade',
  oeffentliches_profil_beleidigung: 'moderation_profile_abuse',
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
