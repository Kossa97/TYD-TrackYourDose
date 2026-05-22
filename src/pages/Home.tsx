import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
  Microscope, Library,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, parseISO, subDays } from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

const PEPTIDE_STUDIES = [
  { emoji: '🧪', title: 'BPC-157 beschleunigt Sehnen- & Muskelheilung signifikant', source: 'J. Physiol. · 2024' },
  { emoji: '💪', title: 'TB-500 fördert Angiogenese & Wundheilung bei Gewebeschäden', source: 'Wound Rep. Reg. · 2023' },
  { emoji: '🧬', title: 'GHK-Cu aktiviert über 4.000 Gene – Gewebereparatur & Anti-Aging', source: 'Biomolecules · 2024' },
  { emoji: '⚡', title: 'Ipamorelin: selektive GH-Freisetzung ohne Cortisol- oder Prolaktin-Spitzen', source: 'Endocrinology · 2023' },
  { emoji: '🌙', title: 'Epitalon verlängert Telomere & hemmt Tumorwachstum in Langzeitstudie', source: 'Aging · 2023' },
  { emoji: '🧠', title: 'Selank (TP-7) zeigt anxiolytische Wirkung ohne Abhängigkeitspotenzial', source: 'Neuropharmacology · 2024' },
  { emoji: '🔬', title: 'MOTS-c verbessert Insulinsensitivität & Mitochondrienfunktion', source: 'Cell Metab. · 2024' },
  { emoji: '🩹', title: 'AOD-9604: gezielter Fettabbau ohne diabetogene Nebenwirkungen', source: 'Obes. Res. · 2023' },
  { emoji: '🫀', title: 'Thymosin α1 stärkt Immunantwort bei chronischer Entzündung', source: 'Immunology · 2024' },
  { emoji: '💡', title: 'PT-141 (Bremelanotide) – erstes FDA-zugelassenes Peptid gegen Libidostörungen', source: 'FDA Approval · 2019' },
  { emoji: '📈', title: 'CJC-1295 hält IGF-1-Spiegel über 14 Tage erhöht', source: 'J. Clin. Endocrinol. · 2006' },
  { emoji: '🛡️', title: 'Humanin schützt Neuronen vor amyloidbedingtem Zelltod – neue Daten', source: 'PNAS · 2024' },
  { emoji: '🌿', title: 'Epithalon reduziert oxidativen Stress & verbessert Schlafqualität', source: 'Biogerontology · 2023' },
  { emoji: '🦴', title: 'BPC-157 fördert Knochenregeneration nach Fraktur – Tierstudie', source: 'Bone · 2024' },
]
const TODAY_STUDY = PEPTIDE_STUDIES[Math.floor(Date.now() / 86_400_000) % PEPTIDE_STUDIES.length]

const DATE_LOCALES: Record<string, Locale> = {
  de, en: enUS, es, fr, it, pt, ru, tr, ar, hi, id, zh: zhCN, ja, ko,
}

