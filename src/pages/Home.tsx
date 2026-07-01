import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../config/features'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
  Microscope, Library, Droplets, Heart, FileText, type LucideIcon,
  Activity, ArrowUpRight, CheckCircle2, ClipboardList,
  Clock3, Package, ShieldCheck, Sparkles,
  Syringe, TrendingUp, Bell,
  Dumbbell, Dna, Zap, Moon, Brain, Bandage, HeartPulse, Lightbulb, Leaf, Bone,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BlutspiegelCarousel } from '../components/BlutspiegelCarousel'
import { getPeptideExpiryAlerts, type PeptideExpiryAlert } from '../lib/peptideExpiry'
import { collectMissedIntakes, cycleAppliesToDay, scheduleForDay, effectiveDose, AUTO_MISSED_NOTE, type EscalationRow } from '../lib/intakeSchedule'
import { ExpiryWarningBanners } from '../components/ExpiryWarningBanners'
import { WorkflowBanner } from '../components/WorkflowBanner'
import { InjectionTrackerHero, type InjectionHeroPin } from '../components/injection3d/InjectionTrackerHero'
import { buildInjectionTrackerUrl, isInjectableMethod } from '../lib/injectionDeepLink'
import { format, parseISO, startOfDay } from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

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

interface TodayIntake {
  time: string          // 'HH:MM'
  min: number           // Minuten seit Mitternacht (Sortierung)
  substance: string | null
  dose: string | null
  peptideId: string
  cycleId: string
  method: string | null
  scheduledAt: string
}

interface InjectionHeroState {
  pins: InjectionHeroPin[]
}

const EMPTY_INJECTION_HERO: InjectionHeroState = {
  pins: [],
}

