# Protokoll Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `src/pages/Protokoll.tsx` into a biohacking dashboard with KPI strip, dual charts (% normalized correlation view + small multiples with real units + normal ranges), preset system, and per-peptide adherence bars.

**Architecture:** Single file edit — `src/pages/Protokoll.tsx`. Add constants (NORMAL_RANGES, SERIES_COLORS, PRESETS), new state (`activeMarkers`, `selectedPreset`), new useMemo derivations (`kpiValues`, `normalizedChartData`, `smallMultiplesData`, `adherencePerPeptide`), new sub-components (KpiStrip, ChartControls, NormalizedChart, SmallMultiplesSection, AdherenceBars). Remove old single-marker bloodwork chart, old single-bar adherence chart, `selectedMarker` state.

**Tech Stack:** React 18, TypeScript, recharts (`ComposedChart`, `LineChart`, `Area`, `Line`, `ReferenceArea`, `ReferenceLine`, `ResponsiveContainer`, `Tooltip`, `YAxis`, `XAxis`, `CartesianGrid`, `Legend`) — all already installed.

---

## File Map

| File | Action |
|---|---|
| `src/pages/Protokoll.tsx` | Modify — all changes here |

---

### Task 1: Add constants and helper functions

**Files:**
- Modify: `src/pages/Protokoll.tsx` (top of file, after existing interfaces)

- [ ] **Step 1: Add NORMAL_RANGES, SERIES_COLORS, PRESETS, CYCLE_COLORS constants**

Add after the existing `COPY` constant (around line 184):

```typescript
// ─── Design constants ────────────────────────────────────────────────────────

const NORMAL_RANGES: Record<string, { min: number | null; max: number | null }> = {
  'IGF-1':       { min: 100,  max: 300  },
  'Testosteron': { min: 264,  max: 916  },
  'Östradiol':   { min: 10,   max: 40   },
  'SHBG':        { min: 10,   max: 57   },
  'LH':          { min: 1.5,  max: 9.3  },
  'FSH':         { min: 1.5,  max: 12.4 },
  'TSH':         { min: 0.4,  max: 4.0  },
  'CRP':         { min: 0,    max: 5.0  },
  'Vitamin D':   { min: 30,   max: 100  },
  'Ferritin':    { min: 30,   max: 400  },
  'Hämoglobin':  { min: 13.5, max: 17.5 },
  'Hematokrit':  { min: 40,   max: 52   },
  'GH':          { min: 0,    max: 3.0  },
  'Kortisol':    { min: 6,    max: 23   },
  'Insulin':     { min: 2,    max: 25   },
}

const SERIES_COLORS: Record<string, string> = {
  'Gewicht':     '#00ccf5',
  'IGF-1':       '#8b5cf6',
  'CRP':         '#10b981',
  'Testosteron': '#f59e0b',
  'Insulin':     '#f43f5e',
  'Vitamin D':   '#38bdf8',
  'Östradiol':   '#a78bfa',
  'TSH':         '#34d399',
  'Hämoglobin':  '#fb923c',
  'Hematokrit':  '#e879f9',
  'GH':          '#67e8f9',
  'Kortisol':    '#fde68a',
  'Ferritin':    '#86efac',
  'SHBG':        '#c084fc',
  'LH':          '#f472b6',
  'FSH':         '#94a3b8',
}

const PRESETS: { key: string; label: string; markers: string[] }[] = [
  { key: 'weight-igf1',  label: '⚖️ Gewicht + IGF-1',  markers: ['Gewicht', 'IGF-1'] },
  { key: 'gh-panel',     label: '💉 GH-Panel',          markers: ['Gewicht', 'IGF-1', 'Vitamin D'] },
  { key: 'inflammation', label: '🔥 Entzündung',        markers: ['Gewicht', 'CRP'] },
  { key: 'metabolismus', label: '🧬 Metabolismus',      markers: ['Gewicht', 'Insulin'] },
  { key: 'hormone',      label: '⚗️ Hormone',           markers: ['Testosteron', 'IGF-1', 'Insulin'] },
  { key: 'full',         label: '📊 Alle Marker',       markers: [] }, // populated dynamically
]

const CYCLE_COLORS = ['#00ccf5','#8b5cf6','#10b981','#f59e0b','#f43f5e','#38bdf8']
```

