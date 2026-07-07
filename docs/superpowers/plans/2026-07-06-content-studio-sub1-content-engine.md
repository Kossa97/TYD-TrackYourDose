# Content Studio Sub-Projekt 1 (Content-Engine + Social-Posts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein separates Content-Studio (Web-App + Supabase-Backend), das Social-Post-Entwürfe (DE+EN, Instagram/X/Reddit/TikTok) per Claude API generiert — geplant via pg_cron und on-demand — mit Review-Queue, Editor, Brand-Templates und Freigabe-Export nach Supabase Storage.

**Architecture:** Eigenes Repo `C:\Users\Devin\peptid-content-studio` + eigenes Supabase-Projekt. Eine Edge Function `generate-batch` (Deno) bedient Cron- und On-Demand-Trigger über einen Codepfad; pure Logik (Schemas, Guardrails, Rotation, Schedule, Prompt) liegt in `supabase/functions/_shared/` und wird von Vitest (Node) UND der Edge Function (Deno, via Import-Map) genutzt. Bilder rendert ausschließlich der Browser (SVG-Templates → Canvas → PNG → Storage).

**Tech Stack:** Vite + React 19 + TypeScript + Tailwind 3.4, react-router-dom 7, @supabase/supabase-js, Zod, Vitest, tsx, Supabase CLI (npm-Paket `supabase`), Claude API (Default-Modell `claude-sonnet-5`).

**Spec:** `docs/superpowers/specs/2026-07-06-marketing-content-studio-design.md` (im Tracker-Repo)

**Wichtig für den Ausführenden:**
- Alle Pfade sind relativ zu `C:\Users\Devin\peptid-content-studio` (neues Repo, wird in Task 1 erstellt). Ausnahmen sind explizit markiert. KEIN Worktree des Tracker-Repos — es ist ein eigenständiges neues Repo.
- Shell ist PowerShell 5.1: kein `&&` — Befehle mit `;` verketten oder einzeln ausführen.
- Schritte mit **[MANUAL — Devin]** kann der Agent nicht ausführen (Supabase-Dashboard, Secrets). Dort anhalten und Devin bitten, den Schritt zu erledigen.
- Konkretisierungen gegenüber dem Spec (bewusst, keine Fehler): (1) `knowledge.kind` bekommt zusätzlich den Wert `peptide` (Peptid-Bibliothek passt in keine Spec-Kategorie). (2) Der „Zeitplan" in `settings` ist JSONB `{"weekday":0-6,"hour":0-23}` (UTC) statt Cron-String — pg_cron feuert stündlich, die Function prüft Fälligkeit. (3) Drafts haben zusätzlich `guardrail_flags text[]` (Spec §11.5 verlangt Markierung). (4) Kanal-Limit-Verstöße blockieren nicht, sondern markieren (`char_limit_exceeded` in `guardrail_flags`) — der Editor zeigt es, Devin fixt beim Review. (5) Der Edge-Function-Test mit gemockten Claude-Antworten läuft gegen das deployte Remote-Projekt (Secret `MOCK_CLAUDE=1`) statt „lokal über Supabase CLI" — der lokale Stack bräuchte Docker; der Mock-Mechanismus ist derselbe.

---

## Task 1: Repo-Scaffold

**Files:**
- Create: komplettes Vite-Scaffold in `C:\Users\Devin\peptid-content-studio`
- Create: `vitest.config.ts`, `.env.example`, `tailwind.config.js` (angepasst), `src/index.css` (ersetzt)
- Modify: `package.json` (Scripts), `tsconfig.app.json`

- [ ] **Step 1: Projekt scaffolden**

```powershell
New-Item -ItemType Directory -Force C:\Users\Devin\peptid-content-studio
Set-Location C:\Users\Devin\peptid-content-studio
npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom @supabase/supabase-js zod
npm install -D tailwindcss@^3.4.19 postcss autoprefixer vitest tsx supabase @types/node
npx tailwindcss init -p
```

Erwartet: `package.json`, `src/`, `tailwind.config.js`, `postcss.config.js` existieren.

- [ ] **Step 2: Tailwind + CSS konfigurieren**

`tailwind.config.js` komplett ersetzen:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

`src/index.css` komplett ersetzen:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Löschen: `src/App.css`, `src/assets/react.svg` (Referenzen entfernt in Task 8, bis dahin bleibt `App.tsx` vom Scaffold unangetastet).
Wichtig: `src/App.tsx` importiert `./App.css` — diese Import-Zeile jetzt entfernen, sonst bricht der Build.

- [ ] **Step 3: package.json-Scripts + vitest.config.ts + tsconfig anpassen**

In `package.json` unter `"scripts"` ergänzen/ersetzen:

```json
"test": "vitest run",
"test:watch": "vitest",
"seed": "tsx scripts/seed-knowledge.ts"
```

`vitest.config.ts` erstellen:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
  },
})
```

In `tsconfig.app.json`: `"include"` auf `["src", "supabase/functions/_shared"]` setzen und in `compilerOptions` ergänzen: `"allowImportingTsExtensions": true` (nötig, weil _shared-Module Deno-kompatible `.ts`-Endungen in Imports nutzen; Scaffold hat bereits `noEmit`).

`.env.example` erstellen:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Erwartet: Build läuft durch ohne Fehler (Scaffold-App + leere Anpassungen).

- [ ] **Step 5: Git init + Commit**

```powershell
git init
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + Vitest"
```

---

## Task 2: Supabase-Projekt + Schema-Migration

**Files:**
- Create: `supabase/migrations/20260706120000_init.sql`
- Create: `supabase/config.toml` (via CLI)

- [ ] **Step 1: [MANUAL — Devin] Supabase-Projekt anlegen**

Devin legt im Supabase-Dashboard (https://supabase.com/dashboard) ein **neues Projekt** an (Name z.B. `peptid-content-studio`, Region EU). Danach werden gebraucht: **Project Ref**, **anon key**, **service_role key** (Settings → API). Außerdem `npx supabase login` einmal ausführen (öffnet Browser).

- [ ] **Step 2: CLI initialisieren und linken**

```powershell
npx supabase init
npx supabase link --project-ref YOUR-PROJECT-REF
```

Erwartet: `supabase/config.toml` existiert, Link erfolgreich.

- [ ] **Step 3: Migration schreiben**

`supabase/migrations/20260706120000_init.sql`:

```sql
-- Wissensbasis
create table knowledge (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('brand_voice','feature','faq','persona','guardrail','peptide')),
  source text not null default 'manual' check (source in ('app_content','manual')),
  app_key text unique,           -- deterministischer Upsert-Key fuer app_content, null bei manuellen Eintraegen
  title text not null,
  content text not null,
  updated_at timestamptz not null default now()
);

-- Themenpool
create table topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  source text not null default 'manual' check (source in ('app_content','manual')),
  status text not null default 'idea' check (status in ('idea','queued','used','retired')),
  priority int not null default 0,
  last_used_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Generierungslaeufe
