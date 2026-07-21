export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Maximale Importe pro Nutzer im 30-Tage-Fenster. */
export const IMPORT_LIMIT = 10

export const RATE_WINDOW_DAYS = 30

/** Maximale Upload-Größe (dekodiert) — schützt vor teuren Riesendateien. Muss mit
 *  dem Client-Limit in src/features/blutwerte/lib/imageResize.ts übereinstimmen. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Ungefähre dekodierte Größe eines base64-Strings in Bytes. */
export function base64Bytes(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

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
    '- tested_at ist das Datum der BLUTENTNAHME im Format yyyy-MM-dd.',
    '  Bevorzuge in dieser Reihenfolge: "Entnahme", "Abnahme", "Abnahmedatum", "Entnahmedatum",',
    '  "Probeneingang", "Eingang". Nur wenn keines davon vorhanden ist, nutze das Befund- oder Druckdatum.',
    '  Verwende NIEMALS das Geburtsdatum des Patienten und nicht das Geburts-/Falldatum.',
    '  Deutsche Daten stehen als TT.MM.JJJJ (z.B. 20.05.2026 -> 2026-05-20). Rechne sie korrekt um,',
    '  ohne Tag und Monat zu vertauschen. Findest du gar kein Datum, setze tested_at auf null.',
    '- lab_name ist der Name des Labors, oder null.',
    '',
    '- Manche Blutbild-Zellarten (Neutrophile, Lymphozyten, Monozyten, Eosinophile, Basophile)',
    '  stehen im Befund doppelt: einmal als Prozentwert (Einheit %) und einmal als Absolutzahl',
    '  (Einheit G/l, /nl oder /µl). Übernimm beide als getrennte Werte: den Prozentwert mit der',
    '  Variante " %" (z.B. "Basophile %") und die Absolutzahl mit der Variante " absolut"',
    '  (z.B. "Basophile absolut"). Ordne die richtige Variante immer anhand der Einheit zu.',
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