- [ ] **Step 2: Add helper functions**

Add immediately after the constants:

```typescript
function getSeriesColor(marker: string): string {
  return SERIES_COLORS[marker] ?? '#00ccf5'
}

function getNormalRange(marker: string): { min: number | null; max: number | null } {
  return NORMAL_RANGES[marker] ?? { min: null, max: null }
}

/** % change from first value. Returns null if no entries. */
function toPercentChange(entries: { date: string; value: number }[]): { date: string; pct: number }[] {
  if (entries.length === 0) return []
  const first = entries[0].value
  if (first === 0) return entries.map(e => ({ date: e.date, pct: 0 }))
  return entries.map(e => ({
    date: e.date,
    pct: Math.round(((e.value - first) / Math.abs(first)) * 1000) / 10,
  }))
}

/** Linear interpolation of pct value for a given date between two anchors. */
function interpolatePct(
  date: string,
  anchors: { date: string; pct: number }[],
): number | undefined {
  if (anchors.length === 0) return undefined
  if (date <= anchors[0].date) return anchors[0].pct
  if (date >= anchors[anchors.length - 1].date) return anchors[anchors.length - 1].pct
  for (let i = 0; i < anchors.length - 1; i++) {
    if (date >= anchors[i].date && date <= anchors[i + 1].date) {
      const t = (date.localeCompare(anchors[i].date)) / (anchors[i + 1].date.localeCompare(anchors[i].date))
      return Math.round((anchors[i].pct + t * (anchors[i + 1].pct - anchors[i].pct)) * 10) / 10
    }
  }
  return undefined
}
```

- [ ] **Step 3: Update recharts imports**

Replace the existing recharts import block with:

```typescript
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
```

