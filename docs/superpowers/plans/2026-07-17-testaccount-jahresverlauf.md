# Testaccount-Jahresverlauf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen deterministischen täglichen Jahresverlauf erzeugen, ausschließlich im freigegebenen Testaccount speichern und anschließend direkt in Supabase verifizieren.

**Architecture:** Eine reine Generatorfunktion erzeugt die 366 Tageswerte und wird unabhängig von Supabase getestet. Ein kleiner Seeder authentifiziert den Testaccount, ersetzt nur die beiden freigegebenen Tabellen im Jahresfenster und liest die gespeicherten Daten zur Kontrolle wieder ein.

**Tech Stack:** TypeScript, date-fns, Vitest, Supabase JS

## Global Constraints

- Zeitraum exakt 17.07.2025 bis einschließlich 17.07.2026.
- Andere Tabellen und Zeiträume bleiben unverändert.
- Zugangsdaten werden nur über Umgebungsvariablen übergeben und nicht ausgegeben.
- Gewicht endet exakt bei 88,0 kg; tägliche Einträge sind deterministisch.

---

### Task 1: Deterministischen Verlauf erzeugen

**Files:**
- Create: `scripts/progress-year-data.test.ts`
- Create: `scripts/progress-year-data.ts`

**Interfaces:**
- Produces: `generateProgressYear({ userId, startDate, endDate }): { dailyRows, weightRows }`

- [ ] **Step 1: Failing tests schreiben**

Tests fordern 366 eindeutige Tage, exakte Endpunkte, gültige Wertebereiche, Determinismus und verbesserte 30-Tage-Durchschnitte.

- [ ] **Step 2: RED verifizieren**

Run: `npm test -- scripts/progress-year-data.test.ts`
Expected: FAIL, weil `progress-year-data.ts` noch nicht existiert.

- [ ] **Step 3: Minimalen Generator implementieren**

Die Generatorfunktion nutzt einen geglätteten Trend, periodische kleine Schwankungen und Rundung gemäß Datenbankschema.

- [ ] **Step 4: GREEN verifizieren**

Run: `npm test -- scripts/progress-year-data.test.ts`
Expected: alle Tests PASS.

### Task 2: Testaccount ersetzen und verifizieren

**Files:**
- Create: `scripts/seed-progress-year.ts`

**Interfaces:**
- Consumes: `generateProgressYear`

- [ ] **Step 1: Seeder mit harter Bereichsvalidierung implementieren**

Der Seeder verlangt E-Mail und Passwort aus Umgebungsvariablen, prüft die erzeugten 366 Zeilen, upsertet `daily_logs`, ersetzt `weight_logs` im Fenster und gibt nur aggregierte Prüfergebnisse aus.

- [ ] **Step 2: TypeScript/Test-Verifikation ausführen**

Run: `npm test -- scripts/progress-year-data.test.ts`
Expected: alle Tests PASS.

- [ ] **Step 3: Seeder einmal ausführen**

Run: Zugangsdaten aus der bestehenden lokalen Testkonfiguration in Umgebungsvariablen laden und `npx tsx scripts/seed-progress-year.ts` ausführen.
Expected: 366 vollständige Tageslogs, 366 eindeutige Gewichtstage, Gewicht 115,0 → 88,0 kg.

- [ ] **Step 4: Daten erneut nur lesend verifizieren**

Die Prüfung bestätigt Anzahl, Datumsgrenzen, Endpunkte, Wertebereiche und Trendrichtung aus frisch geladenen Supabase-Zeilen.