const TILE_DEFS = [
  { icon: CalendarDays, labelKey: 'tile_kalender', descKey: 'tile_kalender_desc', path: '/kalender',             color: '#00ccf5', bg: 'rgba(0,204,245,0.10)',   wide: true },
  { icon: Archive,      labelKey: 'tile_lager',     descKey: 'tile_lager_desc',    path: '/peptide?tab=inventar', color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: FlaskConical, labelKey: 'tile_peptide',   descKey: 'tile_peptide_desc',  path: '/peptide',              color: '#22d3ee', bg: 'rgba(34,211,238,0.10)'         },
  { icon: Calculator,   labelKey: 'tile_rechner',   descKey: 'tile_rechner_desc',  path: '/rechner',              color: '#3b82f6', bg: 'rgba(59,130,246,0.10)'         },
  { icon: Microscope,   labelKey: 'tile_lab',       descKey: 'tile_lab_desc',      path: '/lab',                  color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: Library,      labelKey: 'tile_bibliothek', descKey: 'tile_bibliothek_desc', path: '/lab/library',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: BookHeart,    labelKey: 'tile_tagebuch',  descKey: 'tile_tagebuch_desc', path: '/tagebuch',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: Star,         labelKey: 'tile_bewertungen',descKey:'tile_bewertungen_desc',path:'/bewertungen',          color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'         },
  { icon: HelpCircle,   labelKey: 'tile_faq',       descKey: 'tile_faq_desc',      path: '/faq',                  color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: User,         labelKey: 'tile_profil',    descKey: 'tile_profil_desc',   path: '/profil',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
]

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nextIntake,  setNextIntake]  = useState<string | null>(null)
  const [todayDone,   setTodayDone]   = useState(false)
  const [streak,      setStreak]      = useState(0)

  // Rotate study daily
  const todayStudy = TODAY_STUDY

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: cycleData }, { data: logData }] = await Promise.all([
        supabase.from('cycles')
          .select('intake_time, intake_time_custom')
          .eq('user_id', user!.id).eq('active', true),
        supabase.from('dose_logs')
          .select('logged_at')
          .eq('user_id', user!.id).eq('taken', true)
          .order('logged_at', { ascending: false }),
      ])

      // ── Next intake time ─────────────────────────────────────────
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
      let bestMin = Infinity, bestTime = ''
      for (const c of cycleData ?? []) {
        const slots   = (c.intake_time ?? '').split(',').filter(Boolean)
        const customs = (c.intake_time_custom ?? '').split(',')
        slots.forEach((slot: string, i: number) => {
          const t = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
          if (!t) return
          const [h, m] = t.split(':').map(Number)
          const min = h * 60 + m
          if (min > nowMin && min < bestMin) { bestMin = min; bestTime = t }
        })
      }
      setNextIntake(bestTime || null)
      setTodayDone(!bestTime && (cycleData ?? []).length > 0)

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
    }
    load()
  }, [user])

  const { t, i18n } = useTranslation()
  const locale = DATE_LOCALES[i18n.language] ?? enUS
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_day') : t('greeting_evening')
  const dateStr  = format(new Date(), "EEEE, d. MMMM", { locale })

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-5 pt-1">
        <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.65)', marginBottom: 4 }}>
          {dateStr}
        </p>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc', lineHeight: 1.1 }}>
          {greeting} 👋
        </h1>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-3 gap-2 mb-6">

        {/* Nächste Einnahme */}
        <div style={{ background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '12px 10px' }}>
          <p style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.55)', marginBottom: 4 }}>
            ⏱ {t('stat_next_intake')}
          </p>
          {todayDone ? (
            <>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>✓</p>
              <p style={{ fontSize: '0.58rem', color: '#10b981', marginTop: 2 }}>{t('stat_today_done')}</p>
            </>
          ) : nextIntake ? (
            <p style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#00ccf5', lineHeight: 1 }}>
              {nextIntake}
            </p>
          ) : (
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'rgba(154,170,191,0.35)', lineHeight: 1 }}>–</p>
          )}
        </div>

        {/* Streak */}
        <div style={{ background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '12px 10px' }}>
          <p style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.55)', marginBottom: 4 }}>
            🔥 Streak
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: streak > 0 ? '#f59e0b' : 'rgba(154,170,191,0.35)', lineHeight: 1 }}>
            {streak}
          </p>
          <p style={{ fontSize: '0.55rem', color: 'rgba(154,170,191,0.45)', marginTop: 2 }}>{t('stat_days')}</p>
        </div>

        {/* Tägliche Peptid-Studie */}
        <div style={{ background: 'rgba(10,14,30,0.85)', border: '1px solid rgba(0,204,245,0.10)', borderRadius: 16, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <p style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.55)' }}>
            📰 {t('stat_study')}
          </p>
          <p style={{ fontSize: '0.63rem', fontWeight: 700, color: '#eaeefc', lineHeight: 1.35, flex: 1 }}>
            {todayStudy.emoji} {todayStudy.title}
          </p>
          <p style={{ fontSize: '0.5rem', color: 'rgba(154,170,191,0.38)', marginTop: 2 }}>
            {todayStudy.source}
          </p>
        </div>

      </div>

      {/* ── Section Label ── */}
      <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.4)', marginBottom: 12 }}>
        {t('sections')}
      </p>

      {/* ── Tiles Grid ── */}
      <div className="grid grid-cols-2 gap-3" data-ob="home-tiles">
        {TILE_DEFS.map((tile) => (
          <button
            key={tile.labelKey}
            onClick={() => navigate(tile.path)}
            className={tile.wide ? 'col-span-2' : ''}
            style={{
              background: 'rgba(10,14,30,0.85)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20,
              padding: tile.wide ? '14px 18px' : '16px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: tile.wide ? 'center' : 'flex-start',
              flexDirection: tile.wide ? 'row' : 'column',
              gap: tile.wide ? 14 : 0,
              position: 'relative',
              overflow: 'hidden',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: tile.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: tile.wide ? 0 : 12, flexShrink: 0,
            }}>
              <tile.icon size={18} color={tile.color} />
            </div>

            {/* Text */}
            <div style={{ flex: tile.wide ? 1 : undefined, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#eaeefc', marginBottom: 2 }}>{t(tile.labelKey)}</p>
              <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.55)', lineHeight: 1.4 }}>{t(tile.descKey)}</p>
            </div>

            {tile.wide && <ChevronRight size={16} color="rgba(0,204,245,0.4)" style={{ flexShrink: 0 }} />}

            {/* Glow */}
            <div style={{
              position: 'absolute', bottom: -20, right: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: tile.color, opacity: 0.06, filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />
          </button>
        ))}
      </div>
    </div>
  )
}
