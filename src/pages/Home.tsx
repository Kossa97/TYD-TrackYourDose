import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, FlaskConical, Archive, Calculator,
  BookHeart, Star, HelpCircle, User, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const TILES = [
  {
    icon: CalendarDays, label: 'Kalender',    desc: 'Tagesprotokoll & Einnahmen',
    path: '/kalender',              color: '#00ccf5', bg: 'rgba(0,204,245,0.10)',  wide: true,
  },
  {
    icon: Archive,      label: 'Lager',        desc: 'Rohstoff-Inventar',
    path: '/peptide?tab=inventar',  color: '#00ccf5', bg: 'rgba(0,204,245,0.10)',
  },
  {
    icon: FlaskConical, label: 'Peptide',      desc: 'Meine Peptide & Zyklen',
    path: '/peptide',               color: '#22d3ee', bg: 'rgba(34,211,238,0.10)',
  },
  {
    icon: Calculator,   label: 'Rechner',      desc: 'Dosis berechnen',
    path: '/rechner',               color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',
  },
  {
    icon: BookHeart,    label: 'Tagebuch',     desc: 'Wirkungen & Nebenwirkungen',
    path: '/tagebuch',              color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)',
  },
  {
    icon: Star,         label: 'Bewertungen',  desc: 'Peptide bewerten',
    path: '/bewertungen',           color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',
  },
  {
    icon: HelpCircle,   label: 'FAQ',          desc: 'Hilfe & Anleitung',
    path: '/faq',                   color: '#10b981', bg: 'rgba(16,185,129,0.10)',
  },
  {
    icon: User,         label: 'Profil',       desc: 'Einstellungen & Sharing',
    path: '/profil',                color: '#f43f5e', bg: 'rgba(244,63,94,0.10)',
  },
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

  const hour    = new Date().getHours()
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
  const dateStr  = format(new Date(), "EEEE, d. MMMM", { locale: de })

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
          { label: 'Aktive Zyklen', value: activeCycles, color: '#00ccf5' },
          { label: 'Vials im Lager', value: totalVials,  color: '#00ccf5' },
          { label: 'Meine Peptide', value: peptideCount, color: '#eaeefc' },
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
        Bereiche
      </p>

      {/* ── Tiles Grid ── */}
      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => (
          <button
            key={t.label}
            onClick={() => navigate(t.path)}
            className={t.wide ? 'col-span-2' : ''}
            style={{
              background: 'rgba(10,14,30,0.85)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20,
              padding: t.wide ? '14px 18px' : '16px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: t.wide ? 'center' : 'flex-start',
              flexDirection: t.wide ? 'row' : 'column',
              gap: t.wide ? 14 : 0,
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
              background: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: t.wide ? 0 : 12, flexShrink: 0,
            }}>
              <t.icon size={18} color={t.color} />
            </div>

            {/* Text */}
            <div style={{ flex: t.wide ? 1 : undefined, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#eaeefc', marginBottom: 2 }}>{t.label}</p>
              <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.55)', lineHeight: 1.4 }}>{t.desc}</p>
            </div>

            {t.wide && <ChevronRight size={16} color="rgba(0,204,245,0.4)" style={{ flexShrink: 0 }} />}

            {/* Glow */}
            <div style={{
              position: 'absolute', bottom: -20, right: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: t.color, opacity: 0.06, filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />
          </button>
        ))}
      </div>
    </div>
  )
}
