import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown, ChevronUp, Search,
  CalendarDays, FlaskConical, BookHeart, Star, User,
  TrendingUp, Bell, HelpCircle, Shield, Calculator, Package,
  Syringe, Archive, FileText,
} from 'lucide-react'
import { loadFaqBundle } from '../i18n/faq'
import type { FaqBundle, FaqCategory, FaqItem } from '../i18n/faq/types'

interface QA { q: string; a: string | string[] }
interface Category extends FaqCategory {
  icon: React.ReactNode
  color: string
}

const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  start: { icon: <HelpCircle size={16} />, color: 'text-sky-400' },
  kalender: { icon: <CalendarDays size={16} />, color: 'text-violet-400' },
  peptide: { icon: <FlaskConical size={16} />, color: 'text-sky-400' },
  rechner: { icon: <Calculator size={16} />, color: 'text-emerald-400' },
  zyklen: { icon: <CalendarDays size={16} />, color: 'text-violet-400' },
  escalation: { icon: <TrendingUp size={16} />, color: 'text-orange-400' },
  tagebuch: { icon: <BookHeart size={16} />, color: 'text-emerald-400' },
  bewertungen: { icon: <Star size={16} />, color: 'text-amber-400' },
  profil: { icon: <User size={16} />, color: 'text-slate-300' },
  erinnerung: { icon: <Bell size={16} />, color: 'text-sky-400' },
  injections: { icon: <Syringe size={16} />, color: 'text-emerald-400' },
  inventory: { icon: <Archive size={16} />, color: 'text-cyan-400' },
  reports: { icon: <FileText size={16} />, color: 'text-sky-400' },
  technik: { icon: <Shield size={16} />, color: 'text-slate-400' },
}

function toDisplayCategories(cats: FaqCategory[]): Category[] {
  return cats.map(cat => {
    const meta = CAT_META[cat.id] ?? { icon: <Package size={16} />, color: 'text-slate-400' }
    return { ...cat, ...meta }
  })
}

function AccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border-b border-slate-800 last:border-b-0`}>
      <button
        type="button"
        className="w-full text-start flex items-start justify-between gap-3 py-3.5 px-1"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`text-sm font-medium leading-snug ${open ? 'text-white' : 'text-slate-300'}`}>
          {item.q}
        </span>
        {open
          ? <ChevronUp size={16} className="text-sky-400 shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-slate-500 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="pb-4 px-1">
          {Array.isArray(item.a) ? (
            <ul className="space-y-1.5">
              {item.a.map((line, i) => (
                <li key={i} className={`text-sm leading-relaxed ${
                  i === 0 && item.a.length > 1 ? 'text-slate-300 font-medium' : 'text-slate-400'
                }`}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
          )}
        </div>
      )}
    </div>
  )
}

function itemMatchesQuery(item: FaqItem, q: string): boolean {
  const hay = (
    item.q.toLowerCase() +
    (Array.isArray(item.a) ? item.a.join(' ') : item.a).toLowerCase()
  )
  return hay.includes(q)
}

export function FAQ() {
  const { i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['start']))

  const [bundle, setBundle] = useState<FaqBundle | null>(null)
  useEffect(() => {
    let alive = true
    loadFaqBundle(i18n.language).then(b => { if (alive) setBundle(b) })
    return () => { alive = false }
  }, [i18n.language])

  const CATEGORIES = useMemo(
    () => (bundle ? toDisplayCategories(bundle.categories) : []),
    [bundle],
  )

  const toggleCat = (id: string) =>
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const q = search.toLowerCase().trim()

  const visible = q
    ? CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item => itemMatchesQuery(item, q)),
      })).filter(cat => cat.items.length > 0)
    : CATEGORIES

  const totalQ = CATEGORIES.reduce((s, c) => s + c.items.length, 0)

  if (!bundle) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        …
      </div>
    )
  }
  const { ui } = bundle

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle size={20} className="text-sky-400" />
        <h1 className="text-xl font-bold">{ui.pageTitle}</h1>
      </div>
      <p className="text-slate-500 text-sm mb-4">
        {ui.subtitle.replace(/\{\{\s*count\s*\}\}/gi, String(totalQ))}
      </p>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          className="input pl-10"
          placeholder={ui.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {q && visible.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
          <p>{ui.emptySearch.replace(/\{\{\s*query\s*\}\}/gi, search)}</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map(cat => (
          <div key={cat.id} className="card overflow-hidden p-0">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5"
              onClick={() => !q && toggleCat(cat.id)}
            >
              <div className="flex items-center gap-2.5">
                <span className={cat.color}>{cat.icon}</span>
                <span className="font-semibold text-slate-200 text-sm">{cat.title}</span>
                <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">
                  {cat.items.length}
                </span>
              </div>
              {!q && (
                openCats.has(cat.id)
                  ? <ChevronUp size={16} className="text-slate-500 shrink-0" />
                  : <ChevronDown size={16} className="text-slate-500 shrink-0" />
              )}
            </button>

            {(q || openCats.has(cat.id)) && (
              <div className="px-4 border-t border-slate-800">
                {cat.items.map((item, i) => (
                  <AccordionItem key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-slate-700 text-xs mt-8 pb-2">
        {ui.footer}
      </p>
    </div>
  )
}