Expected: no errors for Protokoll.tsx.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "refactor(protokoll): add design constants and helper functions"
```

---

### Task 2: New state + derived data

**Files:**
- Modify: `src/pages/Protokoll.tsx` — inside `Protokoll()` function body

- [ ] **Step 1: Add `activeMarkers` and `selectedPreset` state**

Inside `export function Protokoll()`, after the existing state declarations, add:

```typescript
const [activeMarkers, setActiveMarkers] = useState<string[]>(['Gewicht', 'IGF-1'])
const [selectedPreset, setSelectedPreset] = useState<string>('weight-igf1')
```

- [ ] **Step 2: Add `kpiValues` useMemo**

Add after `userName` useMemo:

```typescript
const kpiValues = useMemo(() => {
  // Adherence overall
  const logsWithValue = doseLogs.filter(l => l.taken != null)
  const takenCount = logsWithValue.filter(l => l.taken).length
  const adherencePct = logsWithValue.length > 0
    ? Math.round((takenCount / logsWithValue.length) * 100)
    : null

  // Weight delta
  const sortedWeights = [...weightLogs].sort((a, b) =>
    dateKey(a.logged_at).localeCompare(dateKey(b.logged_at)))
  const firstWeight = sortedWeights[0] ? numericValue(sortedWeights[0].weight_kg) : null
  const lastWeight  = sortedWeights[sortedWeights.length - 1]
    ? numericValue(sortedWeights[sortedWeights.length - 1].weight_kg) : null
  const weightDelta = firstWeight != null && lastWeight != null
    ? Math.round((lastWeight - firstWeight) * 10) / 10 : null

  // Helper: first/last value for a blood marker
  function markerDelta(marker: string) {
    const entries = bloodwork
      .filter(e => e.marker === marker)
      .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
      .filter((e): e is { date: string; value: number } => e.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (entries.length < 2) return null
    const first = entries[0].value
    if (first === 0) return null
    return Math.round(((entries[entries.length - 1].value - first) / Math.abs(first)) * 1000) / 10
  }

  return {
    adherencePct,
    weightDelta,
    igf1Delta: markerDelta('IGF-1'),
    crpDelta: markerDelta('CRP'),
  }
}, [doseLogs, weightLogs, bloodwork])
```

- [ ] **Step 3: Add `normalizedChartData` useMemo**

Add after `kpiValues`:

```typescript
/**
 * Builds data rows for the % Veränderung chart.
 * X-axis: all weekly weight dates + blood test dates, merged and sorted.
 * Each active marker is a column; bloodwork markers are null between tests,
 * recharts Line connectNulls=true draws straight lines between test points.
 */
const normalizedChartData = useMemo(() => {
  // Weight series (normalized)
  const weightSorted = [...weightLogs]
    .map(l => ({ date: dateKey(l.logged_at), value: numericValue(l.weight_kg) }))
    .filter((e): e is { date: string; value: number } => e.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const weightPcts = toPercentChange(weightSorted)

  // Bloodwork per marker (normalized)
  const bloodPcts = new Map<string, { date: string; pct: number }[]>()
  for (const marker of activeMarkers) {
    if (marker === 'Gewicht') continue
    const entries = bloodwork
      .filter(e => e.marker === marker)
      .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
      .filter((e): e is { date: string; value: number } => e.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    bloodPcts.set(marker, toPercentChange(entries))
  }

  // Collect all x-axis dates
  const allDates = new Set<string>()
  weightSorted.forEach(e => allDates.add(e.date))
  bloodPcts.forEach(arr => arr.forEach(p => allDates.add(p.date)))
  const sortedDates = Array.from(allDates).sort()

  // Build rows
  return sortedDates.map(date => {
    const row: Record<string, string | number | null> = {
      date,
      label: formatDate(date, language),
    }

    if (activeMarkers.includes('Gewicht')) {
      const match = weightPcts.find(p => p.date === date)
      row['Gewicht'] = match ? match.pct : interpolatePct(date, weightPcts) ?? null
    }

    for (const [marker, pcts] of bloodPcts) {
      const match = pcts.find(p => p.date === date)
      row[marker] = match ? match.pct : null // null = no measurement → connectNulls draws line
    }

    return row
  })
}, [activeMarkers, weightLogs, bloodwork, language])
```

- [ ] **Step 4: Add `smallMultiplesData` useMemo**

```typescript
interface SmallMultipleSeries {
  marker: string
  unit: string
  color: string
  normalMin: number | null
  normalMax: number | null
  yDomain: [number, number]
  data: { date: string; label: string; value: number | null }[]
  lastValue: number | null
  lastDate: string | null
}

const smallMultiplesData = useMemo((): SmallMultipleSeries[] => {
  return activeMarkers.map(marker => {
    const color = getSeriesColor(marker)
    const { min: normalMin, max: normalMax } = getNormalRange(marker)

    let data: { date: string; label: string; value: number | null }[]
    let unit = ''

    if (marker === 'Gewicht') {
      data = [...weightLogs]
        .sort((a, b) => dateKey(a.logged_at).localeCompare(dateKey(b.logged_at)))
        .map(l => ({
          date: dateKey(l.logged_at),
          label: formatDate(dateKey(l.logged_at), language),
          value: numericValue(l.weight_kg),
        }))
      unit = 'kg'
    } else {
      const entries = bloodwork
        .filter(e => e.marker === marker)
        .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
      unit = entries[0]?.unit ?? ''
      data = entries.map(e => ({
        date: e.tested_at,
        label: formatDate(e.tested_at, language),
        value: numericValue(e.value),
      }))
    }

    const numericValues = data.map(d => d.value).filter((v): v is number => v != null)
    const dataMin = numericValues.length > 0 ? Math.min(...numericValues) : 0
    const dataMax = numericValues.length > 0 ? Math.max(...numericValues) : 1
    const padding = (dataMax - dataMin) * 0.2 || dataMax * 0.2 || 1

    const yMin = normalMin != null ? Math.min(normalMin, dataMin - padding) : dataMin - padding
    const yMax = normalMax != null ? Math.max(normalMax, dataMax + padding) : dataMax + padding

    const lastEntry = [...data].reverse().find(d => d.value != null)

    return {
      marker,
      unit,
      color,
      normalMin,
      normalMax,
      yDomain: [Math.round(yMin * 10) / 10, Math.round(yMax * 10) / 10],
      data,
      lastValue: lastEntry?.value ?? null,
      lastDate: lastEntry?.date ?? null,
    }
  })
}, [activeMarkers, weightLogs, bloodwork, language])
```

- [ ] **Step 5: Add `adherencePerPeptide` useMemo**

```typescript
const adherencePerPeptide = useMemo(() => {
  // Map peptide_id → peptide name from activeCycles + completedCycles
  const nameMap = new Map<string, string>()
  ;[...activeCycles, ...completedCycles].forEach(c => {
    if (c.peptide_id && c.peptides?.name) nameMap.set(c.peptide_id, c.peptides.name)
  })

  const grouped = new Map<string, { taken: number; total: number; color: string }>()
  doseLogs.forEach((log, i) => {
    if (log.taken == null || !log.peptide_id) return
    const name = nameMap.get(log.peptide_id) ?? log.peptide_id
    const existing = grouped.get(name) ?? { taken: 0, total: 0, color: CYCLE_COLORS[i % CYCLE_COLORS.length] }
    existing.total++
    if (log.taken) existing.taken++
    grouped.set(name, existing)
  })

  return Array.from(grouped.entries())
    .map(([name, stats], i) => ({
      name,
      pct: Math.round((stats.taken / stats.total) * 100),
      color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }))
    .sort((a, b) => b.pct - a.pct)
}, [doseLogs, activeCycles, completedCycles])
```

- [ ] **Step 6: Add `availableMarkers` and `bloodTestDates` useMemo**

```typescript
// All markers present in the current range
const availableMarkers = useMemo(() => {
  const markers = Array.from(new Set(bloodwork.map(e => e.marker))).sort()
  return ['Gewicht', ...markers]
}, [bloodwork])

// Dates where blood tests were taken (for vertical event markers)
const bloodTestDates = useMemo(() => {
  return Array.from(new Set(bloodwork.map(e => e.tested_at))).sort()
}, [bloodwork])

// Cycle phase bands for background
const cycleBands = useMemo(() => {
  return [...activeCycles, ...completedCycles].map((c, i) => ({
    x1: c.start_date,
    x2: cycleEnd(c),
    name: c.peptides?.name ?? c.name,
    color: CYCLE_COLORS[i % CYCLE_COLORS.length],
  }))
}, [activeCycles, completedCycles])
```

- [ ] **Step 7: Verify compiles**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "refactor(protokoll): add new state, kpiValues, normalizedChartData, smallMultiplesData, adherencePerPeptide"
```

---

### Task 3: KpiStrip component

**Files:**
- Modify: `src/pages/Protokoll.tsx` — add sub-component before `Protokoll()`

- [ ] **Step 1: Add `KpiStrip` component**

Add before `export function Protokoll()`:

```typescript
function KpiCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(8,11,26,0.95)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '12px 14px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.7,
      }} />
      <p style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Render KpiStrip in Protokoll JSX**

In the JSX return, immediately after `<header>` block and before the `<section className="card">` (Zeitraum-Selektor), add:

```tsx
{/* ── KPI Strip ── */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
  <KpiCard
    label="Adherence"
    value={kpiValues.adherencePct != null ? `${kpiValues.adherencePct}%` : '—'}
    sub={kpiValues.adherencePct != null && kpiValues.adherencePct >= 80 ? '↑ gut' : undefined}
    color="#10b981"
  />
  <KpiCard
    label="Gewicht Δ"
    value={kpiValues.weightDelta != null
      ? `${kpiValues.weightDelta > 0 ? '+' : ''}${formatNumber(kpiValues.weightDelta, language, 1)} kg`
      : '—'}
    color="#00ccf5"
  />
  <KpiCard
    label="IGF-1 Δ"
    value={kpiValues.igf1Delta != null
      ? `${kpiValues.igf1Delta > 0 ? '+' : ''}${kpiValues.igf1Delta}%`
      : '—'}
    color="#8b5cf6"
  />
  <KpiCard
    label="CRP Δ"
    value={kpiValues.crpDelta != null
      ? `${kpiValues.crpDelta > 0 ? '+' : ''}${kpiValues.crpDelta}%`
      : '—'}
    color={kpiValues.crpDelta != null && kpiValues.crpDelta < 0 ? '#10b981' : '#f43f5e'}
  />
</div>
```

- [ ] **Step 3: Verify compiles + commit**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): add KPI strip (adherence, weight delta, IGF-1, CRP)"
```

---

### Task 4: Preset chips + marker toggles

**Files:**
- Modify: `src/pages/Protokoll.tsx` — JSX, inside `ref={reportRef}` div

- [ ] **Step 1: Add `applyPreset` handler**

Inside `Protokoll()`, before the return:

```typescript
const applyPreset = (presetKey: string) => {
  const preset = PRESETS.find(p => p.key === presetKey)
  if (!preset) return
  const markers = preset.key === 'full' ? availableMarkers : preset.markers
  // Filter to only markers that exist in current range
  const available = markers.filter(m => m === 'Gewicht' || bloodwork.some(e => e.marker === m))
  setActiveMarkers(available.length > 0 ? available : ['Gewicht'])
  setSelectedPreset(presetKey)
}

const toggleMarker = (marker: string) => {
  setSelectedPreset('') // deselect preset
  setActiveMarkers(prev => {
    if (prev.includes(marker)) {
      return prev.length > 1 ? prev.filter(m => m !== marker) : prev
    }
    return prev.length < 5 ? [...prev, marker] : prev
  })
}
```

- [ ] **Step 2: Add preset + toggle JSX inside `reportRef` div**

At the very start of the `<div ref={reportRef} ...>` content (after the period/date header row), add:

```tsx
{/* ── Schnell-Ansichten ── */}
<div>
  <p style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#334155', marginBottom: 8 }}>
    Schnell-Ansichten
  </p>
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
    {PRESETS.map(p => (
      <button
        key={p.key}
        onClick={() => applyPreset(p.key)}
        style={{
          padding: '5px 13px', borderRadius: 100,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
          cursor: 'pointer', whiteSpace: 'nowrap',
          border: selectedPreset === p.key
            ? '1px solid rgba(0,204,245,0.45)'
            : '1px solid rgba(255,255,255,0.08)',
          background: selectedPreset === p.key
            ? 'rgba(0,204,245,0.12)'
            : 'rgba(255,255,255,0.03)',
          color: selectedPreset === p.key ? '#00ccf5' : '#64748b',
          boxShadow: selectedPreset === p.key ? '0 0 14px rgba(0,204,245,0.15)' : 'none',
          transition: 'all 0.18s',
        }}
      >
        {p.label}
      </button>
    ))}
  </div>
</div>

{/* ── Marker-Toggles ── */}
<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
  {availableMarkers.map(marker => {
    const on = activeMarkers.includes(marker)
    const color = getSeriesColor(marker)
    return (
      <button
        key={marker}
        onClick={() => toggleMarker(marker)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 11px', borderRadius: 10,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
          cursor: 'pointer',
          border: on ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
          background: on ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
          color: on ? '#eaeefc' : '#475569',
          transition: 'all 0.18s',
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: 3,
          background: color, opacity: on ? 1 : 0.3, flexShrink: 0,
        }} />
        {marker}
      </button>
    )
  })}
</div>
```

- [ ] **Step 3: Verify compiles + commit**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): add preset chips and marker toggles"
```

---

### Task 5: Chart 1 — Normalized % ComposedChart

**Files:**
- Modify: `src/pages/Protokoll.tsx` — replace old weight + bloodwork ChartCards inside `reportRef`

- [ ] **Step 1: Add SVG gradient defs helper**

Add before `Protokoll()`:

```typescript
function NormalizedChartDefs({ markers }: { markers: string[] }) {
  return (
    <defs>
      {markers.map(marker => {
        const color = getSeriesColor(marker)
        const id = `grad-${marker.replace(/[^a-zA-Z0-9]/g, '')}`
        return (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        )
      })}
    </defs>
  )
}

function gradId(marker: string) {
  return `grad-${marker.replace(/[^a-zA-Z0-9]/g, '')}`
}
```

- [ ] **Step 2: Add custom tooltip component**

```typescript
function NormalizedTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(8,11,26,0.97)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 12, padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontSize: 11,
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontWeight: 700, color: p.color }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span>{p.name}: {p.value > 0 ? '+' : ''}{p.value}%</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Replace old weight + bloodwork ChartCards with NormalizedChart JSX**

Inside `reportRef`, replace the two old `<ChartCard title={copy.weightTitle}>` and `<ChartCard title={copy.bloodworkTitle}>` sections with:

```tsx
{/* ── Chart 1: % Veränderung ── */}
<section style={{
  background: 'rgba(8,11,26,0.95)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20, padding: 18,
}}>
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
    <div>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc' }}>Verlauf — % Veränderung</p>
      <p style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>
        Normalisiert ab Start · Zyklusphasen im Hintergrund
      </p>
    </div>
    <span style={{
      background: 'rgba(0,204,245,0.08)', border: '1px solid rgba(0,204,245,0.15)',
      borderRadius: 8, padding: '4px 9px',
      fontSize: 9, fontWeight: 700, color: 'rgba(0,204,245,0.7)',
    }}>
      % Δ ab Start
    </span>
  </div>

  {normalizedChartData.length > 0 ? (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={normalizedChartData} margin={{ top: 10, right: 50, bottom: 0, left: -10 }}>
        <NormalizedChartDefs markers={activeMarkers} />

        {/* Cycle phase backgrounds */}
        {cycleBands.map((band, i) => (
          <ReferenceArea
            key={i}
            x1={band.x1} x2={band.x2}
            fill={band.color} fillOpacity={0.06}
            strokeOpacity={0}
            label={{ value: band.name, position: 'insideTopLeft', fontSize: 8, fill: band.color, opacity: 0.6, fontWeight: 700 }}
          />
        ))}

        {/* Blood test event lines */}
        {bloodTestDates.map((date, i) => (
          <ReferenceLine
            key={date}
            x={date}
            stroke="rgba(0,204,245,0.25)"
            strokeWidth={1}
            strokeDasharray="2 5"
            label={i === 0 ? { value: 'Bluttest', position: 'top', fontSize: 8, fill: 'rgba(0,204,245,0.55)', fontWeight: 700 } : undefined}
          />
        ))}

        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />

        <XAxis
          dataKey="label"
          tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
          tickLine={false} axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
          tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
          tickLine={false} axisLine={false}
          domain={['auto', 'auto']}
        />

        <Tooltip content={<NormalizedTooltip />} />

        {/* Per-marker: glow Area + glow Line + main Area + main Line */}
        {activeMarkers.map(marker => {
          const color = getSeriesColor(marker)
          return (
            <React.Fragment key={marker}>
              {/* Glow line (thick, low opacity) */}
              <Line
                dataKey={marker}
                stroke={color}
                strokeWidth={7}
                strokeOpacity={0.12}
                dot={false}
                activeDot={false}
                connectNulls
                legendType="none"
                name={`${marker}-glow`}
                isAnimationActive={false}
              />
              {/* Gradient area fill */}
              <Area
                dataKey={marker}
                stroke="none"
                fill={`url(#${gradId(marker)})`}
                connectNulls
                legendType="none"
                name={`${marker}-area`}
                isAnimationActive={false}
                activeDot={false}
              />
              {/* Main line */}
              <Line
                dataKey={marker}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                connectNulls
                name={marker}
                dot={(props: { cx?: number; cy?: number }) => (
                  props.cx != null && props.cy != null ? (
                    <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={4} fill="#07091a" stroke={color} strokeWidth={2} />
                  ) : <g key="empty" />
                )}
                activeDot={{ r: 6, fill: color, stroke: '#07091a', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </React.Fragment>
          )
        })}

        <Legend
          wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: getSeriesColor(String(value)) }}>{value}</span>}
          // Hide glow/area duplicates
          payload={activeMarkers.map(m => ({ value: m, type: 'line' as const, color: getSeriesColor(m) }))}
        />
      </ComposedChart>
    </ResponsiveContainer>
  ) : (
    <EmptyChart label={copy.emptyChart} />
  )}
