# Visible Chart Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Chart-Linie und anschließend ihre Punkte ausschließlich im aktuellen Sichtfenster animieren und die Sequenz beim Metrikwechsel sauber neu starten.

**Architecture:** `MetricChart.tsx` erzeugt eine strikt gefilterte Animationsserie aus `viewStart` und `viewEnd`. Der bestehende CSS-Reveal bleibt zuständig für Linie und Punkte; ein Layout-Effekt setzt die Animationsphase vor dem Paint beim Metrikwechsel zurück.

**Tech Stack:** React, TypeScript, Recharts, Vitest, CSS-Keyframes

## Global Constraints

- Standardmetrik: `weight`.
- Standardfenster: `3m`.
- Keine erneute Animation beim Wischen.
- Zyklusbalken beim Metrikwechsel nicht erneut animieren.
- `prefers-reduced-motion` respektieren.

---

### Task 1: Sichtfenster und Neustart absichern

**Files:**
- Modify: `src/features/fortschritt/components/verlauf/chartAnimation.test.ts`
- Modify: `src/features/fortschritt/components/verlauf/MetricChart.tsx`

**Interfaces:**
- Consumes: `viewStart`, `viewEnd`, `metricKey`, `lineData`.
- Produces: `animationLineData` als strikt sichtbare, chronologisch sortierte Animationsserie.

- [ ] **Step 1: Failing Tests schreiben**

Die Tests verlangen einen strikten Sichtfensterfilter, einen konstanten Punkt-Delay und einen Layout-Effekt für den Neustart.

- [ ] **Step 2: RED prüfen**

Run: `npm test -- src/features/fortschritt/components/verlauf/chartAnimation.test.ts`

Expected: FAIL, weil `animationLineData` und `useLayoutEffect` noch fehlen.

- [ ] **Step 3: Minimale Implementierung schreiben**

`animationLineData` filtert `lineData` mit `point.ts >= viewStart && point.ts <= viewEnd`. Der Metrik-Effekt verwendet `useLayoutEffect`; Recharts erhält die gefilterte Serie.

- [ ] **Step 4: GREEN prüfen**

Run: `npm test -- src/features/fortschritt/components/verlauf/chartAnimation.test.ts`

Expected: PASS.

### Task 2: Verhalten vollständig verifizieren

**Files:**
- Verify: `src/features/fortschritt/components/verlauf/MetricChart.tsx`

**Interfaces:**
- Consumes: gerenderte SVG-Punkte und CSS-Animationswerte.
- Produces: Messnachweis für Linie → Punkte, links → rechts und konstante Staffelung.

- [ ] **Step 1: Browsermessung durchführen**

Prüfen: streng steigende `cx`-Werte, Delay-Differenz `110ms`, Punktstart erst nach `900ms`, Wiederholung nach Metrikwechsel.

- [ ] **Step 2: Gesamttests und Build ausführen**

Run: `npm test`

Run: `npm run build`

Expected: beide Befehle mit Exitcode 0.