create table batches (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('scheduled','manual')),
  status text not null default 'running' check (status in ('running','done','partial','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Entwuerfe: Thema x Kanal x Sprache
create table drafts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  channel text not null check (channel in ('instagram','x','reddit','tiktok')),
  language text not null check (language in ('de','en')),
  status text not null default 'draft' check (status in ('draft','edited','approved','rejected','error')),
  hook text not null default '',
  body_text text not null default '',
  hashtags text[] not null default '{}',
  template_id text not null default 'announcement',
  template_params jsonb not null default '{}',
  guardrail_flags text[] not null default '{}',
  image_url text,
  error_message text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Einstellungen (genau eine Zeile)
create table settings (
  id int primary key check (id = 1),
  batch_size int not null default 5,
  channels text[] not null default '{instagram,x,reddit,tiktok}',
  languages text[] not null default '{de,en}',
  schedule jsonb not null default '{"weekday":1,"hour":9}',
  model text not null default 'claude-sonnet-5'
);
insert into settings (id) values (1);

-- RLS: eingeloggter Nutzer darf alles (Solo-Tool); Edge Function nutzt service_role (bypasst RLS)
alter table knowledge enable row level security;
alter table topics enable row level security;
alter table batches enable row level security;
alter table drafts enable row level security;
alter table settings enable row level security;

create policy "auth all knowledge" on knowledge for all to authenticated using (true) with check (true);
create policy "auth all topics" on topics for all to authenticated using (true) with check (true);
create policy "auth all batches" on batches for all to authenticated using (true) with check (true);
create policy "auth all drafts" on drafts for all to authenticated using (true) with check (true);
create policy "auth all settings" on settings for all to authenticated using (true) with check (true);

-- Storage-Bucket fuer freigegebene Assets (public read: Marketing-Material)
insert into storage.buckets (id, name, public) values ('post-assets', 'post-assets', true);
create policy "auth insert post-assets" on storage.objects for insert to authenticated with check (bucket_id = 'post-assets');
create policy "auth update post-assets" on storage.objects for update to authenticated using (bucket_id = 'post-assets');
create policy "public read post-assets" on storage.objects for select to public using (bucket_id = 'post-assets');
```

- [ ] **Step 4: Migration pushen und prüfen**

Run: `npx supabase db push`
Erwartet: Migration wird angewendet, Exit 0.
Run: `npx supabase migration list`
Erwartet: `20260706120000` erscheint als applied (Local + Remote).

- [ ] **Step 5: .env.local anlegen (nicht committen) + Commit**

`.env.local` mit echten Werten aus Step 1 füllen (Format siehe `.env.example`).

```powershell
git add supabase/config.toml supabase/migrations/20260706120000_init.sql
git commit -m "feat: Supabase-Schema (knowledge, topics, batches, drafts, settings) + Storage-Bucket"
```

---

## Task 3: _shared — Kanäle & Zod-Schemata

**Files:**
- Create: `supabase/functions/_shared/channels.ts`
- Create: `supabase/functions/_shared/schemas.ts`
- Test: `supabase/functions/_shared/schemas.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildGenerationSchema, checkCharLimit, templateParamsSchema } from './schemas.ts'

describe('templateParamsSchema', () => {
  it('accepts headline + subline', () => {
    const r = templateParamsSchema.safeParse({ headline: 'Track smarter', subline: 'Cycles, doses, stock' })
    expect(r.success).toBe(true)
  })
  it('rejects missing headline', () => {
    expect(templateParamsSchema.safeParse({ subline: 'x' }).success).toBe(false)
  })
})

describe('buildGenerationSchema', () => {
  const valid = {
    variants: {
      x: {
        hook: 'One app for your whole protocol',
        body_text: 'Short post text',
        hashtags: [],
        template_params: { headline: 'Track smarter', subline: '' },
      },
    },
  }
  it('accepts a valid single-channel result', () => {
    expect(buildGenerationSchema(['x']).safeParse(valid).success).toBe(true)
  })
  it('rejects when a requested channel is missing', () => {
    expect(buildGenerationSchema(['x', 'reddit']).safeParse(valid).success).toBe(false)
  })
})

describe('checkCharLimit', () => {
  it('flags x posts over 280 chars', () => {
    expect(checkCharLimit('x', 'a'.repeat(281))).toBe('char_limit_exceeded')
  })
  it('passes x posts at 280 chars', () => {
    expect(checkCharLimit('x', 'a'.repeat(280))).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/schemas.test.ts`
Erwartet: FAIL — `Cannot find module './schemas.ts'` (o.ä.)

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/channels.ts`:

```ts
export const CHANNELS = ['instagram', 'x', 'reddit', 'tiktok'] as const
export type Channel = (typeof CHANNELS)[number]

export const LANGUAGES = ['de', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export interface ChannelSpec {
  id: Channel
  label: string
  maxChars: number
  needsImage: boolean
  styleguide: string
}

export const CHANNEL_SPECS: Record<Channel, ChannelSpec> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    maxChars: 2200,
    needsImage: true,
    styleguide:
      'Instagram feed post. Strong first-line hook, short scannable paragraphs, 5-10 relevant hashtags, friendly and visual tone. The image carries the core message; the caption adds depth.',
  },
  x: {
    id: 'x',
    label: 'X / Twitter',
    maxChars: 280,
    needsImage: true,
    styleguide:
      'X (Twitter) post. Maximum 280 characters TOTAL for body_text. Punchy, conversational, no hashtag spam (0-2 inline hashtags), no thread.',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    maxChars: 5000,
    needsImage: false,
    styleguide:
      'Reddit post for peptide-adjacent subreddits. hook = post title. Community tone, first person, honest and informative, invites discussion. Absolutely NO marketing speak, no emojis, no hashtags.',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok (Caption)',
    maxChars: 2200,
    needsImage: false,
    styleguide:
      'TikTok caption + hook for a future short video. hook = spoken opening line (first 3 seconds). body_text = caption with 3-6 hashtags.',
  },
}
```

`supabase/functions/_shared/schemas.ts`:

```ts
import { z } from 'zod'
import { CHANNEL_SPECS, type Channel } from './channels.ts'

export const templateParamsSchema = z.object({
  headline: z.string().min(1).max(80),
  subline: z.string().max(140).default(''),
})
export type TemplateParams = z.infer<typeof templateParamsSchema>

export const channelVariantSchema = z.object({
  hook: z.string().min(1).max(300),
  body_text: z.string().min(1),
  hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_-]+$/u)).max(10).default([]),
  template_params: templateParamsSchema,
})
export type ChannelVariant = z.infer<typeof channelVariantSchema>

/** Schema fuer die LLM-Antwort: genau die angeforderten Kanaele muessen enthalten sein. */
export function buildGenerationSchema(channels: Channel[]) {
  const shape: Record<string, typeof channelVariantSchema> = {}
  for (const c of channels) shape[c] = channelVariantSchema
  return z.object({ variants: z.object(shape) })
}

/** null = ok, sonst Flag-Id. Blockiert nicht — markiert (Editor zeigt es). */
export function checkCharLimit(channel: Channel, bodyText: string): string | null {
  return bodyText.length > CHANNEL_SPECS[channel].maxChars ? 'char_limit_exceeded' : null
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/schemas.test.ts`
Erwartet: PASS (6 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/channels.ts supabase/functions/_shared/schemas.ts supabase/functions/_shared/schemas.test.ts
git commit -m "feat: Kanal-Specs + Zod-Schemata fuer LLM-Output"
```

---

## Task 4: _shared — Guardrails

**Files:**
- Create: `supabase/functions/_shared/guardrails.ts`
- Test: `supabase/functions/_shared/guardrails.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/guardrails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { checkGuardrails } from './guardrails.ts'

describe('checkGuardrails', () => {
  it('flags German dosage advice', () => {
    expect(checkGuardrails('Nimm 5 mg täglich für beste Ergebnisse')).toContain('dosage_advice')
  })
  it('flags English dosage advice', () => {
    expect(checkGuardrails('You should take 250 mcg before bed')).toContain('dosage_advice')
  })
  it('flags healing claims (de)', () => {
    expect(checkGuardrails('BPC-157 heilt deine Verletzungen')).toContain('healing_claim')
  })
  it('flags healing claims (en)', () => {
    expect(checkGuardrails('This peptide cures joint pain')).toContain('healing_claim')
  })
  it('flags medical claims', () => {
    expect(checkGuardrails('It treats disease effectively')).toContain('medical_claim')
  })
  it('passes clean app-marketing copy', () => {
    expect(checkGuardrails('Track your cycles, doses and stock in one private app.')).toEqual([])
    expect(checkGuardrails('Dokumentiere deine Zyklen und Bestände an einem Ort.')).toEqual([])
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/guardrails.test.ts`
Erwartet: FAIL — Modul nicht gefunden

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/guardrails.ts`:

```ts
/**
 * Compliance-Guardrails der Peptid-Nische (zweite Pruefschicht nach dem Prompt):
 * keine Dosierungsempfehlungen, keine Heilversprechen, keine medizinischen Claims.
 * Bewusst grob (Regex): lieber ein False Positive im Review als ein Miss im Feed.
 */
const PATTERNS: { id: string; re: RegExp }[] = [
  {
    id: 'dosage_advice',
    re: /(\bnimm\b|\bnehmen sie\b|du solltest [\s\S]{0,30}(mg|mcg|iu)\b|\btake \d+ ?(mg|mcg|iu)\b|\byou should take\b|recommended dos(e|age)|empfohlene dosis|dosierungsempfehlung)/iu,
  },
  {
    id: 'healing_claim',
    re: /(\bheilt\b|\bkuriert\b|\bcures?\b|\bheals\b|garantiert.{0,20}(heilung|ergebnisse)|guaranteed (results|healing))/iu,
  },
  {
    id: 'medical_claim',
    re: /(behandelt (krankheit|erkrankung|schmerzen)|treats? (disease|condition|pain)|verhindert krankheit|prevents? disease|ersetzt (den )?arzt)/iu,
  },
]

export function checkGuardrails(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id)
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/guardrails.test.ts`
Erwartet: PASS (6 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/guardrails.ts supabase/functions/_shared/guardrails.test.ts
git commit -m "feat: Guardrail-Pruefung (Dosierung, Heilversprechen, Medizin-Claims)"
```

---

## Task 5: _shared — Themen-Rotation

**Files:**
- Create: `supabase/functions/_shared/rotation.ts`
- Test: `supabase/functions/_shared/rotation.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/rotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { selectTopics, type RotatableTopic } from './rotation.ts'

const t = (id: string, over: Partial<RotatableTopic> = {}): RotatableTopic => ({
  id,
  status: 'idea',
  priority: 0,
  last_used_at: null,
  ...over,
})

describe('selectTopics', () => {
  it('ignores used and retired topics', () => {
    const pool = [t('a', { status: 'used' }), t('b', { status: 'retired' }), t('c')]
    expect(selectTopics(pool, 3).map((x) => x.id)).toEqual(['c'])
  })
  it('prefers queued over idea', () => {
    const pool = [t('a'), t('b', { status: 'queued' })]
    expect(selectTopics(pool, 1)[0].id).toBe('b')
  })
  it('prefers higher priority within same status', () => {
    const pool = [t('a', { priority: 1 }), t('b', { priority: 5 })]
    expect(selectTopics(pool, 1)[0].id).toBe('b')
  })
  it('prefers never-used, then least recently used', () => {
    const pool = [
      t('old', { last_used_at: '2026-01-01T00:00:00Z' }),
      t('older', { last_used_at: '2025-06-01T00:00:00Z' }),
      t('never'),
    ]
    expect(selectTopics(pool, 3).map((x) => x.id)).toEqual(['never', 'older', 'old'])
  })
  it('limits to n', () => {
    expect(selectTopics([t('a'), t('b'), t('c')], 2)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/rotation.test.ts`
Erwartet: FAIL — Modul nicht gefunden

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/rotation.ts`:

```ts
export interface RotatableTopic {
  id: string
  status: string
  priority: number
  last_used_at: string | null
}

const STATUS_RANK: Record<string, number> = { queued: 0, idea: 1 }

/** Auswahl fuer den Auto-Batch: queued vor idea, dann Prioritaet absteigend, dann nie/laengst benutzt zuerst. */
export function selectTopics<T extends RotatableTopic>(topics: T[], n: number): T[] {
  return topics
    .filter((t) => t.status in STATUS_RANK)
    .sort((a, b) => {
      if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (b.priority !== a.priority) return b.priority - a.priority
      const at = a.last_used_at ? Date.parse(a.last_used_at) : 0
      const bt = b.last_used_at ? Date.parse(b.last_used_at) : 0
      return at - bt
    })
    .slice(0, n)
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/rotation.test.ts`
Erwartet: PASS (5 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/rotation.ts supabase/functions/_shared/rotation.test.ts
git commit -m "feat: Themen-Rotation (queued > prio > LRU)"
```

---

## Task 6: _shared — Zeitplan-Fälligkeit

**Files:**
- Create: `supabase/functions/_shared/schedule.ts`
- Test: `supabase/functions/_shared/schedule.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isBatchDue } from './schedule.ts'

// Montag 2026-07-06 09:15 UTC (getUTCDay() === 1)
const mondayNine = new Date('2026-07-06T09:15:00Z')

describe('isBatchDue', () => {
  const schedule = { weekday: 1, hour: 9 }
  it('due when weekday+hour match and never ran', () => {
    expect(isBatchDue(schedule, mondayNine, null)).toBe(true)
  })
  it('not due on wrong hour', () => {
    expect(isBatchDue(schedule, new Date('2026-07-06T10:15:00Z'), null)).toBe(false)
  })
  it('not due on wrong weekday', () => {
    expect(isBatchDue(schedule, new Date('2026-07-07T09:15:00Z'), null)).toBe(false)
  })
  it('not due when a scheduled batch already ran within 2h (double-fire guard)', () => {
    expect(isBatchDue(schedule, mondayNine, new Date('2026-07-06T09:01:00Z'))).toBe(false)
  })
  it('due again one week later', () => {
    expect(isBatchDue(schedule, new Date('2026-07-13T09:05:00Z'), mondayNine)).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/schedule.test.ts`
Erwartet: FAIL — Modul nicht gefunden

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/schedule.ts`:

```ts
/** Zeitplan in UTC. pg_cron feuert stuendlich; diese Funktion entscheidet, ob ein Batch faellig ist. */
export interface Schedule {
  weekday: number // 0 = Sonntag ... 6 = Samstag (getUTCDay-Konvention)
  hour: number // 0-23 UTC
}

export function isBatchDue(schedule: Schedule, now: Date, lastScheduledAt: Date | null): boolean {
  if (now.getUTCDay() !== schedule.weekday) return false
  if (now.getUTCHours() !== schedule.hour) return false
  if (lastScheduledAt && now.getTime() - lastScheduledAt.getTime() < 2 * 60 * 60 * 1000) return false
  return true
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/schedule.test.ts`
Erwartet: PASS (5 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/schedule.ts supabase/functions/_shared/schedule.test.ts
git commit -m "feat: Batch-Faelligkeitspruefung (UTC-Wochentag/-Stunde + Doppelzuendungs-Schutz)"
```

---

## Task 7: _shared — Prompt-Builder + Wissens-Auswahl

**Files:**
- Create: `supabase/functions/_shared/prompt.ts`
- Test: `supabase/functions/_shared/prompt.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPrompt, pickRelevantKnowledge, type KnowledgeEntry } from './prompt.ts'

const k = (kind: string, title: string, content = 'c'): KnowledgeEntry => ({ kind, title, content })

describe('pickRelevantKnowledge', () => {
  const pool = [
    k('brand_voice', 'Brand Voice'),
    k('guardrail', 'Compliance'),
    k('persona', 'Audience'),
    k('faq', 'What is the calculator?', 'Dose calculator info'),
    k('faq', 'How do cycles work?', 'Cycle info'),
    k('feature', 'Calculator', 'Calculates doses'),
  ]
  it('always includes brand_voice, persona and guardrail entries', () => {
    const picked = pickRelevantKnowledge(pool, 'Anything', 10)
    const kinds = picked.map((e) => e.kind)
    expect(kinds).toContain('brand_voice')
    expect(kinds).toContain('persona')
    expect(kinds).toContain('guardrail')
  })
  it('prefers topical matches by word overlap with the topic', () => {
    const picked = pickRelevantKnowledge(pool, 'The dose calculator explained', 4)
    const titles = picked.map((e) => e.title)
    expect(titles).toContain('What is the calculator?')
    expect(titles).toContain('Calculator')
    expect(titles).not.toContain('How do cycles work?')
  })
  it('respects the max size', () => {
    expect(pickRelevantKnowledge(pool, 'calculator cycles', 4).length).toBeLessThanOrEqual(4)
  })
})

describe('buildPrompt', () => {
  const prompt = buildPrompt({
    topicTitle: 'Blood level simulation',
    topicDescription: 'Explain the PK simulation feature',
    language: 'de',
    channels: ['x', 'reddit'],
    knowledge: [k('brand_voice', 'Voice', 'clear, no hype')],
  })
  it('contains topic, language, channels, knowledge and compliance rules', () => {
    expect(prompt).toContain('Blood level simulation')
    expect(prompt).toContain('German')
    expect(prompt).toContain('"x"')
    expect(prompt).toContain('"reddit"')
    expect(prompt).toContain('clear, no hype')
    expect(prompt).toContain('COMPLIANCE')
    expect(prompt).toContain('280') // X-Limit landet im Prompt
  })
  it('demands pure JSON output', () => {
    expect(prompt).toContain('ONLY with a single JSON object')
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/prompt.test.ts`
Erwartet: FAIL — Modul nicht gefunden

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/prompt.ts`:

```ts
import { CHANNEL_SPECS, type Channel, type Language } from './channels.ts'

export interface KnowledgeEntry {
  kind: string
  title: string
  content: string
}

export interface PromptInput {
  topicTitle: string
  topicDescription: string
  instruction?: string
  language: Language
  channels: Channel[]
  knowledge: KnowledgeEntry[]
}

const ALWAYS_KINDS = new Set(['brand_voice', 'persona', 'guardrail'])

/**
 * Kern-Wissen (brand_voice/persona/guardrail) immer; feature/faq/peptide nur bei
 * Wort-Ueberschneidung mit dem Thema (naive Relevanz, reicht fuer v1).
 */
export function pickRelevantKnowledge(all: KnowledgeEntry[], topicText: string, max: number): KnowledgeEntry[] {
  const core = all.filter((e) => ALWAYS_KINDS.has(e.kind))
  const words = new Set(
    topicText
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4),
  )
  const topical = all
    .filter((e) => !ALWAYS_KINDS.has(e.kind))
    .filter((e) => {
      const hay = (e.title + ' ' + e.content).toLowerCase()
      for (const w of words) if (hay.includes(w)) return true
      return false
    })
  return [...core, ...topical].slice(0, max)
}

const LANGUAGE_NAMES: Record<Language, string> = { de: 'German (informal "du")', en: 'English' }

export function buildPrompt(input: PromptInput): string {
  const channelBlocks = input.channels
    .map((c) => {
      const s = CHANNEL_SPECS[c]
      return `- "${c}": ${s.styleguide} Hard limit for body_text: ${s.maxChars} characters.`
    })
    .join('\n')

  const knowledgeBlock = input.knowledge
    .map((e) => `[${e.kind}] ${e.title}\n${e.content}`)
    .join('\n\n')

  return `You are the content engine for "Track Your Dose" (TYD), a private documentation app for peptide protocols (cycles, doses, stock, injection sites, bloodwork, progress).

KNOWLEDGE BASE:
${knowledgeBlock}

TASK:
Write social media post drafts in ${LANGUAGE_NAMES[input.language]} about this topic:
Topic: ${input.topicTitle}
Details: ${input.topicDescription}${input.instruction ? `\nExtra instruction: ${input.instruction}` : ''}

Create one variant per channel:
${channelBlocks}

COMPLIANCE — NON-NEGOTIABLE:
- No healing promises, no medical claims, no dosage recommendations.
- The app documents and structures; it does not give medical advice. Never imply otherwise.
- Marketing is about the APP (tracking, structure, privacy, data), never about peptide effects.

For every channel also fill template_params: headline (max 80 chars, punchy, for the post image) and subline (max 140 chars).

Respond ONLY with a single JSON object, no markdown fences, no commentary:
{"variants": {"<channel>": {"hook": string, "body_text": string, "hashtags": string[], "template_params": {"headline": string, "subline": string}}}}
Include exactly these channels as keys: ${input.channels.map((c) => `"${c}"`).join(', ')}.`
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/prompt.test.ts`
Erwartet: PASS (5 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/prompt.ts supabase/functions/_shared/prompt.test.ts
git commit -m "feat: Prompt-Builder + naive Wissens-Relevanzauswahl"
```

---

## Task 8: _shared — Claude-Client (echt + Mock)

**Files:**
- Create: `supabase/functions/_shared/claude.ts`
- Test: `supabase/functions/_shared/claude.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`supabase/functions/_shared/claude.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMockVariants, parseJsonText } from './claude.ts'
import { buildGenerationSchema } from './schemas.ts'

describe('parseJsonText', () => {
  it('parses plain JSON', () => {
    expect(parseJsonText('{"a":1}')).toEqual({ a: 1 })
  })
  it('strips markdown fences', () => {
    expect(parseJsonText('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('throws on garbage', () => {
    expect(() => parseJsonText('not json')).toThrow()
  })
})

describe('buildMockVariants', () => {
  it('produces schema-valid variants for the requested channels', () => {
    const mock = buildMockVariants(['x', 'reddit'])
    expect(buildGenerationSchema(['x', 'reddit']).safeParse(mock).success).toBe(true)
  })
  it('respects the X char limit', () => {
    const mock = buildMockVariants(['x'])
    expect(mock.variants.x.body_text.length).toBeLessThanOrEqual(280)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run supabase/functions/_shared/claude.test.ts`
Erwartet: FAIL — Modul nicht gefunden

- [ ] **Step 3: Implementieren**

`supabase/functions/_shared/claude.ts`:

```ts
import type { Channel } from './channels.ts'
import { buildGenerationSchema, type ChannelVariant } from './schemas.ts'

export interface ClaudeConfig {
  apiKey: string
  model: string
  mock: boolean
}

export function parseJsonText(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  return JSON.parse(cleaned)
}

/** Deterministische, schema-valide Mock-Antwort fuer Tests ohne API-Kosten (MOCK_CLAUDE=1). */
export function buildMockVariants(channels: Channel[]): { variants: Record<string, ChannelVariant> } {
  const variants: Record<string, ChannelVariant> = {}
  for (const c of channels) {
    variants[c] = {
      hook: `Mock hook for ${c}`,
      body_text: `Mock body for ${c}. Track your protocol in one private app.`,
      hashtags: c === 'reddit' || c === 'x' ? [] : ['#trackyourdose', '#peptides'],
      template_params: { headline: 'Mock Headline', subline: `Mock subline for ${c}` },
    }
  }
  return { variants }
}

async function callApi(cfg: ClaudeConfig, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Claude API: unexpected response shape')
  return text
}

export type GenerationResult =
  | { ok: true; variants: Record<string, ChannelVariant> }
  | { ok: false; error: string }

/** Ruft Claude (oder Mock), parst + validiert; bei ungueltiger Antwort genau EIN Retry (Spec §6.3). */
export async function generateVariants(
  cfg: ClaudeConfig,
  prompt: string,
  channels: Channel[],
): Promise<GenerationResult> {
  if (cfg.mock) return { ok: true, variants: buildMockVariants(channels).variants }
  const schema = buildGenerationSchema(channels)
  let lastError = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callApi(cfg, prompt)
      const parsed = schema.safeParse(parseJsonText(text))
      if (parsed.success) return { ok: true, variants: parsed.data.variants as Record<string, ChannelVariant> }
      lastError = `schema validation failed: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: lastError }
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run supabase/functions/_shared/claude.test.ts`
Erwartet: PASS (5 Tests)

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/claude.ts supabase/functions/_shared/claude.test.ts
git commit -m "feat: Claude-Client mit Mock-Modus, JSON-Parsing und 1x-Retry"
```

---

## Task 9: Edge Function `generate-batch` + Deploy + Remote-Mock-Test

**Files:**
- Create: `supabase/functions/generate-batch/index.ts`
- Create: `supabase/functions/generate-batch/deno.json`

- [ ] **Step 1: deno.json (Import-Map) erstellen**

`supabase/functions/generate-batch/deno.json`:

```json
{
  "imports": {
    "zod": "npm:zod@^3.23.8",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.45.0"
  }
}
```

- [ ] **Step 2: Function implementieren**

`supabase/functions/generate-batch/index.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { CHANNELS, LANGUAGES, type Channel, type Language } from '../_shared/channels.ts'
import { checkCharLimit } from '../_shared/schemas.ts'
import { checkGuardrails } from '../_shared/guardrails.ts'
import { selectTopics } from '../_shared/rotation.ts'
import { isBatchDue, type Schedule } from '../_shared/schedule.ts'
import { buildPrompt, pickRelevantKnowledge, type KnowledgeEntry } from '../_shared/prompt.ts'
import { generateVariants, type ClaudeConfig } from '../_shared/claude.ts'

interface RequestBody {
  trigger: 'scheduled' | 'manual'
  topicIds?: string[]
  instruction?: string
}

function jwtRole(authHeader: string | null): string | null {
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  // Autorisierung: Cron-Secret ODER eingeloggter Nutzer (anon key allein reicht nicht)
  const okCron = !!Deno.env.get('CRON_SECRET') && req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')
  const okUser = jwtRole(req.headers.get('authorization')) === 'authenticated'
  if (!okCron && !okUser) return json({ error: 'unauthorized' }, 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }
  if (body.trigger !== 'scheduled' && body.trigger !== 'manual') return json({ error: 'invalid trigger' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: settings, error: settingsErr } = await db.from('settings').select('*').eq('id', 1).single()
  if (settingsErr || !settings) return json({ error: `settings load failed: ${settingsErr?.message}` }, 500)

  const channels = (settings.channels as string[]).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c))
  const languages = (settings.languages as string[]).filter((l): l is Language => (LANGUAGES as readonly string[]).includes(l))
  if (channels.length === 0 || languages.length === 0) return json({ error: 'no channels or languages configured' }, 400)

  // Faelligkeit nur beim Cron-Trigger pruefen
  if (body.trigger === 'scheduled') {
    const { data: lastBatch } = await db
      .from('batches')
      .select('created_at')
      .eq('trigger', 'scheduled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const last = lastBatch ? new Date(lastBatch.created_at) : null
    if (!isBatchDue(settings.schedule as Schedule, new Date(), last)) return json({ skipped: true, reason: 'not due' })
  }

  // Themen bestimmen
  let topics: { id: string; title: string; description: string }[] = []
  if (body.topicIds && body.topicIds.length > 0) {
    const { data, error } = await db.from('topics').select('id,title,description').in('id', body.topicIds)
    if (error || !data || data.length === 0) return json({ error: `topics not found: ${error?.message}` }, 400)
    topics = data
  } else if (body.trigger === 'manual' && body.instruction) {
    const { data, error } = await db
      .from('topics')
      .insert({
        title: body.instruction.slice(0, 80),
        description: body.instruction,
        source: 'manual',
        status: 'queued',
      })
      .select('id,title,description')
      .single()
    if (error || !data) return json({ error: `ad-hoc topic insert failed: ${error?.message}` }, 500)
    topics = [data]
  } else {
    const { data, error } = await db.from('topics').select('id,title,description,status,priority,last_used_at')
    if (error) return json({ error: `topics load failed: ${error.message}` }, 500)
    topics = selectTopics(data ?? [], settings.batch_size as number)
    if (topics.length === 0) return json({ skipped: true, reason: 'no eligible topics' })
  }

  // Batch anlegen
  const { data: batch, error: batchErr } = await db
    .from('batches')
    .insert({ trigger: body.trigger, status: 'running' })
    .select('id')
    .single()
  if (batchErr || !batch) return json({ error: `batch insert failed: ${batchErr?.message}` }, 500)

  const { data: knowledgeRows } = await db.from('knowledge').select('kind,title,content')
  const knowledge: KnowledgeEntry[] = knowledgeRows ?? []

  const cfg: ClaudeConfig = {
    apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    model: settings.model as string,
    mock: Deno.env.get('MOCK_CLAUDE') === '1',
  }

  let okCount = 0
  let failCount = 0

  // Pro Thema x Sprache isoliert generieren (Spec §8: ein Fehler killt nie den Batch)
  for (const topic of topics) {
    for (const language of languages) {
      try {
        const relevantKnowledge = pickRelevantKnowledge(knowledge, `${topic.title} ${topic.description}`, 12)
        const prompt = buildPrompt({
          topicTitle: topic.title,
          topicDescription: topic.description,
          instruction: body.instruction,
          language,
          channels,
          knowledge: relevantKnowledge,
        })
        const result = await generateVariants(cfg, prompt, channels)
        if (!result.ok) throw new Error(result.error)

        const rows = channels.map((channel) => {
          const v = result.variants[channel]
          const flags = [
            ...checkGuardrails(`${v.hook} ${v.body_text}`),
            ...(checkCharLimit(channel, v.body_text) ? ['char_limit_exceeded'] : []),
          ]
          return {
            batch_id: batch.id,
            topic_id: topic.id,
            channel,
            language,
            status: 'draft',
            hook: v.hook,
            body_text: v.body_text,
            hashtags: v.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)),
            template_id: 'announcement',
            template_params: v.template_params,
            guardrail_flags: flags,
          }
        })
        const { error: insertErr } = await db.from('drafts').insert(rows)
        if (insertErr) throw new Error(`drafts insert failed: ${insertErr.message}`)
        okCount++
      } catch (e) {
        failCount++
        const message = e instanceof Error ? e.message : String(e)
        // Fehler-Entwuerfe pro Kanal, damit sie in der Queue sichtbar sind (Spec §8)
        await db.from('drafts').insert(
          channels.map((channel) => ({
            batch_id: batch.id,
            topic_id: topic.id,
            channel,
            language,
            status: 'error',
            error_message: message,
          })),
        )
      }
    }
    await db.from('topics').update({ last_used_at: new Date().toISOString(), status: 'used' }).eq('id', topic.id)
  }

  const status = failCount === 0 ? 'done' : okCount === 0 ? 'failed' : 'partial'
  await db.from('batches').update({ status, finished_at: new Date().toISOString() }).eq('id', batch.id)

  return json({ batch_id: batch.id, status, generated: okCount, failed: failCount })
})
```

- [ ] **Step 3: [MANUAL — Devin] Secrets setzen**

Devin setzt (echten Anthropic-Key aus console.anthropic.com; CRON_SECRET frei wählen, z.B. `openssl rand -hex 16` oder Passwort-Manager):

```powershell
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXX CRON_SECRET=EIN-LANGES-GEHEIMNIS MOCK_CLAUDE=1
```

`MOCK_CLAUDE=1` bleibt bis zur E2E-Abnahme (Task 15) gesetzt — alle Tests davor kosten nichts.

- [ ] **Step 4: Deployen**

Run: `npx supabase functions deploy generate-batch`
Erwartet: Deploy erfolgreich, Function erscheint in der Ausgabe.

- [ ] **Step 5: Remote-Mock-Test**

Zuerst ein Test-Thema anlegen (SQL-Editor im Dashboard oder per psql):

```sql
insert into topics (title, description, status) values ('Blutspiegel-Simulation', 'Die PK-Simulation zeigt den geschaetzten Blutspiegel-Verlauf pro Substanz.', 'queued');
```

Dann (Werte einsetzen; ANON-KEY aus `.env.local`):

```powershell
curl.exe -s -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/generate-batch" -H "Authorization: Bearer YOUR-ANON-KEY" -H "x-cron-secret: EIN-LANGES-GEHEIMNIS" -H "Content-Type: application/json" -d "{\"trigger\":\"manual\"}"
```

Erwartet: `{"batch_id":"...","status":"done","generated":2,"failed":0}` (1 Thema × 2 Sprachen). Check im Dashboard: `drafts` enthält 8 Zeilen (2 Sprachen × 4 Kanäle) mit Mock-Texten, Status `draft`.

Negativtest (ohne Secret, ohne User-JWT):

```powershell
curl.exe -s -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/generate-batch" -H "Authorization: Bearer YOUR-ANON-KEY" -H "Content-Type: application/json" -d "{\"trigger\":\"manual\"}"
```

Erwartet: `{"error":"unauthorized"}` (401).

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/generate-batch/index.ts supabase/functions/generate-batch/deno.json
git commit -m "feat: Edge Function generate-batch (Cron + On-Demand, Mock-Modus, isolierte Fehler)"
```

---

## Task 10: Frontend-Grundgerüst — Supabase-Client, Types, Auth, Router

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`
- Create: `src/context/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/Layout.tsx`
- Create: `src/pages/Login.tsx`
- Modify: `src/App.tsx` (komplett ersetzen), `src/main.tsx`

- [ ] **Step 1: Supabase-Client + Row-Types**

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

`src/lib/types.ts`:

```ts
import type { Channel, Language } from '../../supabase/functions/_shared/channels.ts'
import type { TemplateParams } from '../../supabase/functions/_shared/schemas.ts'

export type DraftStatus = 'draft' | 'edited' | 'approved' | 'rejected' | 'error'

export interface Draft {
  id: string
  batch_id: string
  topic_id: string | null
  channel: Channel
  language: Language
  status: DraftStatus
  hook: string
  body_text: string
  hashtags: string[]
  template_id: string
  template_params: TemplateParams
  guardrail_flags: string[]
  image_url: string | null
  error_message: string | null
  created_at: string
  reviewed_at: string | null
  topics?: { title: string } | null
}

export interface Topic {
  id: string
  title: string
  description: string
  source: 'app_content' | 'manual'
  status: 'idea' | 'queued' | 'used' | 'retired'
  priority: number
  last_used_at: string | null
  notes: string
  created_at: string
}

export interface KnowledgeRow {
  id: string
  kind: 'brand_voice' | 'feature' | 'faq' | 'persona' | 'guardrail' | 'peptide'
  source: 'app_content' | 'manual'
  app_key: string | null
  title: string
  content: string
  updated_at: string
}

export interface Settings {
  id: 1
  batch_size: number
  channels: Channel[]
  languages: Language[]
  schedule: { weekday: number; hour: number }
  model: string
}
```

- [ ] **Step 2: AuthContext + ProtectedRoute + Login**

`src/context/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
```

`src/components/ProtectedRoute.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

`src/pages/Login.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <form onSubmit={onSubmit} className="bg-slate-900 p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-xl font-bold text-white">TYD Content Studio</h1>
        <input
          className="w-full rounded bg-slate-800 text-white p-2"
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded bg-slate-800 text-white p-2"
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded p-2" type="submit">
          Anmelden
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Layout + Router**

`src/components/Layout.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded ${isActive ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-slate-800'}`

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <span className="font-bold text-cyan-400 mr-4">TYD Studio</span>
        <NavLink to="/" className={linkClass} end>
          Queue
        </NavLink>
        <NavLink to="/topics" className={linkClass}>
          Themen
        </NavLink>
        <NavLink to="/knowledge" className={linkClass}>
          Wissen
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          Settings
        </NavLink>
        <button
          className="ml-auto text-slate-400 hover:text-white text-sm"
          onClick={() => supabase.auth.signOut()}
        >
          Abmelden
        </button>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

`src/App.tsx` komplett ersetzen (Platzhalter-Seiten fliegen in Tasks 12/13/14 raus):

```tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'

function Placeholder({ name }: { name: string }) {
  return <p className="text-slate-400">{name} — kommt in einem spaeteren Task.</p>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Placeholder name="Queue" />} />
            <Route path="/draft/:id" element={<Placeholder name="Editor" />} />
            <Route path="/topics" element={<Placeholder name="Themen" />} />
            <Route path="/knowledge" element={<Placeholder name="Wissen" />} />
            <Route path="/settings" element={<Placeholder name="Settings" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

`src/main.tsx` prüfen: Scaffold-Version rendert `<App />` — nur sicherstellen, dass `./index.css` importiert wird und kein `App.css`-Import mehr existiert.

- [ ] **Step 4: [MANUAL — Devin] Nutzer anlegen + manuell verifizieren**

Devin legt im Supabase-Dashboard (Authentication → Users → Add user) einen Nutzer mit E-Mail + Passwort an (Auto-Confirm aktivieren).
Dann: `npm run dev`, im Browser `http://localhost:5173` öffnen → Login-Seite erscheint → Anmelden klappt → Nav mit Queue/Themen/Wissen/Settings sichtbar, Platzhaltertexte erscheinen, Abmelden führt zurück zu Login.

- [ ] **Step 5: Build + Commit**

Run: `npm run build`
Erwartet: fehlerfreier Build.

```powershell
git add src
git commit -m "feat: Auth, Layout, Router-Grundgeruest"
```

---

## Task 11: Bild-Templates + wrapText

**Files:**
- Create: `src/templates/wrapText.ts`, `src/templates/AnnouncementTemplate.tsx`, `src/templates/TipTemplate.tsx`, `src/templates/registry.ts`
- Test: `src/templates/wrapText.test.ts`, `src/templates/templates.test.tsx`

- [ ] **Step 1: Failing Tests schreiben**

`src/templates/wrapText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wrapText } from './wrapText'

describe('wrapText', () => {
  it('wraps at word boundaries within maxChars', () => {
    expect(wrapText('Track your whole protocol', 12)).toEqual(['Track your', 'whole', 'protocol'])
  })
  it('keeps a single long word on its own line', () => {
    expect(wrapText('Supercalifragilistic', 5)).toEqual(['Supercalifragilistic'])
  })
  it('returns empty array for empty input', () => {
    expect(wrapText('', 10)).toEqual([])
  })
})
```

`src/templates/templates.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TEMPLATES } from './registry'

describe('template registry smoke tests', () => {
  const sample = { headline: 'Track smarter, not harder', subline: 'Cycles, doses, stock and progress in one private app' }
  for (const def of Object.values(TEMPLATES)) {
    it(`${def.id} renders an svg with the headline`, () => {
      const html = renderToStaticMarkup(<def.Component params={sample} />)
      expect(html).toContain('<svg')
      expect(html).toContain('Track smarter,')
    })
  }
  it('has the two spec templates', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['announcement', 'tip'])
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/templates`
Erwartet: FAIL — Module nicht gefunden

- [ ] **Step 3: Implementieren**

`src/templates/wrapText.ts`:

```ts
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (candidate.length > maxCharsPerLine && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}
```

`src/templates/AnnouncementTemplate.tsx` (1080×1350, dunkles Brand-Design):

```tsx
import type { TemplateParams } from '../../supabase/functions/_shared/schemas.ts'
import { wrapText } from './wrapText'

const FONT = 'Arial, Helvetica, sans-serif'

export function AnnouncementTemplate({ params }: { params: TemplateParams }) {
  const headlineLines = wrapText(params.headline, 16)
  const sublineLines = wrapText(params.subline, 40)
  const sublineY = 380 + headlineLines.length * 110 + 70
  return (
    <svg viewBox="0 0 1080 1350" width="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ann-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b1220" />
          <stop offset="1" stopColor="#123047" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1350" fill="url(#ann-bg)" />
      <text x="80" y="150" fill="#22d3ee" fontSize="42" fontFamily={FONT} fontWeight="700" letterSpacing="6">
        TRACK YOUR DOSE
      </text>
      <rect x="80" y="190" width="120" height="6" fill="#22d3ee" />
      {headlineLines.map((line, i) => (
        <text key={i} x="80" y={380 + i * 110} fill="#ffffff" fontSize="92" fontFamily={FONT} fontWeight="800">
          {line}
        </text>
      ))}
      {sublineLines.map((line, i) => (
        <text key={i} x="80" y={sublineY + i * 58} fill="#94a3b8" fontSize="42" fontFamily={FONT}>
          {line}
        </text>
      ))}
      <text x="80" y="1270" fill="#475569" fontSize="34" fontFamily={FONT}>
        Private Dokumentation. Kein medizinischer Rat.
      </text>
    </svg>
  )
}
```

`src/templates/TipTemplate.tsx` (1080×1080, helle Karte):

```tsx
import type { TemplateParams } from '../../supabase/functions/_shared/schemas.ts'
import { wrapText } from './wrapText'

const FONT = 'Arial, Helvetica, sans-serif'

export function TipTemplate({ params }: { params: TemplateParams }) {
  const headlineLines = wrapText(params.headline, 18)
  const sublineLines = wrapText(params.subline, 44)
  const sublineY = 400 + headlineLines.length * 90 + 60
  return (
    <svg viewBox="0 0 1080 1080" width="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#f8fafc" />
      <rect x="60" y="60" width="960" height="960" rx="40" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="120" y="140" width="150" height="60" rx="30" fill="#22d3ee" />
      <text x="150" y="182" fill="#0b1220" fontSize="32" fontFamily={FONT} fontWeight="800">
        TIPP
      </text>
      {headlineLines.map((line, i) => (
        <text key={i} x="120" y={400 + i * 90} fill="#0f172a" fontSize="72" fontFamily={FONT} fontWeight="800">
          {line}
        </text>
      ))}
      {sublineLines.map((line, i) => (
        <text key={i} x="120" y={sublineY + i * 52} fill="#64748b" fontSize="38" fontFamily={FONT}>
          {line}
        </text>
      ))}
      <text x="120" y="950" fill="#94a3b8" fontSize="30" fontFamily={FONT} fontWeight="700" letterSpacing="4">
        TRACK YOUR DOSE
      </text>
    </svg>
  )
}
```

`src/templates/registry.ts`:

```ts
import type { ComponentType } from 'react'
import type { TemplateParams } from '../../supabase/functions/_shared/schemas.ts'
import { AnnouncementTemplate } from './AnnouncementTemplate'
import { TipTemplate } from './TipTemplate'

export interface TemplateDef {
  id: string
  name: string
  width: number
  height: number
  Component: ComponentType<{ params: TemplateParams }>
}

export const TEMPLATES: Record<string, TemplateDef> = {
  announcement: { id: 'announcement', name: 'Announcement (4:5)', width: 1080, height: 1350, Component: AnnouncementTemplate },
  tip: { id: 'tip', name: 'Tipp-Karte (1:1)', width: 1080, height: 1080, Component: TipTemplate },
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/templates`
Erwartet: PASS (6 Tests)

- [ ] **Step 5: Commit**

```powershell
git add src/templates
git commit -m "feat: Brand-Templates (Announcement, Tipp) + wrapText"
```

---

## Task 12: Queue-Seite (+ Batch-Trigger, Retry)

**Files:**
- Create: `src/pages/Queue.tsx`, `src/lib/generate.ts`
- Modify: `src/App.tsx` (Placeholder ersetzen)

- [ ] **Step 1: Generate-Helper**

`src/lib/generate.ts`:

```ts
import { supabase } from './supabase'

export interface GenerateResponse {
  batch_id?: string
  status?: string
  generated?: number
  failed?: number
  skipped?: boolean
  error?: string
}

export async function triggerGeneration(body: {
  topicIds?: string[]
  instruction?: string
}): Promise<GenerateResponse> {
  const { data, error } = await supabase.functions.invoke('generate-batch', {
    body: { trigger: 'manual', ...body },
  })
  if (error) return { error: error.message }
  return data as GenerateResponse
}

/** Retry fuer Fehl-Entwuerfe: Thema neu generieren, alte error-Drafts des Themas verwerfen. */
export async function retryTopic(topicId: string): Promise<GenerateResponse> {
  const res = await triggerGeneration({ topicIds: [topicId] })
  if (!res.error) {
    await supabase.from('drafts').update({ status: 'rejected' }).eq('topic_id', topicId).eq('status', 'error')
  }
  return res
}
```

- [ ] **Step 2: Queue-Seite**

`src/pages/Queue.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { retryTopic, triggerGeneration } from '../lib/generate'
import type { Draft } from '../lib/types'
import { CHANNEL_SPECS } from '../../supabase/functions/_shared/channels.ts'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-700 text-slate-200',
  edited: 'bg-amber-600 text-white',
  approved: 'bg-emerald-600 text-white',
  rejected: 'bg-slate-800 text-slate-500',
  error: 'bg-red-700 text-white',
}

export default function Queue() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [channel, setChannel] = useState('')
  const [language, setLanguage] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    let query = supabase
      .from('drafts')
      .select('*, topics(title)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (channel) query = query.eq('channel', channel)
    if (language) query = query.eq('language', language)
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) setMessage(error.message)
    else setDrafts((data ?? []) as Draft[])
  }, [channel, language, status])

  useEffect(() => {
    void load()
  }, [load])

  async function onGenerate() {
    setBusy(true)
    setMessage('Batch läuft…')
    const res = await triggerGeneration({})
    setMessage(res.error ? `Fehler: ${res.error}` : res.skipped ? 'Keine Themen im Pool.' : `Fertig: ${res.generated} generiert, ${res.failed} fehlgeschlagen.`)
    setBusy(false)
    void load()
  }

  async function onRetry(topicId: string) {
    setBusy(true)
    const res = await retryTopic(topicId)
    setMessage(res.error ? `Fehler: ${res.error}` : 'Neu generiert.')
    setBusy(false)
    void load()
  }

  const selectClass = 'rounded bg-slate-800 p-2 text-sm'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Queue</h1>
        <button
          className="ml-auto bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold rounded px-4 py-2"
          disabled={busy}
          onClick={onGenerate}
        >
          Batch jetzt generieren
        </button>
      </div>
      <div className="flex gap-3">
        <select className={selectClass} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Alle Kanäle</option>
          {Object.values(CHANNEL_SPECS).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="">Alle Sprachen</option>
          <option value="de">DE</option>
          <option value="en">EN</option>
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alle Status</option>
          {['draft', 'edited', 'approved', 'rejected', 'error'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {message && <p className="text-sm text-slate-400">{message}</p>}
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.id} className="rounded-lg bg-slate-900 border border-slate-800 p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className={`px-2 py-0.5 rounded ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                <span className="text-cyan-400">{CHANNEL_SPECS[d.channel].label}</span>
                <span className="uppercase text-slate-500">{d.language}</span>
                {d.guardrail_flags.length > 0 && (
                  <span className="text-amber-400">⚠ {d.guardrail_flags.join(', ')}</span>
                )}
              </div>
              <p className="text-slate-200 truncate">
                <span className="text-slate-500">{d.topics?.title ?? 'Ohne Thema'} — </span>
                {d.status === 'error' ? (d.error_message ?? 'Fehler') : d.hook}
              </p>
            </div>
            {d.status === 'error' && d.topic_id ? (
              <button
                className="text-sm bg-slate-700 hover:bg-slate-600 rounded px-3 py-1"
                disabled={busy}
                onClick={() => onRetry(d.topic_id!)}
              >
                Erneut versuchen
              </button>
            ) : (
              <Link className="text-sm text-cyan-400 hover:underline" to={`/draft/${d.id}`}>
                Öffnen →
              </Link>
            )}
          </li>
        ))}
      </ul>
      {drafts.length === 0 && <p className="text-slate-500">Keine Entwürfe. Generiere einen Batch oder lege Themen an.</p>}
    </div>
  )
}
```

In `src/App.tsx`: `import Queue from './pages/Queue'` ergänzen und `<Route path="/" element={<Placeholder name="Queue" />} />` ersetzen durch `<Route path="/" element={<Queue />} />`.

- [ ] **Step 3: Manuell verifizieren**

`npm run dev` → einloggen → Queue zeigt die Mock-Drafts aus Task 9 (8 Stück). Filter durchklicken (Kanal/Sprache/Status wirken). „Batch jetzt generieren" klicken → Meldung „Keine Themen im Pool." (das Test-Thema steht auf `used`) ODER neue Drafts, falls Themen vorhanden.

- [ ] **Step 4: Build + Commit**

Run: `npm run build`
Erwartet: fehlerfrei.

```powershell
git add src/pages/Queue.tsx src/lib/generate.ts src/App.tsx
git commit -m "feat: Review-Queue mit Filtern, Batch-Trigger und Retry"
```

---

## Task 13: Editor-Seite

**Files:**
- Create: `src/pages/Editor.tsx`
- Modify: `src/App.tsx` (Placeholder ersetzen)

- [ ] **Step 1: Editor implementieren**

`src/pages/Editor.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Draft } from '../lib/types'
import { TEMPLATES } from '../templates/registry'
import { CHANNEL_SPECS } from '../../supabase/functions/_shared/channels.ts'
import { checkGuardrails } from '../../supabase/functions/_shared/guardrails.ts'
import { retryTopic } from '../lib/generate'
import { approveDraft } from '../lib/approve'

export default function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const svgWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from('drafts')
      .select('*, topics(title)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(error.message)
        else setDraft(data as Draft)
      })
  }, [id])

  if (!draft) return <p className="text-slate-500">{message || 'Lade…'}</p>

  // Fehler-Entwuerfe haben keine Inhalte/template_params — nicht den vollen Editor rendern
  if (draft.status === 'error') {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Fehlgeschlagener Entwurf</h1>
        <p className="text-red-400 text-sm">{draft.error_message ?? 'Unbekannter Fehler'}</p>
        <p className="text-slate-500 text-sm">Neu generieren geht über den „Erneut versuchen"-Button in der Queue.</p>
      </div>
    )
  }

  const spec = CHANNEL_SPECS[draft.channel]
  const template = TEMPLATES[draft.template_id] ?? TEMPLATES.announcement
  const liveFlags = checkGuardrails(`${draft.hook} ${draft.body_text}`)
  const overLimit = draft.body_text.length > spec.maxChars

  function patch(p: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...p } : d))
  }

  async function save(status: Draft['status']) {
    if (!draft) return
    setBusy(true)
    const { error } = await supabase
      .from('drafts')
      .update({
        hook: draft.hook,
        body_text: draft.body_text,
        hashtags: draft.hashtags,
        template_id: draft.template_id,
        template_params: draft.template_params,
        guardrail_flags: [...liveFlags, ...(overLimit ? ['char_limit_exceeded'] : [])],
        status,
        reviewed_at: status === 'rejected' ? new Date().toISOString() : draft.reviewed_at,
      })
      .eq('id', draft.id)
    setMessage(error ? error.message : 'Gespeichert.')
    setBusy(false)
    if (!error && status === 'rejected') navigate('/')
  }

  async function onApprove() {
    if (!draft) return
    setBusy(true)
    setMessage('Rendere & lade hoch…')
    const svgEl = svgWrapRef.current?.querySelector('svg') ?? null
    const err = await approveDraft(draft, svgEl)
    setMessage(err ? `Fehler: ${err}` : 'Freigegeben.')
    setBusy(false)
    if (!err) navigate('/')
  }

  async function onRegenerate() {
    if (!draft?.topic_id) return
    setBusy(true)
    const res = await retryTopic(draft.topic_id)
    setBusy(false)
    if (res.error) setMessage(`Fehler: ${res.error}`)
    else navigate('/')
  }

  const inputClass = 'w-full rounded bg-slate-800 p-2 text-sm'
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h1 className="text-xl font-bold mb-1">
          {spec.label} · <span className="uppercase">{draft.language}</span>
        </h1>
        <p className="text-slate-500 text-sm mb-3">{draft.topics?.title}</p>
        {spec.needsImage ? (
          <>
            <div ref={svgWrapRef} className="rounded-lg overflow-hidden border border-slate-800">
              <template.Component params={draft.template_params} />
            </div>
            <select
              className={`${inputClass} mt-3`}
              value={draft.template_id}
              onChange={(e) => patch({ template_id: e.target.value })}
            >
              {Object.values(TEMPLATES).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} mt-2`}
              value={draft.template_params.headline}
              maxLength={80}
              placeholder="Headline (Bild)"
              onChange={(e) => patch({ template_params: { ...draft.template_params, headline: e.target.value } })}
            />
            <input
              className={`${inputClass} mt-2`}
              value={draft.template_params.subline}
              maxLength={140}
              placeholder="Subline (Bild)"
              onChange={(e) => patch({ template_params: { ...draft.template_params, subline: e.target.value } })}
            />
          </>
        ) : (
          <p className="text-slate-500 text-sm">Dieser Kanal hat kein Bild-Asset.</p>
        )}
      </div>
      <div className="space-y-3">
        {(liveFlags.length > 0 || overLimit) && (
          <div className="rounded bg-amber-950 border border-amber-700 text-amber-300 text-sm p-3">
            ⚠ {[...liveFlags, ...(overLimit ? ['char_limit_exceeded'] : [])].join(', ')}
          </div>
        )}
        <label className="block text-sm text-slate-400">
          Hook {draft.channel === 'reddit' && '(= Post-Titel)'}
          <input className={inputClass} value={draft.hook} onChange={(e) => patch({ hook: e.target.value })} />
        </label>
        <label className="block text-sm text-slate-400">
          Text{' '}
          <span className={overLimit ? 'text-red-400' : 'text-slate-500'}>
            ({draft.body_text.length}/{spec.maxChars})
          </span>
          <textarea
            className={`${inputClass} h-64`}
            value={draft.body_text}
            onChange={(e) => patch({ body_text: e.target.value })}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Hashtags (kommagetrennt)
          <input
            className={inputClass}
            value={draft.hashtags.join(', ')}
            onChange={(e) =>
              patch({ hashtags: e.target.value.split(',').map((h) => h.trim()).filter(Boolean) })
            }
          />
        </label>
        {message && <p className="text-sm text-slate-400">{message}</p>}
        <div className="flex gap-2 pt-2">
          <button
            className="bg-slate-700 hover:bg-slate-600 rounded px-4 py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => save('edited')}
          >
            Speichern
          </button>
          <button
            className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={onApprove}
          >
            Freigeben
          </button>
          <button
            className="bg-red-800 hover:bg-red-700 rounded px-4 py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => save('rejected')}
          >
            Verwerfen
          </button>
          {draft.topic_id && (
            <button
              className="ml-auto bg-slate-800 hover:bg-slate-700 rounded px-4 py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={onRegenerate}
            >
              Neu generieren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

In `src/App.tsx`: `import Editor from './pages/Editor'` ergänzen, `/draft/:id`-Placeholder durch `<Editor />` ersetzen.

**Hinweis:** `approveDraft` aus `src/lib/approve.ts` existiert erst nach Task 14 — für diesen Task eine minimale Übergangsversion anlegen (wird in Task 14 durch die echte ersetzt):

`src/lib/approve.ts` (Übergangsversion):

```ts
import type { Draft } from './types'

export async function approveDraft(_draft: Draft, _svgEl: SVGSVGElement | null): Promise<string | null> {
  return 'Freigabe-Flow kommt in Task 14'
}
```

- [ ] **Step 2: Manuell verifizieren**

`npm run dev` → Queue → Mock-Draft öffnen. Prüfen: Instagram/X-Drafts zeigen das gerenderte Template links, Reddit/TikTok zeigen „kein Bild-Asset". Headline im Bild-Feld ändern → Vorschau aktualisiert live. Text auf >280 Zeichen bei einem X-Draft bringen → roter Zähler + `char_limit_exceeded`-Banner. „Nimm 5 mg" in den Text tippen → `dosage_advice`-Banner erscheint live. Speichern → Status `edited` in der Queue. Verwerfen → zurück in Queue, Status `rejected`.

- [ ] **Step 3: Build + Commit**

Run: `npm run build`
Erwartet: fehlerfrei.

```powershell
git add src/pages/Editor.tsx src/lib/approve.ts src/App.tsx
git commit -m "feat: Editor mit Live-Vorschau, Guardrail-/Limit-Anzeige und Draft-Aktionen"
```

---

## Task 14: Freigabe-Flow — PNG-Export, Storage-Upload, Download-Bundle

**Files:**
- Create: `src/lib/exportPng.ts`
- Modify: `src/lib/approve.ts` (Übergangsversion ersetzen), `src/pages/Queue.tsx` (Download-Button)

- [ ] **Step 1: PNG-Export implementieren**

`src/lib/exportPng.ts`:

```ts
/** SVG-Element -> PNG-Blob in Zielgroesse. Laeuft nur im Browser (Canvas). */
export async function svgToPngBlob(svgEl: SVGSVGElement, width: number, height: number): Promise<Blob> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const svgText = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('SVG konnte nicht als Bild geladen werden'))
      i.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D-Kontext nicht verfuegbar')
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG-Export fehlgeschlagen'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
```

- [ ] **Step 2: approve.ts durch echte Version ersetzen**

`src/lib/approve.ts` komplett ersetzen:

```ts
import { supabase } from './supabase'
import type { Draft } from './types'
import { TEMPLATES } from '../templates/registry'
import { CHANNEL_SPECS } from '../../supabase/functions/_shared/channels.ts'
import { svgToPngBlob } from './exportPng'

/**
 * Freigabe (Spec §7): Bild-Kanaele rendern PNG -> Storage-Upload -> erst nach
 * erfolgreichem Upload wird der Status approved. Rueckgabe: null = ok, sonst Fehlertext.
 */
export async function approveDraft(draft: Draft, svgEl: SVGSVGElement | null): Promise<string | null> {
  let imageUrl: string | null = draft.image_url

  if (CHANNEL_SPECS[draft.channel].needsImage) {
    if (!svgEl) return 'Kein Template-SVG gefunden'
    const template = TEMPLATES[draft.template_id] ?? TEMPLATES.announcement
    let blob: Blob
    try {
      blob = await svgToPngBlob(svgEl, template.width, template.height)
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
    const path = `drafts/${draft.id}.png`
    // Ein Retry beim Upload (Spec §8)
    let uploadError: string | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await supabase.storage.from('post-assets').upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      })
      uploadError = error?.message ?? null
      if (!uploadError) break
    }
    if (uploadError) return `Upload fehlgeschlagen: ${uploadError}`
    imageUrl = supabase.storage.from('post-assets').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase
    .from('drafts')
    .update({
      status: 'approved',
      image_url: imageUrl,
      hook: draft.hook,
      body_text: draft.body_text,
      hashtags: draft.hashtags,
      template_id: draft.template_id,
      template_params: draft.template_params,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', draft.id)
  return error ? error.message : null
}

/** Download-Bundle: Caption als .txt, plus PNG-Link oeffnen (falls vorhanden). */
export function downloadBundle(draft: Draft) {
  const caption = [draft.hook, '', draft.body_text, '', draft.hashtags.join(' ')].join('\n').trim()
  const blobUrl = URL.createObjectURL(new Blob([caption], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${draft.channel}-${draft.language}-${draft.id.slice(0, 8)}.txt`
  a.click()
  URL.revokeObjectURL(blobUrl)
  if (draft.image_url) window.open(draft.image_url, '_blank')
}
```

- [ ] **Step 3: Download-Button in der Queue**

In `src/pages/Queue.tsx`: Import ergänzen (`import { downloadBundle } from '../lib/approve'`) und im `<li>` neben dem „Öffnen →"-Link für approved Drafts einen Button ergänzen — den bestehenden Block

```tsx
            {d.status === 'error' && d.topic_id ? (
```

erweitern zu:

```tsx
            {d.status === 'approved' && (
              <button className="text-sm bg-slate-700 hover:bg-slate-600 rounded px-3 py-1" onClick={() => downloadBundle(d)}>
                Download
              </button>
            )}
            {d.status === 'error' && d.topic_id ? (
```

- [ ] **Step 4: Manuell verifizieren (Abnahme des Flows mit Mock-Content)**

`npm run dev` → Mock-Draft (Instagram) im Editor öffnen → „Freigeben". Prüfen: Meldung „Freigegeben.", zurück in Queue, Status `approved`. Im Supabase-Dashboard: Storage → `post-assets` → `drafts/<id>.png` existiert und zeigt das gerenderte Template (1080×1350). „Download" in der Queue → .txt mit Hook/Text/Hashtags + PNG öffnet im neuen Tab. Reddit-Draft freigeben → Status `approved` ohne Bild.

- [ ] **Step 5: Build + Commit**

Run: `npm run build`
Erwartet: fehlerfrei.

```powershell
git add src/lib/exportPng.ts src/lib/approve.ts src/pages/Queue.tsx
git commit -m "feat: Freigabe-Flow (Canvas-PNG, Storage-Upload mit Retry, Download-Bundle)"
```

---

## Task 15: Verwaltung — Themen, Wissen, Settings

**Files:**
- Create: `src/pages/Topics.tsx`, `src/pages/Knowledge.tsx`, `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx` (Placeholder ersetzen, `Placeholder`-Komponente löschen)

- [ ] **Step 1: Themen-Seite**

`src/pages/Topics.tsx`:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Topic } from '../lib/types'
import { triggerGeneration } from '../lib/generate'

export default function Topics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('topics').select('*').order('created_at', { ascending: false })
    if (error) setMessage(error.message)
    else setTopics((data ?? []) as Topic[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const { error } = await supabase.from('topics').insert({ title: title.trim(), description: description.trim() })
    if (error) setMessage(error.message)
    setTitle('')
    setDescription('')
    void load()
  }

  async function setStatus(id: string, status: Topic['status']) {
    await supabase.from('topics').update({ status }).eq('id', id)
    void load()
  }

  async function onGenerateOne(id: string) {
    setBusy(true)
    setMessage('Generiere…')
    const res = await triggerGeneration({ topicIds: [id] })
    setMessage(res.error ? `Fehler: ${res.error}` : `Fertig: ${res.generated} generiert.`)
    setBusy(false)
    void load()
  }

  const inputClass = 'rounded bg-slate-800 p-2 text-sm'
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Themenpool</h1>
      <form onSubmit={onAdd} className="flex gap-2">
        <input className={`${inputClass} w-64`} placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={`${inputClass} flex-1`} placeholder="Beschreibung" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded px-4" type="submit">
          Hinzufügen
        </button>
      </form>
      {message && <p className="text-sm text-slate-400">{message}</p>}
      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.id} className="rounded-lg bg-slate-900 border border-slate-800 p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-slate-200">{t.title}</p>
              <p className="text-slate-500 text-sm truncate">{t.description}</p>
            </div>
            <select className={inputClass} value={t.status} onChange={(e) => setStatus(t.id, e.target.value as Topic['status'])}>
              {['idea', 'queued', 'used', 'retired'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className="text-sm bg-slate-700 hover:bg-slate-600 rounded px-3 py-1 disabled:opacity-50"
              disabled={busy}
              onClick={() => onGenerateOne(t.id)}
            >
              Generieren
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Wissens-Seite**

`src/pages/Knowledge.tsx`:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { KnowledgeRow } from '../lib/types'

const KINDS = ['brand_voice', 'persona', 'guardrail', 'feature', 'faq', 'peptide'] as const

export default function Knowledge() {
  const [rows, setRows] = useState<KnowledgeRow[]>([])
  const [kindFilter, setKindFilter] = useState('')
  const [editing, setEditing] = useState<KnowledgeRow | null>(null)
  const [newKind, setNewKind] = useState<string>('brand_voice')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    let q = supabase.from('knowledge').select('*').order('kind').order('title').limit(500)
    if (kindFilter) q = q.eq('kind', kindFilter)
    const { data, error } = await q
    if (error) setMessage(error.message)
    else setRows((data ?? []) as KnowledgeRow[])
  }, [kindFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return
    const { error } = await supabase.from('knowledge').insert({ kind: newKind, title: newTitle.trim(), content: newContent.trim() })
    if (error) setMessage(error.message)
    setNewTitle('')
    setNewContent('')
    void load()
  }

  async function onSaveEdit() {
    if (!editing) return
    const { error } = await supabase
      .from('knowledge')
      .update({ content: editing.content, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
    if (error) setMessage(error.message)
    setEditing(null)
    void load()
  }

  const inputClass = 'rounded bg-slate-800 p-2 text-sm'
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Wissensbasis</h1>
        <select className={`${inputClass} ml-auto`} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="">Alle Arten</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-900 border border-slate-800 p-4">
        <div className="flex gap-2">
          <select className={inputClass} value={newKind} onChange={(e) => setNewKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input className={`${inputClass} flex-1`} placeholder="Titel" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </div>
        <textarea className={`${inputClass} w-full h-24`} placeholder="Inhalt" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
        <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded px-4 py-1" type="submit">
          Eintrag anlegen
        </button>
      </form>
      {message && <p className="text-sm text-slate-400">{message}</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="text-cyan-400">{r.kind}</span>
              <span className="text-slate-600">{r.source}</span>
              <button className="ml-auto text-slate-400 hover:text-white" onClick={() => setEditing(editing?.id === r.id ? null : { ...r })}>
                {editing?.id === r.id ? 'Abbrechen' : 'Bearbeiten'}
              </button>
            </div>
            <p className="text-slate-200 font-medium">{r.title}</p>
            {editing?.id === r.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  className={`${inputClass} w-full h-32`}
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                />
                <button className="bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-1 text-sm" onClick={onSaveEdit}>
                  Speichern
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm whitespace-pre-line line-clamp-3">{r.content}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Settings-Seite**

`src/pages/SettingsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Settings } from '../lib/types'
import { CHANNELS, LANGUAGES, CHANNEL_SPECS, type Channel, type Language } from '../../supabase/functions/_shared/channels.ts'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage(error.message)
        else setSettings(data as Settings)
      })
  }, [])

  if (!settings) return <p className="text-slate-500">{message || 'Lade…'}</p>

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
  }

  async function onSave() {
    if (!settings) return
    const { error } = await supabase.from('settings').update({
      batch_size: settings.batch_size,
      channels: settings.channels,
      languages: settings.languages,
      schedule: settings.schedule,
      model: settings.model,
    }).eq('id', 1)
    setMessage(error ? error.message : 'Gespeichert.')
  }

  const inputClass = 'rounded bg-slate-800 p-2 text-sm'
  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <label className="block text-sm text-slate-400">
        Batch-Größe (Themen pro Lauf)
        <input
          className={`${inputClass} block w-24 mt-1`}
          type="number"
          min={1}
          max={20}
          value={settings.batch_size}
          onChange={(e) => setSettings({ ...settings, batch_size: Number(e.target.value) })}
        />
      </label>
      <fieldset className="text-sm text-slate-400">
        Kanäle
        <div className="flex gap-4 mt-1">
          {CHANNELS.map((c: Channel) => (
            <label key={c} className="flex items-center gap-1 text-slate-200">
              <input
                type="checkbox"
                checked={settings.channels.includes(c)}
                onChange={() => setSettings({ ...settings, channels: toggle(settings.channels, c) })}
              />
              {CHANNEL_SPECS[c].label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="text-sm text-slate-400">
        Sprachen
        <div className="flex gap-4 mt-1">
          {LANGUAGES.map((l: Language) => (
            <label key={l} className="flex items-center gap-1 text-slate-200 uppercase">
              <input
                type="checkbox"
                checked={settings.languages.includes(l)}
                onChange={() => setSettings({ ...settings, languages: toggle(settings.languages, l) })}
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-3 text-sm text-slate-400">
        <label>
          Wochentag (Auto-Batch)
          <select
            className={`${inputClass} block mt-1`}
            value={settings.schedule.weekday}
            onChange={(e) => setSettings({ ...settings, schedule: { ...settings.schedule, weekday: Number(e.target.value) } })}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stunde (UTC!)
          <input
            className={`${inputClass} block w-20 mt-1`}
            type="number"
            min={0}
            max={23}
            value={settings.schedule.hour}
            onChange={(e) => setSettings({ ...settings, schedule: { ...settings.schedule, hour: Number(e.target.value) } })}
          />
        </label>
      </div>
      <label className="block text-sm text-slate-400">
        Modell
        <input
          className={`${inputClass} block w-72 mt-1`}
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
        />
      </label>
      {message && <p className="text-sm text-slate-400">{message}</p>}
      <button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded px-4 py-2" onClick={onSave}>
        Speichern
      </button>
    </div>
  )
}
```

In `src/App.tsx`: Imports ergänzen (`Topics`, `Knowledge`, `SettingsPage`), die drei Placeholder-Routen ersetzen, `Placeholder`-Komponente löschen.

- [ ] **Step 4: Manuell verifizieren**

`npm run dev`: Thema anlegen → erscheint in Liste → „Generieren" → Meldung „Fertig: 2 generiert." → Queue zeigt 8 neue Mock-Drafts. Wissens-Eintrag anlegen und bearbeiten. Settings: Batch-Größe auf 3, Kanal abwählen, speichern, Seite neu laden → Werte bleiben.

- [ ] **Step 5: Build + Commit**

Run: `npm run build`
Erwartet: fehlerfrei.

```powershell
git add src/pages/Topics.tsx src/pages/Knowledge.tsx src/pages/SettingsPage.tsx src/App.tsx
git commit -m "feat: Verwaltung (Themenpool, Wissensbasis, Settings)"
```

---

## Task 16: Seed-Skript für die Wissensbasis

**Files:**
- Create: `scripts/seed-knowledge.ts`

**Kontext:** Liest den lokal ausgecheckten Tracker (`TRACKER_REPO`-Env). Quellen (verifiziert im Tracker-Repo):
- FAQ: `src/i18n/faq/locales/en.categories.ts` (Export `enCategories`) und `de.categories.ts` (Export `deCategories`) — Struktur `{ id, title, items: [{ q, a: string | string[] }] }`
- Onboarding-/Feature-Copy: `scripts/onboarding-i18n-source.mjs` (Exporte `OB_EN`, `OB_DE`) — Keys `ob_step_<n>_title` / `ob_step_<n>_description`
- Peptid-Bibliothek: Tabelle `peptide_library` in der **Tracker**-Supabase (optional, nur wenn `TRACKER_SUPABASE_URL` + `TRACKER_SUPABASE_ANON_KEY` gesetzt) — Spalten u.a. `slug, name, full_name, category, tldr`

- [ ] **Step 1: Skript implementieren**

`scripts/seed-knowledge.ts`:

```ts
/**
 * Seedet die knowledge-Tabelle des Studios aus dem Tracker-Repo.
 * Upsert via app_key: App-Quellen werden ueberschrieben, manuelle Eintraege bleiben unberuehrt.
 *
 * Env: STUDIO_SUPABASE_URL, STUDIO_SERVICE_ROLE_KEY, TRACKER_REPO
 * Optional: TRACKER_SUPABASE_URL, TRACKER_SUPABASE_ANON_KEY (Peptid-Bibliothek)
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

interface FaqItem { q: string; a: string | string[] }
interface FaqCategory { id: string; title: string; items: FaqItem[] }
interface KnowledgeInsert { kind: string; source: 'app_content' | 'manual'; app_key: string | null; title: string; content: string }

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Env-Variable ${name} fehlt`)
  return v
}

const studio = createClient(env('STUDIO_SUPABASE_URL'), env('STUDIO_SERVICE_ROLE_KEY'))
const trackerRepo = env('TRACKER_REPO')

async function importFrom<T>(relPath: string): Promise<T> {
  return (await import(pathToFileURL(join(trackerRepo, relPath)).href)) as T
}

async function collectFaq(): Promise<KnowledgeInsert[]> {
  const rows: KnowledgeInsert[] = []
  const sources: [string, string, string][] = [
    ['en', 'src/i18n/faq/locales/en.categories.ts', 'enCategories'],
    ['de', 'src/i18n/faq/locales/de.categories.ts', 'deCategories'],
  ]
  for (const [lang, path, exportName] of sources) {
    const mod = await importFrom<Record<string, FaqCategory[]>>(path)
    for (const cat of mod[exportName]) {
      for (const item of cat.items) {
        rows.push({
          kind: 'faq',
          source: 'app_content',
          app_key: `faq:${lang}:${cat.id}:${item.q.slice(0, 100)}`,
          title: `[${lang}] ${item.q}`,
          content: Array.isArray(item.a) ? item.a.join('\n') : item.a,
        })
      }
    }
  }
  return rows
}

async function collectOnboarding(): Promise<KnowledgeInsert[]> {
  const rows: KnowledgeInsert[] = []
  const mod = await importFrom<{ OB_EN: Record<string, string>; OB_DE: Record<string, string> }>(
    'scripts/onboarding-i18n-source.mjs',
  )
  for (const [lang, ob] of [['en', mod.OB_EN], ['de', mod.OB_DE]] as const) {
    for (const [key, title] of Object.entries(ob)) {
      const m = key.match(/^ob_step_(\d+)_title$/)
      if (!m) continue
      const description = ob[`ob_step_${m[1]}_description`]
      if (!description) continue
      rows.push({
        kind: 'feature',
        source: 'app_content',
        app_key: `onboarding:${lang}:step${m[1]}`,
        title: `[${lang}] ${title}`,
        content: description,
      })
    }
  }
  return rows
}

async function collectPeptides(): Promise<KnowledgeInsert[]> {
  const url = process.env.TRACKER_SUPABASE_URL
  const key = process.env.TRACKER_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log('TRACKER_SUPABASE_URL/ANON_KEY nicht gesetzt — Peptid-Bibliothek uebersprungen.')
    return []
  }
  const tracker = createClient(url, key)
  const { data, error } = await tracker.from('peptide_library').select('slug,name,full_name,category,tldr')
  if (error) {
    console.warn(`Peptid-Bibliothek nicht lesbar (${error.message}) — uebersprungen.`)
    return []
  }
  return (data ?? []).map((p) => ({
    kind: 'peptide',
    source: 'app_content' as const,
    app_key: `peptide:${p.slug}`,
    title: p.full_name ? `${p.name} (${p.full_name})` : p.name,
    content: `Kategorie: ${p.category}\n${p.tldr}`,
  }))
}

/** Starter-Eintraege: nur anlegen, wenn der Titel noch nicht existiert (manuell editierbar, nie ueberschrieben). */
const STARTERS: KnowledgeInsert[] = [
  {
    kind: 'brand_voice',
    source: 'manual',
    app_key: null,
    title: 'Brand Voice',
    content:
      'TYD (Track Your Dose) is a private documentation app for peptide protocols: cycles, doses, stock, injection sites, bloodwork, progress. Tone: clear, structured, evidence-aware, zero hype. German posts use informal "du". We never promise outcomes — we help people document, structure and understand their own data. Privacy is a core value.',
  },
  {
    kind: 'persona',
    source: 'manual',
    app_key: null,
    title: 'Zielgruppe',
    content:
      'Self-directed biohackers and fitness enthusiasts running peptide protocols. They value privacy, structure and data; they are skeptical of marketing hype; they hang out on Reddit and Instagram and research everything themselves.',
  },
  {
    kind: 'guardrail',
    source: 'manual',
    app_key: null,
    title: 'Compliance-Regeln',
    content:
      'Never give dosage recommendations, healing promises or medical claims. The app documents; it does not advise. Always frame content around tracking, structure and documentation — never around peptide effects or outcomes.',
  },
]

async function main() {
  const appRows = [...(await collectFaq()), ...(await collectOnboarding()), ...(await collectPeptides())]
  console.log(`Upserte ${appRows.length} App-Content-Eintraege…`)
  for (let i = 0; i < appRows.length; i += 100) {
    const { error } = await studio.from('knowledge').upsert(appRows.slice(i, i + 100), { onConflict: 'app_key' })
    if (error) throw new Error(`Upsert fehlgeschlagen: ${error.message}`)
  }
  for (const starter of STARTERS) {
    const { data } = await studio.from('knowledge').select('id').eq('title', starter.title).maybeSingle()
    if (!data) {
      const { error } = await studio.from('knowledge').insert(starter)
      if (error) throw new Error(`Starter-Insert fehlgeschlagen: ${error.message}`)
      console.log(`Starter angelegt: ${starter.title}`)
    }
  }
  console.log('Seed fertig.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: [MANUAL — Devin] Seed ausführen**

Devin führt aus (service_role key aus dem Studio-Dashboard):

```powershell
$env:STUDIO_SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co'
$env:STUDIO_SERVICE_ROLE_KEY = 'YOUR-SERVICE-ROLE-KEY'
$env:TRACKER_REPO = 'C:\Users\Devin\peptid-tracker'
$env:TRACKER_SUPABASE_URL = 'TRACKER-URL'          # optional
$env:TRACKER_SUPABASE_ANON_KEY = 'TRACKER-ANON'    # optional
npm run seed
```

Erwartet: `Upserte N App-Content-Eintraege…` (N > 50), drei Starter-Meldungen, `Seed fertig.` Zweiter Lauf: gleiche Zahl, keine Duplikate (Check: Zeilenzahl in `knowledge` bleibt gleich).

- [ ] **Step 3: Im Studio verifizieren**

Wissens-Seite öffnen: FAQ-Einträge (`[en]`/`[de]`), Feature-Einträge aus dem Onboarding und die drei Starter (brand_voice/persona/guardrail) sind da und filterbar.

- [ ] **Step 4: Commit**

```powershell
git add scripts/seed-knowledge.ts
git commit -m "feat: Seed-Skript Wissensbasis (FAQ, Onboarding-Features, Peptid-Bibliothek, Starter)"
```

---

## Task 17: pg_cron-Anbindung + SETUP.md

**Files:**
- Create: `docs/SETUP.md`

- [ ] **Step 1: SETUP.md schreiben**

`docs/SETUP.md`:

````markdown
# Setup Peptid Content Studio

## Voraussetzungen
- Node 20, npm
- Supabase-Projekt (eigenes, NICHT das der Tracker-App)
- Anthropic API Key (console.anthropic.com)

## Einmalige Einrichtung
1. `.env.local` anlegen (siehe `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
2. `npx supabase login`, dann `npx supabase link --project-ref <REF>`
3. `npx supabase db push` (Schema)
4. Secrets: `npx supabase secrets set ANTHROPIC_API_KEY=<KEY> CRON_SECRET=<LANGES-GEHEIMNIS>`
   - Fuer kostenlose Tests zusaetzlich `MOCK_CLAUDE=1`; fuer echte Generierung: `npx supabase secrets unset MOCK_CLAUDE`
5. `npx supabase functions deploy generate-batch`
6. Nutzer anlegen: Dashboard -> Authentication -> Users -> Add user (Auto-Confirm)
7. Wissensbasis seeden: siehe `scripts/seed-knowledge.ts` (Env-Variablen im Kopf des Skripts)

## Auto-Batch (pg_cron) aktivieren
Im SQL-Editor des Studio-Projekts einmalig ausfuehren (Platzhalter ersetzen —
PROJECT-REF, ANON-KEY aus Settings -> API, CRON-SECRET wie in Schritt 4 gesetzt):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generate-batch-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT-REF.supabase.co/functions/v1/generate-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ANON-KEY',
      'x-cron-secret', 'CRON-SECRET'
    ),
    body := '{"trigger":"scheduled"}'::jsonb
  );
  $$
);
```

Der Cron feuert stuendlich; die Edge Function prueft gegen `settings.schedule`
(Wochentag + Stunde, UTC), ob wirklich ein Batch faellig ist. Zeitplan-Aenderungen
in den Studio-Settings wirken sofort, ohne den Cron-Job anzufassen.

Kontrolle: `select * from cron.job;` zeigt den Job. Nach dem geplanten Zeitpunkt
muss in `batches` eine Zeile mit `trigger = 'scheduled'` stehen.

## Betrieb
- Studio starten: `npm run dev` -> http://localhost:5173
- Tests: `npm test`
- Neuer Wissens-Stand aus dem Tracker: Seed-Skript erneut laufen lassen (Upsert)
````

- [ ] **Step 2: [MANUAL — Devin] Cron-SQL ausführen**

Devin führt das SQL aus SETUP.md im SQL-Editor des Studio-Projekts aus (Platzhalter ersetzen). Check: `select * from cron.job;` zeigt `generate-batch-hourly`.

- [ ] **Step 3: Fälligkeit einmal live prüfen (mit Mock)**

In den Studio-Settings den Zeitplan auf die NÄCHSTE volle Stunde (UTC, heutiger Wochentag) stellen. Mindestens ein Thema auf `queued` setzen. Nach der vollen Stunde prüfen: `batches` hat eine neue Zeile mit `trigger='scheduled'`, Queue zeigt neue Mock-Drafts. Danach Zeitplan auf den Wunschtermin (z.B. Montag 9 UTC) zurückstellen.

- [ ] **Step 4: Commit**

```powershell
git add docs/SETUP.md
git commit -m "docs: Setup-Anleitung inkl. pg_cron-Anbindung"
```

---

## Task 18: E2E-Abnahme mit echtem Modell

**Files:** keine neuen — Abnahmelauf gemäß Spec §11.

- [ ] **Step 1: [MANUAL — Devin] Mock abschalten**

```powershell
npx supabase secrets unset MOCK_CLAUDE
```

(Secrets-Änderung wirkt sofort; kein Redeploy nötig.)

- [ ] **Step 2: Kompletter Durchlauf (Erfolgskriterien 2+3)**

1. Themen-Seite: echtes Thema anlegen (z.B. „Blutspiegel-Simulation: PK-Kurven pro Substanz verstehen") → „Generieren".
2. Erwartet: nach ~30-60s Meldung `Fertig: 2 generiert.` — Queue enthält 8 echte Drafts (DE+EN × 4 Kanäle) mit sinnvollen Texten.
3. Stichprobe: Reddit-EN-Draft klingt nach Community-Post (kein Werbesprech), X-Draft ≤ 280 Zeichen, keine Guardrail-Flags (oder: Flags sind berechtigt → im Editor fixen).
4. Instagram-DE-Draft im Editor öffnen, Headline anpassen, „Freigeben" → PNG in Storage, Status `approved`.
5. Queue → „Download" → .txt + PNG passen zusammen.

- [ ] **Step 3: Guardrail-Gegenprobe (Erfolgskriterium 5)**

Auf der Themen-Seite ein provozierendes Thema anlegen: „Beste BPC-157 Dosierung für schnelle Heilung" → „Generieren". Erwartet: Entweder generiert das Modell compliant um das Thema herum (App-Fokus), ODER die Drafts tragen Guardrail-Flags in Queue/Editor. In beiden Fällen: kein unmarkierter Verstoß. Danach Thema auf `retired` setzen.

- [ ] **Step 4: Alle Tests + Build final**

Run: `npm test`
Erwartet: alle Vitest-Suiten PASS.
Run: `npm run build`
Erwartet: fehlerfrei.

- [ ] **Step 5: Abschluss-Commit**

```powershell
git add -A
git commit -m "chore: E2E-Abnahme Sub-Projekt 1 bestanden"
```

---

## Offene Punkte für spätere Sub-Projekte (NICHT jetzt bauen)

- Auto-Publishing/Kanal-APIs, Content-Kalender (Sub-Projekt 2) — Schnittstelle: `drafts.status='approved'` + PNG in `post-assets`
- Blog/SEO + Newsletter (Sub-Projekt 3)
- Videos/Reels, YouTube, App-Store-Assets (Sub-Projekt 4)
- Analytics/Feedback-Loop (Sub-Projekt 5)
