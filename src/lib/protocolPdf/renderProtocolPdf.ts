// Nativer jsPDF-Renderer für das Protokoll-PDF (helles, druckfertiges A4-Dokument).
// Nur WinAnsi-sichere Zeichen verwenden (Helvetica) — KEIN Δ, ✓, →, ≈, ↑/↓.
// Für Deltas +/- mit Zahl schreiben.

import type { jsPDF } from 'jspdf'
import type {
  ProtocolData, PdfBuildOptions, PdfLang, PdfCycle, SectionId,
} from './types'
import { SECTIONS, visibleSections, resolveSubject } from './sections'

type RGB = [number, number, number]

const INK: RGB = [15, 23, 42]
const MUTED: RGB = [100, 116, 139]
const FAINT: RGB = [148, 163, 184]
const RULE: RGB = [226, 232, 240]
const ACCENT: RGB = [8, 145, 178]
const HEAD_FILL: RGB = [236, 254, 255]
const ZEBRA: RGB = [248, 250, 252]
const GOOD: RGB = [22, 163, 74]
const BAD: RGB = [220, 38, 38]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2
const TOP_Y = 24        // Start-Y auf Inhaltsseiten (unter Running Header)
const BOTTOM_Y = 282    // Fußzeile beginnt hier

// ─── Copy ─────────────────────────────────────────────────────────────────

interface Copy {
  docTitle: string
  brand: string
  subject: string
  period: string
  createdAt: string
  contents: string
  sectionTitles: Record<SectionId, string>
  age: string; gender: string; height: string; weight: string; years: string
  kpiAdherence: string; kpiWeight: string; kpiCycles: string; kpiDays: string
  cyclesHead: [string, string, string, string, string]
  statusActive: string; statusDone: string
  adherenceIntro: string; taken: string; skipped: string
  bloodMarker: string; bloodUnit: string; bloodRange: string; bloodFirst: string; bloodLast: string; bloodChange: string
  weightStart: string; weightEnd: string; weightChange: string; kg: string
  wellnessEnergy: string; wellnessSleep: string; wellnessLibido: string; scale: string
  effectType: string; effectDesc: string; effectSeverity: string; effectDate: string; effect: string; sideEffect: string
  reviewPeptide: string; reviewRating: string; reviewExperience: string
  expGood: string; expMedium: string; expBad: string
  notesEmpty: string
  disclaimerTitle: string; disclaimer: string
  noData: string
  footer: string
}

