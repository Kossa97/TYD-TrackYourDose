# Design: Automatisiertes Marketing Content Studio — Sub-Projekt 1: Content-Engine + Social-Posts

**Datum:** 2026-07-06
**Status:** Design freigegeben, wartet auf Spec-Review
**Zielort:** Separates neues Repo (Arbeitstitel `peptid-content-studio`). Dieses Dokument liegt im Tracker-Repo, weil das Studio-Repo noch nicht existiert.

## 1. Kontext & Ziel

Der Peptid-Tracker (React 19 + Vite + Capacitor iOS/Android/PWA, Supabase, mehrsprachig) braucht kontinuierlichen Marketing-Content. Ziel ist ein separates, automatisiertes Content Studio: Es generiert Post-Entwürfe, der Betreiber reviewt, bearbeitet und gibt frei. Freigegebene Assets liegen fertig zum Posten bereit.

## 2. Gesamtvorhaben & Zerlegung

Das Gesamtvorhaben (Social-Posts, Videos, Blog/SEO, App-Store-Assets, Newsletter, Auto-Publishing, Analytics) ist zu groß für einen Spec. Es wird in fünf Sub-Projekte zerlegt; jedes durchläuft eigenen Spec → Plan → Umsetzung:

1. **Fundament: Content-Engine + Social-Posts** ← dieses Dokument
2. **Publishing & Scheduling** — Kanal-APIs (Instagram/X/Reddit), Content-Kalender, Auto-Posting. Achtung: Business-Accounts/API-Freigaben nötig; Plattform-Richtlinien der Peptid-Nische (Health Claims) einplanen.
3. **Blog/SEO + Newsletter** — textlastig, nutzt dieselbe Engine; Blog braucht Website als Ziel, Newsletter Versand-Infrastruktur + Empfänger aus Supabase.
4. **Videos/Reels + App-Store-Assets + YouTube** — Rendering-Pipeline, am aufwendigsten.
5. **Analytics/Feedback-Loop** — misst Performance pro Kanal, fließt in die Generierung zurück; ergibt erst mit Live-Content Sinn.

## 3. Anforderungen Sub-Projekt 1

