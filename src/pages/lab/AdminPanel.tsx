// src/pages/lab/AdminPanel.tsx
// Admin-Panel für KI-gestützte Pflege der Peptid-Bibliothek.
// Nur für Administratoren.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Plus, RefreshCw, Save, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAllPeptides, STATUS_LABELS, CATEGORY_LABELS } from '../../services/peptideLibrary'
import type { PeptideEntry } from '../../services/peptideLibrary'

type Tab = 'update' | 'create'
type Status = 'idle' | 'loading' | 'preview' | 'saving' | 'done' | 'error'

// ─── API Call ─────────────────────────────────────────────────────────────────

async function callAI(
  action: 'create' | 'update',
  payload: { name?: string; existing?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/peptide-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Server-Fehler (${res.status}): ${text.slice(0, 120)}`)
  }
  if (!res.ok || data.error) throw new Error(String(data.error ?? 'Unbekannter Fehler'))
  return data.result as Record<string, unknown>
}

// ─── Preview Card ─────────────────────────────────────────────────────────────

function PreviewField({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null

  return (
    <div className="border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <p
        className="text-[0.52rem] font-black uppercase tracking-[0.18em] text-sky-400/50 mb-1"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </p>
      {Array.isArray(value) ? (
        <ul className="space-y-0.5">
          {(value as string[]).map((v, i) => (
            <li key={i} className="text-xs text-slate-300 flex gap-2">
              <span className="text-slate-600">·</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-300 leading-relaxed">{String(value)}</p>
      )}
    </div>
  )
}

function EvidencePreview({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <span className="text-[0.52rem] text-slate-600 uppercase tracking-widest" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Human</span>
        <span className="text-xs text-slate-400">{String(result.evidence_human)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[0.52rem] text-slate-600 uppercase tracking-widest" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Tier</span>
        <span className="text-xs text-slate-400">{String(result.evidence_animal)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[0.52rem] text-slate-600 uppercase tracking-widest" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Klinisch</span>
        <span className="text-xs text-slate-400">{String(result.evidence_clinical)}</span>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs font-black text-sky-400">{String(result.evidence_score)}</span>
        <span className="text-xs text-slate-600">/10</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminPanel() {
  const navigate                    = useNavigate()
  const [tab, setTab]               = useState<Tab>('update')
  const [peptides, setPeptides]     = useState<PeptideEntry[]>([])
  const [selected, setSelected]     = useState<PeptideEntry | null>(null)
  const [newName, setNewName]       = useState('')
  const [status, setStatus]         = useState<Status>('idle')
  const [result, setResult]         = useState<Record<string, unknown> | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [savedMsg, setSavedMsg]     = useState('')

  useEffect(() => {
    getAllPeptides().then(data => {
      setPeptides(data)
      if (data.length > 0) setSelected(data[0])
    })
  }, [])

  // ── Update existing ──────────────────────────────────────────────────────────
  async function handleUpdate() {
    if (!selected) return
    setStatus('loading')
    setResult(null)
    setErrorMsg('')
    try {
      const res = await callAI('update', { existing: selected as unknown as Record<string, unknown> })
      setResult(res)
      setStatus('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Fehler')
      setStatus('error')
    }
  }

  async function saveUpdate() {
    if (!selected || !result) return
    setStatus('saving')
    const { error } = await supabase
      .from('peptide_library')
      .update(result)
      .eq('slug', selected.slug)
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('done')
      setSavedMsg(`${selected.name} aktualisiert.`)
      // Reload peptides
      const fresh = await getAllPeptides()
      setPeptides(fresh)
      const updated = fresh.find(p => p.slug === selected.slug)
      if (updated) setSelected(updated)
      setTimeout(() => { setStatus('idle'); setResult(null) }, 3000)
    }
  }

  // ── Create new ───────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newName.trim()) return
    setStatus('loading')
    setResult(null)
    setErrorMsg('')
    try {
      const res = await callAI('create', { name: newName.trim() })
      setResult(res)
      setStatus('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Fehler')
      setStatus('error')
    }
  }

  async function saveNew() {
    if (!result) return
    setStatus('saving')
    const { error } = await supabase
      .from('peptide_library')
      .insert({ ...result, sort_order: peptides.length + 1 })
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('done')
      setSavedMsg(`${String(result.name)} zur Bibliothek hinzugefügt.`)
      setNewName('')
      const fresh = await getAllPeptides()
      setPeptides(fresh)
      setTimeout(() => { setStatus('idle'); setResult(null) }, 3000)
    }
  }

  const isLoading  = status === 'loading' || status === 'saving'
  const isSaving   = status === 'saving'
  const showPreview = (status === 'preview' || status === 'saving') && result !== null

  return (
    <div className="max-w-2xl mx-auto pb-12">

      {/* Header */}
      <button
        type="button"
        onClick={() => navigate('/lab/library')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4"
      >
        <ArrowLeft size={12} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Bibliothek</span>
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-violet-400" />
        <h1
          className="text-2xl font-black text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Admin — KI-Bibliothek
        </h1>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        KI-gestützte Pflege der Peptid-Forschungsdatenbank. Änderungen sofort live.
      </p>

      {/* Note about production */}
      <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 mb-5">
        <AlertTriangle size={13} className="text-blue-400/60 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300/55 leading-relaxed">
          Die KI-Funktion läuft über Vercel. Lokal: <code className="text-blue-300/70">vercel dev</code> statt <code className="text-blue-300/70">npm run dev</code> verwenden.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0B1220] border border-white/[0.07] rounded-xl p-1 mb-6">
        {([
          { id: 'update', icon: RefreshCw, label: 'Aktualisieren' },
          { id: 'create', icon: Plus,      label: 'Hinzufügen' },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setResult(null); setStatus('idle') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── UPDATE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'update' && (
        <div className="space-y-4">
          <div className="bg-[#0B1220] border border-white/[0.07] rounded-2xl p-5">
            <p
              className="text-[0.55rem] font-black uppercase tracking-[0.18em] text-sky-400/55 mb-3"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Peptid wählen
            </p>
            <select
              value={selected?.slug ?? ''}
              onChange={e => setSelected(peptides.find(p => p.slug === e.target.value) ?? null)}
              disabled={isLoading}
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500/50 transition-colors mb-4"
            >
              {peptides.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>

            {selected && (
              <div className="text-xs text-slate-500 space-y-1 mb-4">
                <p>Kategorie: <span className="text-slate-400">{CATEGORY_LABELS[selected.category]}</span></p>
                <p>Status: <span className="text-slate-400">{STATUS_LABELS[selected.research_status]}</span></p>
                <p>Evidence Score: <span className="text-slate-400">{selected.evidence_score}/10</span></p>
              </div>
            )}

            <button
              type="button"
              onClick={handleUpdate}
              disabled={!selected || isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {status === 'loading'
                ? <><Loader2 size={14} className="animate-spin" /> KI analysiert…</>
                : <><Sparkles size={14} /> KI-Update starten</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── CREATE TAB ──────────────────────────────────────────────────────── */}
      {tab === 'create' && (
        <div className="bg-[#0B1220] border border-white/[0.07] rounded-2xl p-5">
          <p
            className="text-[0.55rem] font-black uppercase tracking-[0.18em] text-sky-400/55 mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Neues Peptid
          </p>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
            disabled={isLoading}
            placeholder="z.B. Hexarelin, PT-141, Melanotan II…"
            className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-500/50 transition-colors mb-4"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {status === 'loading'
              ? <><Loader2 size={14} className="animate-spin" /> KI generiert Profil…</>
              : <><Sparkles size={14} /> Profil generieren</>
            }
          </button>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <div className="mt-4 bg-red-950/30 border border-red-500/20 rounded-2xl p-4 flex gap-3">
          <X size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-300 font-medium mb-1">Fehler</p>
            <p className="text-xs text-red-300/70">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── SUCCESS ─────────────────────────────────────────────────────────── */}
      {status === 'done' && (
        <div className="mt-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 flex gap-3">
          <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-300">{savedMsg}</p>
        </div>
      )}

      {/* ── PREVIEW ─────────────────────────────────────────────────────────── */}
      {showPreview && result && (
        <div className="mt-5 bg-[#0B1220] border border-sky-500/20 rounded-2xl overflow-hidden">
          {/* Preview Header */}
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <p
                className="text-[0.55rem] font-black uppercase tracking-[0.18em] text-sky-400/55"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                KI-Vorschau
              </p>
              <p className="text-sm font-bold text-white mt-0.5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {String(result.name ?? result.slug ?? '—')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setResult(null); setStatus('idle') }}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Evidence quick view */}
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <EvidencePreview result={result} />
          </div>

          {/* Fields */}
          <div className="px-5 py-4 space-y-3 max-h-[40vh] overflow-y-auto">
            <PreviewField label="TLDR"             value={result.tldr} />
            <PreviewField label="Mechanismus"      value={result.mechanism} />
            <PreviewField label="Forschungsbereiche" value={result.benefits} />
            <PreviewField label="Dosierungen"      value={result.research_dosage} />
            <PreviewField label="Halbwertszeit"    value={result.half_life} />
            <PreviewField label="Nebenwirkungen"   value={result.side_effects} />
            <PreviewField label="Wissenslücken"    value={result.research_gaps} />
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-white/[0.06] flex gap-3">
            <button
              type="button"
              onClick={() => { setResult(null); setStatus('idle') }}
              className="btn-secondary flex-1 text-sm"
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={tab === 'update' ? saveUpdate : saveNew}
              disabled={isSaving}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              {isSaving
                ? <><Loader2 size={14} className="animate-spin" /> Speichern…</>
                : <><Save size={14} /> In Bibliothek speichern</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
