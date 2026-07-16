# Blutwerte-Feinschliff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blutwerte-Feature um KI-Befundimport (Foto/PDF), Laien-Erklärungen mit deutlichem Referenzbereich und Kategorie-Filter/Sortierung erweitern.

**Architecture:** Die 560-Zeilen-Seite `src/pages/Blutwerte.tsx` wird nach `src/features/blutwerte/` aufgeteilt (Muster: `src/features/fortschritt/`). Kern ist ein Markerkatalog als TypeScript-Modul (~60 Marker mit Kategorie, Referenzbereich, Erklärung), der die bisherigen Hardcodings `ALL_MARKERS`/`REFERENCE_RANGES` ersetzt. Alle Berechnungen (effektive Referenz, Trend, Filter, Sortierung) leben als pure Functions in `lib/` und sind per Vitest getestet. Der Import läuft über eine Supabase Edge Function, die Claude Haiku 4.5 mit Vision aufruft; die hochgeladene Datei wird nicht gespeichert.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest, Supabase (Postgres + Edge Functions/Deno), Recharts, lucide-react, react-hot-toast, date-fns, Tailwind + CSS-Variablen (`var(--surface)`, `var(--accent)`, …)

**Spec:** `docs/superpowers/specs/2026-07-17-blutwerte-feinschliff-design.md`

---

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/features/blutwerte/types.ts` | `BloodworkEntry`, `BloodworkReport` |
| `src/features/blutwerte/lib/markerCatalog.ts` | Katalogdaten + `normalizeMarker` |
| `src/features/blutwerte/lib/bloodwork.ts` | Pure Functions: effektive Referenz, In-Range, Trend, Summaries, Filter, Sortierung |
| `src/features/blutwerte/lib/extractResult.ts` | Typen + Validierung der Edge-Function-Antwort |
| `src/features/blutwerte/lib/imageResize.ts` | Clientseitige Bildverkleinerung |
| `src/features/blutwerte/BlutwertePage.tsx` | Orchestrierung, Daten laden, View-Routing |
| `src/features/blutwerte/components/MarkerGrid.tsx` | Grid + Kategorie-Chips + Sortierung |
| `src/features/blutwerte/components/AuffaelligeWerte.tsx` | Sektion „Auffällige Werte" |
| `src/features/blutwerte/components/MarkerDetail.tsx` | Detailansicht |
| `src/features/blutwerte/components/ReferenceBar.tsx` | Visueller Referenzbalken |
| `src/features/blutwerte/components/EntryModal.tsx` | Manuelles Eingabe-Modal |
| `src/features/blutwerte/components/BefundListe.tsx` | Befund-Ansicht |
| `src/features/blutwerte/components/import/ImportFlow.tsx` | Upload → Extraktion → Review → Speichern |
| `src/features/blutwerte/components/import/ReviewTable.tsx` | Editierbare Tabelle der erkannten Werte |
| `supabase/functions/bloodwork-extract/index.ts` | Edge Function (Deno) |
| `supabase/functions/bloodwork-extract/prompt.ts` | Prompt-Bau + Antwort-Normalisierung (pure) |
| `supabase-bloodwork-import.sql` | Migration |

**Geändert:** `src/pages/Blutwerte.tsx` → dünner Re-Export (Routen bleiben unverändert).

---

### Task 1: Markerkatalog

**Files:**
- Create: `src/features/blutwerte/lib/markerCatalog.ts`
- Test: `src/features/blutwerte/lib/markerCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/blutwerte/lib/markerCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CATALOG_MARKER_NAMES, KATEGORIEN, MARKER_CATALOG, normalizeMarker } from './markerCatalog'

describe('normalizeMarker', () => {
  it('findet einen Marker über den kanonischen Namen', () => {
    expect(normalizeMarker('Testosteron')?.name).toBe('Testosteron')
  })

  it('ignoriert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeMarker('  testosteron  ')?.name).toBe('Testosteron')
  })

  it('findet einen Marker über ein Synonym', () => {
    expect(normalizeMarker('Gesamttestosteron')?.name).toBe('Testosteron')
  })

  it('gibt null für unbekannte Marker zurück', () => {
    expect(normalizeMarker('Phantasiewert')).toBeNull()
  })

  it('gibt null für leere Eingaben zurück', () => {
    expect(normalizeMarker('   ')).toBeNull()
  })
})

