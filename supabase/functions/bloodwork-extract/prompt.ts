export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Maximale Importe pro Nutzer im 30-Tage-Fenster. */
export const IMPORT_LIMIT = 10

export const RATE_WINDOW_DAYS = 30

export function buildPrompt(markerNames: string[]): string {
  return [
    'Du extrahierst Laborwerte aus einem deutschen oder englischen Laborbefund.',
    '',
    'Regeln:',
    '- Gib ausschließlich JSON zurück, ohne erklärenden Text und ohne Markdown-Codeblock.',
    '- Übernimm nur numerische Laborwerte. Keine Befundtexte, keine Interpretationen, keine Patientendaten.',
    '- Wenn ein Wert unleserlich oder mehrdeutig ist, lasse ihn weg. Auf keinen Fall raten.',
    '- Übernimm die Einheit exakt so, wie sie im Befund steht.',
    '- Übernimm den Referenzbereich des Labors, falls angegeben (ref_min/ref_max). Fehlt eine Grenze, setze null.',
    '- Bei einem Bereich wie "< 5" ist ref_min null und ref_max 5. Bei "> 40" ist ref_min 40 und ref_max null.',
    '- tested_at ist das Datum der Blutentnahme im Format yyyy-MM-dd. Findest du kein Datum, nutze das Befunddatum.',
    '- lab_name ist der Name des Labors, oder null.',
    '',
    'Wenn ein Marker in dieser Liste vorkommt, verwende exakt diese Schreibweise:',
    markerNames.join(', '),
    '',
    'Marker, die nicht in der Liste stehen, übernimmst du trotzdem mit ihrer Bezeichnung aus dem Befund.',
    '',
    'Antwortformat:',
    '{"tested_at":"yyyy-MM-dd","lab_name":"Name oder null","values":[{"marker":"Name","value":1.23,"unit":"mg/L","ref_min":null,"ref_max":5}]}',
    '',
    'Ist das Dokument kein Laborbefund, antworte mit: {"tested_at":null,"lab_name":null,"values":[]}',
  ].join('\n')
}

/** Holt das erste JSON-Objekt aus einer Modellantwort. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * Zeitpunkt, ab dem wieder ein Import frei wird: 30 Tage nach dem ältesten
 * Import im Fenster. Rechnet in UTC-Millisekunden, damit das Ergebnis nicht
 * von der Zeitzone des Servers abhängt.
 */
export function resetsAt(oldestImportIso: string | null): string | null {
  if (!oldestImportIso) return null
  const ms = Date.parse(oldestImportIso)
  if (Number.isNaN(ms)) return null
  return new Date(ms + RATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
