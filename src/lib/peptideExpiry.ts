import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'

export type ExpiryStatus = 'expired' | 'soon'

export interface PeptideExpiryAlert {
  id: string
  name: string
  daysLeft: number
  status: ExpiryStatus
}

export interface PeptideExpirySource {
  id: string
  name: string
  reconstitution_date: string | null
  expiry_days: number | null
}

/** Alerts when expiry is within 7 days (or already past). */
export function getPeptideExpiryAlerts(
  peptides: PeptideExpirySource[],
  referenceDate = new Date(),
): PeptideExpiryAlert[] {
  const horizon = addDays(referenceDate, 7)

  return peptides
    .map(peptide => {
      if (!peptide.reconstitution_date || peptide.expiry_days == null) return null
      const expiryDate = addDays(parseISO(peptide.reconstitution_date), Number(peptide.expiry_days))
      if (expiryDate > horizon) return null

      const daysLeft = differenceInCalendarDays(expiryDate, referenceDate)
      return {
        id: peptide.id,
        name: peptide.name,
        daysLeft,
        status: daysLeft < 0 ? 'expired' as const : 'soon' as const,
      }
    })
    .filter((row): row is PeptideExpiryAlert => row != null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}