describe('MARKER_CATALOG', () => {
  it('enthält alle bisher unterstützten Marker', () => {
    const bisher = [
      'IGF-1', 'Testosteron', 'Östradiol', 'SHBG', 'LH', 'FSH',
      'TSH', 'CRP', 'Vitamin D', 'Ferritin', 'Hämoglobin', 'Hämatokrit',
      'GH', 'Kortisol', 'Insulin',
    ]
    bisher.forEach(name => {
      expect(normalizeMarker(name), `${name} fehlt im Katalog`).not.toBeNull()
    })
  })

  it('hat für jeden Marker eine Erklärung und eine gültige Kategorie', () => {
    MARKER_CATALOG.forEach(def => {
      expect(def.erklaerung.length, `${def.name} ohne Erklärung`).toBeGreaterThan(20)
      expect(KATEGORIEN, `${def.name} mit unbekannter Kategorie`).toContain(def.kategorie)
    })
  })

  it('hat keine doppelten Namen oder Synonyme', () => {
    const alle = MARKER_CATALOG.flatMap(d => [d.name, ...d.synonyme]).map(s => s.toLowerCase())
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('exportiert die Markernamen für den Extraktions-Prompt', () => {
    expect(CATALOG_MARKER_NAMES).toContain('Testosteron')
    expect(CATALOG_MARKER_NAMES.length).toBe(MARKER_CATALOG.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/blutwerte/lib/markerCatalog.test.ts`
Expected: FAIL — „Failed to resolve import ./markerCatalog"

- [ ] **Step 3: Write the implementation**

Create `src/features/blutwerte/lib/markerCatalog.ts`:

```ts
export type Kategorie =
  | 'Hormone'
  | 'Schilddrüse'
  | 'Blutbild'
  | 'Leber'
  | 'Niere'
  | 'Lipide'
  | 'Entzündung'
  | 'Vitamine & Mineralstoffe'
  | 'Stoffwechsel'

export const KATEGORIEN: Kategorie[] = [
  'Hormone',
  'Schilddrüse',
  'Blutbild',
  'Leber',
  'Niere',
  'Lipide',
  'Entzündung',
  'Vitamine & Mineralstoffe',
  'Stoffwechsel',
]

/** Kategorie-Label für Marker, die nicht im Katalog stehen. */
export const SONSTIGE = 'Sonstige' as const

export type KategorieFilter = Kategorie | typeof SONSTIGE

export interface MarkerDef {
  /** Kanonischer Anzeigename. */
  name: string
  /** Alternative Schreibweisen, wie sie auf Laborbefunden auftauchen. */
  synonyme: string[]
  kategorie: Kategorie
  /** Standard-Einheit für manuelle Eingaben. */
  einheit: string
  refMin?: number
  refMax?: number
  /** Steuert die Trend-Farbe: bei true ist ein sinkender Wert gut. */
  lowerIsBetter?: boolean
  /** 1–3 Sätze in Laiendeutsch: was der Wert bedeutet und wann er relevant ist. */
  erklaerung: string
}

export const MARKER_CATALOG: MarkerDef[] = [
  // ---------- Hormone ----------
  {
    name: 'Testosteron',
    synonyme: ['Testosteron gesamt', 'Gesamttestosteron', 'Testosteron, gesamt', 'Testo'],
    kategorie: 'Hormone',
    einheit: 'ng/dL',
    refMin: 400,
    refMax: 900,
    erklaerung:
      'Das wichtigste männliche Sexualhormon. Es beeinflusst Muskelaufbau, Knochendichte, Libido und Stimmung. Zu niedrige Werte können sich durch Antriebslosigkeit und Muskelabbau zeigen.',
  },
  {
    name: 'Freies Testosteron',
    synonyme: ['Testosteron frei', 'Freies Testo', 'fT'],
    kategorie: 'Hormone',
    einheit: 'pg/mL',
    refMin: 50,
    refMax: 210,
    erklaerung:
      'Der Anteil des Testosterons, der nicht an Transportproteine gebunden und damit direkt wirksam ist. Aussagekräftiger als der Gesamtwert, wenn SHBG auffällig ist.',
  },
  {
    name: 'Östradiol',
    synonyme: ['Estradiol', 'E2', 'Oestradiol'],
    kategorie: 'Hormone',
    einheit: 'pg/mL',
    refMin: 20,
    refMax: 50,
    erklaerung:
      'Das wichtigste Östrogen, das auch bei Männern aus Testosteron entsteht. Zu hohe Werte können Wassereinlagerungen und Brustgewebswachstum begünstigen, zu niedrige schaden Gelenken und Libido.',
  },
  {
    name: 'SHBG',
    synonyme: ['Sexualhormon-bindendes Globulin', 'Sexualhormonbindendes Globulin'],
    kategorie: 'Hormone',
    einheit: 'nmol/L',
    refMin: 20,
    refMax: 60,
    erklaerung:
      'Ein Transportprotein, das Sexualhormone im Blut bindet. Je höher SHBG, desto weniger Testosteron ist frei verfügbar — der Gesamtwert allein sagt dann wenig aus.',
  },
  {
    name: 'LH',
    synonyme: ['Luteinisierendes Hormon', 'Luteinizing Hormone'],
    kategorie: 'Hormone',
    einheit: 'mIU/mL',
    refMin: 1.7,
    refMax: 8.6,
    erklaerung:
      'Ein Steuerhormon aus der Hirnanhangdrüse, das die körpereigene Testosteronproduktion anregt. Niedrige Werte bei niedrigem Testosteron deuten auf eine Störung der Steuerung hin.',
  },
  {
    name: 'FSH',
    synonyme: ['Follikelstimulierendes Hormon', 'Follitropin'],
    kategorie: 'Hormone',
    einheit: 'mIU/mL',
    refMin: 1.5,
    refMax: 12.4,
    erklaerung:
      'Steuerhormon aus der Hirnanhangdrüse, das bei Männern die Spermienbildung und bei Frauen die Eizellreifung anregt.',
  },
  {
    name: 'Prolaktin',
    synonyme: ['PRL'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMax: 15,
    lowerIsBetter: true,
    erklaerung:
      'Ein Hormon der Hirnanhangdrüse. Dauerhaft erhöhte Werte können Libido und Testosteronproduktion dämpfen und sollten ärztlich abgeklärt werden.',
  },
  {
    name: 'IGF-1',
    synonyme: ['Insulin-like Growth Factor 1', 'Somatomedin C', 'IGF1'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMin: 100,
    refMax: 300,
    erklaerung:
      'Ein Wachstumsfaktor, der überwiegend als Antwort auf Wachstumshormon in der Leber gebildet wird. Er gilt als stabiler Indikator für die Wachstumshormon-Aktivität, da er über den Tag kaum schwankt.',
  },
  {
    name: 'GH',
    synonyme: ['Wachstumshormon', 'Somatotropin', 'HGH', 'STH'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMax: 3.0,
    erklaerung:
      'Das Wachstumshormon selbst. Sein Spiegel schwankt im Tagesverlauf stark, weshalb eine Einzelmessung wenig aussagt — IGF-1 ist der verlässlichere Indikator.',
  },
  {
    name: 'Kortisol',
    synonyme: ['Cortisol'],
    kategorie: 'Hormone',
    einheit: 'µg/dL',
    refMin: 10,
    refMax: 20,
    erklaerung:
      'Das zentrale Stresshormon. Der Wert ist morgens am höchsten, die Uhrzeit der Blutentnahme ist deshalb entscheidend für die Beurteilung.',
  },
  {
    name: 'DHEA-S',
    synonyme: ['DHEA-Sulfat', 'Dehydroepiandrosteron-Sulfat', 'DHEAS'],
    kategorie: 'Hormone',
    einheit: 'µg/dL',
    refMin: 150,
    refMax: 500,
    erklaerung:
      'Eine Vorstufe von Testosteron und Östrogen aus der Nebenniere. Der Wert sinkt natürlicherweise mit dem Alter.',
  },
  {
    name: 'Progesteron',
    synonyme: ['Progesteron gesamt'],
    kategorie: 'Hormone',
    einheit: 'ng/mL',
    refMax: 0.5,
    erklaerung:
      'Ein Sexualhormon, das bei Frauen den Zyklus steuert. Bei Männern liegt es normalerweise sehr niedrig.',
  },

  // ---------- Schilddrüse ----------
  {
    name: 'TSH',
    synonyme: ['Thyreotropin', 'Thyreoidea-stimulierendes Hormon', 'TSH basal'],
    kategorie: 'Schilddrüse',
    einheit: 'mIU/L',
    refMin: 0.4,
    refMax: 4.0,
    erklaerung:
      'Das Steuerhormon der Schilddrüse und der wichtigste Suchtest. Ein hoher Wert spricht eher für eine Unterfunktion, ein niedriger für eine Überfunktion — es verhält sich also gegenläufig zu den Schilddrüsenhormonen.',
  },
  {
    name: 'fT3',
    synonyme: ['Freies T3', 'Freies Trijodthyronin', 'Trijodthyronin frei'],
    kategorie: 'Schilddrüse',
    einheit: 'pg/mL',
    refMin: 2.3,
    refMax: 4.2,
    erklaerung:
      'Das aktive Schilddrüsenhormon, das den Energieverbrauch der Zellen steuert. Es beeinflusst Stoffwechseltempo, Körpertemperatur und Antrieb.',
  },
  {
    name: 'fT4',
    synonyme: ['Freies T4', 'Freies Thyroxin', 'Thyroxin frei'],
    kategorie: 'Schilddrüse',
    einheit: 'ng/dL',
    refMin: 0.8,
    refMax: 1.8,
    erklaerung:
      'Die Speicherform des Schilddrüsenhormons, die der Körper bei Bedarf in das aktive fT3 umwandelt.',
  },

  // ---------- Blutbild ----------
  {
    name: 'Hämoglobin',
    synonyme: ['Hb', 'Haemoglobin', 'HGB'],
    kategorie: 'Blutbild',
    einheit: 'g/dL',
    refMin: 13.5,
    refMax: 17.5,
    erklaerung:
      'Der rote Blutfarbstoff, der den Sauerstoff im Blut transportiert. Zu niedrige Werte bedeuten Blutarmut, zu hohe machen das Blut zähflüssiger.',
  },
  {
    name: 'Hämatokrit',
    synonyme: ['Hkt', 'Haematokrit', 'HCT'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 40,
    refMax: 52,
    erklaerung:
      'Der Anteil fester Blutzellen am Blutvolumen — vereinfacht: wie dickflüssig das Blut ist. Stark erhöhte Werte belasten Herz und Kreislauf.',
  },
  {
    name: 'Erythrozyten',
    synonyme: ['Rote Blutkörperchen', 'RBC', 'Ery'],
    kategorie: 'Blutbild',
    einheit: 'Mio/µL',
    refMin: 4.5,
    refMax: 5.9,
    erklaerung: 'Die Anzahl roter Blutkörperchen, die den Sauerstoff durch den Körper transportieren.',
  },
  {
    name: 'Leukozyten',
    synonyme: ['Weiße Blutkörperchen', 'WBC', 'Leuko'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 4.0,
    refMax: 10.0,
    erklaerung:
      'Die weißen Blutkörperchen der Immunabwehr. Erhöhte Werte treten typischerweise bei Infektionen auf.',
  },
  {
    name: 'Thrombozyten',
    synonyme: ['Blutplättchen', 'PLT', 'Thrombo'],
    kategorie: 'Blutbild',
    einheit: '/nL',
    refMin: 150,
    refMax: 400,
    erklaerung: 'Die Blutplättchen sorgen für die Blutgerinnung und das Verschließen von Wunden.',
  },
  {
    name: 'MCV',
    synonyme: ['Mittleres korpuskuläres Volumen'],
    kategorie: 'Blutbild',
    einheit: 'fL',
    refMin: 80,
    refMax: 96,
    erklaerung:
      'Die durchschnittliche Größe der roten Blutkörperchen. Sie hilft, die Ursache einer Blutarmut einzugrenzen.',
  },
  {
    name: 'MCH',
    synonyme: ['Mittlerer korpuskulärer Hämoglobingehalt', 'HbE'],
    kategorie: 'Blutbild',
    einheit: 'pg',
    refMin: 28,
    refMax: 33,
    erklaerung: 'Der durchschnittliche Hämoglobingehalt eines einzelnen roten Blutkörperchens.',
  },
  {
    name: 'MCHC',
    synonyme: ['Mittlere korpuskuläre Hämoglobinkonzentration'],
    kategorie: 'Blutbild',
    einheit: 'g/dL',
    refMin: 33,
    refMax: 36,
    erklaerung: 'Die Hämoglobinkonzentration in den roten Blutkörperchen.',
  },
  {
    name: 'RDW',
    synonyme: ['Erythrozytenverteilungsbreite'],
    kategorie: 'Blutbild',
    einheit: '%',
    refMin: 11.5,
    refMax: 14.5,
    erklaerung:
      'Beschreibt, wie unterschiedlich groß die roten Blutkörperchen sind. Erhöhte Werte können ein früher Hinweis auf einen Nährstoffmangel sein.',
  },

  // ---------- Leber ----------
  {
    name: 'GOT (AST)',
    synonyme: ['GOT', 'AST', 'ASAT', 'Aspartat-Aminotransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 50,
    lowerIsBetter: true,
    erklaerung:
      'Ein Leberenzym, das auch in Muskeln vorkommt. Nach hartem Training kann es erhöht sein, ohne dass die Leber betroffen ist.',
  },
  {
    name: 'GPT (ALT)',
    synonyme: ['GPT', 'ALT', 'ALAT', 'Alanin-Aminotransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 50,
    lowerIsBetter: true,
    erklaerung:
      'Das leberspezifischste der Standard-Leberenzyme. Erhöhte Werte deuten auf eine Belastung oder Schädigung der Leberzellen hin.',
  },
  {
    name: 'Gamma-GT',
    synonyme: ['GGT', 'γ-GT', 'Gamma-Glutamyltransferase'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMax: 60,
    lowerIsBetter: true,
    erklaerung:
      'Ein Leberenzym, das empfindlich auf Alkohol, Medikamente und Gallenstau reagiert. Es gilt als sensibler Frühindikator für Leberbelastung.',
  },
  {
    name: 'Alkalische Phosphatase',
    synonyme: ['AP', 'ALP'],
    kategorie: 'Leber',
    einheit: 'U/L',
    refMin: 40,
    refMax: 130,
    erklaerung: 'Ein Enzym aus Leber, Gallenwegen und Knochen. Erhöhungen können aus beiden Bereichen stammen.',
  },
  {
    name: 'Bilirubin gesamt',
    synonyme: ['Bilirubin', 'Gesamtbilirubin'],
    kategorie: 'Leber',
    einheit: 'mg/dL',
    refMax: 1.2,
    lowerIsBetter: true,
    erklaerung:
      'Ein Abbauprodukt des roten Blutfarbstoffs, das die Leber ausscheidet. Stark erhöhte Werte machen sich als Gelbfärbung bemerkbar.',
  },
  {
    name: 'Albumin',
    synonyme: [],
    kategorie: 'Leber',
    einheit: 'g/dL',
    refMin: 3.5,
    refMax: 5.2,
    erklaerung:
      'Das wichtigste Transportprotein im Blut, das die Leber herstellt. Es zeigt die Syntheseleistung der Leber und den Ernährungszustand.',
  },

  // ---------- Niere ----------
  {
    name: 'Kreatinin',
    synonyme: ['Creatinin'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMin: 0.7,
    refMax: 1.3,
    erklaerung:
      'Ein Abbauprodukt aus dem Muskelstoffwechsel, das die Nieren ausscheiden. Bei viel Muskelmasse oder Kreatin-Einnahme ist der Wert auch ohne Nierenproblem erhöht.',
  },
  {
    name: 'eGFR',
    synonyme: ['GFR', 'Glomeruläre Filtrationsrate'],
    kategorie: 'Niere',
    einheit: 'mL/min',
    refMin: 90,
    erklaerung:
      'Ein aus dem Kreatinin berechneter Schätzwert für die Filterleistung der Nieren. Je höher, desto besser.',
  },
  {
    name: 'Harnstoff',
    synonyme: ['Urea', 'BUN'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMin: 17,
    refMax: 43,
    erklaerung:
      'Ein Abbauprodukt des Eiweißstoffwechsels. Der Wert steigt bei hoher Proteinzufuhr und bei nachlassender Nierenfunktion.',
  },
  {
    name: 'Harnsäure',
    synonyme: ['Urat'],
    kategorie: 'Niere',
    einheit: 'mg/dL',
    refMax: 7.0,
    lowerIsBetter: true,
    erklaerung:
      'Ein Abbauprodukt, das bei stark erhöhten Werten in Gelenken auskristallisieren und Gicht auslösen kann.',
  },
  {
    name: 'Cystatin C',
    synonyme: [],
    kategorie: 'Niere',
    einheit: 'mg/L',
    refMin: 0.5,
    refMax: 1.0,
    erklaerung:
      'Ein Nierenwert, der anders als Kreatinin nicht von der Muskelmasse abhängt — deshalb bei Sportlern aussagekräftiger.',
  },

  // ---------- Lipide ----------
  {
    name: 'Cholesterin gesamt',
    synonyme: ['Gesamtcholesterin', 'Cholesterin'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 200,
    lowerIsBetter: true,
    erklaerung:
      'Das gesamte Cholesterin im Blut. Für die Risikobeurteilung ist die Aufteilung in LDL und HDL aussagekräftiger als der Gesamtwert.',
  },
  {
    name: 'LDL-Cholesterin',
    synonyme: ['LDL', 'LDL-C'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 130,
    lowerIsBetter: true,
    erklaerung:
      'Das „schlechte" Cholesterin, das sich in Gefäßwänden ablagern kann. Ein hoher Wert gilt als Risikofaktor für Herz-Kreislauf-Erkrankungen.',
  },
  {
    name: 'HDL-Cholesterin',
    synonyme: ['HDL', 'HDL-C'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMin: 40,
    erklaerung:
      'Das „gute" Cholesterin, das überschüssiges Cholesterin zurück zur Leber transportiert. Hier sind höhere Werte günstiger.',
  },
  {
    name: 'Triglyceride',
    synonyme: ['Triglyzeride', 'TG'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 150,
    lowerIsBetter: true,
    erklaerung:
      'Blutfette, die stark auf Ernährung und Alkohol reagieren. Für eine verlässliche Messung sollte man nüchtern sein.',
  },
  {
    name: 'Lipoprotein (a)',
    synonyme: ['Lp(a)', 'Lipoprotein a'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 30,
    lowerIsBetter: true,
    erklaerung:
      'Ein weitgehend genetisch festgelegter Risikofaktor für Herz-Kreislauf-Erkrankungen. Der Wert ändert sich im Leben kaum, eine einmalige Messung genügt meist.',
  },
  {
    name: 'ApoB',
    synonyme: ['Apolipoprotein B'],
    kategorie: 'Lipide',
    einheit: 'mg/dL',
    refMax: 100,
    lowerIsBetter: true,
    erklaerung:
      'Zählt die Anzahl potenziell gefäßschädigender Partikel und gilt vielen als präziserer Risikomarker als LDL allein.',
  },

  // ---------- Entzündung ----------
  {
    name: 'CRP',
    synonyme: ['C-reaktives Protein', 'hs-CRP', 'CRP hochsensitiv'],
    kategorie: 'Entzündung',
    einheit: 'mg/L',
    refMax: 1.0,
    lowerIsBetter: true,
    erklaerung:
      'Der wichtigste Entzündungsmarker. Er steigt bei akuten Infekten stark an; leicht erhöhte Dauerwerte deuten auf stille Entzündungsprozesse hin.',
  },
  {
    name: 'BSG',
    synonyme: ['Blutsenkung', 'Blutsenkungsgeschwindigkeit', 'ESR'],
    kategorie: 'Entzündung',
    einheit: 'mm/h',
    refMax: 15,
    lowerIsBetter: true,
    erklaerung:
      'Ein älterer, unspezifischer Entzündungsmarker. Er reagiert träger als CRP und wird meist ergänzend betrachtet.',
  },
  {
    name: 'Homocystein',
    synonyme: [],
    kategorie: 'Entzündung',
    einheit: 'µmol/L',
    refMax: 12,
    lowerIsBetter: true,
    erklaerung:
      'Eine Aminosäure, die bei Mangel an B-Vitaminen ansteigt. Erhöhte Werte gelten als Risikofaktor für Gefäßerkrankungen.',
  },

  // ---------- Vitamine & Mineralstoffe ----------
  {
    name: 'Vitamin D',
    synonyme: ['25-OH-Vitamin D', 'Vitamin D3', '25-OH-D', 'Calcidiol'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 40,
    refMax: 80,
    erklaerung:
      'Wichtig für Knochen, Immunsystem und Hormonhaushalt. In unseren Breiten ist der Wert im Winter häufig zu niedrig, da die Bildung Sonnenlicht braucht.',
  },
  {
    name: 'Vitamin B12',
    synonyme: ['B12', 'Cobalamin'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'pg/mL',
    refMin: 300,
    refMax: 900,
    erklaerung:
      'Notwendig für Blutbildung und Nervensystem. Ein Mangel entwickelt sich schleichend und betrifft besonders Menschen mit rein pflanzlicher Ernährung.',
  },
  {
    name: 'Holo-Transcobalamin',
    synonyme: ['Holo-TC', 'Aktives B12'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'pmol/L',
    refMin: 50,
    erklaerung:
      'Der tatsächlich verwertbare Anteil von Vitamin B12. Er zeigt einen Mangel früher an als der Gesamt-B12-Wert.',
  },
  {
    name: 'Folsäure',
    synonyme: ['Folat', 'Vitamin B9'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 4.6,
    refMax: 18.7,
    erklaerung: 'Wichtig für Zellteilung und Blutbildung und eng mit dem Vitamin-B12-Stoffwechsel verknüpft.',
  },
  {
    name: 'Ferritin',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'ng/mL',
    refMin: 30,
    refMax: 300,
    erklaerung:
      'Der Eisenspeicher des Körpers und der beste Einzelwert für den Eisenstatus. Achtung: Bei Entzündungen steigt Ferritin an und kann einen Mangel verschleiern.',
  },
  {
    name: 'Eisen',
    synonyme: ['Serumeisen'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'µg/dL',
    refMin: 60,
    refMax: 170,
    erklaerung:
      'Das aktuell im Blut zirkulierende Eisen. Der Wert schwankt im Tagesverlauf stark — Ferritin ist aussagekräftiger.',
  },
  {
    name: 'Transferrinsättigung',
    synonyme: ['TSAT', 'Transferrin-Sättigung'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: '%',
    refMin: 20,
    refMax: 45,
    erklaerung: 'Zeigt, wie gut das Eisentransportprotein beladen ist, und ergänzt die Beurteilung des Eisenstatus.',
  },
  {
    name: 'Magnesium',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mg/dL',
    refMin: 1.7,
    refMax: 2.4,
    erklaerung:
      'Beteiligt an Muskel- und Nervenfunktion. Da der Großteil in den Zellen sitzt, kann der Blutwert trotz Mangel normal aussehen.',
  },
  {
    name: 'Kalium',
    synonyme: ['K'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 3.5,
    refMax: 5.1,
    erklaerung:
      'Ein Elektrolyt, das für Herzrhythmus und Muskelarbeit entscheidend ist. Sowohl zu hohe als auch zu niedrige Werte sind relevant.',
  },
  {
    name: 'Natrium',
    synonyme: ['Na'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mmol/L',
    refMin: 135,
    refMax: 145,
    erklaerung: 'Ein Elektrolyt, das den Wasserhaushalt des Körpers steuert.',
  },
  {
    name: 'Kalzium',
    synonyme: ['Calcium', 'Ca'],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'mg/dL',
    refMin: 8.6,
    refMax: 10.3,
    erklaerung: 'Wichtig für Knochen, Muskelkontraktion und Blutgerinnung.',
  },
  {
    name: 'Zink',
    synonyme: [],
    kategorie: 'Vitamine & Mineralstoffe',
    einheit: 'µg/dL',
    refMin: 70,
    refMax: 120,
    erklaerung: 'Ein Spurenelement für Immunsystem, Wundheilung und Hormonhaushalt.',
  },

  // ---------- Stoffwechsel ----------
  {
    name: 'Glukose',
    synonyme: ['Blutzucker', 'Glucose', 'Nüchternglukose'],
    kategorie: 'Stoffwechsel',
    einheit: 'mg/dL',
    refMin: 70,
    refMax: 99,
    erklaerung:
      'Der Blutzuckerwert, üblicherweise nüchtern gemessen. Dauerhaft erhöhte Werte sind ein Hinweis auf eine gestörte Zuckerverwertung.',
  },
  {
    name: 'HbA1c',
    synonyme: ['Langzeitzucker', 'Hämoglobin A1c'],
    kategorie: 'Stoffwechsel',
    einheit: '%',
    refMax: 5.7,
    lowerIsBetter: true,
    erklaerung:
      'Der „Langzeitzucker": Er bildet den durchschnittlichen Blutzucker der letzten zwei bis drei Monate ab und ist deshalb unabhängig von der letzten Mahlzeit.',
  },
  {
    name: 'Insulin',
    synonyme: ['Nüchterninsulin'],
    kategorie: 'Stoffwechsel',
    einheit: 'µIU/mL',
    refMin: 2,
    refMax: 10,
    erklaerung:
      'Das Hormon, das Zucker in die Zellen schleust. Ein hoher Nüchternwert bei normalem Blutzucker kann ein früher Hinweis auf Insulinresistenz sein.',
  },
  {
    name: 'HOMA-Index',
    synonyme: ['HOMA-IR', 'HOMA'],
    kategorie: 'Stoffwechsel',
    einheit: '',
    refMax: 2.0,
    lowerIsBetter: true,
    erklaerung:
      'Ein aus Nüchternzucker und Insulin berechneter Wert für die Insulinempfindlichkeit. Niedriger ist besser.',
  },
]

const LOOKUP: Map<string, MarkerDef> = new Map()
MARKER_CATALOG.forEach(def => {
  LOOKUP.set(def.name.toLowerCase(), def)
  def.synonyme.forEach(syn => LOOKUP.set(syn.toLowerCase(), def))
})

/** Kanonische Markernamen — u.a. für den Extraktions-Prompt. */
export const CATALOG_MARKER_NAMES: string[] = MARKER_CATALOG.map(def => def.name)

/**
 * Ordnet einen Rohnamen (z.B. von einem Laborbefund) einem Katalog-Marker zu.
 * Gibt null zurück, wenn der Marker nicht im Katalog steht (Custom-Marker).
 */
export function normalizeMarker(raw: string): MarkerDef | null {
  const key = raw.trim().toLowerCase()
  if (!key) return null
  return LOOKUP.get(key) ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/blutwerte/lib/markerCatalog.test.ts`
Expected: PASS (10 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte/lib/markerCatalog.ts src/features/blutwerte/lib/markerCatalog.test.ts
git commit -m "feat(blutwerte): add marker catalog with categories and explanations"
```

---

### Task 2: Typen

**Files:**
- Create: `src/features/blutwerte/types.ts`

Reine Typdatei ohne Laufzeitverhalten — kein eigener Test, wird durch Task 3 mitgeprüft.

- [ ] **Step 1: Create the types file**

Create `src/features/blutwerte/types.ts`:

```ts
export interface BloodworkEntry {
  id: string
  user_id: string
  tested_at: string
  marker: string
  value: number | string
  unit: string
  notes: string | null
  created_at: string | null
  /** Verweist auf den Befund, aus dem der Wert stammt. Null bei Einzelwerten. */
  report_id: string | null
  /** Referenz-Untergrenze des Labors, falls im Befund angegeben. */
  ref_min: number | null
  /** Referenz-Obergrenze des Labors, falls im Befund angegeben. */
  ref_max: number | null
}

export interface BloodworkReport {
  id: string
  user_id: string
  tested_at: string
  lab_name: string | null
  source: 'manual' | 'import'
  created_at: string | null
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: Kein Fehler in `src/features/blutwerte/types.ts`. (Falls `tsconfig.app.json` nicht existiert: `npx tsc -b`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/blutwerte/types.ts
git commit -m "feat(blutwerte): add bloodwork entry and report types"
```

---

### Task 3: Berechnungs-Bibliothek

**Files:**
- Create: `src/features/blutwerte/lib/bloodwork.ts`
- Test: `src/features/blutwerte/lib/bloodwork.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/blutwerte/lib/bloodwork.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { BloodworkEntry } from '../types'
import { normalizeMarker } from './markerCatalog'
import {
  auffaelligeWerte,
  buildMarkerSummaries,
  computeTrend,
  effectiveRange,
  filterByKategorie,
  isInRange,
  sortSummaries,
  toNumber,
} from './bloodwork'

const entry = (over: Partial<BloodworkEntry> = {}): BloodworkEntry => ({
  id: 'e1',
  user_id: 'u1',
  tested_at: '2026-07-01',
  marker: 'Testosteron',
  value: 600,
  unit: 'ng/dL',
  notes: null,
  created_at: null,
  report_id: null,
  ref_min: null,
  ref_max: null,
  ...over,
})

describe('toNumber', () => {
  it('wandelt Strings in Zahlen um', () => {
    expect(toNumber('12.5')).toBe(12.5)
  })

  it('gibt Zahlen unverändert zurück', () => {
    expect(toNumber(7)).toBe(7)
  })
})

describe('effectiveRange', () => {
  it('bevorzugt die Labor-Referenz am Eintrag', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry({ ref_min: 300, ref_max: 1000 }), def)
    expect(range).toEqual({ min: 300, max: 1000, source: 'lab' })
  })

  it('nutzt den Katalog, wenn keine Labor-Referenz vorliegt', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry(), def)
    expect(range).toEqual({ min: 400, max: 900, source: 'catalog' })
  })

  it('akzeptiert eine einseitige Labor-Referenz', () => {
    const def = normalizeMarker('Testosteron')
    const range = effectiveRange(entry({ ref_max: 1000 }), def)
    expect(range).toEqual({ min: null, max: 1000, source: 'lab' })
  })

  it('meldet "none" für Custom-Marker ohne Labor-Referenz', () => {
    const range = effectiveRange(entry({ marker: 'Phantasiewert' }), null)
    expect(range).toEqual({ min: null, max: null, source: 'none' })
  })

  it('nutzt die Labor-Referenz auch für Custom-Marker', () => {
    const range = effectiveRange(entry({ marker: 'Phantasiewert', ref_min: 1, ref_max: 9 }), null)
    expect(range).toEqual({ min: 1, max: 9, source: 'lab' })
  })

  it('übernimmt einen einseitigen Katalog-Bereich', () => {
    const range = effectiveRange(entry({ marker: 'CRP' }), normalizeMarker('CRP'))
    expect(range).toEqual({ min: null, max: 1.0, source: 'catalog' })
  })

  it('meldet "none" ohne Eintrag und ohne Katalog-Definition', () => {
    expect(effectiveRange(null, null)).toEqual({ min: null, max: null, source: 'none' })
  })
})

describe('isInRange', () => {
  it('erkennt einen Wert im Bereich', () => {
    expect(isInRange(500, { min: 400, max: 900, source: 'catalog' })).toBe(true)
  })

  it('erkennt einen zu niedrigen Wert', () => {
    expect(isInRange(300, { min: 400, max: 900, source: 'catalog' })).toBe(false)
  })

  it('erkennt einen zu hohen Wert', () => {
    expect(isInRange(1000, { min: 400, max: 900, source: 'catalog' })).toBe(false)
  })

  it('prüft nur die Obergrenze, wenn keine Untergrenze existiert', () => {
    expect(isInRange(0.5, { min: null, max: 1, source: 'catalog' })).toBe(true)
    expect(isInRange(2, { min: null, max: 1, source: 'catalog' })).toBe(false)
  })

  it('gibt null zurück, wenn kein Referenzbereich existiert', () => {
    expect(isInRange(500, { min: null, max: null, source: 'none' })).toBeNull()
  })
})

describe('computeTrend', () => {
  it('gibt null bei weniger als zwei Werten zurück', () => {
    expect(computeTrend([entry()])).toEqual({ trend: null, diff: 0 })
  })

  it('erkennt einen steigenden Trend (neuester Eintrag zuerst)', () => {
    const result = computeTrend([
      entry({ id: 'neu', tested_at: '2026-07-01', value: 700 }),
      entry({ id: 'alt', tested_at: '2026-01-01', value: 500 }),
    ])
    expect(result).toEqual({ trend: 'up', diff: 200 })
  })

  it('erkennt einen fallenden Trend', () => {
    const result = computeTrend([
      entry({ id: 'neu', value: 400 }),
      entry({ id: 'alt', value: 600 }),
    ])
    expect(result).toEqual({ trend: 'down', diff: -200 })
  })

  it('erkennt einen gleichbleibenden Wert', () => {
    expect(computeTrend([entry({ value: 500 }), entry({ id: 'alt', value: 500 })]).trend).toBe('same')
  })
})

describe('buildMarkerSummaries', () => {
  it('legt für jeden Katalog-Marker eine Zusammenfassung an', () => {
    const summaries = buildMarkerSummaries([])
    expect(summaries.length).toBeGreaterThan(50)
    expect(summaries.every(s => s.latest === null)).toBe(true)
  })

  it('sortiert die Einträge eines Markers absteigend nach Datum', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'alt', tested_at: '2026-01-01', value: 500 }),
      entry({ id: 'neu', tested_at: '2026-07-01', value: 700 }),
    ])
    const testo = summaries.find(s => s.name === 'Testosteron')!
    expect(testo.latest?.id).toBe('neu')
    expect(testo.entries.map(e => e.id)).toEqual(['neu', 'alt'])
  })

  it('führt unbekannte Marker als Custom-Marker unter "Sonstige"', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert', ref_max: 10 })])
    const custom = summaries.find(s => s.name === 'Phantasiewert')!
    expect(custom.def).toBeNull()
    expect(custom.kategorie).toBe('Sonstige')
    expect(custom.range).toEqual({ min: null, max: 10, source: 'lab' })
  })

  it('bewertet den letzten Wert gegen die effektive Referenz', () => {
    const summaries = buildMarkerSummaries([entry({ value: 1200 })])
    const testo = summaries.find(s => s.name === 'Testosteron')!
    expect(testo.inRange).toBe(false)
  })
})

describe('filterByKategorie', () => {
  it('gibt bei null alle Marker zurück', () => {
    const summaries = buildMarkerSummaries([])
    expect(filterByKategorie(summaries, null)).toHaveLength(summaries.length)
  })

  it('filtert auf eine Kategorie', () => {
    const summaries = filterByKategorie(buildMarkerSummaries([]), 'Schilddrüse')
    expect(summaries.map(s => s.name).sort()).toEqual(['TSH', 'fT3', 'fT4'].sort())
  })

  it('filtert Custom-Marker unter "Sonstige"', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert' })])
    expect(filterByKategorie(summaries, 'Sonstige').map(s => s.name)).toEqual(['Phantasiewert'])
  })
})

describe('sortSummaries', () => {
  const summaries = buildMarkerSummaries([
    entry({ id: 'a', marker: 'Testosteron', tested_at: '2026-01-01', value: 1200 }),
    entry({ id: 'b', marker: 'Ferritin', tested_at: '2026-07-01', value: 100 }),
  ])

  it('sortiert nach Name', () => {
    const names = sortSummaries(summaries, 'name').map(s => s.name)
    expect(names.indexOf('Albumin')).toBeLessThan(names.indexOf('Zink'))
  })

  it('sortiert nach zuletzt getestet, ungetestete zuletzt', () => {
    const sorted = sortSummaries(summaries, 'zuletzt')
    expect(sorted[0].name).toBe('Ferritin')
    expect(sorted[1].name).toBe('Testosteron')
    expect(sorted[2].latest).toBeNull()
  })

  it('sortiert auffällige Werte nach vorn', () => {
    const sorted = sortSummaries(summaries, 'status')
    expect(sorted[0].name).toBe('Testosteron')
  })

  it('sortiert nach Kategorie in Katalog-Reihenfolge, Sonstige zuletzt', () => {
    const withCustom = buildMarkerSummaries([entry({ marker: 'Phantasiewert' })])
    const sorted = sortSummaries(withCustom, 'kategorie')
    expect(sorted[0].kategorie).toBe('Hormone')
    expect(sorted[sorted.length - 1].kategorie).toBe('Sonstige')
  })
})

describe('auffaelligeWerte', () => {
  it('liefert nur Marker, deren letzter Wert außerhalb der Referenz liegt', () => {
    const summaries = buildMarkerSummaries([
      entry({ id: 'hoch', marker: 'Testosteron', value: 1200 }),
      entry({ id: 'ok', marker: 'Ferritin', value: 100 }),
    ])
    expect(auffaelligeWerte(summaries).map(s => s.name)).toEqual(['Testosteron'])
  })

  it('ignoriert Marker ohne Referenzbereich', () => {
    const summaries = buildMarkerSummaries([entry({ marker: 'Phantasiewert', value: 999 })])
    expect(auffaelligeWerte(summaries)).toEqual([])
  })

  it('ignoriert ungetestete Marker', () => {
    expect(auffaelligeWerte(buildMarkerSummaries([]))).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/blutwerte/lib/bloodwork.test.ts`
Expected: FAIL — „Failed to resolve import ./bloodwork"

- [ ] **Step 3: Write the implementation**

Create `src/features/blutwerte/lib/bloodwork.ts`:

```ts
import type { BloodworkEntry } from '../types'
import type { Kategorie, KategorieFilter, MarkerDef } from './markerCatalog'
import { KATEGORIEN, MARKER_CATALOG, SONSTIGE, normalizeMarker } from './markerCatalog'

export interface EffectiveRange {
  min: number | null
  max: number | null
  /** Woher der Bereich stammt: Labor-Referenz, Katalog oder gar nicht vorhanden. */
  source: 'lab' | 'catalog' | 'none'
}

export type Trend = 'up' | 'down' | 'same' | null

export type SortMode = 'kategorie' | 'name' | 'zuletzt' | 'status'

export interface MarkerSummary {
  /** Kanonischer Name (Katalog) oder Rohname (Custom-Marker). */
  name: string
  def: MarkerDef | null
  kategorie: KategorieFilter
  /** Alle Einträge, absteigend nach Datum. */
  entries: BloodworkEntry[]
  latest: BloodworkEntry | null
  range: EffectiveRange
  inRange: boolean | null
  trend: Trend
  diff: number
}

export function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
}

/** Labor-Referenz am Eintrag schlägt Katalog-Standard; sonst kein Bereich. */
export function effectiveRange(entry: BloodworkEntry | null, def: MarkerDef | null): EffectiveRange {
  if (entry && (entry.ref_min != null || entry.ref_max != null)) {
    return { min: entry.ref_min ?? null, max: entry.ref_max ?? null, source: 'lab' }
  }
  if (def && (def.refMin != null || def.refMax != null)) {
    return { min: def.refMin ?? null, max: def.refMax ?? null, source: 'catalog' }
  }
  return { min: null, max: null, source: 'none' }
}

export function isInRange(value: number, range: EffectiveRange): boolean | null {
  if (range.min == null && range.max == null) return null
  if (!Number.isFinite(value)) return null
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

/** Erwartet Einträge absteigend nach Datum (neuester zuerst). */
export function computeTrend(entries: BloodworkEntry[]): { trend: Trend; diff: number } {
  if (entries.length < 2) return { trend: null, diff: 0 }
  const last = toNumber(entries[0].value)
  const prev = toNumber(entries[1].value)
  if (!Number.isFinite(last) || !Number.isFinite(prev)) return { trend: null, diff: 0 }
  const diff = last - prev
  if (diff > 0) return { trend: 'up', diff }
  if (diff < 0) return { trend: 'down', diff }
  return { trend: 'same', diff: 0 }
}

/**
 * Baut je eine Zusammenfassung pro Katalog-Marker plus je eine pro Custom-Marker,
 * für den Einträge existieren.
 */
export function buildMarkerSummaries(entries: BloodworkEntry[]): MarkerSummary[] {
  const byName = new Map<string, { def: MarkerDef | null; entries: BloodworkEntry[] }>()

  MARKER_CATALOG.forEach(def => byName.set(def.name, { def, entries: [] }))

  entries.forEach(entry => {
    const def = normalizeMarker(entry.marker)
    const key = def ? def.name : entry.marker.trim()
    if (!key) return
    const bucket = byName.get(key) ?? { def, entries: [] }
    bucket.entries.push(entry)
    byName.set(key, bucket)
  })

  return Array.from(byName.entries()).map(([name, bucket]) => {
    const sorted = bucket.entries.slice().sort((a, b) => b.tested_at.localeCompare(a.tested_at))
    const latest = sorted[0] ?? null
    const range = effectiveRange(latest, bucket.def)
    const { trend, diff } = computeTrend(sorted)
    return {
      name,
      def: bucket.def,
      kategorie: bucket.def ? bucket.def.kategorie : SONSTIGE,
      entries: sorted,
      latest,
      range,
      inRange: latest ? isInRange(toNumber(latest.value), range) : null,
      trend,
      diff,
    }
  })
}

export function filterByKategorie(
  summaries: MarkerSummary[],
  kategorie: KategorieFilter | null,
): MarkerSummary[] {
  if (!kategorie) return summaries
  return summaries.filter(s => s.kategorie === kategorie)
}

/** Sonstige landet ans Ende, Katalog-Kategorien in Katalog-Reihenfolge. */
const kategorieRang = (kategorie: KategorieFilter): number => {
  const index = KATEGORIEN.indexOf(kategorie as Kategorie)
  return index === -1 ? KATEGORIEN.length : index
}

export function sortSummaries(summaries: MarkerSummary[], mode: SortMode): MarkerSummary[] {
  const sorted = summaries.slice()
  switch (mode) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    case 'zuletzt':
      return sorted.sort((a, b) => {
        if (!a.latest && !b.latest) return a.name.localeCompare(b.name, 'de')
        if (!a.latest) return 1
        if (!b.latest) return -1
        return b.latest.tested_at.localeCompare(a.latest.tested_at)
      })
    case 'status':
      return sorted.sort((a, b) => {
        const rang = (s: MarkerSummary) => (s.inRange === false ? 0 : s.latest ? 1 : 2)
        const diff = rang(a) - rang(b)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'de')
      })
    case 'kategorie':
    default:
      return sorted.sort((a, b) => {
        const diff = kategorieRang(a.kategorie) - kategorieRang(b.kategorie)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'de')
      })
  }
}

/** Marker, deren letzter Wert außerhalb der effektiven Referenz liegt. */
export function auffaelligeWerte(summaries: MarkerSummary[]): MarkerSummary[] {
  return summaries.filter(s => s.inRange === false)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/blutwerte/lib/bloodwork.test.ts`
Expected: PASS (alle Tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte/lib/bloodwork.ts src/features/blutwerte/lib/bloodwork.test.ts
git commit -m "feat(blutwerte): add bloodwork calculation library"
```

---

### Task 4: Datenbank-Migration

**Files:**
- Create: `supabase-bloodwork-import.sql`

Diese Migration führt der Nutzer manuell im Supabase SQL Editor aus (Muster der bestehenden `supabase-*.sql`-Dateien im Repo-Root).

- [ ] **Step 1: Create the migration file**

Create `supabase-bloodwork-import.sql`:

```sql
-- Blutwerte-Feinschliff: Befund-Gruppierung + Labor-Referenzbereiche
-- Im Supabase SQL Editor ausführen
--
-- Hinweis: Die Tabellen blood_tests/blood_values aus supabase-health.sql sind
-- Altlasten und werden vom Code nicht verwendet. Die App arbeitet ausschließlich
-- mit der Tabelle bloodwork, die hier erweitert wird.

create table if not exists bloodwork_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tested_at date not null,
  lab_name text,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_at timestamptz default now()
);

alter table bloodwork add column if not exists report_id uuid references bloodwork_reports on delete set null;
alter table bloodwork add column if not exists ref_min numeric(10,3);
alter table bloodwork add column if not exists ref_max numeric(10,3);

alter table bloodwork_reports enable row level security;

drop policy if exists "Own bloodwork reports" on bloodwork_reports;
create policy "Own bloodwork reports" on bloodwork_reports for all using (auth.uid() = user_id);

-- Zählt Importe pro Monat (Rate-Limit) und lädt Befunde eines Nutzers.
create index if not exists bloodwork_reports_user_created_idx
  on bloodwork_reports (user_id, source, created_at desc);

-- Lädt alle Werte eines Befunds.
create index if not exists bloodwork_report_idx on bloodwork (report_id);
```

- [ ] **Step 2: Ask the user to run the migration**

Sag dem Nutzer wörtlich:

> Bitte führe `supabase-bloodwork-import.sql` im Supabase SQL Editor aus (Dashboard → SQL Editor → Inhalt einfügen → Run). Sag mir Bescheid, wenn es durchgelaufen ist.

Warte auf die Bestätigung. Ohne die Migration schlagen alle folgenden Tasks zur Laufzeit fehl.

- [ ] **Step 3: Verify the schema**

Sobald der Nutzer bestätigt hat, prüfe im Dashboard (Table Editor) oder lass den Nutzer prüfen:
- Tabelle `bloodwork_reports` existiert mit RLS.
- `bloodwork` hat die Spalten `report_id`, `ref_min`, `ref_max`.

- [ ] **Step 4: Commit**

```bash
git add supabase-bloodwork-import.sql
git commit -m "feat(blutwerte): add migration for reports and lab reference ranges"
```

---

### Task 5: Feature-Struktur (behavior-preserving Refactor)

Die bestehende Seite zieht 1:1 nach `src/features/blutwerte/` um und nutzt ab jetzt Katalog + `bloodwork.ts` statt `ALL_MARKERS`/`REFERENCE_RANGES`. **Keine neuen Features in diesem Task** — das Verhalten bleibt identisch.

**Files:**
- Create: `src/features/blutwerte/BlutwertePage.tsx`
- Create: `src/features/blutwerte/components/EntryModal.tsx`
- Create: `src/features/blutwerte/components/MarkerGrid.tsx`
- Create: `src/features/blutwerte/components/MarkerDetail.tsx`
- Create: `src/features/blutwerte/styles.ts`
- Modify: `src/pages/Blutwerte.tsx` (wird zum Re-Export)

- [ ] **Step 1: Create shared styles**

Create `src/features/blutwerte/styles.ts`:

```ts
import type { CSSProperties } from 'react'

export const PANEL_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
}

export const CYAN = 'var(--accent)'
export const TEXT = 'var(--text)'
export const MUTED = 'var(--text-muted)'
export const GREEN = '#10b981'
export const RED = '#ef4444'

export const DISCLAIMER =
  'Diese Angaben dienen der Orientierung und ersetzen keine ärztliche Beratung.'
```

- [ ] **Step 2: Create the entry modal**

Create `src/features/blutwerte/components/EntryModal.tsx`:

```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { CYAN, TEXT } from '../styles'

export interface EntryDraft {
  tested_at: string
  marker: string
  value: string
  unit: string
}

const today = () => format(new Date(), 'yyyy-MM-dd')

export const emptyDraft = (marker = ''): EntryDraft => ({
  tested_at: today(),
  marker,
  value: '',
  unit: marker ? (normalizeMarker(marker)?.einheit ?? '') : '',
})

interface Props {
  draft: EntryDraft
  /** Marker ist fixiert, wenn das Modal aus der Detailansicht geöffnet wurde. */
  markerLocked: boolean
  saving: boolean
  onChange: (draft: EntryDraft) => void
  onCancel: () => void
  onSave: (parsed: { tested_at: string; marker: string; value: number; unit: string }) => void
}

export function EntryModal({ draft, markerLocked, saving, onChange, onCancel, onSave }: Props) {
  const submit = () => {
    const marker = draft.marker.trim()
    const unit = draft.unit.trim()
    const value = Number(draft.value.replace(',', '.'))

    if (!draft.tested_at) return toast.error('Bitte ein Testdatum eintragen')
    if (!marker) return toast.error('Bitte einen Marker auswählen')
    if (!Number.isFinite(value) || draft.value.trim() === '') {
      return toast.error('Bitte einen gültigen Wert eintragen')
    }
    if (!unit) return toast.error('Bitte eine Einheit eintragen')

    onSave({ tested_at: draft.tested_at, marker, value, unit })
  }

  const setMarker = (marker: string) =>
    onChange({ ...draft, marker, unit: normalizeMarker(marker)?.einheit ?? '' })

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onCancel}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>Neuer Eintrag</h2>

        <div>
          <label className="label">Marker</label>
          {markerLocked ? (
            <div
              className="rounded-2xl px-4 py-3 font-semibold"
              style={{ border: '1px solid var(--accent-border)', color: CYAN }}
            >
              {draft.marker}
            </div>
          ) : (
            <select className="select" value={draft.marker} onChange={e => setMarker(e.target.value)}>
              <option value="">Marker auswählen</option>
              {CATALOG_MARKER_NAMES.map(marker => (
                <option key={marker} value={marker}>{marker}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">Datum</label>
          <input
            className="input"
            type="date"
            value={draft.tested_at}
            onChange={e => onChange({ ...draft, tested_at: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Wert</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="42.5"
              value={draft.value}
              onChange={e => onChange({ ...draft, value: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Einheit</label>
            <input
              className="input"
              placeholder="ng/mL"
              value={draft.unit}
              onChange={e => onChange({ ...draft, unit: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>Abbrechen</button>
          <button className="btn-primary flex-1" onClick={submit} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Nur für Tests/Storybook nützlich. */
export { today as heute }
```

- [ ] **Step 3: Create shared formatting helpers**

Create `src/features/blutwerte/lib/format.ts`:

```ts
import { format } from 'date-fns'
import { toNumber } from './bloodwork'

export const formatDisplayDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yyyy')

export const formatChartDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yy')

export const formatNumber = (value: number | string) => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(numeric)
}

/** Menschlich lesbarer Referenztext, z.B. "400–900 ng/dL" oder "bis 1 mg/L". */
export const formatRange = (min: number | null, max: number | null, unit: string): string | null => {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${formatNumber(min)}–${formatNumber(max)} ${unit}`.trim()
  if (max != null) return `bis ${formatNumber(max)} ${unit}`.trim()
  return `ab ${formatNumber(min as number)} ${unit}`.trim()
}
```

- [ ] **Step 4: Create the marker grid (behavior-preserving)**

Create `src/features/blutwerte/components/MarkerGrid.tsx`:

```tsx
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { MarkerSummary, Trend } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber } from '../lib/format'
import { CYAN, MUTED, RED, TEXT } from '../styles'

export const TrendIcon = ({ trend, size = 16 }: { trend: Trend; size?: number }) => {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  if (trend === 'same') return <Minus size={size} />
  return null
}

/** Grün, wenn sich der Wert in die gewünschte Richtung bewegt. */
export const trendColor = (summary: MarkerSummary): string => {
  if (summary.trend === 'same' || summary.trend === null) return MUTED
  const lowerIsBetter = summary.def?.lowerIsBetter
  const good = lowerIsBetter ? summary.trend === 'down' : summary.trend === 'up'
  return good ? '#10b981' : RED
}

interface Props {
  summaries: MarkerSummary[]
  onSelect: (name: string) => void
}

export function MarkerGrid({ summaries, onSelect }: Props) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {summaries.map(summary => {
        const { latest, inRange } = summary
        const hasData = !!latest
        return (
          <button
            key={summary.name}
            onClick={() => onSelect(summary.name)}
            className="text-left"
            style={{
              padding: 14,
              borderRadius: 16,
              background: 'var(--surface)',
              border: hasData ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              cursor: 'pointer',
              opacity: hasData ? 1 : 0.55,
            }}
          >
            <p className="font-bold text-sm" style={{ color: TEXT }}>{summary.name}</p>
            {latest ? (
              <>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-base font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                    {formatNumber(latest.value)}{' '}
                    <span className="text-xs font-semibold" style={{ color: MUTED }}>{latest.unit}</span>
                  </span>
                  <span style={{ color: trendColor(summary) }}>
                    <TrendIcon trend={summary.trend} size={15} />
                  </span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: MUTED }}>{formatDisplayDate(latest.tested_at)}</p>
              </>
            ) : (
              <p className="text-xs mt-3" style={{ color: MUTED }}>– Noch kein Test</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Create the marker detail (behavior-preserving)**

Create `src/features/blutwerte/components/MarkerDetail.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BloodworkEntry } from '../types'
import type { MarkerSummary } from '../lib/bloodwork'
import { toNumber } from '../lib/bloodwork'
import { formatChartDate, formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { CYAN, MUTED, PANEL_STYLE, RED, TEXT } from '../styles'
import { TrendIcon, trendColor } from './MarkerGrid'

export type RangeFilter = '3M' | '6M' | '1J' | 'ALL'

const cutoffFor = (filter: RangeFilter): string | null => {
  const d = new Date()
  if (filter === '3M') d.setMonth(d.getMonth() - 3)
  else if (filter === '6M') d.setMonth(d.getMonth() - 6)
  else if (filter === '1J') d.setFullYear(d.getFullYear() - 1)
  else return null
  return format(d, 'yyyy-MM-dd')
}

interface Props {
  summary: MarkerSummary
  onBack: () => void
  onAdd: () => void
  onDelete: (entry: BloodworkEntry) => void
}

export function MarkerDetail({ summary, onBack, onAdd, onDelete }: Props) {
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('1J')
  const { latest, range, inRange, trend, diff } = summary

  const chartData = useMemo(() => {
    const cutoff = cutoffFor(rangeFilter)
    return summary.entries
      .filter(e => (cutoff ? e.tested_at >= cutoff : true))
      .slice()
      .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
      .map(e => ({ date_label: formatChartDate(e.tested_at), value: toNumber(e.value) }))
  }, [summary.entries, rangeFilter])

  const referenzText = latest ? formatRange(range.min, range.max, latest.unit) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="p-2 -ml-2 transition-colors" style={{ color: MUTED }} onClick={onBack} aria-label="Zurück">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: TEXT }}>{summary.name}</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={onAdd}>
          <Plus size={15} /> Eintrag
        </button>
      </div>

      <div className="p-5 mb-4" style={PANEL_STYLE}>
        {latest ? (
          <>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                {formatNumber(latest.value)}
                <span className="text-base font-semibold ml-1.5" style={{ color: MUTED }}>{latest.unit}</span>
              </p>
              {trend && (
                <div
                  className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: trendColor(summary) }}
                >
                  <TrendIcon trend={trend} />
                  {trend === 'same' ? 'gleich' : formatNumber(Math.abs(diff))}
                </div>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: MUTED }}>
              {referenzText ? `Referenz: ${referenzText}` : 'Kein Referenzbereich'}
            </p>
            <div className="mt-3">
              {inRange === true && (
                <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                  Im Normalbereich
                </span>
              )}
              {inRange === false && (
                <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: RED }}>Außerhalb</span>
              )}
              {inRange === null && (
                <span className="badge" style={{ background: 'var(--border)', color: MUTED }}>
                  Kein Referenzbereich
                </span>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: MUTED }}>Noch kein Test für {summary.name}.</p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {([['3M', '3M'], ['6M', '6M'], ['1J', '1J'], ['ALL', 'Alles']] as [RangeFilter, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setRangeFilter(key)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={
                rangeFilter === key
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {label}
            </button>
          ),
        )}
      </div>

      {chartData.length > 0 ? (
        <div className="p-4 mb-4" style={PANEL_STYLE}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date_label" tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 12,
                  color: 'var(--text)',
                }}
              />
              {range.min != null && range.max != null && (
                <ReferenceArea
                  y1={range.min}
                  y2={range.max}
                  fill="rgba(16,185,129,0.08)"
                  stroke="rgba(16,185,129,0.2)"
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#00ccf5"
                strokeWidth={2}
                dot={{ fill: '#00ccf5', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="p-6 mb-4 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
          Keine Werte im gewählten Zeitraum.
        </div>
      )}

      <div style={PANEL_STYLE}>
        {summary.entries.length === 0 && (
          <p className="p-5 text-sm text-center" style={{ color: MUTED }}>Noch keine Einträge.</p>
        )}
        {summary.entries.map((entry, i) => (
          <div
            key={entry.id}
            className="flex items-center justify-between px-5 py-3.5"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <span className="text-sm" style={{ color: MUTED }}>{formatDisplayDate(entry.tested_at)}</span>
            <span className="text-sm font-semibold flex-1 text-right mr-3" style={{ color: TEXT }}>
              {formatNumber(entry.value)} {entry.unit}
            </span>
            <button
              className="p-1.5 transition-colors hover:text-red-400"
              style={{ color: MUTED }}
              onClick={() => onDelete(entry)}
              aria-label="Löschen"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create the page orchestrator**

Create `src/features/blutwerte/BlutwertePage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { BloodworkEntry } from './types'
import { buildMarkerSummaries } from './lib/bloodwork'
import { formatDisplayDate } from './lib/format'
import { EntryModal, emptyDraft, type EntryDraft } from './components/EntryModal'
import { MarkerGrid } from './components/MarkerGrid'
import { MarkerDetail } from './components/MarkerDetail'
import { MUTED, PANEL_STYLE, TEXT } from './styles'

export function BlutwertePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('tested_at', { ascending: false })
      .order('marker', { ascending: true })

    if (error) toast.error('Blutwerte konnten nicht geladen werden')
    else setEntries((data ?? []) as BloodworkEntry[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void load()
    })
    return () => { cancelled = true }
  }, [load])

  const summaries = useMemo(() => buildMarkerSummaries(entries), [entries])

  const markersTested = useMemo(
    () => summaries.filter(s => s.latest !== null).length,
    [summaries],
  )

  const latestDate = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((max, e) => (e.tested_at > max ? e.tested_at : max), entries[0].tested_at)
  }, [entries])

  const openNew = (marker?: string) => {
    setDraft(emptyDraft(marker))
    setShowForm(true)
  }

  const save = async (parsed: { tested_at: string; marker: string; value: number; unit: string }) => {
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('bloodwork').insert({
      user_id: user.id,
      tested_at: parsed.tested_at,
      marker: parsed.marker,
      value: parsed.value,
      unit: parsed.unit,
      notes: null,
    })

    if (error) toast.error('Blutwert konnte nicht gespeichert werden')
    else {
      toast.success('Blutwert gespeichert')
      setShowForm(false)
      setDraft(emptyDraft())
      void load()
    }
    setSaving(false)
  }

  const remove = async (entry: BloodworkEntry) => {
    if (!confirm(`${entry.marker} vom ${formatDisplayDate(entry.tested_at)} löschen?`)) return
    const { error } = await supabase.from('bloodwork').delete().eq('id', entry.id).eq('user_id', user!.id)
    if (error) toast.error('Blutwert konnte nicht gelöscht werden')
    else {
      toast.success('Blutwert gelöscht')
      void load()
    }
  }

  const modal = showForm ? (
    <EntryModal
      draft={draft}
      markerLocked={!!draft.marker && selectedMarker === draft.marker}
      saving={saving}
      onChange={setDraft}
      onCancel={() => setShowForm(false)}
      onSave={save}
    />
  ) : null

  const selected = selectedMarker ? summaries.find(s => s.name === selectedMarker) : undefined

  if (selected) {
    return (
      <div>
        <MarkerDetail
          summary={selected}
          onBack={() => setSelectedMarker(null)}
          onAdd={() => openNew(selected.name)}
          onDelete={remove}
        />
        {modal}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: TEXT }}>Blutwerte</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew()}>
          <Plus size={15} /> Neu
        </button>
      </div>

      <div className="flex mb-4 p-4" style={PANEL_STYLE}>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Einträge gesamt</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{entries.length}</p>
        </div>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Marker getestet</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{markersTested}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Letzter Test</p>
          <p className="text-sm font-bold leading-tight pt-1" style={{ color: TEXT }}>
            {latestDate ? formatDisplayDate(latestDate) : '–'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center" style={{ ...PANEL_STYLE, color: MUTED }}>
          Blutwerte werden geladen...
        </div>
      ) : (
        <MarkerGrid summaries={summaries} onSelect={setSelectedMarker} />
      )}

      {modal}
    </div>
  )
}
```

- [ ] **Step 7: Replace the old page with a re-export**

Replace the **entire** contents of `src/pages/Blutwerte.tsx` with:

```tsx
export { BlutwertePage as Blutwerte } from '../features/blutwerte/BlutwertePage'
```

- [ ] **Step 8: Verify tests, types and lint**

Run: `npm test`
Expected: PASS, keine neuen Fehler

Run: `npx tsc -b`
Expected: kein Fehler

Run: `npm run lint`
Expected: keine neuen Fehler

- [ ] **Step 9: Verify in the browser**

Starte den Dev-Server über `preview_start` (siehe Task 15 für die `.claude/launch.json`-Konfiguration) und öffne die Blutwerte-Seite. Prüfe: Grid zeigt alle Katalog-Marker, vorhandene Werte erscheinen wie zuvor, Detailansicht mit Chart öffnet sich, manuelles Anlegen und Löschen funktionieren.

Da das Grid jetzt ~60 statt 15 Marker zeigt, ist die Seite länger — das ist erwartet und wird in Task 6 durch Kategorie-Filter aufgelöst.

- [ ] **Step 10: Commit**

```bash
git add src/features/blutwerte src/pages/Blutwerte.tsx
git commit -m "refactor(blutwerte): split page into feature module using marker catalog"
```

---

### Task 6: Kategorie-Filter und Sortierung

**Files:**
- Modify: `src/features/blutwerte/components/MarkerGrid.tsx`
- Create: `src/features/blutwerte/components/GridControls.tsx`
- Modify: `src/features/blutwerte/BlutwertePage.tsx`

Die Logik ist in Task 3 bereits getestet (`filterByKategorie`, `sortSummaries`) — hier kommt nur die UI dazu.

- [ ] **Step 1: Create the controls component**

Create `src/features/blutwerte/components/GridControls.tsx`:

```tsx
import type { SortMode } from '../lib/bloodwork'
import type { KategorieFilter } from '../lib/markerCatalog'
import { KATEGORIEN, SONSTIGE } from '../lib/markerCatalog'
import { CYAN, MUTED, TEXT } from '../styles'

const SORT_LABELS: Record<SortMode, string> = {
  kategorie: 'Kategorie',
  name: 'Name',
  zuletzt: 'Zuletzt getestet',
  status: 'Auffällige zuerst',
}

interface Props {
  kategorie: KategorieFilter | null
  sortMode: SortMode
  /** Kategorien, die "Sonstige" anzeigen sollen — nur wenn Custom-Marker existieren. */
  showSonstige: boolean
  onKategorie: (kategorie: KategorieFilter | null) => void
  onSortMode: (mode: SortMode) => void
}

export function GridControls({ kategorie, sortMode, showSonstige, onKategorie, onSortMode }: Props) {
  const chips: Array<{ key: KategorieFilter | null; label: string }> = [
    { key: null, label: 'Alle' },
    ...KATEGORIEN.map(k => ({ key: k as KategorieFilter, label: k })),
    ...(showSonstige ? [{ key: SONSTIGE as KategorieFilter, label: SONSTIGE }] : []),
  ]

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {chips.map(chip => {
          const active = kategorie === chip.key
          return (
            <button
              key={chip.label}
              onClick={() => onKategorie(chip.key)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: MUTED }} htmlFor="blutwerte-sort">Sortieren:</label>
        <select
          id="blutwerte-sort"
          className="select"
          style={{ color: TEXT, width: 'auto', paddingTop: 6, paddingBottom: 6 }}
          value={sortMode}
          onChange={e => onSortMode(e.target.value as SortMode)}
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
            <option key={mode} value={mode}>{SORT_LABELS[mode]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add category headings to the grid**

In `src/features/blutwerte/components/MarkerGrid.tsx`, replace the `Props` interface and the `MarkerGrid` function (keep `TrendIcon` and `trendColor` unchanged):

```tsx
interface Props {
  summaries: MarkerSummary[]
  /** Bei true werden Zwischenüberschriften je Kategorie gezeigt. */
  grouped: boolean
  onSelect: (name: string) => void
}

export function MarkerGrid({ summaries, grouped, onSelect }: Props) {
  if (summaries.length === 0) {
    return (
      <div className="p-6 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
        Keine Marker in dieser Kategorie.
      </div>
    )
  }

  if (!grouped) {
    return <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>{summaries.map(renderCard)}</div>
  }

  const gruppen: Array<{ kategorie: string; items: MarkerSummary[] }> = []
  summaries.forEach(summary => {
    const last = gruppen[gruppen.length - 1]
    if (last && last.kategorie === summary.kategorie) last.items.push(summary)
    else gruppen.push({ kategorie: summary.kategorie, items: [summary] })
  })

  return (
    <div className="space-y-5">
      {gruppen.map(gruppe => (
        <div key={gruppe.kategorie}>
          <p className="text-[0.65rem] uppercase tracking-wide mb-2" style={{ color: MUTED }}>
            {gruppe.kategorie}
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {gruppe.items.map(renderCard)}
          </div>
        </div>
      ))}
    </div>
  )

  function renderCard(summary: MarkerSummary) {
    const { latest, inRange } = summary
    const hasData = !!latest
    return (
      <button
        key={summary.name}
        onClick={() => onSelect(summary.name)}
        className="text-left"
        style={{
          padding: 14,
          borderRadius: 16,
          background: 'var(--surface)',
          border: hasData ? '1px solid var(--accent-border)' : '1px solid var(--border)',
          cursor: 'pointer',
          opacity: hasData ? 1 : 0.55,
        }}
      >
        <p className="font-bold text-sm" style={{ color: TEXT }}>{summary.name}</p>
        {latest ? (
          <>
            <div className="flex items-center justify-between mt-2">
              <span className="text-base font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                {formatNumber(latest.value)}{' '}
                <span className="text-xs font-semibold" style={{ color: MUTED }}>{latest.unit}</span>
              </span>
              <span style={{ color: trendColor(summary) }}>
                <TrendIcon trend={summary.trend} size={15} />
              </span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: MUTED }}>{formatDisplayDate(latest.tested_at)}</p>
          </>
        ) : (
          <p className="text-xs mt-3" style={{ color: MUTED }}>– Noch kein Test</p>
        )}
      </button>
    )
  }
}
```

Ergänze den Import um `PANEL_STYLE`:

```tsx
import { CYAN, MUTED, PANEL_STYLE, RED, TEXT } from '../styles'
```

- [ ] **Step 3: Wire controls into the page**

In `src/features/blutwerte/BlutwertePage.tsx`:

Ergänze die Imports:

```tsx
import { buildMarkerSummaries, filterByKategorie, sortSummaries, type SortMode } from './lib/bloodwork'
import type { KategorieFilter } from './lib/markerCatalog'
import { SONSTIGE } from './lib/markerCatalog'
import { GridControls } from './components/GridControls'
```

Ergänze die State-Hooks direkt nach `const [draft, setDraft] = useState<EntryDraft>(emptyDraft())`:

```tsx
const [kategorie, setKategorie] = useState<KategorieFilter | null>(null)
const [sortMode, setSortMode] = useState<SortMode>('kategorie')
```

Ergänze nach `const summaries = useMemo(...)`:

```tsx
const showSonstige = useMemo(() => summaries.some(s => s.kategorie === SONSTIGE), [summaries])

const visibleSummaries = useMemo(
  () => sortSummaries(filterByKategorie(summaries, kategorie), sortMode),
  [summaries, kategorie, sortMode],
)
```

Ersetze im Grid-Zweig den `MarkerGrid`-Aufruf:

```tsx
) : (
  <>
    <GridControls
      kategorie={kategorie}
      sortMode={sortMode}
      showSonstige={showSonstige}
      onKategorie={setKategorie}
      onSortMode={setSortMode}
    />
    <MarkerGrid
      summaries={visibleSummaries}
      grouped={sortMode === 'kategorie' && kategorie === null}
      onSelect={setSelectedMarker}
    />
  </>
)}
```

- [ ] **Step 4: Verify tests and types**

Run: `npm test`
Expected: PASS

Run: `npx tsc -b`
Expected: kein Fehler

- [ ] **Step 5: Verify in the browser**

Im Dev-Server: Kategorie-Chips filtern das Grid; bei „Alle" + Sortierung „Kategorie" erscheinen Zwischenüberschriften; die vier Sortiermodi ändern die Reihenfolge sichtbar. Screenshot für den Nutzer.

- [ ] **Step 6: Commit**

```bash
git add src/features/blutwerte
git commit -m "feat(blutwerte): add category filter and sorting to marker grid"
```

---

### Task 7: Auffällige-Werte-Sektion

**Files:**
- Create: `src/features/blutwerte/components/AuffaelligeWerte.tsx`
- Modify: `src/features/blutwerte/BlutwertePage.tsx`

- [ ] **Step 1: Create the component**

Create `src/features/blutwerte/components/AuffaelligeWerte.tsx`:

```tsx
import { AlertTriangle } from 'lucide-react'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatNumber, formatRange } from '../lib/format'
import { MUTED, PANEL_STYLE, RED, TEXT } from '../styles'

interface Props {
  summaries: MarkerSummary[]
  onSelect: (name: string) => void
}

export function AuffaelligeWerte({ summaries, onSelect }: Props) {
  if (summaries.length === 0) return null

  return (
    <div className="mb-4" style={{ ...PANEL_STYLE, border: '1px solid rgba(239,68,68,0.35)' }}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <AlertTriangle size={15} style={{ color: RED }} />
        <p className="text-sm font-bold" style={{ color: TEXT }}>
          Auffällige Werte ({summaries.length})
        </p>
      </div>
      {summaries.map((summary, i) => {
        const latest = summary.latest!
        const referenz = formatRange(summary.range.min, summary.range.max, latest.unit)
        return (
          <button
            key={summary.name}
            onClick={() => onSelect(summary.name)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{summary.name}</p>
              {referenz && (
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>Referenz: {referenz}</p>
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: RED }}>
              {formatNumber(latest.value)}{' '}
              <span className="text-xs font-semibold" style={{ color: MUTED }}>{latest.unit}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the page**

In `src/features/blutwerte/BlutwertePage.tsx`:

Ergänze die Imports:

```tsx
import { auffaelligeWerte } from './lib/bloodwork'
import { AuffaelligeWerte } from './components/AuffaelligeWerte'
import { DISCLAIMER } from './styles'
```

Ergänze nach `const visibleSummaries = useMemo(...)`:

```tsx
const auffaellig = useMemo(() => auffaelligeWerte(summaries), [summaries])
```

Füge im Grid-Zweig direkt vor `<GridControls ... />` ein:

```tsx
<AuffaelligeWerte summaries={auffaellig} onSelect={setSelectedMarker} />
```

Und ganz am Ende des Grid-Zweigs, nach `<MarkerGrid ... />`:

```tsx
<p className="text-xs text-center mt-5" style={{ color: MUTED }}>{DISCLAIMER}</p>
```

- [ ] **Step 3: Verify tests and types**

Run: `npm test && npx tsc -b`
Expected: PASS, kein Fehler

- [ ] **Step 4: Verify in the browser**

Lege testweise einen Wert außerhalb der Referenz an (z.B. Testosteron 1200 ng/dL) → die Sektion erscheint oben, rot, klickbar. Bei ausschließlich normalen Werten ist sie unsichtbar. Danach den Testwert wieder löschen.

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte
git commit -m "feat(blutwerte): add out-of-range values section and disclaimer"
```

---

### Task 8: Referenzbalken

**Files:**
- Create: `src/features/blutwerte/lib/referenceBar.ts`
- Test: `src/features/blutwerte/lib/referenceBar.test.ts`
- Create: `src/features/blutwerte/components/ReferenceBar.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/blutwerte/lib/referenceBar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { referenceBarGeometry } from './referenceBar'

describe('referenceBarGeometry', () => {
  it('gibt null zurück, wenn kein beidseitiger Referenzbereich existiert', () => {
    expect(referenceBarGeometry(500, { min: null, max: null, source: 'none' })).toBeNull()
  })

  it('platziert einen Wert in der Mitte des Referenzbereichs bei 50%', () => {
    const geo = referenceBarGeometry(650, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeCloseTo(50, 1)
  })

  it('legt die grüne Zone innerhalb der Skala an', () => {
    const geo = referenceBarGeometry(650, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.zoneStartPercent).toBeGreaterThan(0)
    expect(geo.zoneEndPercent).toBeLessThan(100)
    expect(geo.zoneEndPercent).toBeGreaterThan(geo.zoneStartPercent)
  })

  it('hält einen weit außerhalb liegenden Wert innerhalb der Skala', () => {
    const geo = referenceBarGeometry(99999, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeLessThanOrEqual(100)
    expect(geo.valuePercent).toBeGreaterThanOrEqual(0)
  })

  it('hält einen weit darunter liegenden Wert innerhalb der Skala', () => {
    const geo = referenceBarGeometry(-500, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeGreaterThanOrEqual(0)
  })

  it('behandelt eine einseitige Obergrenze wie einen Bereich ab 0', () => {
    const geo = referenceBarGeometry(0.5, { min: null, max: 1, source: 'catalog' })!
    expect(geo.zoneStartPercent).toBeCloseTo(referenceBarGeometry(0.5, { min: 0, max: 1, source: 'catalog' })!.zoneStartPercent, 5)
  })

  it('gibt null bei einem nicht-numerischen Wert zurück', () => {
    expect(referenceBarGeometry(Number.NaN, { min: 400, max: 900, source: 'catalog' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/blutwerte/lib/referenceBar.test.ts`
Expected: FAIL — „Failed to resolve import ./referenceBar"

- [ ] **Step 3: Write the implementation**

Create `src/features/blutwerte/lib/referenceBar.ts`:

```ts
import type { EffectiveRange } from './bloodwork'

export interface ReferenceBarGeometry {
  /** Position des aktuellen Werts auf der Skala, 0–100. */
  valuePercent: number
  /** Start der grünen Zone, 0–100. */
  zoneStartPercent: number
  /** Ende der grünen Zone, 0–100. */
  zoneEndPercent: number
  /** Skalenränder für die Beschriftung. */
  scaleMin: number
  scaleMax: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Berechnet die Balken-Geometrie: Die Skala umfasst den Referenzbereich plus
 * 50% Puffer auf beiden Seiten, damit die grüne Zone mittig sitzt und
 * Ausreißer sichtbar am Rand kleben.
 */
export function referenceBarGeometry(value: number, range: EffectiveRange): ReferenceBarGeometry | null {
  if (!Number.isFinite(value)) return null
  if (range.min == null && range.max == null) return null

  const min = range.min ?? 0
  const max = range.max ?? min * 2
  if (!(max > min)) return null

  const puffer = (max - min) * 0.5
  const scaleMin = min - puffer
  const scaleMax = max + puffer
  const spanne = scaleMax - scaleMin

  const percent = (n: number) => clamp(((n - scaleMin) / spanne) * 100, 0, 100)

  return {
    valuePercent: percent(value),
    zoneStartPercent: percent(min),
    zoneEndPercent: percent(max),
    scaleMin,
    scaleMax,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/blutwerte/lib/referenceBar.test.ts`
Expected: PASS (7 Tests)

- [ ] **Step 5: Create the component**

Create `src/features/blutwerte/components/ReferenceBar.tsx`:

```tsx
import type { EffectiveRange } from '../lib/bloodwork'
import { referenceBarGeometry } from '../lib/referenceBar'
import { formatNumber, formatRange } from '../lib/format'
import { GREEN, MUTED, RED, TEXT } from '../styles'

interface Props {
  value: number
  unit: string
  range: EffectiveRange
  inRange: boolean | null
}

export function ReferenceBar({ value, unit, range, inRange }: Props) {
  const geo = referenceBarGeometry(value, range)
  if (!geo) return null

  const referenzText = formatRange(range.min, range.max, unit)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>Referenzbereich</p>
        <p className="text-xs" style={{ color: MUTED }}>
          {referenzText}
          {range.source === 'lab' && ' (Labor)'}
        </p>
      </div>

      <div className="relative h-2.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${geo.zoneStartPercent}%`,
            width: `${geo.zoneEndPercent - geo.zoneStartPercent}%`,
            background: 'rgba(16,185,129,0.35)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: `${geo.valuePercent}%`,
            top: -3,
            width: 10,
            height: 16,
            marginLeft: -5,
            background: inRange === false ? RED : GREEN,
            border: '2px solid var(--surface)',
          }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMin)}</span>
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMax)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/blutwerte/lib/referenceBar.ts src/features/blutwerte/lib/referenceBar.test.ts src/features/blutwerte/components/ReferenceBar.tsx
git commit -m "feat(blutwerte): add reference range bar component"
```

---

### Task 9: Erklärung und Referenzbalken in der Detailansicht

**Files:**
- Modify: `src/features/blutwerte/components/MarkerDetail.tsx`

- [ ] **Step 1: Add the imports**

In `src/features/blutwerte/components/MarkerDetail.tsx`, ergänze:

```tsx
import { Info } from 'lucide-react'
import { ReferenceBar } from './ReferenceBar'
import { DISCLAIMER } from '../styles'
```

- [ ] **Step 2: Add the reference bar to the hero panel**

Ersetze im Hero-Panel den Block

```tsx
            <p className="text-xs mt-2" style={{ color: MUTED }}>
              {referenzText ? `Referenz: ${referenzText}` : 'Kein Referenzbereich'}
            </p>
```

durch:

```tsx
            {range.source !== 'none' ? (
              <div className="mt-4">
                <ReferenceBar
                  value={toNumber(latest.value)}
                  unit={latest.unit}
                  range={range}
                  inRange={inRange}
                />
              </div>
            ) : (
              <p className="text-xs mt-2" style={{ color: MUTED }}>Kein Referenzbereich hinterlegt</p>
            )}
```

Die Variable `referenzText` wird dadurch im Hero nicht mehr gebraucht — entferne die `const referenzText = ...`-Zeile und den nun ungenutzten `formatRange`-Import, falls er sonst nirgends verwendet wird.

- [ ] **Step 3: Add the explanation block**

Füge direkt **nach** dem Hero-Panel (also nach dem schließenden `</div>` des `PANEL_STYLE`-Panels) und **vor** dem Zeitraumfilter ein:

```tsx
      <div className="p-5 mb-4" style={PANEL_STYLE}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={15} style={{ color: CYAN }} />
          <p className="text-sm font-bold" style={{ color: TEXT }}>Was ist das?</p>
        </div>
        {summary.def ? (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{summary.def.erklaerung}</p>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            Für diesen Marker ist keine Erklärung hinterlegt. Er wurde aus einem importierten Befund übernommen.
          </p>
        )}
        <p className="text-xs mt-3" style={{ color: MUTED, opacity: 0.8 }}>{DISCLAIMER}</p>
      </div>
```

- [ ] **Step 4: Verify tests, types and lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: PASS, keine Fehler (insbesondere keine ungenutzten Imports)

- [ ] **Step 5: Verify in the browser**

Öffne einen Marker mit Wert (z.B. Testosteron): Referenzbalken zeigt die grüne Zone und den Punkt an der richtigen Stelle; „Was ist das?" zeigt die Erklärung; Disclaimer sichtbar. Öffne einen Marker ohne Wert: kein Balken, Erklärung trotzdem sichtbar. Screenshot für den Nutzer.

- [ ] **Step 6: Commit**

```bash
git add src/features/blutwerte/components/MarkerDetail.tsx
git commit -m "feat(blutwerte): add explanation block and reference bar to marker detail"
```

---

### Task 10: Extraktions-Ergebnis validieren

**Files:**
- Create: `src/features/blutwerte/lib/extractResult.ts`
- Test: `src/features/blutwerte/lib/extractResult.test.ts`

Diese Datei ist die Vertragsgrenze zur Edge Function. Sie wird vom Frontend **und** (per Copy der Typen) von der Function genutzt.

- [ ] **Step 1: Write the failing test**

Create `src/features/blutwerte/lib/extractResult.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseExtractResult } from './extractResult'

const gueltig = {
  tested_at: '2026-07-10',
  lab_name: 'Labor XY',
  values: [
    { marker: 'Testosteron', matched: true, value: 620, unit: 'ng/dL', ref_min: 300, ref_max: 1000 },
  ],
}

describe('parseExtractResult', () => {
  it('akzeptiert ein gültiges Ergebnis', () => {
    expect(parseExtractResult(gueltig)).toEqual(gueltig)
  })

  it('lehnt Nicht-Objekte ab', () => {
    expect(parseExtractResult(null)).toBeNull()
    expect(parseExtractResult('text')).toBeNull()
    expect(parseExtractResult([])).toBeNull()
  })

  it('lehnt ein fehlendes oder falsch formatiertes Datum ab', () => {
    expect(parseExtractResult({ ...gueltig, tested_at: '10.07.2026' })).toBeNull()
    expect(parseExtractResult({ ...gueltig, tested_at: undefined })).toBeNull()
  })

  it('akzeptiert ein fehlendes Labor als null', () => {
    expect(parseExtractResult({ ...gueltig, lab_name: undefined })?.lab_name).toBeNull()
  })

  it('lehnt ein fehlendes values-Array ab', () => {
    expect(parseExtractResult({ ...gueltig, values: undefined })).toBeNull()
  })

  it('akzeptiert ein leeres values-Array', () => {
    expect(parseExtractResult({ ...gueltig, values: [] })?.values).toEqual([])
  })

  it('verwirft einzelne Werte ohne Marker oder mit unbrauchbarem Wert', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [
        ...gueltig.values,
        { marker: '', matched: false, value: 5, unit: 'U/L', ref_min: null, ref_max: null },
        { marker: 'GPT (ALT)', matched: false, value: 'unleserlich', unit: 'U/L', ref_min: null, ref_max: null },
        { marker: 'GOT (AST)', matched: false, value: Number.NaN, unit: 'U/L', ref_min: null, ref_max: null },
      ],
    })
    expect(result?.values.map(v => v.marker)).toEqual(['Testosteron'])
  })

  it('normalisiert fehlende Referenzgrenzen zu null', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'CRP', matched: true, value: 0.8, unit: 'mg/L' }],
    })
    expect(result?.values[0]).toEqual({
      marker: 'CRP', matched: true, value: 0.8, unit: 'mg/L', ref_min: null, ref_max: null,
    })
  })

  it('setzt eine fehlende Einheit auf einen leeren String', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'HOMA-Index', matched: true, value: 1.4 }],
    })
    expect(result?.values[0].unit).toBe('')
  })

  it('akzeptiert Zahlen als Strings mit Komma', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'CRP', matched: true, value: '0,8', unit: 'mg/L' }],
    })
    expect(result?.values[0].value).toBe(0.8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/blutwerte/lib/extractResult.test.ts`
Expected: FAIL — „Failed to resolve import ./extractResult"

- [ ] **Step 3: Write the implementation**

Create `src/features/blutwerte/lib/extractResult.ts`:

```ts
export interface ExtractedValue {
  marker: string
  /** True, wenn der Marker im Katalog gefunden wurde (setzt die Edge Function). */
  matched: boolean
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
}

export interface ExtractResult {
  /** ISO-Datum yyyy-MM-dd. */
  tested_at: string
  lab_name: string | null
  values: ExtractedValue[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const toFiniteNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseValue = (raw: unknown): ExtractedValue | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>

  const marker = typeof record.marker === 'string' ? record.marker.trim() : ''
  if (!marker) return null

  const value = toFiniteNumber(record.value)
  if (value === null) return null

  return {
    marker,
    matched: record.matched === true,
    value,
    unit: typeof record.unit === 'string' ? record.unit.trim() : '',
    ref_min: toFiniteNumber(record.ref_min),
    ref_max: toFiniteNumber(record.ref_max),
  }
}

/**
 * Validiert die Antwort der Edge Function. Gibt null zurück, wenn die Struktur
 * unbrauchbar ist; einzelne unbrauchbare Werte werden still verworfen.
 */
export function parseExtractResult(raw: unknown): ExtractResult | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>

  const tested_at = typeof record.tested_at === 'string' ? record.tested_at.trim() : ''
  if (!ISO_DATE.test(tested_at)) return null

  if (!Array.isArray(record.values)) return null

  const values = record.values
    .map(parseValue)
    .filter((v): v is ExtractedValue => v !== null)

  const lab_name =
    typeof record.lab_name === 'string' && record.lab_name.trim() ? record.lab_name.trim() : null

  return { tested_at, lab_name, values }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/blutwerte/lib/extractResult.test.ts`
Expected: PASS (10 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte/lib/extractResult.ts src/features/blutwerte/lib/extractResult.test.ts
git commit -m "feat(blutwerte): add extraction result validation"
```

---

### Task 11: Bildverkleinerung

**Files:**
- Create: `src/features/blutwerte/lib/imageResize.ts`
- Test: `src/features/blutwerte/lib/imageResize.test.ts`

Nur die Maß-Berechnung ist pure und wird getestet; das Canvas-Zeichnen selbst ist Browser-API und wird per Browser-Verifikation in Task 13 geprüft.

- [ ] **Step 1: Write the failing test**

Create `src/features/blutwerte/lib/imageResize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_EDGE, targetSize } from './imageResize'

describe('targetSize', () => {
  it('lässt kleine Bilder unverändert', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('lässt ein Bild genau auf der Grenze unverändert', () => {
    expect(targetSize(MAX_EDGE, 400)).toEqual({ width: MAX_EDGE, height: 400 })
  })

  it('skaliert ein breites Bild auf die maximale Kante', () => {
    expect(targetSize(4000, 2000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE / 2 })
  })

  it('skaliert ein hohes Bild auf die maximale Kante', () => {
    expect(targetSize(2000, 4000)).toEqual({ width: MAX_EDGE / 2, height: MAX_EDGE })
  })

  it('rundet auf ganze Pixel', () => {
    const size = targetSize(3000, 1777)
    expect(Number.isInteger(size.width)).toBe(true)
    expect(Number.isInteger(size.height)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/blutwerte/lib/imageResize.test.ts`
Expected: FAIL — „Failed to resolve import ./imageResize"

- [ ] **Step 3: Write the implementation**

Create `src/features/blutwerte/lib/imageResize.ts`:

```ts
/** Längste Kante, die an die Vision-API geschickt wird — darüber bringt Auflösung keinen Erkennungsgewinn mehr. */
export const MAX_EDGE = 1568

export interface Size {
  width: number
  height: number
}

/** Skaliert proportional auf MAX_EDGE herunter; kleinere Bilder bleiben unverändert. */
export function targetSize(width: number, height: number): Size {
  const longest = Math.max(width, height)
  if (longest <= MAX_EDGE) return { width, height }
  const factor = MAX_EDGE / longest
  return { width: Math.round(width * factor), height: Math.round(height * factor) }
}

export interface PreparedFile {
  /** Base64 ohne data:-Präfix. */
  base64: string
  mimeType: string
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })

const stripPrefix = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = dataUrl
  })

/**
 * Bereitet eine Datei für den Upload vor: PDFs unverändert, Bilder auf MAX_EDGE
 * verkleinert und als JPEG kodiert (spart Tokens und Upload-Zeit).
 */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const dataUrl = await readAsDataUrl(file)

  if (file.type === 'application/pdf') {
    return { base64: stripPrefix(dataUrl), mimeType: 'application/pdf' }
  }

  const img = await loadImage(dataUrl)
  const size = targetSize(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Bild konnte nicht verarbeitet werden')
  ctx.drawImage(img, 0, 0, size.width, size.height)

  return { base64: stripPrefix(canvas.toDataURL('image/jpeg', 0.9)), mimeType: 'image/jpeg' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/blutwerte/lib/imageResize.test.ts`
Expected: PASS (5 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte/lib/imageResize.ts src/features/blutwerte/lib/imageResize.test.ts
git commit -m "feat(blutwerte): add client-side image resizing for upload"
```

---

### Task 12: Edge Function `bloodwork-extract`

**Files:**
- Create: `supabase/functions/bloodwork-extract/prompt.ts`
- Create: `supabase/functions/bloodwork-extract/index.ts`
- Test: `supabase/functions/bloodwork-extract/prompt.test.ts`

Muster: `supabase/functions/pubmed/index.ts` (Deno.serve, CORS-Header).

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/bloodwork-extract/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALLOWED_MIME_TYPES, buildPrompt, extractJson, resetsAt } from './prompt'

describe('buildPrompt', () => {
  it('enthält die Katalog-Marker', () => {
    const prompt = buildPrompt(['Testosteron', 'CRP'])
    expect(prompt).toContain('Testosteron')
    expect(prompt).toContain('CRP')
  })

  it('weist an, unleserliche Werte wegzulassen statt zu raten', () => {
    const prompt = buildPrompt(['CRP']).toLowerCase()
    expect(prompt).toContain('lasse ihn weg')
    expect(prompt).toContain('raten')
  })

  it('legt das JSON-Antwortformat fest', () => {
    expect(buildPrompt(['CRP'])).toContain('"tested_at"')
  })
})

describe('extractJson', () => {
  it('liest reines JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('liest JSON aus einem Markdown-Codeblock', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('liest JSON mit umgebendem Text', () => {
    expect(extractJson('Hier das Ergebnis:\n{"a":1}\nFertig.')).toEqual({ a: 1 })
  })

  it('gibt null bei fehlendem JSON zurück', () => {
    expect(extractJson('kein json hier')).toBeNull()
  })

  it('gibt null bei kaputtem JSON zurück', () => {
    expect(extractJson('{"a":')).toBeNull()
  })
})

describe('resetsAt', () => {
  it('liegt 30 Tage nach dem ältesten Import im Fenster', () => {
    const result = resetsAt('2026-07-01T10:00:00.000Z')
    expect(result).toBe('2026-07-31T10:00:00.000Z')
  })

  it('gibt null ohne ältesten Import zurück', () => {
    expect(resetsAt(null)).toBeNull()
  })
})

describe('ALLOWED_MIME_TYPES', () => {
  it('erlaubt gängige Bildformate und PDF', () => {
    expect(ALLOWED_MIME_TYPES).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/bloodwork-extract/prompt.test.ts`
Expected: FAIL — „Failed to resolve import ./prompt"

Falls Vitest die Datei nicht einsammelt, weil `include` nur `src/` abdeckt: prüfe `vite.config.ts` / `vitest.config.ts` und erweitere `test.include` um `supabase/functions/**/*.test.ts`.

- [ ] **Step 3: Write the pure helpers**

Create `supabase/functions/bloodwork-extract/prompt.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/bloodwork-extract/prompt.test.ts`
Expected: PASS (9 Tests)

- [ ] **Step 5: Write the edge function**

Create `supabase/functions/bloodwork-extract/index.ts`:

```ts
/* global Deno */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ALLOWED_MIME_TYPES, IMPORT_LIMIT, RATE_WINDOW_DAYS, buildPrompt, extractJson, resetsAt } from './prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

/** Muss mit CATALOG_MARKER_NAMES aus src/features/blutwerte/lib/markerCatalog.ts übereinstimmen. */
type ExtractRequest = {
  file?: string
  mimeType?: string
  markerNames?: string[]
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  let body: ExtractRequest
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const { file, mimeType, markerNames } = body
  if (!file || !mimeType) return json({ error: 'invalid_body' }, 400)
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return json({ error: 'unsupported_type' }, 400)
  if (!Array.isArray(markerNames) || markerNames.length === 0) return json({ error: 'invalid_body' }, 400)

  // Rate-Limit
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - RATE_WINDOW_DAYS)

  const { data: recent, error: countError } = await supabase
    .from('bloodwork_reports')
    .select('created_at')
    .eq('user_id', userId)
    .eq('source', 'import')
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: true })

  if (countError) return json({ error: 'server_error' }, 500)

  if ((recent?.length ?? 0) >= IMPORT_LIMIT) {
    return json({ error: 'rate_limit', resetsAt: resetsAt(recent?.[0]?.created_at ?? null) }, 429)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'server_error' }, 500)

  const documentBlock =
    mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: file } }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [documentBlock, { type: 'text', text: buildPrompt(markerNames) }],
        },
      ],
    }),
  })

  if (!response.ok) return json({ error: 'extraction_failed' }, 502)

  const payload = await response.json()
  const text: string = payload?.content?.[0]?.text ?? ''
  const parsed = extractJson(text)

  if (!parsed || typeof parsed !== 'object') return json({ error: 'extraction_failed' }, 422)

  const result = parsed as { tested_at?: unknown; values?: unknown }
  if (!result.tested_at || !Array.isArray(result.values) || result.values.length === 0) {
    return json({ error: 'no_bloodwork_found' }, 422)
  }

  // matched serverseitig setzen, damit das Modell es nicht erfinden kann
  const known = new Set(markerNames.map(n => n.toLowerCase()))
  const values = (result.values as Array<Record<string, unknown>>).map(v => ({
    ...v,
    matched: typeof v.marker === 'string' && known.has(v.marker.trim().toLowerCase()),
  }))

  return json({ ...result, values })
})
```

- [ ] **Step 6: Guide the user through the API key setup**

Sag dem Nutzer wörtlich:

> Für die Extraktion brauche ich einen Anthropic API-Key als Supabase-Secret. **Bitte richte den selbst ein — schicke mir den Key nicht.**
>
> 1. Key erstellen: https://console.anthropic.com/settings/keys → „Create Key" → Key kopieren.
> 2. Als Supabase-Secret setzen — entweder im Dashboard unter **Edge Functions → Secrets → Add new secret** mit dem Namen `ANTHROPIC_API_KEY`, oder im Terminal:
>    ```
>    npx supabase secrets set ANTHROPIC_API_KEY=dein-key-hier
>    ```
> 3. Function deployen:
>    ```
>    npx supabase functions deploy bloodwork-extract
>    ```
>
> `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase automatisch — die musst du nicht anlegen. Sag Bescheid, wenn Key und Deploy durch sind.

Warte auf die Bestätigung.

- [ ] **Step 7: Verify tests and lint**

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: keine neuen Fehler. Falls ESLint die Deno-Datei nicht auflösen kann (Import via URL, `Deno`-Global), ergänze `supabase/functions/**` in den `ignores` der `eslint.config.js` — wie beim bestehenden `pubmed`-Ordner gehandhabt.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/bloodwork-extract
git commit -m "feat(blutwerte): add bloodwork extraction edge function"
```

---

### Task 13: Import-Flow

**Files:**
- Create: `src/features/blutwerte/components/import/ReviewTable.tsx`
- Create: `src/features/blutwerte/components/import/ImportFlow.tsx`
- Modify: `src/features/blutwerte/BlutwertePage.tsx`

- [ ] **Step 1: Create the review table**

Create `src/features/blutwerte/components/import/ReviewTable.tsx`:

```tsx
import { Check } from 'lucide-react'
import type { ExtractedValue } from '../../lib/extractResult'
import { CYAN, MUTED, TEXT } from '../../styles'

export interface ReviewRow extends ExtractedValue {
  /** Wird übernommen, wenn true. */
  selected: boolean
}

interface Props {
  rows: ReviewRow[]
  onChange: (index: number, row: ReviewRow) => void
}

export function ReviewTable({ rows, onChange }: Props) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.marker}-${index}`}
          className="p-3 rounded-2xl"
          style={{
            border: row.selected ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            opacity: row.selected ? 1 : 0.5,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onChange(index, { ...row, selected: !row.selected })}
              className="flex items-center justify-center rounded-md shrink-0"
              style={{
                width: 20,
                height: 20,
                border: '1px solid var(--border)',
                background: row.selected ? 'var(--accent)' : 'transparent',
              }}
              aria-label={row.selected ? `${row.marker} abwählen` : `${row.marker} auswählen`}
            >
              {row.selected && <Check size={13} color="#000" />}
            </button>
            <input
              className="input flex-1"
              style={{ paddingTop: 6, paddingBottom: 6 }}
              value={row.marker}
              onChange={e => onChange(index, { ...row, marker: e.target.value })}
              aria-label="Marker"
            />
            {!row.matched && (
              <span className="badge shrink-0" style={{ background: 'var(--border)', color: MUTED }}>Neu</span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[0.65rem]" style={{ color: MUTED }}>Wert</label>
              <input
                className="input"
                style={{ paddingTop: 6, paddingBottom: 6 }}
                inputMode="decimal"
                value={String(row.value)}
                onChange={e => onChange(index, { ...row, value: Number(e.target.value.replace(',', '.')) })}
              />
            </div>
            <div>
              <label className="text-[0.65rem]" style={{ color: MUTED }}>Einheit</label>
              <input
                className="input"
                style={{ paddingTop: 6, paddingBottom: 6 }}
                value={row.unit}
                onChange={e => onChange(index, { ...row, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[0.65rem]" style={{ color: MUTED }}>Ref. min</label>
              <input
                className="input"
                style={{ paddingTop: 6, paddingBottom: 6 }}
                inputMode="decimal"
                value={row.ref_min ?? ''}
                onChange={e =>
                  onChange(index, {
                    ...row,
                    ref_min: e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.')),
                  })
                }
              />
            </div>
            <div>
              <label className="text-[0.65rem]" style={{ color: MUTED }}>Ref. max</label>
              <input
                className="input"
                style={{ paddingTop: 6, paddingBottom: 6 }}
                inputMode="decimal"
                value={row.ref_max ?? ''}
                onChange={e =>
                  onChange(index, {
                    ...row,
                    ref_max: e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.')),
                  })
                }
              />
            </div>
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: MUTED }}>Keine Werte erkannt.</p>
      )}
      <p className="text-xs pt-1" style={{ color: CYAN }}>
        <span style={{ color: TEXT }}>Bitte prüfen:</span> Die Werte wurden automatisch erkannt und können Fehler enthalten.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create the import flow**

Create `src/features/blutwerte/components/import/ImportFlow.tsx`:

```tsx
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Upload } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../context/AuthContext'
import { CATALOG_MARKER_NAMES } from '../../lib/markerCatalog'
import { parseExtractResult } from '../../lib/extractResult'
import { prepareFile } from '../../lib/imageResize'
import { formatDisplayDate } from '../../lib/format'
import { CYAN, MUTED, TEXT } from '../../styles'
import { ReviewTable, type ReviewRow } from './ReviewTable'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function ImportFlow({ onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('idle')
  const [testedAt, setTestedAt] = useState('')
  const [labName, setLabName] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setPhase('extracting')
    try {
      const prepared = await prepareFile(file)
      const { data, error } = await supabase.functions.invoke('bloodwork-extract', {
        body: { file: prepared.base64, mimeType: prepared.mimeType, markerNames: CATALOG_MARKER_NAMES },
      })

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status
        if (status === 429) {
          toast.error('Import-Limit erreicht (10 pro Monat). Bitte später erneut versuchen.')
        } else {
          toast.error('Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.')
        }
        setPhase('idle')
        return
      }

      const result = parseExtractResult(data)
      if (!result || result.values.length === 0) {
        toast.error('Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.')
        setPhase('idle')
        return
      }

      setTestedAt(result.tested_at)
      setLabName(result.lab_name ?? '')
      setRows(result.values.map(v => ({ ...v, selected: true })))
      setPhase('review')
    } catch {
      toast.error('Die Datei konnte nicht verarbeitet werden.')
      setPhase('idle')
    }
  }

  const save = async () => {
    if (!user) return
    const selected = rows.filter(r => r.selected && r.marker.trim() && Number.isFinite(r.value))
    if (selected.length === 0) return toast.error('Bitte mindestens einen Wert auswählen')
    if (!testedAt) return toast.error('Bitte ein Testdatum eintragen')

    setPhase('saving')

    const { data: report, error: reportError } = await supabase
      .from('bloodwork_reports')
      .insert({
        user_id: user.id,
        tested_at: testedAt,
        lab_name: labName.trim() || null,
        source: 'import',
      })
      .select()
      .single()

    if (reportError || !report) {
      toast.error('Befund konnte nicht gespeichert werden')
      setPhase('review')
      return
    }

    const { error: valuesError } = await supabase.from('bloodwork').insert(
      selected.map(row => ({
        user_id: user.id,
        tested_at: testedAt,
        marker: row.marker.trim(),
        value: row.value,
        unit: row.unit.trim(),
        notes: null,
        report_id: report.id,
        ref_min: row.ref_min,
        ref_max: row.ref_max,
      })),
    )

    if (valuesError) {
      // Befund ohne Werte wäre eine Leiche — wieder entfernen.
      await supabase.from('bloodwork_reports').delete().eq('id', report.id)
      toast.error('Werte konnten nicht gespeichert werden')
      setPhase('review')
      return
    }

    toast.success(`${selected.length} Werte übernommen`)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>Befund importieren</h2>

        {phase === 'idle' && (
          <>
            <p className="text-sm" style={{ color: MUTED }}>
              Fotografiere deinen Laborbefund ab oder lade ihn als Bild oder PDF hoch. Die erkannten Werte
              kannst du vor dem Speichern prüfen und korrigieren.
            </p>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => void handleFile(e.target.files?.[0])}
            />
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => cameraRef.current?.click()}>
                <Camera size={16} /> Foto
              </button>
              <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Datei
              </button>
            </div>
            <button className="btn-secondary w-full" onClick={onClose}>Abbrechen</button>
          </>
        )}

        {phase === 'extracting' && (
          <p className="py-10 text-center text-sm" style={{ color: CYAN }}>Befund wird ausgelesen...</p>
        )}

        {(phase === 'review' || phase === 'saving') && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Testdatum</label>
                <input className="input" type="date" value={testedAt} onChange={e => setTestedAt(e.target.value)} />
              </div>
              <div>
                <label className="label">Labor</label>
                <input className="input" placeholder="optional" value={labName} onChange={e => setLabName(e.target.value)} />
              </div>
            </div>

            <ReviewTable
              rows={rows}
              onChange={(index, row) => setRows(current => current.map((r, i) => (i === index ? row : r)))}
            />

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={save} disabled={phase === 'saving'}>
                {phase === 'saving' ? 'Speichern...' : `${rows.filter(r => r.selected).length} übernehmen`}
              </button>
            </div>
            {testedAt && (
              <p className="text-xs text-center" style={{ color: MUTED }}>
                Wird gespeichert als Befund vom {formatDisplayDate(testedAt)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the import button into the page**

In `src/features/blutwerte/BlutwertePage.tsx`:

Ergänze die Imports:

```tsx
import { Camera, Plus } from 'lucide-react'
import { ImportFlow } from './components/import/ImportFlow'
```

Ergänze den State:

```tsx
const [showImport, setShowImport] = useState(false)
```

Ersetze die Kopfzeile des Grid-Zweigs:

```tsx
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: TEXT }}>Blutwerte</h1>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center gap-1.5 text-sm"
            onClick={() => setShowImport(true)}
          >
            <Camera size={15} /> Import
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew()}>
            <Plus size={15} /> Neu
          </button>
        </div>
      </div>
```

Ergänze vor dem schließenden `</div>` des Grid-Zweigs (neben `{modal}`):

```tsx
      {showImport && <ImportFlow onClose={() => setShowImport(false)} onSaved={load} />}
```

- [ ] **Step 4: Verify tests, types and lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: PASS, keine Fehler

- [ ] **Step 5: Verify with the real lab report**

Bitte den Nutzer um sein Laborbefund-Foto. Im Dev-Server:
1. „Import" → „Datei" → Befund wählen.
2. Prüfe: Ladeanzeige erscheint, Review-Screen zeigt erkannte Werte mit Datum und Labor.
3. Vergleiche stichprobenartig 5 Werte mit dem Original — Wert, Einheit und Referenzbereich müssen stimmen.
4. Zeile abwählen, einen Wert korrigieren, „übernehmen".
5. Prüfe: Werte erscheinen im Grid, bekannte Marker mit Kategorie, unbekannte unter „Sonstige".
6. Prüfe in der Detailansicht: Bei importierten Werten steht am Referenzbalken „(Labor)".

Berichte dem Nutzer die Trefferquote. Bei systematischen Fehlern: `buildPrompt` in `supabase/functions/bloodwork-extract/prompt.ts` nachschärfen, neu deployen, erneut testen.

- [ ] **Step 6: Commit**

```bash
git add src/features/blutwerte
git commit -m "feat(blutwerte): add lab report import flow with review step"
```

---

### Task 14: Befund-Ansicht

**Files:**
- Create: `src/features/blutwerte/components/BefundListe.tsx`
- Modify: `src/features/blutwerte/BlutwertePage.tsx`

- [ ] **Step 1: Create the report list**

Create `src/features/blutwerte/components/BefundListe.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { effectiveRange, isInRange, toNumber } from '../lib/bloodwork'
import { normalizeMarker } from '../lib/markerCatalog'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { MUTED, PANEL_STYLE, RED, TEXT } from '../styles'

interface Props {
  reports: BloodworkReport[]
  entries: BloodworkEntry[]
}

export function BefundListe({ reports, entries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  const byReport = useMemo(() => {
    const map = new Map<string, BloodworkEntry[]>()
    entries.forEach(entry => {
      if (!entry.report_id) return
      const list = map.get(entry.report_id) ?? []
      list.push(entry)
      map.set(entry.report_id, list)
    })
    return map
  }, [entries])

  const auffaelligCount = (list: BloodworkEntry[]) =>
    list.filter(entry => {
      const def = normalizeMarker(entry.marker)
      return isInRange(toNumber(entry.value), effectiveRange(entry, def)) === false
    }).length

  if (reports.length === 0) {
    return (
      <div className="p-8 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
        Noch keine Befunde. Importiere einen Laborbefund, um alle Werte eines Termins zusammen zu sehen.
      </div>
    )
  }

  const open = openId ? reports.find(r => r.id === openId) : undefined

  if (open) {
    const list = (byReport.get(open.id) ?? []).slice().sort((a, b) => a.marker.localeCompare(b.marker, 'de'))
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <button className="p-2 -ml-2" style={{ color: MUTED }} onClick={() => setOpenId(null)} aria-label="Zurück">
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="font-bold" style={{ color: TEXT }}>{formatDisplayDate(open.tested_at)}</p>
            {open.lab_name && <p className="text-xs" style={{ color: MUTED }}>{open.lab_name}</p>}
          </div>
        </div>

        <div style={PANEL_STYLE}>
          {list.map((entry, i) => {
            const def = normalizeMarker(entry.marker)
            const range = effectiveRange(entry, def)
            const inRange = isInRange(toNumber(entry.value), range)
            const referenz = formatRange(range.min, range.max, entry.unit)
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-5 py-3"
                style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>{entry.marker}</p>
                  {referenz && <p className="text-xs mt-0.5" style={{ color: MUTED }}>Referenz: {referenz}</p>}
                </div>
                <span className="text-sm font-bold" style={{ color: inRange === false ? RED : TEXT }}>
                  {formatNumber(entry.value)}{' '}
                  <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={PANEL_STYLE}>
      {reports.map((report, i) => {
        const list = byReport.get(report.id) ?? []
        const auffaellig = auffaelligCount(list)
        return (
          <button
            key={report.id}
            onClick={() => setOpenId(report.id)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{formatDisplayDate(report.tested_at)}</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                {report.lab_name ? `${report.lab_name} · ` : ''}
                {list.length} {list.length === 1 ? 'Wert' : 'Werte'}
                {auffaellig > 0 && <span style={{ color: RED }}> · {auffaellig} auffällig</span>}
              </p>
            </div>
            <ChevronRight size={16} style={{ color: MUTED }} />
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Load reports and add the view switcher**

In `src/features/blutwerte/BlutwertePage.tsx`:

Ergänze die Imports:

```tsx
import type { BloodworkEntry, BloodworkReport } from './types'
import { BefundListe } from './components/BefundListe'
```

Ergänze den State:

```tsx
const [reports, setReports] = useState<BloodworkReport[]>([])
const [view, setView] = useState<'marker' | 'befunde'>('marker')
```

Erweitere `load` — ersetze den Body der `useCallback`:

```tsx
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [entriesResult, reportsResult] = await Promise.all([
      supabase
        .from('bloodwork')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false })
        .order('marker', { ascending: true }),
      supabase
        .from('bloodwork_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false }),
    ])

    if (entriesResult.error) toast.error('Blutwerte konnten nicht geladen werden')
    else setEntries((entriesResult.data ?? []) as BloodworkEntry[])

    if (!reportsResult.error) setReports((reportsResult.data ?? []) as BloodworkReport[])

    setLoading(false)
  }, [user])
```

Füge im Grid-Zweig direkt nach dem Mini-Stats-Panel den Umschalter ein:

```tsx
      <div className="flex gap-2 mb-4">
        {([['marker', 'Marker'], ['befunde', 'Befunde']] as ['marker' | 'befunde', string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
              style={
                view === key
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {label}
            </button>
          ),
        )}
      </div>
```

Ergänze den `CYAN`-Import aus `./styles`.

Ersetze den Inhalt nach dem Umschalter (den bisherigen `loading ? ... : (...)`-Block):

```tsx
      {loading ? (
        <div className="p-10 text-center" style={{ ...PANEL_STYLE, color: MUTED }}>
          Blutwerte werden geladen...
        </div>
      ) : view === 'befunde' ? (
        <BefundListe reports={reports} entries={entries} />
      ) : (
        <>
          <AuffaelligeWerte summaries={auffaellig} onSelect={setSelectedMarker} />
          <GridControls
            kategorie={kategorie}
            sortMode={sortMode}
            showSonstige={showSonstige}
            onKategorie={setKategorie}
            onSortMode={setSortMode}
          />
          <MarkerGrid
            summaries={visibleSummaries}
            grouped={sortMode === 'kategorie' && kategorie === null}
            onSelect={setSelectedMarker}
          />
          <p className="text-xs text-center mt-5" style={{ color: MUTED }}>{DISCLAIMER}</p>
        </>
      )}
```

- [ ] **Step 3: Verify tests, types and lint**

Run: `npm test && npx tsc -b && npm run lint`
Expected: PASS, keine Fehler

- [ ] **Step 4: Verify in the browser**

Umschalter „Marker" ↔ „Befunde" funktioniert. Nach dem Import aus Task 13 erscheint der Befund mit Datum, Labor, Anzahl Werte und Auffälligkeits-Zähler; Klick öffnet alle Werte des Termins. Ohne Befunde erscheint der Leerzustand. Screenshot für den Nutzer.

- [ ] **Step 5: Commit**

```bash
git add src/features/blutwerte
git commit -m "feat(blutwerte): add report view grouping values by lab visit"
```

---

### Task 15: Abschluss-Verifikation

**Files:**
- Create/Modify: `.claude/launch.json` (falls noch nicht vorhanden)

- [ ] **Step 1: Ensure the dev server config exists**

Falls `.claude/launch.json` fehlt, create it:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "peptid-tracker",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

(Port prüfen: `vite.config.ts` bzw. Ausgabe von `npm run dev`.)

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS, alle Tests

Run: `npx tsc -b`
Expected: kein Fehler

Run: `npm run lint`
Expected: keine neuen Fehler

Run: `npm run build`
Expected: Build erfolgreich

- [ ] **Step 3: Full manual pass in the browser**

Starte den Dev-Server über `preview_start` und gehe durch:
1. Grid lädt, Kategorie-Chips filtern, alle vier Sortiermodi ändern die Reihenfolge.
2. Auffällige-Werte-Sektion erscheint nur bei Werten außerhalb der Referenz.
3. Detailansicht: Erklärung, Referenzbalken, Chart mit Referenz-Zone, Disclaimer.
4. Manuelles Anlegen und Löschen funktionieren unverändert.
5. Import mit dem echten Befund: Review, Korrektur, Übernahme.
6. Befund-Ansicht zeigt den Import.
7. `resize_window` auf `mobile` (375×812): Chips scrollen horizontal, Grid und Review-Tabelle bleiben bedienbar, kein horizontaler Seiten-Scroll.
8. `read_console_messages`: keine Fehler.

- [ ] **Step 4: Update the knowledge graph**

Run: `graphify update .`
Expected: Graph aktualisiert (AST-only, keine API-Kosten)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(blutwerte): verify feature and update knowledge graph"
```

---

## Rollout-Reihenfolge

Nach jedem Task ist die App lauffähig. Nutzerwert entsteht schon vor dem Import:

1. Tasks 1–3: Fundament (Katalog, Typen, Berechnungen) — keine sichtbare Änderung.
2. Task 4: Migration (Nutzer-Aktion).
3. Task 5: Refactor, Verhalten unverändert, aber ~60 statt 15 Marker.
4. Tasks 6–7: **Ziel 3** (Filter/Sortierung) + Auffällige Werte.
5. Tasks 8–9: **Ziel 2** (Erklärungen + Referenzbereich).
6. Tasks 10–13: **Ziel 1** (KI-Import) — Task 12 braucht den API-Key (Nutzer-Aktion).
7. Task 14: Befund-Ansicht.
8. Task 15: Abschluss.
