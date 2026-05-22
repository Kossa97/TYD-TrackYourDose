// api/peptide-ai.js
// Vercel Serverless Function — Anthropic API server-seitig aufrufen

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
- Aktualisiere Evidenzbewertungen wenn nötig
- Ergänze research_gaps

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.VITE_ANTHROPIC_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'VITE_ANTHROPIC_KEY nicht konfiguriert in Vercel' })
  }

  const body = req.body ?? {}
  const { action, name, existing } = body

  if (!action) return res.status(400).json({ error: 'action fehlt' })

  let prompt = ''
  if (action === 'create') {
    if (!name) return res.status(400).json({ error: 'name fehlt' })
    prompt = buildCreatePrompt(name)
  } else if (action === 'update') {
    if (!existing) return res.status(400).json({ error: 'existing fehlt' })
    prompt = buildUpdatePrompt(existing)
  } else {
    return res.status(400).json({ error: `Unbekannte action: ${action}` })
  }

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      return res.status(500).json({ error: `KI API Fehler ${aiRes.status}`, detail })
    }

    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text ?? ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return res.status(500).json({ error: 'Kein JSON in KI-Antwort', raw: text })
    }

    const result = JSON.parse(match[0])
    return res.status(200).json({ result })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