const COPY: Record<PdfLang, Copy> = {
  de: {
    docTitle: 'Peptid-Protokoll',
    brand: 'TRACK YOUR DOSE',
    subject: 'Betreff',
    period: 'Zeitraum',
    createdAt: 'Erstellt am',
    contents: 'Inhalt',
    sectionTitles: {
      personal: 'Persönliche Angaben', summary: 'Zusammenfassung', cycles: 'Protokoll / Zyklen',
      adherence: 'Einnahmetreue', bloodwork: 'Blutwerte', weight: 'Gewichtsverlauf',
      wellness: 'Wohlbefinden', effects: 'Wirkungen & Nebenwirkungen', reviews: 'Bewertungen',
      notes: 'Notizen / Fragen',
    },
    age: 'Alter', gender: 'Geschlecht', height: 'Größe', weight: 'Gewicht', years: 'Jahre',
    kpiAdherence: 'Einnahmetreue', kpiWeight: 'Gewicht (Veränd.)', kpiCycles: 'Aktive Zyklen', kpiDays: 'Zeitraum',
    cyclesHead: ['Peptid', 'Dosis', 'Methode', 'Frequenz', 'Zeitraum'],
    statusActive: 'aktiv', statusDone: 'beendet',
    adherenceIntro: 'Anteil bestätigter Einnahmen im Zeitraum, je Peptid.',
    taken: 'genommen', skipped: 'ausgelassen',
    bloodMarker: 'Marker', bloodUnit: 'Einheit', bloodRange: 'Normbereich',
    bloodFirst: 'Erst', bloodLast: 'Letzt', bloodChange: 'Veränd.',
    weightStart: 'Start', weightEnd: 'Ende', weightChange: 'Veränderung', kg: 'kg',
    wellnessEnergy: 'Energie', wellnessSleep: 'Schlaf', wellnessLibido: 'Libido', scale: 'Skala 1–10',
    effectType: 'Typ', effectDesc: 'Beschreibung', effectSeverity: 'Stärke', effectDate: 'Datum',
    effect: 'Wirkung', sideEffect: 'Nebenwirkung',
    reviewPeptide: 'Peptid', reviewRating: 'Bewertung', reviewExperience: 'Erfahrung',
    expGood: 'Gut', expMedium: 'Mittel', expBad: 'Schlecht',
    notesEmpty: '(keine Notiz eingetragen)',
    disclaimerTitle: 'Hinweis',
    disclaimer: 'Dieses Dokument dient ausschließlich der persönlichen Dokumentation und Forschung. Es ist kein medizinischer Rat, keine Diagnose und keine Therapieempfehlung. Angaben werden vom Nutzer selbst erfasst. Konsultiere vor Entscheidungen eine medizinische Fachperson.',
    noData: 'Keine Daten im gewählten Zeitraum.',
    footer: 'Erstellt mit TYD – Track Your Dose',
  },
  en: {
    docTitle: 'Peptide Protocol',
    brand: 'TRACK YOUR DOSE',
    subject: 'Subject',
    period: 'Period',
    createdAt: 'Created',
    contents: 'Contents',
    sectionTitles: {
      personal: 'Personal details', summary: 'Summary', cycles: 'Protocol / cycles',
      adherence: 'Adherence', bloodwork: 'Bloodwork', weight: 'Weight trend',
      wellness: 'Well-being', effects: 'Effects & side effects', reviews: 'Ratings',
      notes: 'Notes / questions',
    },
    age: 'Age', gender: 'Gender', height: 'Height', weight: 'Weight', years: 'years',
    kpiAdherence: 'Adherence', kpiWeight: 'Weight (change)', kpiCycles: 'Active cycles', kpiDays: 'Period',
    cyclesHead: ['Peptide', 'Dose', 'Route', 'Frequency', 'Period'],
    statusActive: 'active', statusDone: 'completed',
    adherenceIntro: 'Share of confirmed doses in the period, per peptide.',
    taken: 'taken', skipped: 'skipped',
    bloodMarker: 'Marker', bloodUnit: 'Unit', bloodRange: 'Normal range',
    bloodFirst: 'First', bloodLast: 'Last', bloodChange: 'Change',
    weightStart: 'Start', weightEnd: 'End', weightChange: 'Change', kg: 'kg',
    wellnessEnergy: 'Energy', wellnessSleep: 'Sleep', wellnessLibido: 'Libido', scale: 'Scale 1–10',
    effectType: 'Type', effectDesc: 'Description', effectSeverity: 'Severity', effectDate: 'Date',
    effect: 'Effect', sideEffect: 'Side effect',
    reviewPeptide: 'Peptide', reviewRating: 'Rating', reviewExperience: 'Experience',
    expGood: 'Good', expMedium: 'Medium', expBad: 'Poor',
    notesEmpty: '(no note entered)',
    disclaimerTitle: 'Note',
    disclaimer: 'This document is for personal documentation and research only. It is not medical advice, diagnosis, or treatment recommendation. All data is self-reported by the user. Consult a medical professional before making decisions.',
    noData: 'No data in the selected period.',
    footer: 'Created with TYD – Track Your Dose',
  },
}

const FREQ_EN: Record<string, string> = {
  'Täglich': 'Daily', '2x täglich': '2x daily', '3x täglich': '3x daily',
  'Jeden 2. Tag': 'Every 2nd day', 'Alle X Tage': 'Every X days',
  '5 Tage an / 2 aus': '5 on / 2 off', 'Mo-Fr': 'Mon-Fri',
  'Wöchentlich': 'Weekly', 'Wochentage wählen': 'Selected weekdays',
}

