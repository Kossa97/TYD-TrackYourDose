import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../config/features'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
  Microscope, Library, Droplets, Heart, FileText, type LucideIcon,
  Activity, ArrowUpRight, CheckCircle2, ClipboardList,
  Clock3, Flame, Package, ShieldCheck, Sparkles,
  Syringe, TrendingUp, Bell,
  Dumbbell, Dna, Zap, Moon, Brain, Bandage, HeartPulse, Lightbulb, Leaf, Bone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BlutspiegelCarousel } from '../components/BlutspiegelCarousel'
import { getPeptideExpiryAlerts, type PeptideExpiryAlert } from '../lib/peptideExpiry'
import { findOldestOverdueIntake } from '../lib/intakeSchedule'
import { ExpiryWarningBanners } from '../components/ExpiryWarningBanners'
import { WorkflowBanner } from '../components/WorkflowBanner'
import { differenceInDays, format, parseISO, subDays } from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

interface EscalationRow {
  cycle_id: string
  increase_amount: number
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

// Effective dose for a cycle on a given day, including active escalations.
// Mirrors effectiveDose() in Dashboard.tsx / Peptide.tsx.
function effectiveDose(
  cycle: { id: string; dose: number; start_date: string },
  day: Date,
  escalations: EscalationRow[],
): number {
  const daysFromStart = differenceInDays(day, parseISO(cycle.start_date))
  let total = cycle.dose
  for (const esc of escalations.filter(e => e.cycle_id === cycle.id)) {
    if (esc.start_type === 'date' && esc.start_date) {
      if (day >= parseISO(esc.start_date)) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
}

const PEPTIDE_STUDIES = [
  { icon: FlaskConical, title: 'BPC-157 beschleunigt Sehnen- & Muskelheilung signifikant', source: 'J. Physiol. · 2024' },
  { icon: Dumbbell,     title: 'TB-500 fördert Angiogenese & Wundheilung bei Gewebeschäden', source: 'Wound Rep. Reg. · 2023' },
  { icon: Dna,          title: 'GHK-Cu aktiviert über 4.000 Gene – Gewebereparatur & Anti-Aging', source: 'Biomolecules · 2024' },
  { icon: Zap,          title: 'Ipamorelin: selektive GH-Freisetzung ohne Cortisol- oder Prolaktin-Spitzen', source: 'Endocrinology · 2023' },
  { icon: Moon,         title: 'Epitalon verlängert Telomere & hemmt Tumorwachstum in Langzeitstudie', source: 'Aging · 2023' },
  { icon: Brain,        title: 'Selank (TP-7) zeigt anxiolytische Wirkung ohne Abhängigkeitspotenzial', source: 'Neuropharmacology · 2024' },
  { icon: Microscope,   title: 'MOTS-c verbessert Insulinsensitivität & Mitochondrienfunktion', source: 'Cell Metab. · 2024' },
  { icon: Bandage,      title: 'AOD-9604: gezielter Fettabbau ohne diabetogene Nebenwirkungen', source: 'Obes. Res. · 2023' },
  { icon: HeartPulse,   title: 'Thymosin α1 stärkt Immunantwort bei chronischer Entzündung', source: 'Immunology · 2024' },
  { icon: Lightbulb,    title: 'PT-141 (Bremelanotide) – erstes FDA-zugelassenes Peptid gegen Libidostörungen', source: 'FDA Approval · 2019' },
  { icon: TrendingUp,   title: 'CJC-1295 hält IGF-1-Spiegel über 14 Tage erhöht', source: 'J. Clin. Endocrinol. · 2006' },
  { icon: ShieldCheck,  title: 'Humanin schützt Neuronen vor amyloidbedingtem Zelltod – neue Daten', source: 'PNAS · 2024' },
  { icon: Leaf,         title: 'Epithalon reduziert oxidativen Stress & verbessert Schlafqualität', source: 'Biogerontology · 2023' },
  { icon: Bone,         title: 'BPC-157 fördert Knochenregeneration nach Fraktur – Tierstudie', source: 'Bone · 2024' },
] as const
const TODAY_STUDY = PEPTIDE_STUDIES[Math.floor(Date.now() / 86_400_000) % PEPTIDE_STUDIES.length]

const DATE_LOCALES: Record<string, Locale> = {
  de, en: enUS, es, fr, it, pt, ru, tr, ar, hi, id, zh: zhCN, ja, ko,
}

interface TileDef {
  icon: LucideIcon
  labelKey: string
  descKey: string
  label?: string
  desc?: string
  path: string
  color: string
  bg: string
}

interface QuickActionDef {
  icon: LucideIcon
  labelKey: string
  label: string
  descKey: string
  desc: string
  path: string
  accent: string
}

interface FeatureDef {
  icon: LucideIcon
  labelKey: string
  label: string
  descKey: string
  desc: string
  path: string
  accent: string
  metric: string
}

interface OverviewStats {
  activeCycles: number
  peptides: number
  inventoryVials: number
  loggedToday: number
  lowStock: number
}

const EMPTY_OVERVIEW: OverviewStats = {
  activeCycles: 0,
  peptides: 0,
  inventoryVials: 0,
  loggedToday: 0,
  lowStock: 0,
}

const TILE_DEFS: TileDef[] = [
  { icon: CalendarDays, labelKey: 'tile_kalender',    descKey: 'tile_kalender_desc',    path: '/kalender',             color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Syringe,      labelKey: 'tile_injektionen', descKey: 'tile_injektionen_desc', path: '/injektionen',          color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: Archive,      labelKey: 'tile_lager',       descKey: 'tile_lager_desc',       path: '/peptide?tab=inventar', color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: FlaskConical, labelKey: 'tile_peptide',     descKey: 'tile_peptide_desc',     path: '/peptide',              color: '#22d3ee', bg: 'rgba(34,211,238,0.10)'         },
  { icon: Calculator,   labelKey: 'tile_rechner',     descKey: 'tile_rechner_desc',     path: '/rechner',              color: '#3b82f6', bg: 'rgba(59,130,246,0.10)'         },
  { icon: Droplets,     labelKey: 'tile_blutwerte',   descKey: 'tile_blutwerte_desc',   path: '/blutwerte',            color: '#f43f5e', bg: 'rgba(244,63,94,0.10)', label: 'Blutwerte', desc: 'Laborwerte erfassen' },
  { icon: Heart,        labelKey: 'tile_health',      descKey: 'tile_health_desc',      path: '/health',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
  { icon: FileText,     labelKey: 'tile_protokoll',   descKey: 'tile_protokoll_desc',   path: '/protokoll',            color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Microscope,   labelKey: 'tile_lab',         descKey: 'tile_lab_desc',         path: '/lab',                  color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Library,      labelKey: 'tile_bibliothek',  descKey: 'tile_bibliothek_desc',  path: '/lab/library',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: BookHeart,    labelKey: 'tile_tagebuch',    descKey: 'tile_tagebuch_desc',    path: '/tagebuch',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: Star,         labelKey: 'tile_bewertungen', descKey: 'tile_bewertungen_desc', path: '/bewertungen',          color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'         },
  { icon: HelpCircle,   labelKey: 'tile_faq',         descKey: 'tile_faq_desc',         path: '/faq',                  color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: User,         labelKey: 'tile_profil',      descKey: 'tile_profil_desc',      path: '/profil',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
]

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    icon: CheckCircle2,
    labelKey: 'home_action_log',
    label: 'Heute loggen',
    descKey: 'home_action_log_desc',
    desc: 'Einnahmen bestätigen',
    path: '/kalender',
    accent: '#10b981',
  },
  {
    icon: Syringe,
    labelKey: 'home_action_injection',
    label: 'Injektion loggen',
    descKey: 'home_action_injection_desc',
    desc: 'Stelle & Rotation tracken',
    path: '/injektionen',
    accent: '#00ccf5',
  },
  {
    icon: Calculator,
    labelKey: 'home_action_calc',
    label: 'Dosis rechnen',
    descKey: 'home_action_calc_desc',
    desc: 'Einheiten berechnen',
    path: '/rechner',
    accent: '#3b82f6',
  },
  {
    icon: TrendingUp,
    labelKey: 'home_action_progress',
    label: 'Fortschritt',
    descKey: 'home_action_progress_desc',
    desc: 'Gewicht & Fotos',
    path: '/progress',
    accent: '#10b981',
  },
  {
    icon: Activity,
    labelKey: 'home_action_simulation',
    label: 'Blutspiegel',
    descKey: 'home_action_simulation_desc',
    desc: 'PK-Kurve simulieren',
    path: '/simulation',
    accent: '#00ccf5',
  },
]

const FEATURE_CARDS: FeatureDef[] = [
  {
    icon: FileText,
    labelKey: 'home_feature_protocol',
    label: 'PDF-Protokoll',
    descKey: 'home_feature_protocol_desc',
    desc: 'Zyklen auswerten und als Report exportieren.',
    path: '/protokoll',
    accent: '#00ccf5',
    metric: 'Export',
  },
  {
    icon: Droplets,
    labelKey: 'home_feature_bloodwork',
    label: 'Blutwerte',
    descKey: 'home_feature_bloodwork_desc',
    desc: 'Laborwerte strukturiert erfassen und vergleichen.',
    path: '/blutwerte',
    accent: '#f43f5e',
    metric: 'Labs',
  },
  {
    icon: Microscope,
    labelKey: 'home_feature_research',
    label: 'Research Feed',
    descKey: 'home_feature_research_desc',
    desc: 'PubMed-Studien und Peptipedia schneller finden.',
    path: '/lab',
    accent: '#8b5cf6',
    metric: 'PubMed',
  },
]

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  paddingBottom: 8,
}

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--card-border)',
  borderRadius: 24,
  boxShadow: 'var(--shadow-card)',
  position: 'relative',
  overflow: 'hidden',
}

const labelStyle: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
}

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nextIntake,  setNextIntake]  = useState<string | null>(null)
  const [nextSubstance, setNextSubstance] = useState<string | null>(null)
  const [nextDose, setNextDose] = useState<string | null>(null)
  const [dueIntake, setDueIntake] = useState<{ time: string; substance: string | null; daysOverdue: number; dateKey: string; dose: string | null } | null>(null)
  const [plannedToday, setPlannedToday] = useState(0)
  const [todayDone,   setTodayDone]   = useState(false)
  const [streak,      setStreak]      = useState(0)
  const [overview, setOverview] = useState<OverviewStats>(EMPTY_OVERVIEW)
  const [expiryAlerts, setExpiryAlerts] = useState<PeptideExpiryAlert[]>([])

  // Rotate study daily
  const todayStudy = TODAY_STUDY

  useEffect(() => {
    if (!user) return
    async function load() {
      const todayKey = format(new Date(), 'yyyy-MM-dd')

      try {
        const [{ data: cycleData }, { data: logData }, { data: peptideData }, { data: inventoryData }, { data: escalationData }, { data: decidedTodayData }] = await Promise.all([
          supabase.from('cycles')
            .select('id, intake_time, intake_time_custom, peptide_id, dose, unit, start_date, end_date, frequency, x_days_interval, schedule_days')
            .eq('user_id', user!.id).eq('active', true),
          supabase.from('dose_logs')
            .select('logged_at, peptide_id')
            .eq('user_id', user!.id).eq('taken', true)
            .order('logged_at', { ascending: false }),
          supabase.from('peptides')
            .select('id, name, vials_in_stock, reconstitution_date, expiry_days')
            .eq('user_id', user!.id),
          supabase.from('inventory_items')
            .select('id, vials_count')
            .eq('user_id', user!.id),
          supabase.from('dose_escalations')
            .select('cycle_id, increase_amount, start_type, start_date, start_after_days')
            .eq('user_id', user!.id),
          // Today's decided intakes (taken or skipped) — used to consume slots in the timer.
          supabase.from('dose_logs')
            .select('peptide_id, taken')
            .eq('user_id', user!.id)
            .gte('logged_at', todayKey)
            .lte('logged_at', todayKey + 'T23:59:59'),
        ])
        const escalations = (escalationData ?? []) as EscalationRow[]
        // How many of today's intakes are already decided (taken=true/false) per peptide.
        const decidedCountByPeptide = new Map<string, number>()
        for (const l of decidedTodayData ?? []) {
          if (l.taken !== null) decidedCountByPeptide.set(l.peptide_id, (decidedCountByPeptide.get(l.peptide_id) ?? 0) + 1)
        }

        // ── Next intake time ─────────────────────────────────────────
        const peptideNameById = new Map<string, string>(
          (peptideData ?? []).map((p) => [p.id as string, p.name as string])
        )
        const now = new Date()
        const nowMin = now.getHours() * 60 + now.getMinutes()
        const todaySlots: { min: number; time: string; substance: string | null; dose: string | null; peptideId: string }[] = []
        for (const c of cycleData ?? []) {
          const slots   = (c.intake_time ?? '').split(',').filter(Boolean)
          const customs = (c.intake_time_custom ?? '').split(',')
          const doseLabel = c.dose != null
            ? `${effectiveDose(c, now, escalations)} ${c.unit ?? ''}`.trim()
            : null
          slots.forEach((slot: string, i: number) => {
            const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
            if (!tm) return
            const [h, m] = tm.split(':').map(Number)
            todaySlots.push({ min: h * 60 + m, time: tm, substance: peptideNameById.get(c.peptide_id as string) ?? null, dose: doseLabel, peptideId: c.peptide_id as string })
          })
        }
        todaySlots.sort((a, b) => a.min - b.min)
        // Consume already-decided intakes per peptide in time order; the timer points
        // at the earliest still-open slot in the future.
        const consumedByPeptide = new Map<string, number>()
        let nextSlot: typeof todaySlots[number] | null = null
        for (const s of todaySlots) {
          const used = consumedByPeptide.get(s.peptideId) ?? 0
          if (used < (decidedCountByPeptide.get(s.peptideId) ?? 0)) {
            consumedByPeptide.set(s.peptideId, used + 1)
            continue
          }
          if (s.min > nowMin) { nextSlot = s; break }
        }
        // Oldest unlogged scheduled intake across the past weeks (today included).
        const overdue = findOldestOverdueIntake(cycleData ?? [], logData ?? [], peptideNameById)
        const overdueCycle = overdue ? (cycleData ?? []).find(c => c.id === overdue.cycleId) : null
        const overdueDose = overdue && overdueCycle && overdueCycle.dose != null
          ? `${effectiveDose(overdueCycle, parseISO(overdue.dateKey), escalations)} ${overdueCycle.unit ?? ''}`.trim()
          : null

        setPlannedToday(todaySlots.length)
        setNextIntake(nextSlot?.time ?? null)
        setNextSubstance(nextSlot?.substance ?? null)
        setNextDose(nextSlot?.dose ?? null)
        setDueIntake(overdue ? { ...overdue, dose: overdueDose } : null)
        setTodayDone(todaySlots.length > 0 && !nextSlot && !overdue)

        // ── Streak (consecutive days with ≥1 taken log) ─────────────
        const takenDates = new Set(
          (logData ?? []).map(l => format(parseISO(l.logged_at), 'yyyy-MM-dd'))
        )
        let s = 0
        let d = new Date()
        // If nothing logged today yet, start checking from yesterday
        if (!takenDates.has(format(d, 'yyyy-MM-dd'))) d = subDays(d, 1)
        while (takenDates.has(format(d, 'yyyy-MM-dd'))) { s++; d = subDays(d, 1) }
        setStreak(s)

        setExpiryAlerts(getPeptideExpiryAlerts(peptideData ?? []))

        setOverview({
          activeCycles: (cycleData ?? []).length,
          peptides: (peptideData ?? []).length,
          inventoryVials: (inventoryData ?? []).reduce((sum, item) => sum + Number(item.vials_count ?? 0), 0),
          loggedToday: (logData ?? []).filter((log) => format(parseISO(log.logged_at), 'yyyy-MM-dd') === todayKey).length,
          lowStock: (peptideData ?? []).filter((p) => p.vials_in_stock != null && Number(p.vials_in_stock) <= 1).length,
        })
      } catch {
        setOverview(EMPTY_OVERVIEW)
        setExpiryAlerts([])
      }
    }
    load()
  }, [user])

  const { t, i18n } = useTranslation()
  const locale = DATE_LOCALES[i18n.language] ?? enUS
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_day') : t('greeting_evening')
  const dateStr  = format(new Date(), "EEEE, d. MMMM", { locale })
  const statusLabel = todayDone
    ? t('stat_today_done')
    : nextIntake
      ? `${t('stat_next_intake')}: ${nextIntake}`
      : t('home_status_empty', { defaultValue: 'Kein aktiver Plan' })
  const completionLevel = plannedToday > 0
    ? Math.min(100, Math.round((overview.loggedToday / plannedToday) * 100))
    : 0

  return (
    <div style={pageStyle} className="stagger-in">
      <section style={{ ...panelStyle, padding: 18 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 10%, rgba(0,204,245,0.22), transparent 32%), radial-gradient(circle at 8% 88%, rgba(139,92,246,0.18), transparent 34%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...labelStyle, color: 'var(--accent)', marginBottom: 7 }}>
                {dateStr}
              </p>
              <h1 style={{ fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.045em', color: 'var(--text)', lineHeight: 1.04, marginBottom: 8 }}>
                {greeting}
              </h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: 390 }}>
                {t('home_hero_subtitle', { defaultValue: 'Dein Research-Cockpit für Einnahmen, Vorrat, Laborwerte und Protokolle.' })}
              </p>
            </div>

            <button
              onClick={() => navigate('/profil')}
              aria-label={String(t('tile_profil'))}
              style={{
                width: 42,
                height: 42,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.045)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--accent)',
              }}
            >
              <User size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HeroStat
              icon={Flame}
              label="Streak"
              value={String(streak)}
              hint={String(t('stat_days'))}
              accent={streak > 0 ? '#f59e0b' : '#64748b'}
            />
            <HeroStat
              icon={Activity}
              label={String(t('home_completion', { defaultValue: 'Heute erledigt' }))}
              value={`${completionLevel}%`}
              hint={`${overview.loggedToday}/${plannedToday} ${t('home_completion_unit', { defaultValue: 'Einnahmen geloggt' })}`}
              accent="#8b5cf6"
            />
          </div>

          {dueIntake ? (
            <NextIntakeBanner
              time={dueIntake.time}
              substance={dueIntake.substance}
              dose={dueIntake.dose}
              forceDue
              daysOverdue={dueIntake.daysOverdue}
              onClick={() => navigate(`/kalender?date=${dueIntake.dateKey}#due-intakes`)}
            />
          ) : nextIntake ? (
            <NextIntakeBanner
              time={nextIntake}
              substance={nextSubstance}
              dose={nextDose}
              onClick={() => navigate('/kalender#due-intakes')}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 18,
              background: todayDone ? 'rgba(16,185,129,0.10)' : 'var(--accent-weak)',
              border: todayDone ? '1px solid rgba(16,185,129,0.22)' : '1px solid var(--accent-border)',
            }}>
              <ShieldCheck size={18} color={todayDone ? '#10b981' : 'var(--accent)'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                  {statusLabel}
                </p>
                <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('home_status_hint', { defaultValue: 'Schnellzugriff auf die wichtigsten Schritte.' })}
                </p>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          )}
        </div>
      </section>

      <section>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 8 }}>
          Live-Blutspiegel
        </p>
        <BlutspiegelCarousel />
      </section>

      <ExpiryWarningBanners alerts={expiryAlerts} />

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_quick_actions', { defaultValue: 'Quick Actions' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_quick_title', { defaultValue: 'Direkt loslegen' })}
            </h2>
          </div>
          <Sparkles size={18} color="var(--accent)" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS
            .filter(action => action.path !== '/progress' || FEATURES.FOTO_PROGRESS)
            .map((action, idx, arr) => {
              const isLastOdd = arr.length % 2 === 1 && idx === arr.length - 1
              return (
                <QuickAction
                  key={action.labelKey}
                  icon={action.icon}
                  label={String(t(action.labelKey, { defaultValue: action.label }))}
                  desc={String(t(action.descKey, { defaultValue: action.desc }))}
                  accent={action.accent}
                  wide={isLastOdd}
                  onClick={() => navigate(action.path)}
                />
              )
            })}
        </div>
      </section>

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_overview', { defaultValue: 'Übersicht' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_overview_title', { defaultValue: 'Heute im Blick' })}
            </h2>
          </div>
          <button
            onClick={() => navigate('/kalender')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 750 }}
          >
            {t('today')} <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InsightCard
            icon={CalendarDays}
            label={String(t('stat_active_cycles'))}
            value={String(overview.activeCycles)}
            hint={String(t('home_active_cycles_hint', { defaultValue: 'laufende Pläne' }))}
            accent="#00ccf5"
            onClick={() => navigate('/kalender')}
          />
          <InsightCard
            icon={FlaskConical}
            label={String(t('stat_peptides'))}
            value={String(overview.peptides)}
            hint={String(t('home_peptides_hint', { defaultValue: 'rekonstituiert' }))}
            accent="#22d3ee"
            onClick={() => navigate('/peptide')}
          />
          <InsightCard
            icon={Package}
            label={String(t('stat_vials'))}
            value={String(overview.inventoryVials)}
            hint={overview.lowStock > 0
              ? String(t('home_low_stock', { defaultValue: '{{count}} niedrig', count: overview.lowStock }))
              : String(t('home_stock_ok', { defaultValue: 'Vorrat erfasst' }))}
            accent={overview.lowStock > 0 ? '#f59e0b' : '#10b981'}
            onClick={() => navigate('/peptide?tab=inventar')}
          />
        </div>
      </section>

      <section style={{ ...panelStyle, padding: 14 }}>
        <div style={{ position: 'absolute', top: -34, right: -28, width: 120, height: 120, borderRadius: '50%', background: 'var(--accent-weak)', filter: 'blur(20px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            {(() => { const StudyIcon = todayStudy.icon; return <StudyIcon size={22} color="var(--accent)" /> })()}
            <div>
              <p style={{ ...labelStyle, color: 'var(--accent)' }}>{t('stat_study')}</p>
              <p style={{ fontSize: '0.86rem', fontWeight: 850, color: 'var(--text)', lineHeight: 1.25 }}>
                {t('home_daily_research', { defaultValue: 'Daily Research' })}
              </p>
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.45 }}>
            {todayStudy.title}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              {todayStudy.source}
            </p>
            <button
              onClick={() => navigate('/lab')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 800 }}
            >
              {t('lab_snapshot_discover', { defaultValue: 'Entdecken' })} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('home_features', { defaultValue: 'Features' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_features_title', { defaultValue: 'Mehr aus deinen Daten machen' })}
            </h2>
          </div>
          <ClipboardList size={18} color="var(--text-muted)" />
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {FEATURE_CARDS.map((feature) => (
            <FeatureCard
              key={feature.labelKey}
              icon={feature.icon}
              label={String(t(feature.labelKey, { defaultValue: feature.label }))}
              desc={String(t(feature.descKey, { defaultValue: feature.desc }))}
              cta={String(t('home_feature_cta', { defaultValue: 'Öffnen' }))}
              metric={feature.metric}
              accent={feature.accent}
              onClick={() => navigate(feature.path)}
            />
          ))}
        </div>
      </section>

      <WorkflowBanner userId={user?.id} />

      <section>
        <div style={sectionHeaderStyle}>
          <div>
            <p style={labelStyle}>{t('sections')}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_all_tools', { defaultValue: 'Alle Tools' })}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3" data-ob="home-tiles">
          {TILE_DEFS.map((tile, index) => {
            const stretchLast = TILE_DEFS.length % 2 === 1 && index === TILE_DEFS.length - 1
            return (
              <TileButton
                key={tile.labelKey}
                icon={tile.icon}
                label={String(t(tile.labelKey, { defaultValue: tile.label ?? tile.labelKey }))}
                desc={String(t(tile.descKey, { defaultValue: tile.desc ?? tile.descKey }))}
                color={tile.color}
                bg={tile.bg}
                wide={stretchLast}
                onClick={() => navigate(tile.path)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint: string
  accent: string
}) {
  return (
    <div style={{
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: '11px 9px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, color: 'var(--text-muted)' }}>
        <Icon size={13} color={accent} />
        <p style={{ fontSize: '0.52rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: typeof value === 'string' && value.length > 4 ? '1.03rem' : '1.34rem', fontWeight: 900, letterSpacing: '-0.04em', color: accent, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hint}
      </p>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  desc,
  accent,
  wide,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  accent: string
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={wide ? 'col-span-2 motion-press' : 'motion-press'}
      style={{
        minHeight: 104,
        padding: '12px 9px',
        borderRadius: 20,
        border: `1px solid ${accent}33`,
        background: `linear-gradient(155deg, ${accent}20, var(--surface))`,
        display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        gap: wide ? 12 : 9,
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${accent}1f`,
        color: accent,
        boxShadow: `0 0 20px ${accent}22`,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 850, color: 'var(--text)', lineHeight: 1.15 }}>
          {label}
        </p>
        <p style={{ fontSize: '0.59rem', color: 'var(--text-dim)', lineHeight: 1.3, marginTop: 3 }}>
          {desc}
        </p>
      </div>
      <div style={{ position: 'absolute', right: -18, bottom: -18, width: 62, height: 62, borderRadius: '50%', background: accent, opacity: 0.08, filter: 'blur(12px)' }} />
    </button>
  )
}

function InsightCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...panelStyle,
        padding: 14,
        textAlign: 'left',
        minHeight: 112,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          background: `${accent}17`,
          border: `1px solid ${accent}24`,
        }}>
          <Icon size={17} />
        </div>
        <ChevronRight size={15} color="var(--text-muted)" />
      </div>
      <p style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 14 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 750, marginTop: 5 }}>
        {label}
      </p>
      <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>
        {hint}
      </p>
      <div style={{ position: 'absolute', right: -24, bottom: -28, width: 86, height: 86, borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(16px)' }} />
    </button>
  )
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function msUntilTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const target = new Date()
  target.setHours(h, m, 0, 0)
  return target.getTime() - Date.now()
}

function NextIntakeBanner({
  time,
  substance,
  dose,
  onClick,
  forceDue = false,
  daysOverdue = 0,
}: {
  time: string
  substance: string | null
  dose?: string | null
  onClick: () => void
  forceDue?: boolean
  daysOverdue?: number
}) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => msUntilTime(time))
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilTime(time)), 1000)
    return () => clearInterval(id)
  }, [time])

  const due = forceDue || remaining <= 0
  const c       = due ? '#f59e0b' : 'var(--accent)'
  const cWeak   = due ? 'rgba(245,158,11,0.12)' : 'var(--accent-weak)'
  const cBorder = due ? 'rgba(245,158,11,0.34)' : 'var(--accent-border)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '12px 14px', borderRadius: 18,
        background: cWeak, border: `1px solid ${cBorder}`,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 14, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cWeak, color: c, border: `1px solid ${cBorder}`,
      }}>
        {due ? <Bell size={20} className="pulse-soft" /> : <Clock3 size={20} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...labelStyle, color: c, marginBottom: 3 }}>
          {due ? t('home_due_label', { defaultValue: 'Jetzt fällig' }) : t('stat_next_intake', { defaultValue: 'Nächste Einnahme' })}
        </p>
        {due ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 850, color: c, lineHeight: 1 }}>
            <span className="pulse-soft" style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />
            {t('home_due', { defaultValue: 'Einnahme fällig!' })}
          </p>
        ) : (
          <p style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '0.02em' }}>
            {fmtCountdown(remaining)}
          </p>
        )}
        <p style={{ fontSize: '0.7rem', color: due && daysOverdue >= 1 ? c : 'var(--text-muted)', fontWeight: due && daysOverdue >= 1 ? 700 : 400, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(() => {
            const when = due && daysOverdue >= 1
              ? t('home_overdue_days', { days: daysOverdue, defaultValue: `seit ${daysOverdue} ${daysOverdue === 1 ? 'Tag' : 'Tagen'} überfällig` })
              : `${t('home_at_time', { defaultValue: 'um' })} ${time}`
            return [substance, dose, when].filter(Boolean).join(' · ')
          })()}
        </p>
      </div>
    </button>
  )
}

function FeatureCard({
  icon: Icon,
  label,
  desc,
  cta,
  metric,
  accent,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  cta: string
  metric: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...panelStyle,
        minWidth: 226,
        padding: 14,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}18`,
          color: accent,
          border: `1px solid ${accent}24`,
        }}>
          <Icon size={18} />
        </div>
        <span style={{
          padding: '3px 8px',
          borderRadius: 999,
          background: `${accent}14`,
          border: `1px solid ${accent}24`,
          color: accent,
          fontSize: '0.58rem',
          fontWeight: 850,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {metric}
        </span>
      </div>
      <p style={{ fontSize: '0.9rem', fontWeight: 850, color: 'var(--text)', marginBottom: 5, position: 'relative' }}>
        {label}
      </p>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45, position: 'relative' }}>
        {desc}
      </p>
      <div style={{ marginTop: 13, display: 'inline-flex', alignItems: 'center', gap: 5, color: accent, fontSize: '0.66rem', fontWeight: 850, position: 'relative' }}>
        {cta} <ArrowUpRight size={12} />
      </div>
    </button>
  )
}

function TileButton({
  icon: Icon,
  label,
  desc,
  color,
  bg,
  wide,
  onClick,
}: {
  icon: LucideIcon
  label: string
  desc: string
  color: string
  bg: string
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={wide ? 'col-span-2 motion-press' : 'motion-press'}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: wide ? '14px 16px' : '15px 13px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: wide ? 'center' : 'flex-start',
        flexDirection: wide ? 'row' : 'column',
        gap: wide ? 13 : 0,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 15,
        background: bg,
        border: `1px solid ${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: wide ? 0 : 12,
        flexShrink: 0,
        color,
      }}>
        <Icon size={18} />
      </div>

      <div style={{ flex: wide ? 1 : undefined, minWidth: 0, position: 'relative' }}>
        <p style={{ fontSize: '0.86rem', fontWeight: 820, color: 'var(--text)', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</p>
      </div>

      {wide && <ChevronRight size={16} color="var(--accent)" style={{ flexShrink: 0 }} />}

      <div style={{
        position: 'absolute',
        bottom: -24,
        right: -24,
        width: 88,
        height: 88,
        borderRadius: '50%',
        background: color,
        opacity: 0.055,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
    </button>
  )
}
