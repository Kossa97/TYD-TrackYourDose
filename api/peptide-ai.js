// api/peptide-ai.js — Vercel Serverless Function

// Immer JSON zurückgeben, niemals HTML-Fehlerseite
function sendJSON(res, status, obj) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = status
    res.end(JSON.stringify(obj))
  }
}

// Body lesen — Fallback falls req.body nicht automatisch geparst wird
async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk.toString() })
    req.on('end', () => {
      try { resolve(JSON.parse(raw)) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

function buildCreatePrompt(name) {
  return `Du bist ein wissenschaftlicher Forschungsassistent. Erstelle ein umfassendes, wissenschaftlich korrektes Forschungsprofil für das Peptid: ${name}

PFLICHTREGELN:
- Alle Texte auf DEUTSCH
- Neutrale wissenschaftliche Sprache, KEINE Therapieempfehlungen
- Dosierungen NUR aus veröffentlichten Studien (nicht "empfohlen")
- Formulierungen: "wurde untersucht für", "in Studien beobachtet", "potenzielle Effekte"
- Ehrliche Evidenzbewertung, nicht übertreiben

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Text davor oder danach:

{
  "slug": "kleinbuchstaben-bindestrich",
  "name": "Offizieller Kurzname",
  "full_name": "Vollständiger Name oder null",
  "category": "heilung",
  "tldr": "1-2 Sätze neutrale Zusammenfassung.",
  "mechanism": "Detaillierter Wirkmechanismus: Rezeptoren, Signalwege.",
  "benefits": ["Forschungsbereich 1", "Forschungsbereich 2"],
  "research_dosage": "Dosierungen aus publizierten Studien mit Spezies und Route.",
  "half_life": "Halbwertszeit.",
  "administration": ["Verabreichungsweg 1"],
  "research_status": "preclinical",
  "side_effects": ["Berichtete Nebenwirkung 1"],
  "contraindications": ["Kontraindikation 1"],
  "evidence_human": "none",
  "evidence_animal": "none",
  "evidence_clinical": "none",
  "evidence_score": 1,
  "research_gaps": ["Wissenslücke 1", "Wissenslücke 2"],
  "pubmed_query": "english pubmed query"
}

category: heilung | wachstumshormon | nootropikum | stoffwechsel | anti_aging | sexualgesundheit
research_status: preclinical | phase_1 | phase_2 | approved
evidence_human: none | limited | moderate | strong
evidence_animal: none | limited | moderate | strong
evidence_clinical: none | sparse | moderate | extensive
evidence_score: Ganzzahl 1-10`
}

function buildUpdatePrompt(existing) {
  return `Du bist ein wissenschaftlicher Forschungsassistent. Aktualisiere und verbessere dieses Peptid-Forschungsprofil.

BESTEHENDES PROFIL:
${JSON.stringify(existing, null, 2)}

PFLICHTREGELN:
- Alle Texte auf DEUTSCH
- Neutrale wissenschaftliche Sprache ohne Therapieempfehlungen
- Verbessere Formulierungen wo nötig

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt:

{
  "tldr": "...",
  "mechanism": "...",
  "benefits": [...],
  "research_dosage": "...",
  "half_life": "...",
  "administration": [...],
  "research_status": "...",
  "side_effects": [...],
  "contraindications": [...],
  "evidence_human": "none|limited|moderate|strong",
  "evidence_animal": "none|limited|moderate|strong",
  "evidence_clinical": "none|sparse|moderate|extensive",
  "evidence_score": 1,
  "research_gaps": [...]
}`
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 200
    res.end()
    return
  }

  // Alles in einem großen try-catch — garantiert JSON zurück
  try {
    if (req.method !== 'POST') {
      sendJSON(res, 405, { error: 'Method not allowed' })
      return
    }

    const apiKey = process.env.VITE_ANTHROPIC_KEY
    if (!apiKey) {
      sendJSON(res, 500, { error: 'VITE_ANTHROPIC_KEY fehlt in Vercel Environment Variables' })
      return
    }

    const body = await readBody(req)
    const action   = body.action
    const name     = body.name
    const existing = body.existing

    if (!action) {
      sendJSON(res, 400, { error: 'action fehlt (create | update)' })
      return
    }

    let prompt
    if (action === 'create') {
      if (!name) { sendJSON(res, 400, { error: 'name fehlt' }); return }
      prompt = buildCreatePrompt(name)
    } else if (action === 'update') {
      if (!existing) { sendJSON(res, 400, { error: 'existing fehlt' }); return }
      prompt = buildUpdatePrompt(existing)
    } else {
      sendJSON(res, 400, { error: `Unbekannte action: ${action}` })
      return
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      sendJSON(res, 500, { error: `Anthropic ${aiRes.status}: ${detail.slice(0, 300)}` })
      return
    }

    const aiData = await aiRes.json()
    const text = (aiData.content?.[0]?.text) ?? ''
    const match = text.match(/\{[\s\S]*\}/)

    if (!match) {
      sendJSON(res, 500, { error: 'Kein JSON in KI-Antwort', raw: text.slice(0, 300) })
      return
    }

    const result = JSON.parse(match[0])
    sendJSON(res, 200, { result })

  } catch (err) {
    sendJSON(res, 500, { error: String(err && err.message ? err.message : err) })
  }
}