const NORMAL_RANGES: Record<string, [number, number]> = {
  'IGF-1': [100, 300], 'Testosteron': [264, 916], 'Östradiol': [10, 40], 'SHBG': [10, 57],
  'LH': [1.5, 9.3], 'FSH': [1.5, 12.4], 'TSH': [0.4, 4.0], 'CRP': [0, 5.0],
  'Vitamin D': [30, 100], 'Ferritin': [30, 400], 'Hämoglobin': [13.5, 17.5],
  'Hematokrit': [40, 52], 'GH': [0, 3.0], 'Kortisol': [6, 23], 'Insulin': [2, 25],
}

// ─── Format-Helfer ──────────────────────────────────────────────────────────

function fmtDate(iso: string, lang: PdfLang): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium' }).format(d)
}

function fmtNum(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits
  return String(r)
}

function signed(n: number, digits = 1, suffix = ''): string {
  const s = fmtNum(Math.abs(n), digits)
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${s}${suffix}`
}

function freqLabel(freq: string | null, lang: PdfLang): string {
  if (!freq) return '–'
  return lang === 'en' ? (FREQ_EN[freq] ?? freq) : freq
}

function cyclePeriod(c: PdfCycle, lang: PdfLang): string {
  const from = fmtDate(c.start_date, lang)
  const to = c.end_date ? fmtDate(c.end_date, lang) : (lang === 'de' ? 'laufend' : 'ongoing')
  return `${from} – ${to}`
}

// ─── Render-Kontext ──────────────────────────────────────────────────────────

interface Ctx {
  doc: jsPDF
  y: number
  lang: PdfLang
  c: Copy
}

function setFill(doc: jsPDF, [r, g, b]: RGB) { doc.setFillColor(r, g, b) }
function setText(doc: jsPDF, [r, g, b]: RGB) { doc.setTextColor(r, g, b) }
function setDraw(doc: jsPDF, [r, g, b]: RGB) { doc.setDrawColor(r, g, b) }

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > BOTTOM_Y) {
    ctx.doc.addPage()
    ctx.y = TOP_Y
  }
}

function sectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 16)
  const { doc } = ctx
  ctx.y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setText(doc, INK)
  doc.text(title, MARGIN, ctx.y)
  ctx.y += 2.5
  setDraw(doc, ACCENT)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, ctx.y, MARGIN + 22, ctx.y)
  setDraw(doc, RULE)
  doc.setLineWidth(0.2)
  doc.line(MARGIN + 22, ctx.y, PAGE_W - MARGIN, ctx.y)
  ctx.y += 6
}

function bodyText(ctx: Ctx, text: string, opts: { size?: number; color?: RGB; gap?: number } = {}) {
  const { doc } = ctx
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(opts.size ?? 9.5)
  setText(doc, opts.color ?? MUTED)
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[]
  ensureSpace(ctx, lines.length * 4.6 + (opts.gap ?? 0))
  doc.text(lines, MARGIN, ctx.y)
  ctx.y += lines.length * 4.6 + (opts.gap ?? 2)
}

function finalYAfterTable(doc: jsPDF): number {
  // lastAutoTable wird von jspdf-autotable zur Laufzeit an das doc gehängt.
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? TOP_Y
}

// ─── Vektor-Charts ───────────────────────────────────────────────────────────

interface Series { name: string; color: RGB; points: { t: number; v: number }[] }

function drawLineChart(
  ctx: Ctx, series: Series[],
  opts: { height: number; yMin?: number; yMax?: number; legend?: boolean },
) {
  const { doc } = ctx
  const legendH = opts.legend ? 6 : 0
  const h = opts.height
  ensureSpace(ctx, h + legendH + 4)

  const x0 = MARGIN + 12
  const x1 = PAGE_W - MARGIN
  const yBot = ctx.y + h
  const plotW = x1 - x0

  const allV = series.flatMap(s => s.points.map(p => p.v))
  const allT = series.flatMap(s => s.points.map(p => p.t))
  if (allV.length === 0) { ctx.y += h + legendH; return }
  let vMin = opts.yMin ?? Math.min(...allV)
  let vMax = opts.yMax ?? Math.max(...allV)
  if (vMin === vMax) { vMin -= 1; vMax += 1 }
  const tMin = Math.min(...allT)
  const tMax = Math.max(...allT)
  const tSpan = tMax - tMin || 1

  const sx = (t: number) => x0 + ((t - tMin) / tSpan) * plotW
  const sy = (v: number) => yBot - ((v - vMin) / (vMax - vMin)) * h

  // Gridlines + Y-Ticks (3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (let i = 0; i <= 2; i++) {
    const v = vMin + ((vMax - vMin) * i) / 2
    const yy = sy(v)
    setDraw(doc, RULE); doc.setLineWidth(0.2)
    doc.line(x0, yy, x1, yy)
    setText(doc, FAINT)
    doc.text(fmtNum(v, Math.abs(vMax - vMin) < 5 ? 1 : 0), x0 - 2, yy + 1.5, { align: 'right' })
  }

  // Serien
  for (const s of series) {
    if (s.points.length === 0) continue
    setDraw(doc, s.color); doc.setLineWidth(1.1)
    const pts = [...s.points].sort((a, b) => a.t - b.t)
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx(pts[i - 1].t), sy(pts[i - 1].v), sx(pts[i].t), sy(pts[i].v))
    }
    setFill(doc, s.color)
    for (const p of pts) doc.circle(sx(p.t), sy(p.v), 0.8, 'F')
  }

  ctx.y = yBot + 3

  if (opts.legend) {
    let lx = x0
    doc.setFontSize(7.5)
    for (const s of series) {
      setFill(doc, s.color); doc.circle(lx + 1, ctx.y - 1, 1, 'F')
      setText(doc, MUTED)
      doc.text(s.name, lx + 3.5, ctx.y)
      lx += 4 + doc.getTextWidth(s.name) + 6
    }
    ctx.y += legendH
  }
}

function drawAdherenceBars(ctx: Ctx, rows: { label: string; pct: number; detail: string }[]) {
  const { doc } = ctx
  const rowH = 9
  for (const r of rows) {
    ensureSpace(ctx, rowH + 2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    setText(doc, INK)
    doc.text(r.label, MARGIN, ctx.y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    setText(doc, MUTED)
    doc.text(`${r.pct}%  ·  ${r.detail}`, PAGE_W - MARGIN, ctx.y, { align: 'right' })
    ctx.y += 2.5
    const barW = CONTENT_W
    setFill(doc, RULE)
    doc.roundedRect(MARGIN, ctx.y, barW, 2.4, 1.2, 1.2, 'F')
    const fillW = Math.max(0.1, (r.pct / 100) * barW)
    setFill(doc, r.pct >= 80 ? GOOD : r.pct >= 50 ? ACCENT : BAD)
    doc.roundedRect(MARGIN, ctx.y, fillW, 2.4, 1.2, 1.2, 'F')
    ctx.y += rowH - 2.5
  }
}

// ─── Deckblatt ───────────────────────────────────────────────────────────────

function coverPage(ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions, includedTitles: string[]) {
  const { doc, c, lang } = ctx

  // Akzentband oben
  setFill(doc, ACCENT)
  doc.rect(0, 0, PAGE_W, 3, 'F')

  // Wortmarke
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30)
  setText(doc, ACCENT)
  doc.text('TYD', MARGIN, 40)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  setText(doc, FAINT)
  doc.text(c.brand.split('').join(' '), MARGIN + 1, 46, { charSpace: 1.2 })

  // Titel
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26)
  setText(doc, INK)
  doc.text(c.docTitle, MARGIN, 92)

  // Info-Karte
  const includePersonal = opts.sections.includes('personal')
  const subject = resolveSubject(data, includePersonal, lang)
  const rows: [string, string][] = [
    [c.subject, subject],
    [c.period, `${fmtDate(opts.range.from, lang)} – ${fmtDate(opts.range.to, lang)}`],
    [c.createdAt, new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'long' }).format(new Date())],
  ]
  let cy = 104
  const cardH = rows.length * 11 + 8
  setDraw(doc, RULE); doc.setLineWidth(0.3)
  setFill(doc, [252, 253, 254])
  doc.roundedRect(MARGIN, cy, CONTENT_W, cardH, 2, 2, 'FD')
  cy += 9
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    setText(doc, FAINT)
    doc.text(label.toUpperCase(), MARGIN + 6, cy, { charSpace: 0.5 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    setText(doc, INK)
    doc.text(value, MARGIN + 46, cy)
    cy += 11
  }

  // Inhaltsverzeichnis
  cy += 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  setText(doc, ACCENT)
  doc.text(c.contents.toUpperCase(), MARGIN, cy, { charSpace: 0.8 })
  cy += 3
  setDraw(doc, RULE); doc.setLineWidth(0.2)
  doc.line(MARGIN, cy, PAGE_W - MARGIN, cy)
  cy += 7
  doc.setFontSize(10.5)
  includedTitles.forEach((title, i) => {
    doc.setFont('helvetica', 'normal')
    setText(doc, MUTED)
    doc.text(String(i + 1).padStart(2, '0'), MARGIN, cy)
    setText(doc, INK)
    doc.text(title, MARGIN + 10, cy)
    cy += 7
  })
}

// ─── Sektions-Renderer ───────────────────────────────────────────────────────

function renderPersonal(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const p = data.profile
  if (!p) { bodyText(ctx, c.noData); return }
  const rows: [string, string][] = []
  const name = p.display_name?.trim() || p.username?.trim()
  if (name) rows.push([lang === 'de' ? 'Name' : 'Name', name])
  if (p.age != null) rows.push([c.age, `${p.age} ${c.years}`])
  if (p.gender) rows.push([c.gender, p.gender])
  if (p.height_cm != null) rows.push([c.height, `${p.height_cm} cm`])
  if (p.weight_kg != null) rows.push([c.weight, `${fmtNum(Number(p.weight_kg))} ${c.kg}`])
  if (rows.length === 0) { bodyText(ctx, c.noData); return }
  simpleKeyValueTable(ctx, rows)
}

function simpleKeyValueTable(ctx: Ctx, rows: [string, string][]) {
  autoTableSafe(ctx, {
    body: rows.map(([k, v]) => [k, v]),
    columnStyles: { 0: { cellWidth: 46, fontStyle: 'bold', textColor: MUTED }, 1: { textColor: INK } },
    theme: 'plain',
  })
}

function renderSummary(ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions) {
  const { doc, c, lang } = ctx
  const decided = data.doseLogs.filter(l => l.taken != null)
  const takenN = decided.filter(l => l.taken).length
  const adherence = decided.length > 0 ? Math.round((takenN / decided.length) * 100) : null

  const weights = [...data.weightLogs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const wDelta = weights.length >= 2 ? weights[weights.length - 1].weight_kg - weights[0].weight_kg : null
  const activeN = data.cycles.filter(x => x.active).length
  const days = Math.max(1, Math.round(
    (new Date(opts.range.to).getTime() - new Date(opts.range.from).getTime()) / 86400000) + 1)

  const cards: { label: string; value: string }[] = [
    { label: c.kpiAdherence, value: adherence != null ? `${adherence}%` : '–' },
    { label: c.kpiWeight, value: wDelta != null ? signed(wDelta, 1, ` ${c.kg}`) : '–' },
    { label: c.kpiCycles, value: String(activeN) },
    { label: c.kpiDays, value: `${days} ${lang === 'de' ? 'Tage' : 'days'}` },
  ]

  const gap = 4
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length
  const cardH = 20
  ensureSpace(ctx, cardH + 4)
  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap)
    setDraw(doc, RULE); doc.setLineWidth(0.3)
    setFill(doc, [252, 253, 254])
    doc.roundedRect(x, ctx.y, cardW, cardH, 2, 2, 'FD')
    setFill(doc, ACCENT)
    doc.rect(x, ctx.y, cardW, 1, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    setText(doc, FAINT)
    doc.text(card.label.toUpperCase(), x + 4, ctx.y + 7, { charSpace: 0.3, maxWidth: cardW - 8 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    setText(doc, INK)
    doc.text(card.value, x + 4, ctx.y + 16)
  })
  ctx.y += cardH + 6
}

function renderCycles(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const body = data.cycles.map(cy => {
    const name = cy.peptide_name || cy.name
    const status = cy.active ? c.statusActive : c.statusDone
    const dose = cy.dose != null ? `${fmtNum(cy.dose, 2)} ${cy.unit ?? ''}`.trim() : '–'
    return [
      `${name}\n(${status})`,
      dose,
      cy.method || '–',
      freqLabel(cy.frequency, lang),
      cyclePeriod(cy, lang),
    ]
  })
  autoTableSafe(ctx, {
    head: [c.cyclesHead as unknown as string[]],
    body,
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 28 },
      3: { cellWidth: 34 },
    },
  })
}

function renderAdherence(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  bodyText(ctx, c.adherenceIntro, { gap: 3 })
  const byPep = new Map<string, { taken: number; total: number }>()
  for (const l of data.doseLogs) {
    if (l.taken == null) continue
    const key = l.peptide_id ?? '—'
    const e = byPep.get(key) ?? { taken: 0, total: 0 }
    e.total += 1; if (l.taken) e.taken += 1
    byPep.set(key, e)
  }
  const rows = [...byPep.entries()]
    .map(([pid, e]) => ({
      label: data.peptideNames.get(pid) ?? (ctx.lang === 'de' ? 'Unbekannt' : 'Unknown'),
      pct: Math.round((e.taken / e.total) * 100),
      detail: `${e.taken}/${e.total} ${c.taken}`,
    }))
    .sort((a, b) => b.pct - a.pct)
  if (rows.length === 0) { bodyText(ctx, c.noData); return }
  drawAdherenceBars(ctx, rows)
}

function renderBloodwork(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const markers = Array.from(new Set(data.bloodwork.map(b => b.marker))).sort()
  const body = markers.map(m => {
    const entries = data.bloodwork
      .filter(b => b.marker === m)
      .map(b => ({ date: b.tested_at, value: Number(b.value), unit: b.unit }))
      .filter(e => Number.isFinite(e.value))
      .sort((a, b) => a.date.localeCompare(b.date))
    const unit = entries.find(e => e.unit)?.unit ?? ''
    const range = NORMAL_RANGES[m]
    const first = entries[0]?.value
    const last = entries[entries.length - 1]?.value
    const change = first != null && last != null && entries.length >= 2 ? last - first : null
    return [
      m,
      unit || '–',
      range ? `${range[0]}–${range[1]}` : '–',
      first != null ? fmtNum(first, 2) : '–',
      last != null ? fmtNum(last, 2) : '–',
      change != null ? signed(change, 2) : '–',
    ]
  })
  autoTableSafe(ctx, {
    head: [[c.bloodMarker, c.bloodUnit, c.bloodRange, c.bloodFirst, c.bloodLast, c.bloodChange]],
    body,
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 30 },
    },
  })
  void lang
}

function renderWeight(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  const pts = [...data.weightLogs]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map(w => ({ t: new Date(w.logged_at).getTime(), v: w.weight_kg }))
  if (pts.length === 0) { bodyText(ctx, c.noData); return }
  if (pts.length >= 2) {
    drawLineChart(ctx, [{ name: c.weight, color: ACCENT, points: pts }], { height: 42 })
  }
  const first = pts[0].v
  const last = pts[pts.length - 1].v
  const delta = last - first
  const summary = `${c.weightStart}: ${fmtNum(first)} ${c.kg}   ·   ${c.weightEnd}: ${fmtNum(last)} ${c.kg}   ·   ${c.weightChange}: ${signed(delta, 1, ' ' + c.kg)}`
  bodyText(ctx, summary, { color: INK, size: 9.5, gap: 2 })
}

function renderWellness(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  const build = (field: 'energie' | 'schlaf' | 'libido') =>
    data.dailyLogs
      .filter(l => l[field] != null)
      .map(l => ({ t: new Date(`${l.log_date}T00:00:00`).getTime(), v: l[field] as number }))
      .sort((a, b) => a.t - b.t)
  const series: Series[] = [
    { name: c.wellnessEnergy, color: [8, 145, 178] as RGB, points: build('energie') },
    { name: c.wellnessSleep, color: [99, 102, 241] as RGB, points: build('schlaf') },
    { name: c.wellnessLibido, color: [219, 39, 119] as RGB, points: build('libido') },
  ].filter(s => s.points.length > 0)
  if (series.length === 0) { bodyText(ctx, c.noData); return }
  bodyText(ctx, c.scale, { size: 8, gap: 1 })
  drawLineChart(ctx, series, { height: 42, yMin: 0, yMax: 10, legend: true })
}

function renderEffects(ctx: Ctx, data: ProtocolData) {
  const { c, lang } = ctx
  const body = data.effects.map(e => [
    e.type === 'effect' ? c.effect : c.sideEffect,
    e.peptide_name ? `${e.description}\n(${e.peptide_name})` : e.description,
    `${e.severity}/5`,
    fmtDate(e.occurred_at, lang),
  ])
  autoTableSafe(ctx, {
    head: [[c.effectType, c.effectDesc, c.effectSeverity, c.effectDate]],
    body,
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 32 },
    },
  })
}

function renderReviews(ctx: Ctx, data: ProtocolData) {
  const { c } = ctx
  const expLabel = (e: string | null) =>
    e === 'gut' ? c.expGood : e === 'mittel' ? c.expMedium : e === 'schlecht' ? c.expBad : '–'
  const body = data.reviews.map(r => [
    r.peptide_name ?? '–',
    `${'*'.repeat(Math.max(0, Math.min(5, r.rating)))}${'.'.repeat(5 - Math.max(0, Math.min(5, r.rating)))}  (${r.rating}/5)`,
    expLabel(r.experience),
  ])
  autoTableSafe(ctx, {
    head: [[c.reviewPeptide, c.reviewRating, c.reviewExperience]],
    body,
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { cellWidth: 46 } },
  })
}

function renderNotes(ctx: Ctx, opts: PdfBuildOptions) {
  const { c } = ctx
  const note = opts.note.trim()
  bodyText(ctx, note || c.notesEmpty, { color: note ? INK : FAINT, size: 10 })
}

// ─── autotable-Wrapper ───────────────────────────────────────────────────────

interface AutoTableOpts {
  head?: string[][]
  body: (string | number)[][]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnStyles?: Record<number, any>
  theme?: 'striped' | 'grid' | 'plain'
}

// autoTable wird zur Laufzeit injiziert (dynamischer Import in buildProtocolPdf).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let autoTableFn: any = null

function autoTableSafe(ctx: Ctx, o: AutoTableOpts) {
  const { doc } = ctx
  ensureSpace(ctx, 14)
  autoTableFn(doc, {
    startY: ctx.y,
    head: o.head,
    body: o.body,
    theme: o.theme ?? 'striped',
    margin: { left: MARGIN, right: MARGIN, bottom: PAGE_H - BOTTOM_Y },
    styles: {
      font: 'helvetica', fontSize: 9, cellPadding: 2.2,
      textColor: INK, lineColor: RULE, lineWidth: 0.1, overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEAD_FILL, textColor: ACCENT, fontStyle: 'bold', fontSize: 8.5,
      lineColor: RULE, lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: o.columnStyles,
  })
  ctx.y = finalYAfterTable(doc) + 6
}

// ─── Kopf-/Fußzeile (finaler Pass über alle Seiten) ──────────────────────────

function decoratePages(doc: jsPDF, c: Copy, subject: string) {
  const total = doc.getNumberOfPages()
  for (let p = 2; p <= total; p++) {
    doc.setPage(p)
    // Running Header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
    setText(doc, ACCENT)
    doc.text('TYD', MARGIN, 12)
    doc.setFont('helvetica', 'normal')
    setText(doc, FAINT)
    doc.text(c.docTitle, MARGIN + 8, 12)
    doc.text(subject, PAGE_W - MARGIN, 12, { align: 'right' })
    setDraw(doc, RULE); doc.setLineWidth(0.2)
    doc.line(MARGIN, 15, PAGE_W - MARGIN, 15)
    // Footer
    setDraw(doc, RULE); doc.setLineWidth(0.2)
    doc.line(MARGIN, 286, PAGE_W - MARGIN, 286)
    doc.setFontSize(7.5)
    setText(doc, FAINT)
    doc.text(c.footer, MARGIN, 291)
    doc.text(`${p} / ${total}`, PAGE_W - MARGIN, 291, { align: 'right' })
  }
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

const RENDERERS: Record<SectionId, (ctx: Ctx, data: ProtocolData, opts: PdfBuildOptions) => void> = {
  personal: (ctx, data) => renderPersonal(ctx, data),
  summary: (ctx, data, opts) => renderSummary(ctx, data, opts),
  cycles: (ctx, data) => renderCycles(ctx, data),
  adherence: (ctx, data) => renderAdherence(ctx, data),
  bloodwork: (ctx, data) => renderBloodwork(ctx, data),
  weight: (ctx, data) => renderWeight(ctx, data),
  wellness: (ctx, data) => renderWellness(ctx, data),
  effects: (ctx, data) => renderEffects(ctx, data),
  reviews: (ctx, data) => renderReviews(ctx, data),
  notes: (ctx, _data, opts) => renderNotes(ctx, opts),
}

export async function buildProtocolPdf(data: ProtocolData, opts: PdfBuildOptions): Promise<jsPDF> {
  const [{ jsPDF: JsPdf }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  autoTableFn = autoTableMod.default

  const doc = new JsPdf('p', 'mm', 'a4')
  const c = COPY[opts.lang]
  const ctx: Ctx = { doc, y: TOP_Y, lang: opts.lang, c }

  const shown = visibleSections(opts.sections, data)
  const titles = shown.map(id => c.sectionTitles[id])

  coverPage(ctx, data, opts, titles)

  // Inhaltsseiten
  doc.addPage()
  ctx.y = TOP_Y
  for (const id of shown) {
    const def = SECTIONS.find(s => s.id === id)!
    sectionTitle(ctx, c.sectionTitles[id])
    RENDERERS[id](ctx, data, opts)
    ctx.y += 4
    void def
  }

  // Disclaimer (immer)
  ensureSpace(ctx, 30)
  ctx.y += 2
  sectionTitle(ctx, c.disclaimerTitle)
  bodyText(ctx, c.disclaimer, { size: 8.5, color: MUTED })

  const includePersonal = opts.sections.includes('personal')
  decoratePages(doc, c, resolveSubject(data, includePersonal, opts.lang))

  return doc
}

export function pdfFileName(opts: PdfBuildOptions): string {
  return `TYD-${opts.lang === 'de' ? 'Protokoll' : 'Protocol'}-${opts.range.to}.pdf`
}

export async function downloadProtocolPdf(data: ProtocolData, opts: PdfBuildOptions): Promise<void> {
  const doc = await buildProtocolPdf(data, opts)
  doc.save(pdfFileName(opts))
}