function isHeroVector(value: unknown): value is InjectionHeroPin['position'] {
  if (!value || typeof value !== 'object') return false
  const vector = value as Record<string, unknown>
  return typeof vector.x === 'number' && typeof vector.y === 'number' && typeof vector.z === 'number'
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
  // Alle heute noch offenen (nicht bestätigten) Einnahmen, je mit eigenem Timer.
  const [todayIntakes, setTodayIntakes] = useState<TodayIntake[]>([])
  const [plannedToday, setPlannedToday] = useState(0)
  const [todayDone,   setTodayDone]   = useState(false)
  const [overview, setOverview] = useState<OverviewStats>(EMPTY_OVERVIEW)
  const [expiryAlerts, setExpiryAlerts] = useState<PeptideExpiryAlert[]>([])
  const [injectionHero, setInjectionHero] = useState<InjectionHeroState>(EMPTY_INJECTION_HERO)

  // Rotate study daily
  const todayStudy = TODAY_STUDY

  useEffect(() => {
    if (!user) return
    async function load() {
      const todayKey = format(new Date(), 'yyyy-MM-dd')

      try {
        const [{ data: cycleData }, { data: logData }, { data: peptideData }, { data: inventoryData }, { data: escalationData }, { data: injectionData }] = await Promise.all([
          supabase.from('cycles')
            .select('id, intake_time, intake_time_custom, peptide_id, dose, unit, method, start_date, end_date, frequency, x_days_interval, schedule_days, schedule_history')
            .eq('user_id', user!.id).eq('active', true),
          // All decided/reset logs — taken filtered per use site (overdue/timer).
          supabase.from('dose_logs')
            .select('logged_at, peptide_id, taken')
            .eq('user_id', user!.id)
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
          supabase.from('injection_logs')
            .select('id, logged_at, body_region, body_side, position, normal')
            .eq('user_id', user!.id)
            .order('logged_at', { ascending: false })
            .limit(30),
        ])
        const escalations = (escalationData ?? []) as EscalationRow[]
        // How many of today's intakes are already decided (taken=true/false) per peptide.
        const decidedCountByPeptide = new Map<string, number>()
        for (const l of logData ?? []) {
          if (l.taken !== null && format(parseISO(l.logged_at), 'yyyy-MM-dd') === todayKey)
            decidedCountByPeptide.set(l.peptide_id, (decidedCountByPeptide.get(l.peptide_id) ?? 0) + 1)
        }

        // ── Next intake time ─────────────────────────────────────────
        const peptideNameById = new Map<string, string>(
          (peptideData ?? []).map((p) => [p.id as string, p.name as string])
        )
        const now = new Date()
        const todaySlots: { min: number; time: string; substance: string | null; dose: string | null; peptideId: string; cycleId: string; method: string | null; scheduledAt: string }[] = []
        for (const c of cycleData ?? []) {
          // Nur Zyklen, die HEUTE gelten (Frequenz/Start/Ende), wie im Kalender.
          if (!cycleAppliesToDay(c, now)) continue
          const seg = scheduleForDay(c, now)   // segment-/historienaufgelöste Slots
          const slots   = (seg.intake_time ?? '').split(',').filter(Boolean)
          const customs = (seg.intake_time_custom ?? '').split(',')
          const doseLabel = c.dose != null
            ? `${effectiveDose(c, now, escalations)} ${c.unit ?? ''}`.trim()
            : null
          slots.forEach((slot: string, i: number) => {
            const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
            if (!tm) return
            const [h, m] = tm.split(':').map(Number)
            const scheduledAt = new Date(now)
            scheduledAt.setHours(h, m, 0, 0)
            todaySlots.push({
              min: h * 60 + m,
              time: tm,
              substance: peptideNameById.get(c.peptide_id as string) ?? null,
              dose: doseLabel,
              peptideId: c.peptide_id as string,
              cycleId: c.id as string,
              method: c.method as string | null,
              scheduledAt: scheduledAt.toISOString(),
            })
          })
        }
        todaySlots.sort((a, b) => a.min - b.min)
        // Alle heute noch offenen Slots sammeln (pro Peptid die bereits entschiedenen in
        // Zeitreihenfolge abziehen). Übrig bleiben fällige + anstehende Einnahmen für heute.
        const consumedByPeptide = new Map<string, number>()
        const openSlots: typeof todaySlots = []
        for (const s of todaySlots) {
          const used = consumedByPeptide.get(s.peptideId) ?? 0
          if (used < (decidedCountByPeptide.get(s.peptideId) ?? 0)) {
            consumedByPeptide.set(s.peptideId, used + 1)
            continue
          }
          openSlots.push(s)
        }
        // Frist = Tagesende: nicht bestätigte Slots vergangener Tage automatisch als
        // „verpasst" (taken=false) in die Historie schreiben, damit sie sich nicht stapeln.
        // Nur ab Aktivierung (localStorage) — kein rückwirkendes Backfill der Historie.
        let autoMissSince = localStorage.getItem('tyd_automiss_since')
        if (!autoMissSince) { autoMissSince = todayKey; localStorage.setItem('tyd_automiss_since', autoMissSince) }
        const missed = collectMissedIntakes(cycleData ?? [], logData ?? [], now, parseISO(autoMissSince))
        if (missed.length > 0) {
          const cycleById = new Map((cycleData ?? []).map(c => [c.id, c]))
          const rows = missed.map(m => {
            const c = cycleById.get(m.cycleId)!
            const at = startOfDay(parseISO(m.dateKey))
            at.setHours(Math.floor(m.minutes / 60), m.minutes % 60, 0, 0)
            return {
              user_id: user!.id,
              peptide_id: c.peptide_id,
              dose: effectiveDose(c, parseISO(m.dateKey), escalations),
              unit: c.unit ?? '',
              method: c.method ?? '',
              logged_at: at.toISOString(),
              taken: false,
              notes: AUTO_MISSED_NOTE,
            }
          })
          await supabase.from('dose_logs').insert(rows)
        }

        const injectionRows = injectionData ?? []
        const recentInjectionRows = injectionRows.filter(row => {
          const ageMs = Date.now() - parseISO(row.logged_at as string).getTime()
          return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000
        })
        const pins = recentInjectionRows
          .filter(row => isHeroVector(row.position) && isHeroVector(row.normal))
          .slice(0, 4)
          .map(row => ({
            id: row.id as string,
            position: row.position,
            normal: row.normal,
          }))

        setPlannedToday(todaySlots.length)
        setTodayIntakes(openSlots.map(s => ({ time: s.time, min: s.min, substance: s.substance, dose: s.dose, peptideId: s.peptideId, cycleId: s.cycleId, method: s.method, scheduledAt: s.scheduledAt })))
        setTodayDone(todaySlots.length > 0 && openSlots.length === 0)
        setInjectionHero({ pins })

        setExpiryAlerts(getPeptideExpiryAlerts(peptideData ?? []))

        setOverview({
          activeCycles: (cycleData ?? []).length,
          peptides: (peptideData ?? []).length,
          inventoryVials: (inventoryData ?? []).reduce((sum, item) => sum + Number(item.vials_count ?? 0), 0),
          loggedToday: (logData ?? []).filter((log) => log.taken === true && format(parseISO(log.logged_at), 'yyyy-MM-dd') === todayKey).length,
          lowStock: (peptideData ?? []).filter((p) => p.vials_in_stock != null && Number(p.vials_in_stock) <= 1).length,
        })
      } catch {
        setOverview(EMPTY_OVERVIEW)
        setExpiryAlerts([])
        setInjectionHero(EMPTY_INJECTION_HERO)
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
    : t('home_status_empty', { defaultValue: 'Kein aktiver Plan' })
  const completionLevel = plannedToday > 0
    ? Math.min(100, Math.round((overview.loggedToday / plannedToday) * 100))
    : 0

  const openTodayIntake = (intake: TodayIntake) => {
    if (isInjectableMethod(intake.method)) {
      navigate(buildInjectionTrackerUrl({
        cycleId: intake.cycleId,
        scheduledAt: intake.scheduledAt,
        returnTo: '/',
      }))
      return
    }
    navigate('/kalender#due-intakes')
  }

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
              <h1 style={{ fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.045em', color: 'var(--text)', lineHeight: 1.04 }}>
                {greeting}
              </h1>
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

          <HeroStat
            icon={Activity}
            label={String(t('home_completion', { defaultValue: 'Heute erledigt' }))}
            value={`${completionLevel}%`}
            hint={`${overview.loggedToday}/${plannedToday} ${t('home_completion_unit', { defaultValue: 'Einnahmen geloggt' })}`}
            accent="#8b5cf6"
          />

          {todayIntakes.length === 0 && (
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

      <InjectionTrackerHero
        pins={injectionHero.pins}
        onOpen={() => navigate('/injektionen')}
      />

      {todayIntakes.length > 0 && (
        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <p style={labelStyle}>{t('home_upcoming_intakes', { defaultValue: 'Anstehende Einnahmen' })}</p>
            <p style={{ ...labelStyle, fontSize: '0.55rem' }}>{t('home_due_in', { defaultValue: 'fällig in:' })}</p>
          </div>
          <TodayIntakeCarousel
            intakes={todayIntakes}
            onItemClick={openTodayIntake}
          />
        </section>
      )}

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

// Mitwachsendes Countdown-Format:
//  >= 10h  -> "22h"
//  >= 1h   -> "9h59min"
//  >= 1min -> "59min23sek"
//  < 1min  -> "23sek"
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h >= 10) return `${h}h`
  if (h >= 1) return `${h}h${m}min`
  if (m >= 1) return `${m}min${s}sek`
  return `${s}sek`
}

function msUntilTime(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const target = new Date()
  target.setHours(h, m, 0, 0)
  return target.getTime() - Date.now()
}

// Höhe einer Einnahmen-Zeile (für das vertikale Karussell-Snapping).
const INTAKE_ROW_H = 46

// Text, der nur DANN horizontal durchläuft, wenn er nicht in eine Zeile passt
// (sonst statisch). So bleibt der gesamte Zeileninhalt lesbar.
function MarqueeText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const wrap = wrapRef.current, inner = innerRef.current
    if (!wrap || !inner) return
    let anim: Animation | null = null
    const setup = () => {
      anim?.cancel()
      const overflow = inner.scrollWidth - wrap.clientWidth
      if (overflow <= 4) { inner.style.transform = 'translateX(0)'; return }   // passt → statisch
      const holdStart = 2200, holdEnd = 1200            // Pausen (still stehen)
      const moveOut = Math.max(1800, overflow * 35)     // langsam durchlaufen
      const moveBack = Math.max(700, overflow * 14)     // zügig zurück
      const total = holdStart + moveOut + holdEnd + moveBack
      anim = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: holdStart / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity, easing: 'linear' },
      )
    }
    setup()
    const ro = new ResizeObserver(setup)
    ro.observe(wrap); ro.observe(inner)
    return () => { anim?.cancel(); ro.disconnect() }
    // Inhalt pro Zeile ist stabil (Row ist gekeyed) → nur einmal aufsetzen,
    // sonst würde der 1-Sekunden-Timer-Tick die Animation ständig neu starten.
  }, [])
  return (
    <span ref={wrapRef} style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', ...style }}>
      <span ref={innerRef} style={{ display: 'inline-block', willChange: 'transform' }}>
        {children}
      </span>
    </span>
  )
}

// Eine kompakte, einzeilige Einnahmen-Zeile mit Live-Timer (Countdown bis zur
// Einnahme, danach „Jetzt fällig").
function IntakeRow({
  time,
  substance,
  dose,
  onClick,
}: {
  time: string
  substance: string | null
  dose?: string | null
  onClick: () => void
}) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState(() => msUntilTime(time))
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilTime(time)), 1000)
    return () => clearInterval(id)
  }, [time])

  const due = remaining <= 0
  const c       = due ? '#f59e0b' : 'var(--accent)'
  const cWeak   = due ? 'rgba(245,158,11,0.12)' : 'var(--accent-weak)'
  const cBorder = due ? 'rgba(245,158,11,0.34)' : 'var(--accent-border)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: INTAKE_ROW_H, textAlign: 'left', cursor: 'pointer',
        padding: '0 12px', borderRadius: 14,
        background: cWeak, border: `1px solid ${cBorder}`,
      }}
    >
      {due
        ? <Bell size={16} className="pulse-soft" color={c} style={{ flexShrink: 0 }} />
        : <Clock3 size={16} color={c} style={{ flexShrink: 0 }} />}
      <MarqueeText style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
        {[substance, dose].filter(Boolean).join(' · ') || t('stat_next_intake', { defaultValue: 'Nächste Einnahme' })}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{` · ${t('home_at_time', { defaultValue: 'um' })} ${time}`}</span>
      </MarqueeText>
      {due ? (
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 850, color: c }}>
          <span className="pulse-soft" style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />
          {t('home_due_label', { defaultValue: 'Jetzt fällig' })}
        </span>
      ) : (
        <span style={{ flexShrink: 0, fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '0.02em' }}>
          {fmtCountdown(remaining)}
        </span>
      )}
    </button>
  )
}