</section>
```

Note: Add `import React from 'react'` at the top if not already present (needed for `React.Fragment`). Check existing imports — if using React 18 new JSX transform, replace `<React.Fragment>` with `<>` fragment syntax and wrap each group in a `key`-bearing outer element.

- [ ] **Step 4: Verify compiles**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
```

Fix any type errors. Common issue: `dot` prop type — use `any` cast if needed: `dot={(props: any) => ...}`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): add normalized % ComposedChart with glow, gradients, cycle phases"
```

---

### Task 6: Chart 2 — Small Multiples

**Files:**
- Modify: `src/pages/Protokoll.tsx` — add after Chart 1 section

- [ ] **Step 1: Add SmallMultiple sub-component**

Add before `Protokoll()`:

```typescript
function SmallMultipleRow({
  series, isLast, language,
}: {
  series: SmallMultipleSeries
  isLast: boolean
  language: string
}) {
  const { marker, unit, color, normalMin, normalMax, yDomain, data, lastValue } = series

  return (
    <div style={{ marginBottom: isLast ? 0 : 4 }}>
      {/* Marker header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color }}>{marker}</span>
          <span style={{ fontSize: 9, color: '#334155', fontWeight: 600 }}>{unit}</span>
          {normalMin != null && normalMax != null && (
            <span style={{ fontSize: 8, color: '#334155' }}>Norm: {normalMin}–{normalMax}</span>
          )}
        </div>
        {lastValue != null && (
          <span style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: '-0.02em' }}>
            {formatNumber(lastValue, language, 2)} {unit}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={isLast ? 75 : 65}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 50, bottom: 0, left: 0 }}
          syncId="protokoll-small"
        >
          {/* Normal range band */}
          {normalMin != null && normalMax != null && (
            <ReferenceArea
              y1={normalMin} y2={normalMax}
              fill={color} fillOpacity={0.08}
              strokeOpacity={0}
            />
          )}
          {/* Normal range boundaries */}
          {normalMax != null && (
            <ReferenceLine y={normalMax} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="2 3" />
          )}
          {normalMin != null && normalMin > 0 && (
            <ReferenceLine y={normalMin} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="2 3" />
          )}

          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />

          <YAxis
            domain={yDomain}
            tick={{ fill: '#334155', fontSize: 9, fontWeight: 600 }}
            tickLine={false} axisLine={false}
            width={38}
            tickCount={3}
          />

          {/* Only show x-axis on last row */}
          {isLast && (
            <XAxis
              dataKey="label"
              tick={{ fill: '#334155', fontSize: 9, fontWeight: 600 }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
            />
          )}

          <Tooltip
            contentStyle={{ background: 'rgba(8,11,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 11 }}
            labelStyle={{ color: '#475569', fontSize: 9 }}
            formatter={(value: unknown) => [
              `${typeof value === 'number' ? formatNumber(value, language, 2) : value} ${unit}`,
              marker,
            ]}
          />

          {/* Glow */}
          <Line dataKey="value" stroke={color} strokeWidth={6} strokeOpacity={0.12} dot={false} activeDot={false} connectNulls isAnimationActive={false} legendType="none" name="glow" />
          {/* Main */}
          <Line
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            connectNulls
            isAnimationActive={false}
            name={marker}
            dot={(props: any) => {
              if (props.cx == null || props.cy == null || props.payload?.value == null) return <g key="empty" />
              return <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={4} fill="#07091a" stroke={color} strokeWidth={2} />
            }}
            activeDot={{ r: 6, fill: color, stroke: '#07091a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Row separator */}
      {!isLast && <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />}
    </div>
  )
}
```

- [ ] **Step 2: Add Chart 2 JSX after Chart 1 section**

```tsx
{/* ── Chart 2: Small Multiples ── */}
{smallMultiplesData.length > 0 && (
  <section style={{
    background: 'rgba(8,11,26,0.95)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 18,
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc' }}>Detailansicht — echte Einheiten</p>
        <p style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>
          Absolute Werte · Farbband = Normalbereich
        </p>
      </div>
    </div>
    {smallMultiplesData.map((series, i) => (
      <SmallMultipleRow
        key={series.marker}
        series={series}
        isLast={i === smallMultiplesData.length - 1}
        language={language}
      />
    ))}
  </section>
)}
```

- [ ] **Step 3: Verify compiles**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): add Small Multiples chart with real units and normal range bands"
```

---

### Task 7: Adherence bars per peptide

**Files:**
- Modify: `src/pages/Protokoll.tsx` — replace old adherence ChartCard

- [ ] **Step 1: Replace old `<ChartCard title={copy.adherenceTitle}>` with new bars**

Find the old `<ChartCard title={copy.adherenceTitle} ...>` section (the BarChart with taken/missed) and replace the entire ChartCard with:

```tsx
{/* ── Adherence je Peptid ── */}
{adherencePerPeptide.length > 0 && (
  <section style={{
    background: 'rgba(8,11,26,0.95)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 18,
  }}>
    <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc', marginBottom: 4 }}>
      {copy.adherenceTitle}
    </p>
    <p style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 14 }}>
      Anteil eingenommener Dosen im Zeitraum je Peptid
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {adherencePerPeptide.map(({ name, pct, color }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 6,
              background: `linear-gradient(90deg, ${color}, ${color}aa)`,
              transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, width: 36, textAlign: 'right', flexShrink: 0, color }}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 2: Remove old bloodwork table section**

Find the `<section className="card">` block containing the bloodwork table (the one with `<TestTube2 size={17}>` and `<table>`) inside `reportRef`. Remove it entirely — the Small Multiples chart replaces it.

- [ ] **Step 3: Verify compiles**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1 | grep "Protokoll"
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): per-peptide adherence bars, remove old bloodwork table"
```

---

### Task 8: Cleanup old state + final wiring

**Files:**
- Modify: `src/pages/Protokoll.tsx` — remove dead state, dead useMemo, verify full page

- [ ] **Step 1: Remove unused state and useMemo**

Remove these declarations from the component body (no longer used):
- `const [selectedMarker, setSelectedMarker] = useState('')` → delete
- `const markers = useMemo(...)` (the one computing unique marker names) → delete
- `const bloodworkChartData = useMemo(...)` → delete
- `const selectedMarkerUnit = ...` → delete
- `const adherenceData = useMemo(...)` (old single-bar) → delete
- `const bloodworkRows = useMemo(...)` → delete

- [ ] **Step 2: Clean up unused lucide imports**

Check which icons are no longer used after removing the old chart sections. Remove any unused icons from the lucide-react import. Common removals: `TestTube2` (if bloodwork table gone), `Activity` (if old adherence bar gone).

- [ ] **Step 3: Full TypeScript check**

```bash
cd C:/Users/Devin/peptid-tracker && npx tsc -b --noEmit 2>&1
```

Expected: zero errors in Protokoll.tsx.

- [ ] **Step 4: Run local dev server and verify**

```bash
cd C:/Users/Devin/peptid-tracker && npm run dev
```

Open `http://localhost:5173/protokoll` and verify:
- KPI strip shows 4 cards
- Preset chips work (click each one, markers update)
- Marker toggles update both charts
- Chart 1 shows normalized % lines with glow/gradient
- Chart 2 shows stacked Small Multiples with normal range bands
- Adherence bars show per-peptide data
- PDF export still works (test by clicking "PDF generieren")
- Existing cycle selector (Aktueller Zyklus / Eigener Zeitraum) still works

- [ ] **Step 5: Push to GitHub (Vercel auto-deploys)**

```bash
cd C:/Users/Devin/peptid-tracker
git add src/pages/Protokoll.tsx
git commit -m "feat(protokoll): complete redesign — biohacking dashboard, dual charts, presets"
git push origin main
```

---

## Self-Review

**Spec coverage check:**
- ✅ KPI strip (Task 3) — 4 cards: Adherence, Gewicht Δ, IGF-1 Δ, CRP Δ
- ✅ Preset chips (Task 4) — 6 presets
- ✅ Marker toggles (Task 4) — per-marker with color swatch
- ✅ Chart 1: % Veränderung with glow, gradient fill, cycle phases, blood test events, tooltip (Task 5)
- ✅ Chart 2: Small Multiples with real units, normal range bands, syncId (Task 6)
- ✅ Adherence bars per peptide, no red/green dots (Task 7)
- ✅ Old single-marker bloodwork chart removed (Task 7)
- ✅ Old single-bar adherence chart removed (Task 7)
- ✅ Zeitraum-Selektor unchanged
- ✅ Vergangene Zyklen unchanged
- ✅ PDF export unchanged
- ✅ No new packages, no new DB queries

**Type consistency:** `SmallMultipleSeries` interface defined in Task 2, used in Task 6 `SmallMultipleRow`. `gradId()` defined in Task 5 helper, used in Task 5 JSX. `NormalizedTooltip` uses recharts payload shape — marked as `{ name: string; value: number; color: string }[]`.

**Placeholder check:** No TBDs. All code blocks complete.