- Eigene Web-App im separaten Repo; Stack wie der Tracker: Vite + React + TypeScript + Tailwind, Tests mit Vitest.
- **Eigenes Supabase-Projekt** (nicht das der Tracker-App): Marketing-Tooling bleibt von Produktions-Nutzerdaten getrennt, keine RLS-Verflechtung. Ein Nutzer (Betreiber), Login über Supabase Auth.
- **Kanäle:** Instagram (Feed 1:1/4:5, Story 9:16), X/Twitter, Reddit, TikTok (nur Captions/Hooks — Video folgt in Sub-Projekt 4). YouTube folgt mit Sub-Projekt 4.
- **Sprachen:** Deutsch + Englisch, pro Sprache nativ generiert (keine Übersetzungskette — Reddit-EN und Instagram-DE brauchen unterschiedlichen Ton).
- **Trigger:** geplanter Auto-Batch (Zeitplan + Batch-Größe einstellbar) und On-Demand-Generierung aus der Webapp („generiere Posts zu Feature X").
- **Bilder:** ausschließlich Brand-Templates, keine KI-Bildgenerierung.
- **Themen:** Wissensbasis initial aus App-Inhalten gespeist (Features, FAQ, Peptid-Bibliothek) plus manuell gepflegter Themenpool.
- **Review-Workflow:** Queue → kanalgetreue Vorschau → Bearbeiten → Freigeben/Verwerfen.
- **Betrieb:** Die Webapp läuft für v1 lokal (`npm run dev`); Hosting ist optional und später. Der Auto-Batch läuft unabhängig davon serverseitig in Supabase.

## 4. Architektur

**Gewählt: Supabase-zentriert mit Client-Rendering.**

- Eine Supabase Edge Function `generate-batch` ruft die Claude API auf. Sie bedient beide Trigger über einen Codepfad: `pg_cron` (geplanter Batch) und die Webapp (On-Demand mit Thema/Anweisung als Parameter). `pg_cron` feuert dabei in festem Takt (z. B. stündlich); die Function prüft gegen den Zeitplan in `settings`, ob ein Batch fällig ist — so wirken Zeitplan-Änderungen sofort, ohne den Cron-Job neu zu registrieren. Der Claude-API-Key liegt als Edge-Function-Secret.
- **Bilder werden nie serverseitig gerendert.** Templates sind deterministisch (Template + Parameter = Bild): Der Browser rendert sie live als Vorschau; bei Freigabe exportiert er sie per Canvas als PNG und lädt sie in Supabase Storage hoch. Vorschau = Endprodukt, kein Rendering-Server nötig. Die Storage-Ablage ist zugleich die vorbereitete Schnittstelle für Auto-Publishing (Sub-Projekt 2).
- **Kostenkniff:** Pro Thema × Sprache genau ein Claude-Call, der alle Kanal-Varianten auf einmal als strukturiertes JSON liefert. Ein 5-Themen-Batch in DE+EN sind 10 Calls — Kosten im Cent-Bereich. Modellwahl liegt in den Settings.

**Verworfene Alternativen:**
- *GitHub Actions als Motor* (Node-Skripte + Actions-Cron): vertrauter Skript-Stil, aber On-Demand aus der Webapp erfordert workflow_dispatch über die GitHub-API mit Token, und Actions-Cron ist zeitlich unzuverlässig.
- *Eigener Server:* maximale Freiheit, aber dauerhafter Betriebs- und Kostenaufwand — Overkill für ein Solo-Tool.

## 5. Datenmodell (Postgres)

| Tabelle | Zweck |
|---|---|
| `knowledge` | Wissensbasis: Brand Voice, Zielgruppen, Feature-Beschreibungen, FAQ-Auszüge, Guardrails. Felder: `id`, `kind` (brand_voice / feature / faq / persona / guardrail), `source` (app_content / manual), `title`, `content`, `updated_at`. Im Studio editierbar. |
| `topics` | Themenpool: `title`, `description`, `source` (app_content / manual), `status` (idea / queued / used / retired), `priority`, `last_used_at` (für Rotation), `notes`. |
| `batches` | Ein Generierungslauf: `trigger` (scheduled / manual), `status` (running / done / partial / failed), Zeitstempel. |
| `drafts` | Ein Entwurf = Thema × Kanal × Sprache: `batch_id`, `topic_id`, `channel`, `language`, `status` (draft / edited / approved / rejected / error), `hook`, `body_text`, `hashtags`, `template_id`, `template_params` (JSONB), `image_url` (nach Freigabe), `error_message`, `reviewed_at`. |
| `settings` | Batch-Größe, aktive Kanäle, Zeitplan (Cron-Ausdruck), Sprachen, Modellwahl. |

**Bild-Templates leben als React-Komponenten im Studio-Repo**, nicht in der DB — versioniert, typsicher, mit Parameter-Schema. Die DB referenziert nur `template_id` + `template_params`.

**Seeding der Wissensbasis:** Ein Skript im Studio-Repo liest den lokal ausgecheckten Tracker (Pfad per Env-Variable), extrahiert Features, FAQ-Inhalte und Peptid-Bibliothek und upsertet sie in `knowledge`. Initial einmal ausführen, danach manuell wiederholbar (Upsert überschreibt App-Quellen, manuelle Einträge bleiben unberührt).

## 6. Generierungs-Pipeline (Edge Function `generate-batch`)

1. **Themenwahl:** N Themen aus dem Pool (N = Batch-Größe aus Settings). Rotation: priorisierte zuerst, dann „am längsten nicht verwendet". Bei On-Demand kommt das Thema bzw. die Anweisung direkt aus der Webapp.
2. **Generierung:** Pro Thema × Sprache ein Claude-Call mit Wissensbasis-Auszug, Kanal-Styleguides (Reddit = Community-Ton ohne Werbesprech, Instagram = Hook + Hashtags, X = kurz, TikTok = Caption/Hook) und Compliance-Guardrails. Antwort als strukturiertes JSON: pro Kanal Text, Hook, Hashtags, Template-Parameter.
3. **Validierung:** JSON gegen Zod-Schema, Kanal-Limits erzwungen (z. B. X-Zeichenlimit), Guardrail-Check als zweite Prüfschicht. Bei ungültiger Antwort genau ein automatischer Retry, danach Fehler-Status.
4. **Ablage:** Entwürfe als `drafts` in die Queue, Batch-Status aktualisieren.

**Compliance-Guardrails (Peptid-Nische, nicht verhandelbar):** keine Heilversprechen, keine Dosierungsempfehlungen als Marketing, keine medizinischen Claims. Verankert im Prompt und zusätzlich als Validierungsschicht (Muster-Erkennung), mit Tests abgesichert.

## 7. Review-UI (drei Ansichten)

- **Queue:** Entwürfe gruppiert nach Batch/Thema, filterbar nach Kanal/Sprache/Status. Badge zeigt offene Reviews.
- **Editor:** Kanalgetreue Vorschau — links das live gerenderte Bild-Template (React-Komponente mit `template_params`), rechts der Text in Kanal-Optik. Text und Bild-Slots direkt editierbar, Template wechselbar. Aktionen: Freigeben / Verwerfen / Neu generieren.
- **Verwaltung:** Themenpool pflegen, Wissensbasis editieren, Settings (Batch-Größe, Kanäle, Zeitplan, Sprachen, Modell).

**Freigabe-Ablauf:** Browser rendert das Template zu PNG (Canvas-Export) → Upload nach Supabase Storage → erst nach erfolgreichem Upload wechselt der Status auf `approved`. Freigegebene Posts sind als Bundle (PNG + Caption-Text) herunterladbar — für manuelles Posten jetzt, für Auto-Publishing in Sub-Projekt 2.

## 8. Fehlerbehandlung

- **Pro Entwurf isoliert:** Jede Thema×Sprache-Generierung in eigenem try/catch — ein fehlgeschlagener Call killt nie den Batch. Fehlgeschlagene Einträge erscheinen in der Queue mit Fehlermeldung und „Erneut versuchen"-Button.
- **Batch-Sichtbarkeit:** Jeder Lauf protokolliert Erfolg/Teilerfolg/Fehlschlag in `batches`; die UI zeigt gescheiterte Läufe beim nächsten Öffnen — ein stiller Cron-Ausfall bleibt nicht wochenlang unbemerkt.
- **Ungültige LLM-Antworten:** Zod-Validierung mit einem Retry, danach `error`-Status statt kaputtem Entwurf.
- **Rendering/Upload:** Template-Parameter gegen das Template-Schema geprüft; Storage-Upload mit Retry; Freigabe gilt erst nach erfolgreichem Upload.

## 9. Testing

- **Unit (Vitest):** Themen-Rotation, Prompt-Builder, Zod-Schemata, Guardrail-Validierung (erkennt Heilversprechen-/Dosierungs-Muster), Kanal-Zeichenlimits.
- **Templates:** Smoke-Test — jedes Template rendert mit Beispiel-Parametern fehlerfrei.
- **Edge Function:** lokal über Supabase CLI mit gemockten Claude-Antworten.
- **Abnahme (manuell, E2E):** Ein echter Batch — generieren, in der Queue reviewen, bearbeiten, freigeben; PNG liegt in Storage, Bundle ist herunterladbar.

## 10. Nicht im Umfang von Sub-Projekt 1

- Kein Auto-Publishing, keine Kanal-APIs (→ Sub-Projekt 2; Storage-Ablage ist die vorbereitete Schnittstelle)
- Keine Videos, kein YouTube (→ Sub-Projekt 4)
- Kein Blog, kein Newsletter (→ Sub-Projekt 3)
- Keine Analytics (→ Sub-Projekt 5)
- Keine KI-Bildgenerierung — nur Brand-Templates (Hybrid später möglich)
- Kein Multi-User, keine Rollen

## 11. Erfolgskriterien

1. Auto-Batch läuft nach Zeitplan und füllt die Queue mit gültigen Entwürfen in DE+EN für alle aktiven Kanäle.
2. On-Demand-Generierung aus der Webapp funktioniert über denselben Codepfad.
3. Kompletter E2E-Durchlauf bestanden: generieren → reviewen → bearbeiten → freigeben → PNG in Storage + Bundle-Download.
4. Batch-Größe, Kanäle, Zeitplan und Modell sind über Settings änderbar, ohne Code anzufassen.
5. Guardrail-Tests grün; kein Entwurf mit Heilversprechen/Dosierungsempfehlung passiert die Validierung unmarkiert.