// Vertikales Einzeiler-Karussell: eine Einnahme im Fokus, Nachbarn oben/unten
// lugen hervor und faden aus. Vertikal scroll-/wischbar mit Snap.
function TodayIntakeCarousel({ intakes, onItemClick }: { intakes: TodayIntake[]; onItemClick: (intake: TodayIntake) => void }) {
  if (intakes.length <= 1) {
    return intakes.length === 1
      ? <IntakeRow time={intakes[0].time} substance={intakes[0].substance} dose={intakes[0].dose} onClick={() => onItemClick(intakes[0])} />
      : null
  }
  const height = INTAKE_ROW_H * 2.5   // Fokus + Andeutung der Nachbarn
  const padBlock = (height - INTAKE_ROW_H) / 2
  return (
    <div
      className="no-scrollbar"
      style={{
        height, overflowY: 'auto', scrollSnapType: 'y mandatory',
        display: 'flex', flexDirection: 'column', gap: 6,
        paddingBlock: padBlock,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%)',
      }}
    >
      {intakes.map((it, i) => (
        <div key={`${it.peptideId}-${it.min}-${i}`} style={{ scrollSnapAlign: 'center', flexShrink: 0 }}>
          <IntakeRow time={it.time} substance={it.substance} dose={it.dose} onClick={() => onItemClick(it)} />
        </div>
      ))}
    </div>
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
