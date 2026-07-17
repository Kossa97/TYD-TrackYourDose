# Adaptives Fortschritt-Fotos-Raster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (preferred) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Fortschritt-Fotos-Karte zeigt vorhandene Fotos ohne künstliche Leerslots, behält ihre feste Kartenhöhe und markiert Fotos außerhalb des ausgewählten Zeitraums.

**Architecture:** `photoPreview.ts` liefert höchstens sechs sortierte Slots mit einem `inRange`-Status und berechnet die Spaltenzahl. `FotosCard` nutzt diese Slots, füllt den verfügbaren Karteninnenraum und rendert den Zeitraum-Hinweis. Die vollständige Fotos-Ansicht und ihre persistente Rasterwahl bleiben unabhängig.

**Tech Stack:** React, TypeScript, Vitest, Inline-CSS.

## Global Constraints

- Zeitraum-Fotos zuerst, externe Fotos danach.
- Höchstens sechs Vorschau-Fotos.
- 1 Foto → 1 Spalte; 2–4 Fotos → 2 Spalten; 5–6 Fotos → 3 Spalten.
- Keine Plus-Leerslots bei vorhandenen Fotos.
- Kartenhöhe bleibt durch das bestehende Stretch-Layout unverändert.

---

### Task 1: Adaptive Vorschau-Slots testen und implementieren

**Files:**
- Modify: `src/features/fortschritt/lib/photoPreview.ts`
- Test: `src/features/fortschritt/lib/photoPreview.test.ts`

**Interfaces:**
- Produces `PhotoPreviewSlot`, `buildPhotoSlots(inRange, allPhotos, limit?)`, and `photoPreviewColumns(count)`.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run the focused test and verify it fails**
- [x] **Step 3: Implement the minimal helper**
- [x] **Step 4: Run the focused test and verify it passes**

### Task 2: Adaptive Slots in der Fortschritt-Karte rendern

**Files:**
- Modify: `src/features/fortschritt/components/fotos/FotosCard.tsx`

**Interfaces:**
- Consumes the helper API from Task 1.
- Renders actual period photos, blurred outside-period photos with an overlay, and a single add action only when no photos exist.

- [x] **Step 1: Combine period and outside-period photos**
- [x] **Step 2: Calculate columns and rows from visible slot count**
- [x] **Step 3: Fill the stretched card interior without changing card height**
- [x] **Step 4: Run tests, build, and `git diff --check`**