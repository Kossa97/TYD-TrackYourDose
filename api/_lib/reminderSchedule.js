// Pure Terminplan-Logik für Push-Reminder (Vercel Cron).
// Spiegelt src/lib/intakeSchedule.ts (scheduleForDay / cycleAppliesToDay / Slot-Parsing)
// als plain JS, da die api/-Functions nicht aus src/ importieren.
// Bei Änderungen an der Frequenz-Logik BEIDE Dateien anpassen (Tests decken Parität ab).

const SLOT_TIMES = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

// Index = Date#getUTCDay() (0 = Sonntag) → deutsche Wochentags-Codes aus cycles.schedule_days
const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

// Minuten VOR der Einnahmezeit, zu denen die jeweilige Erinnerung feuert
export const REMINDER_OFFSETS_MIN = { on_time: 0, '2h': 120, '1day': 1440 }

// ── Datums-Helfer (alle auf 'yyyy-MM-dd'-Strings, DST-sicher via UTC-Mittag) ──

function noonUTC(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`)
}

export function diffDays(aKey, bKey) {
  return Math.round((noonUTC(aKey) - noonUTC(bKey)) / 86400000)
}

export function addDaysKey(dateKey, n) {
  const d = noonUTC(dateKey)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Lokales Datum + Minuten-seit-Mitternacht eines Users für einen UTC-Zeitpunkt.
 * Fällt bei unbekannter Zeitzone auf UTC zurück.
 */
export function localParts(date, timezone) {
  let tz = timezone || 'UTC'
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(date)
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(date)
  }
  const get = type => parts.find(p => p.type === type)?.value ?? '00'
  // Intl liefert für 00 Uhr je nach Runtime '24' — auf '00' normalisieren
  const hour = get('hour') === '24' ? '00' : get('hour')
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(hour) * 60 + Number(get('minute')),
  }
}

// ── Zyklus-Terminplan (Parität zu intakeSchedule.ts) ──────────────────────

/** Aktives Plan-Segment für einen Tag. Leere Historie => flache cycles-Felder. */
export function scheduleForDay(cycle, dateKey) {
  const flat = {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    dose: cycle.dose,
    unit: cycle.unit,
    interval_unit: cycle.interval_unit ?? null,
    cycle_on_days: cycle.cycle_on_days ?? null,
    cycle_off_days: cycle.cycle_off_days ?? null,
    slot_doses: cycle.slot_doses ?? null,
    slot_days: cycle.slot_days ?? null,
  }
  const history = cycle.schedule_history
  if (!Array.isArray(history) || history.length === 0) return flat
  const sorted = [...history].sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)))
  let seg = sorted[0]
  for (const s of sorted) {
    if (String(s.effective_from) <= dateKey) seg = s
    else break
  }
  return seg
}

/** Ist der Zyklus an diesem lokalen Tag überhaupt fällig (Frequenz + Laufzeit)? */
export function cycleAppliesToDay(cycle, dateKey) {
  if (!cycle.start_date) return false
  if (dateKey < cycle.start_date) return false
  if (cycle.end_date && dateKey > cycle.end_date) return false

  const seg = scheduleForDay(cycle, dateKey)
  const freq = seg.frequency
  const jsDay = noonUTC(dateKey).getUTCDay()
  const dayOfWeek = WEEKDAYS_DE[jsDay]
  const diff = diffDays(dateKey, cycle.start_date)
  const days = Array.isArray(seg.schedule_days) ? seg.schedule_days : []
  const hasDayFilter = days.length > 0

  if (freq === 'Bei Bedarf') return false

  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? days.includes(dayOfWeek) : true

  if (freq === 'Alle X Tage') {
    const einheit = seg.interval_unit ?? 'day'
    const n = seg.x_days_interval ?? 2
    if (!Number.isInteger(n) || n < 1) return false
    if (einheit === 'month') return n <= 12 && trifftMonatsabstand(cycle.start_date, dateKey, n)
    const schritt = einheit === 'week' ? n * 7 : n
    if (schritt > 366) return false
    return diff % schritt === 0 && (hasDayFilter ? days.includes(dayOfWeek) : true)
  }

  if (freq === 'Im Wechsel') {
    const an = seg.cycle_on_days
    const aus = seg.cycle_off_days
    if (!Number.isInteger(an) || !Number.isInteger(aus)) return false
    if (an < 1 || aus < 1 || an > 90 || aus > 90) return false
    return diff % (an + aus) < an
  }

  if (freq === 'Wochentage wählen') return days.includes(dayOfWeek)

  // Alte Frequenztexte aus bestehenden Zyklen.
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return jsDay >= 1 && jsDay <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  return false
}

/**
 * Monatsabstand ueber Kalendermonate, mit Kappung auf den letzten Tag des
 * Zielmonats — dieselbe Regel wie `addMonths` im Frontend
 * (`src/lib/intakeSchedule.ts`). Beide Seiten muessen dasselbe sagen, sonst
 * erinnert der Cron an Tagen, an denen die App nichts faellig zeigt.
 */
function trifftMonatsabstand(startKey, dateKey, monate) {
  const [sj, sm, sd] = String(startKey).split('-').map(Number)
  const [zj, zm, zd] = String(dateKey).split('-').map(Number)
  const abstand = (zj - sj) * 12 + (zm - sm)
  if (abstand < 0 || abstand % monate !== 0) return false
  const letzterImZielmonat = new Date(Date.UTC(zj, zm, 0)).getUTCDate()
  return zd === Math.min(sd, letzterImZielmonat)
}

/**
 * Geplante Einnahme-Slots des Tages als { minutes, time, dose }, zeitlich sortiert.
 * `dose` ist die eigene Menge DIESES Zeitpunkts (`slot_doses`); null heisst, es
 * gilt die Menge des Zyklus. Ohne sie nannte die Erinnerung bei „morgens 1000,
 * abends 500" an beiden 1000.
 */
export function daySlots(cycle, dateKey) {
  const seg = scheduleForDay(cycle, dateKey)
  const slots = String(seg.intake_time ?? '').split(',').filter(Boolean)
  const customs = String(seg.intake_time_custom ?? '').split(',')
  // Wochentage je Zeitpunkt — leer heisst „an jedem Tag". Ohne diesen Filter
  // erinnerte der Cron an Tagen, an denen die App nichts faellig zeigt.
  const dayLists = String(seg.slot_days ?? '').split(',')
  const doses = String(seg.slot_doses ?? '').split(',')
  const weekday = WEEKDAYS_DE[noonUTC(dateKey).getUTCDay()]
  const out = []
  slots.forEach((slot, i) => {
    const eigeneTage = String(dayLists[i] ?? '').split('|').map(t => t.trim()).filter(Boolean)
    if (eigeneTage.length > 0 && !eigeneTage.includes(weekday)) return
    const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
    if (!/^\d{1,2}:\d{2}$/.test(tm)) return
    const [h, m] = tm.split(':').map(Number)
    const menge = Number(String(doses[i] ?? '').trim())
    const eigeneMenge = String(doses[i] ?? '').trim() !== '' && Number.isFinite(menge) && menge > 0
      ? menge
      : null
    out.push({ minutes: h * 60 + m, time: tm, dose: eigeneMenge })
  })
  return out.sort((a, b) => a.minutes - b.minutes)
}

/**
 * Gewählte Erinnerungs-Offsets eines Zyklus.
 * null/'' (Alt-Daten ohne explizite Wahl) => ['on_time'] wie bisher;
 * explizites 'none' => keine Pushes für diesen Zyklus.
 */
export function reminderKeys(cycle) {
  const raw = String(cycle.reminder ?? '').trim()
  if (!raw) return ['on_time']
  return raw.split(',')
    .map(s => s.trim())
    .filter(k => k && k !== 'none' && REMINDER_OFFSETS_MIN[k] != null)
}

/**
 * Effektive Dosis am Tag: Segment-Basis + aktive Dosis-Anpassungen
 * (dose_escalations). `slotDose` ist die eigene Menge eines Zeitpunkts und
 * tritt an die Stelle der Segment-Basis; die Anpassungen gelten dem ganzen
 * Plan und kommen wie sonst obendrauf.
 */
export function effectiveDoseForDay(cycle, dateKey, escalations = [], slotDose = null) {
  let total = slotDose ?? scheduleForDay(cycle, dateKey).dose
  const daysFromStart = diffDays(dateKey, cycle.start_date)
  for (const esc of escalations) {
    if (esc.cycle_id !== cycle.id) continue
    if (esc.start_type === 'date' && esc.start_date) {
      if (dateKey >= esc.start_date) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
}

/**
 * Alle JETZT fälligen Erinnerungen eines Zyklus.
 * Fällig = Feuerzeitpunkt (Slot minus Offset) liegt in (now - windowMin, now].
 * windowMin muss der Cron-Kadenz entsprechen, damit nichts doppelt oder gar nicht feuert.
 * Geprüft werden Slots von gestern/heute/morgen (Offsets bis 24h + Mitternachts-Überlauf).
 */
export function dueReminders(cycle, nowLocal, windowMin) {
  const due = []
  const offsets = reminderKeys(cycle)
  if (!offsets.length) return due

  for (const dayShift of [-1, 0, 1]) {
    const dayKey = addDaysKey(nowLocal.dateKey, dayShift)
    if (!cycleAppliesToDay(cycle, dayKey)) continue
    for (const slot of daySlots(cycle, dayKey)) {
      for (const key of offsets) {
        const fireMinutes = slot.minutes + dayShift * 1440 - REMINDER_OFFSETS_MIN[key]
        if (fireMinutes <= nowLocal.minutes && fireMinutes > nowLocal.minutes - windowMin) {
          due.push({ offset: key, slotTime: slot.time, slotDateKey: dayKey, slotDose: slot.dose })
        }
      }
    }
  }
  return due
}
