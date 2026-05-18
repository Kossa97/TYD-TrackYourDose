import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const TILE_DEFS = [
  { icon: CalendarDays, labelKey: 'tile_kalender', descKey: 'tile_kalender_desc', path: '/kalender',             color: '#00ccf5', bg: 'rgba(0,204,245,0.10)',   wide: true },
  { icon: Archive,      labelKey: 'tile_lager',     descKey: 'tile_lager_desc',    path: '/peptide?tab=inventar', color: '#00ccf5', bg: 'rgba(0,204,245,0.10)'          },
  { icon: FlaskConical, labelKey: 'tile_peptide',   descKey: 'tile_peptide_desc',  path: '/peptide',              color: '#22d3ee', bg: 'rgba(34,211,238,0.10)'         },
  { icon: Calculator,   labelKey: 'tile_rechner',   descKey: 'tile_rechner_desc',  path: '/rechner',              color: '#3b82f6', bg: 'rgba(59,130,246,0.10)'         },
  { icon: BookHeart,    labelKey: 'tile_tagebuch',  descKey: 'tile_tagebuch_desc', path: '/tagebuch',             color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)'         },
  { icon: Star,         labelKey: 'tile_bewertungen',descKey:'tile_bewertungen_desc',path:'/bewertungen',          color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'         },
  { icon: HelpCircle,   labelKey: 'tile_faq',       descKey: 'tile_faq_desc',      path: '/faq',                  color: '#10b981', bg: 'rgba(16,185,129,0.10)'         },
  { icon: User,         labelKey: 'tile_profil',    descKey: 'tile_profil_desc',   path: '/profil',               color: '#f43f5e', bg: 'rgba(244,63,94,0.10)'          },
]

export function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeCycles,  setActiveCycles]  = useState(0)
  const [totalVials,    setTotalVials]    = useState(0)
  const [peptideCount,  setPeptideCount]  = useState(0)

  useEffect(() => {
    if (!user) return
    async function load() {
      const [{ data: cycles }, { data: inventory }, { data: peptides }] = await Promise.all([
        supabase.from('cycles').select('id').eq('user_id', user!.id).eq('active', true),
        supabase.from('inventory_items').select('vials_count').eq('user_id', user!.id),
        supabase.from('peptides').select('id').eq('user_id', user!.id),
      ])
      setActiveCycles(cycles?.length ?? 0)
      setTotalVials(inventory?.reduce((s, i) => s + (i.vials_count || 0), 0) ?? 0)
      setPeptideCount(peptides?.length ?? 0)
    }
    load()
  }, [user])

  const { t, i18n } = useTranslation()
  const hour    = new Date().getHours()
  const greeting = hour < 12 ? t('greeting_morning') : hour < 18 ? t('greeting_day') : t('greeting_evening')
  const dateStr  = format(new Date(), "EEEE, d. MMMM", { locale: de })
  void i18n

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
        {[
          { label: t('stat_active_cycles'), value: activeCycles, color: '#00ccf5' },
          { label: t('stat_vials'),         value: totalVials,   color: '#00ccf5' },
          { label: t('stat_peptides'),      value: peptideCount, color: '#eaeefc' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(10,14,30,0.85)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '12px 10px',
          }}>
            <p style={{ fontSize: '0.57rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.55)', marginBottom: 5 }}>
              {s.label}
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', color: s.color, lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Section Label ── */}
      <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.4)', marginBottom: 12 }}>
        {t('sections')}
      </p>

      {/* ── Tiles Grid ── */}
      <div className="grid grid-cols-2 gap-3">
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
