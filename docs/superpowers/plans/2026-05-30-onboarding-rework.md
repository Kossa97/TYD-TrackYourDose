# Onboarding-Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neues, feld-für-feld geführtes Onboarding (Substanz anlegen → Zyklus → Dosiserhöhung → Kalender → simulierte Einnahmebestätigung) auf der bestehenden Engine.

**Architecture:** Engine (`Onboarding.tsx`, `onboardingPlacement.ts`, `OnboardingContext`) bleibt. Wir erweitern `OnboardingStepMeta` um zwei Flags (`requireFilled`, `optionalTarget`), ergänzen `data-ob`-Anker an Formularfeldern/Buttons, schreiben `onboardingSteps.ts` neu, rendern eine simulierte Bestätigungs-Karte und liefern neue i18n-Texte.

**Tech Stack:** React 19, TS, react-i18next, lucide-react. Verifikation: `npm run build`, per-Datei `npx eslint`, manueller Durchlauf (Onboarding-Restart im Profil).

**Test-Ansatz:** Interaktives Onboarding ohne sinnvolle Unit-Tests. Verifikation = Build/Lint grün + expliziter manueller Durchlauf-Schritt je Task.

---

## File Structure

- `src/components/onboardingSteps.ts` — **Rewrite**: Typ + neue Schritt-Liste.
- `src/components/Onboarding.tsx` — **Modify**: `requireFilled`-Gating, `optionalTarget`-Auto-Skip, simulierte Confirm-Karte, Entfernen des inventar-spezifischen `add-stock`-Effekts.
- `src/pages/Peptide.tsx` — **Modify**: `data-ob`-Anker an Feldern + „+ Neu"-Button.
- `src/i18n/locales/*.json` — **Modify**: neue `obx_*`-Keys (14 Sprachen), alte `ob_step_*` entfernen.

---

## Task 1: Step-Meta-Flags + Engine-Gating/Skip

**Files:**
- Modify: `src/components/onboardingSteps.ts` (Typ)
- Modify: `src/components/Onboarding.tsx`

- [ ] **Step 1: Typ um zwei Flags erweitern**

In `onboardingSteps.ts` im `OnboardingStepMeta`-Interface ergänzen:
```ts
  /** Next/confirm bleibt deaktiviert, bis das Ziel-Input einen Wert hat. */
  requireFilled?: boolean
  /** Erscheint das Ziel nicht in ~700ms, Schritt automatisch überspringen. */
  optionalTarget?: boolean
```

- [ ] **Step 2: Inventar-spezifischen `add-stock`-Effekt entfernen**

In `Onboarding.tsx` den kompletten `useEffect` mit `meta?.id !== 'add-stock'` (der Block, der bei `add-stock` auto-advanced; ca. Zeilen 276–288) **löschen** — der Schritt existiert nicht mehr. Ebenso in dem darauffolgenden Click-Advance-Effekt die Sonderbedingung `&& meta?.id !== 'add-stock'` aus der `if`-Zeile entfernen (sodass nur noch `meta?.advance !== 'click'` bleibt).

- [ ] **Step 3: `optionalTarget`-Auto-Skip**

In `Onboarding.tsx` neuen Effekt nach dem Mess-Effekt einfügen:
```tsx
  // Auto-skip optional steps whose target never appears.
  useEffect(() => {
    if (!active || needsLanguagePick || !meta?.optionalTarget) return
    const id = window.setTimeout(() => {
      if (!getOnboardingInteractionEl(meta)) nextRef.current()
    }, 700)
    return () => clearTimeout(id)
  }, [step, active, needsLanguagePick, meta])
```

- [ ] **Step 4: `requireFilled`-Gating-State**

In `Onboarding.tsx` einen `filled`-State ergänzen und im Mess-Intervall mitprüfen. Direkt nach `const [fieldIndex, setFieldIndex] = useState(0)` einfügen:
```tsx
  const [filled, setFilled] = useState(true)
```
In `measureTarget` (am Ende, vor dem letzten `setTargetRect(...)`-Pfad) die Füll-Prüfung ergänzen — füge am Anfang von `measureTarget` nach `setModalOpen(...)` ein:
```tsx
    if (meta?.requireFilled) {
      const tgt = getOnboardingInteractionEl(meta)
      const input = tgt?.matches('input,select,textarea')
        ? (tgt as HTMLInputElement)
        : tgt?.querySelector<HTMLInputElement>('input,select,textarea') ?? null
      setFilled(!!input && String(input.value).trim().length > 0)
    } else {
      setFilled(true)
    }
```

- [ ] **Step 5: Next-Button + Confirm-Check bei `requireFilled` deaktivieren**

Footer-Next-Button (`ob-primary-btn`) erweitern: `disabled={meta?.requireFilled ? !filled : false}` und `style={{ opacity: meta?.requireFilled && !filled ? 0.4 : 1 }}`.
Im `confirmBtn`-Portal die Klick-Aktion gaten: am Anfang von `handleConfirm` `if (meta?.requireFilled && !filled) return`, und `style.opacity = meta?.requireFilled && !filled ? 0.4 : 1`, `cursor = ... 'not-allowed' : 'pointer'`.

- [ ] **Step 6: Build + Lint**

Run: `npm run build && npx eslint src/components/Onboarding.tsx src/components/onboardingSteps.ts`
Expected: Build grün; keine NEUEN Lint-Fehler.

- [ ] **Step 7: Commit**
```bash
git add src/components/Onboarding.tsx src/components/onboardingSteps.ts
git commit -m "feat(onboarding): add requireFilled gating and optionalTarget auto-skip"
```

---

## Task 2: `data-ob`-Anker an Formularfeldern & Buttons

**Files:**
- Modify: `src/pages/Peptide.tsx`

Vorhandene Anker bleiben: `pep-liquid`, `btn-pep-save`, `btn-zyklus-add`, `cycle-core`, `btn-cycle-save`, `btn-esc-add`, `esc-core`, `btn-esc-save`. Es werden **Feld-Anker** ergänzt. Jeweils das umschließende `<div>` des Feldes mit `data-ob="<name>"` versehen (NICHT das `<input>` direkt, außer angegeben).

- [ ] **Step 1: „+ Neu"-Button (My-Stack-Header)**

Den Header-Button (`onClick={handleNewPeptide}`, Label `{t('new')}`) um `data-ob="btn-peptid-anlegen"` ergänzen.

- [ ] **Step 2: Peptid-Formular-Feldanker**

Anker an die jeweiligen Feld-Wrapper:
- Name-Feld-Wrapper (das `<div>` um `<input value={pForm.name} …>`) → `data-ob="pep-name"`
- „Farbe der Flüssigkeit"-Block → `data-ob="pep-color"`
- „Wirkstoff pro Vial"-`<div>` → `data-ob="pep-mg"`
- (`pep-liquid` existiert)
- „Datum Rekonstitution"-`<div>` → `data-ob="pep-recon-date"`
- „Haltbarkeit"-Block (`data-ob-self`-`<div>`) → zusätzlich `data-ob="pep-expiry"`
- „Vorrätige Vials"-`<div>` → `data-ob="pep-vials"`
- „Batch"-`<div>` → `data-ob="pep-batch"`
- „Quelle"-`<div>` → `data-ob="pep-source"`
- „Analyse-Dokument"-`<div>` → `data-ob="pep-doc"`
- Standard-Dosis-`<div>` (Dosis+Einheit) → `data-ob="pep-dose-amount"` (die Sektion `pep-dose` bleibt am Sektions-`<div>`; für den Feld-Schritt den inneren Dosis-Block nutzen)
- Applikationsart-`<div>` → `data-ob="pep-method"`
- Notizen-`<div>` → `data-ob="pep-notes"`

- [ ] **Step 3: Zyklus-Formular-Feldanker**

- Zyklus-Name-`<div>` → `data-ob="cyc-name"`
- Dosis-`<div>` → `data-ob="cyc-dose"`
- Einheit-`<div>` → `data-ob="cyc-unit"`
- Applikationsart-`<div>` → `data-ob="cyc-method"`
- Frequenz-`<div>` → `data-ob="cyc-frequency"`
- „Alle X Tage"-Block (bedingt) → `data-ob="cyc-interval"`
- Wochentage-Block (bedingt, `data-ob-self`) → zusätzlich `data-ob="cyc-weekdays"`
- Start/Ende-Block (`data-ob-self`) → zusätzlich `data-ob="cyc-dates"`
- Einnahmezeit-Block (`data-ob-self`) → zusätzlich `data-ob="cyc-intake"`
- Erinnerung-Block (`data-ob-self`) → zusätzlich `data-ob="cyc-reminder"`

- [ ] **Step 4: Dosiserhöhung-Formular-Feldanker**

- „Dosis erhöht um"-`<div>` → `data-ob="esc-amount"`
- „Ab wann"-`<div>` → `data-ob="esc-when"`
- bedingter Datums-/Tage-/Wochen-`<div>` → jeweils `data-ob="esc-when-detail"`
- Notizen-`<div>` → `data-ob="esc-notes"`

- [ ] **Step 5: Build + Lint + Commit**

Run: `npm run build && npx eslint src/pages/Peptide.tsx` → grün / keine neuen Fehler.
```bash
git add src/pages/Peptide.tsx
git commit -m "feat(onboarding): add data-ob anchors to substance/cycle/escalation fields"
```

---

## Task 3: Neue Schritt-Liste (`onboardingSteps.ts`)

**Files:**
- Modify: `src/components/onboardingSteps.ts`

- [ ] **Step 1: `ONBOARDING_STEPS`-Array ersetzen**

Das gesamte Array durch folgende Schritte ersetzen (Keys = `obx_<id>_*`). `placement: 'auto'` + `advance: 'next'` für Erklär-Felder; `advance: 'click'` für Buttons/Nav.

```ts
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { id:'welcome', emoji:'👋', titleKey:'obx_welcome_title', subtitleKey:'obx_welcome_sub', descriptionKey:'obx_welcome_desc', targetSelector:null, placement:'center', advance:'next' },
  { id:'nav-mystack', emoji:'🧬', titleKey:'obx_navmystack_title', subtitleKey:'obx_navmystack_sub', descriptionKey:'obx_navmystack_desc', targetSelector:'[data-ob="nav-peptide"]', placement:'top', advance:'click', navTarget:true, route:'/peptide', tapHintKey:'obx_navmystack_tap' },
  { id:'open-peptide', emoji:'➕', titleKey:'obx_openpep_title', subtitleKey:'obx_openpep_sub', descriptionKey:'obx_openpep_desc', targetSelector:'[data-ob="btn-peptid-anlegen"]', placement:'bottom', advance:'click', tapHintKey:'obx_openpep_tap' },
  { id:'pep-name', emoji:'🏷️', titleKey:'obx_pepname_title', subtitleKey:'obx_pepname_sub', descriptionKey:'obx_pepname_desc', targetSelector:'[data-ob="pep-name"]', placement:'auto', advance:'next', requireFilled:true },
  { id:'pep-color', emoji:'🎨', titleKey:'obx_pepcolor_title', subtitleKey:'obx_pepcolor_sub', descriptionKey:'obx_pepcolor_desc', targetSelector:'[data-ob="pep-color"]', placement:'auto', advance:'next' },
  { id:'pep-mg', emoji:'💊', titleKey:'obx_pepmg_title', subtitleKey:'obx_pepmg_sub', descriptionKey:'obx_pepmg_desc', targetSelector:'[data-ob="pep-mg"]', placement:'auto', advance:'next' },
  { id:'pep-liquid', emoji:'💧', titleKey:'obx_pepliquid_title', subtitleKey:'obx_pepliquid_sub', descriptionKey:'obx_pepliquid_desc', targetSelector:'[data-ob="pep-liquid"]', placement:'auto', advance:'next' },
  { id:'pep-recon', emoji:'📅', titleKey:'obx_peprecon_title', subtitleKey:'obx_peprecon_sub', descriptionKey:'obx_peprecon_desc', targetSelector:'[data-ob="pep-recon-date"]', placement:'auto', advance:'next' },
  { id:'pep-expiry', emoji:'⏳', titleKey:'obx_pepexpiry_title', subtitleKey:'obx_pepexpiry_sub', descriptionKey:'obx_pepexpiry_desc', targetSelector:'[data-ob="pep-expiry"]', placement:'auto', advance:'next' },
  { id:'pep-vials', emoji:'🧴', titleKey:'obx_pepvials_title', subtitleKey:'obx_pepvials_sub', descriptionKey:'obx_pepvials_desc', targetSelector:'[data-ob="pep-vials"]', placement:'auto', advance:'next' },
  { id:'pep-batch', emoji:'🔖', titleKey:'obx_pepbatch_title', subtitleKey:'obx_pepbatch_sub', descriptionKey:'obx_pepbatch_desc', targetSelector:'[data-ob="pep-batch"]', placement:'auto', advance:'next' },
  { id:'pep-source', emoji:'🏭', titleKey:'obx_pepsource_title', subtitleKey:'obx_pepsource_sub', descriptionKey:'obx_pepsource_desc', targetSelector:'[data-ob="pep-source"]', placement:'auto', advance:'next' },
  { id:'pep-doc', emoji:'📎', titleKey:'obx_pepdoc_title', subtitleKey:'obx_pepdoc_sub', descriptionKey:'obx_pepdoc_desc', targetSelector:'[data-ob="pep-doc"]', placement:'auto', advance:'next' },
  { id:'pep-dose', emoji:'💉', titleKey:'obx_pepdose_title', subtitleKey:'obx_pepdose_sub', descriptionKey:'obx_pepdose_desc', targetSelector:'[data-ob="pep-dose-amount"]', placement:'auto', advance:'next' },
  { id:'pep-method', emoji:'🧭', titleKey:'obx_pepmethod_title', subtitleKey:'obx_pepmethod_sub', descriptionKey:'obx_pepmethod_desc', targetSelector:'[data-ob="pep-method"]', placement:'auto', advance:'next' },
  { id:'pep-notes', emoji:'📝', titleKey:'obx_pepnotes_title', subtitleKey:'obx_pepnotes_sub', descriptionKey:'obx_pepnotes_desc', targetSelector:'[data-ob="pep-notes"]', placement:'auto', advance:'next' },
  { id:'pep-save', emoji:'✅', titleKey:'obx_pepsave_title', subtitleKey:'obx_pepsave_sub', descriptionKey:'obx_pepsave_desc', targetSelector:'[data-ob="btn-pep-save"]', placement:'top', advance:'click', tapHintKey:'obx_pepsave_tap', scrollTarget:true },
  { id:'open-cycle', emoji:'🔄', titleKey:'obx_opencyc_title', subtitleKey:'obx_opencyc_sub', descriptionKey:'obx_opencyc_desc', targetSelector:'[data-ob="btn-zyklus-add"]', placement:'top', advance:'click', tapHintKey:'obx_opencyc_tap', scrollTarget:true },
  { id:'cyc-name', emoji:'🏷️', titleKey:'obx_cycname_title', subtitleKey:'obx_cycname_sub', descriptionKey:'obx_cycname_desc', targetSelector:'[data-ob="cyc-name"]', placement:'auto', advance:'next' },
  { id:'cyc-dose', emoji:'💉', titleKey:'obx_cycdose_title', subtitleKey:'obx_cycdose_sub', descriptionKey:'obx_cycdose_desc', targetSelector:'[data-ob="cyc-dose"]', placement:'auto', advance:'next', requireFilled:true },
  { id:'cyc-unit', emoji:'⚖️', titleKey:'obx_cycunit_title', subtitleKey:'obx_cycunit_sub', descriptionKey:'obx_cycunit_desc', targetSelector:'[data-ob="cyc-unit"]', placement:'auto', advance:'next' },
  { id:'cyc-method', emoji:'🧭', titleKey:'obx_cycmethod_title', subtitleKey:'obx_cycmethod_sub', descriptionKey:'obx_cycmethod_desc', targetSelector:'[data-ob="cyc-method"]', placement:'auto', advance:'next' },
  { id:'cyc-freq', emoji:'🔁', titleKey:'obx_cycfreq_title', subtitleKey:'obx_cycfreq_sub', descriptionKey:'obx_cycfreq_desc', targetSelector:'[data-ob="cyc-frequency"]', placement:'auto', advance:'next' },
  { id:'cyc-interval', emoji:'📆', titleKey:'obx_cycinterval_title', subtitleKey:'obx_cycinterval_sub', descriptionKey:'obx_cycinterval_desc', targetSelector:'[data-ob="cyc-interval"]', placement:'auto', advance:'next', optionalTarget:true },
  { id:'cyc-weekdays', emoji:'🗓️', titleKey:'obx_cycweekdays_title', subtitleKey:'obx_cycweekdays_sub', descriptionKey:'obx_cycweekdays_desc', targetSelector:'[data-ob="cyc-weekdays"]', placement:'auto', advance:'next', optionalTarget:true },
  { id:'cyc-dates', emoji:'📅', titleKey:'obx_cycdates_title', subtitleKey:'obx_cycdates_sub', descriptionKey:'obx_cycdates_desc', targetSelector:'[data-ob="cyc-dates"]', placement:'auto', advance:'next' },
  { id:'cyc-intake', emoji:'⏰', titleKey:'obx_cycintake_title', subtitleKey:'obx_cycintake_sub', descriptionKey:'obx_cycintake_desc', targetSelector:'[data-ob="cyc-intake"]', placement:'auto', advance:'next' },
  { id:'cyc-reminder', emoji:'🔔', titleKey:'obx_cycreminder_title', subtitleKey:'obx_cycreminder_sub', descriptionKey:'obx_cycreminder_desc', targetSelector:'[data-ob="cyc-reminder"]', placement:'auto', advance:'next' },
  { id:'cyc-save', emoji:'✅', titleKey:'obx_cycsave_title', subtitleKey:'obx_cycsave_sub', descriptionKey:'obx_cycsave_desc', targetSelector:'[data-ob="btn-cycle-save"]', placement:'top', advance:'click', tapHintKey:'obx_cycsave_tap', scrollTarget:true },
  { id:'open-esc', emoji:'📈', titleKey:'obx_openesc_title', subtitleKey:'obx_openesc_sub', descriptionKey:'obx_openesc_desc', targetSelector:'[data-ob="btn-esc-add"]', placement:'top', advance:'click', tapHintKey:'obx_openesc_tap', scrollTarget:true },
  { id:'esc-amount', emoji:'➕', titleKey:'obx_escamount_title', subtitleKey:'obx_escamount_sub', descriptionKey:'obx_escamount_desc', targetSelector:'[data-ob="esc-amount"]', placement:'auto', advance:'next', requireFilled:true },
  { id:'esc-when', emoji:'🕒', titleKey:'obx_escwhen_title', subtitleKey:'obx_escwhen_sub', descriptionKey:'obx_escwhen_desc', targetSelector:'[data-ob="esc-when"]', placement:'auto', advance:'next' },
  { id:'esc-when-detail', emoji:'📅', titleKey:'obx_escdetail_title', subtitleKey:'obx_escdetail_sub', descriptionKey:'obx_escdetail_desc', targetSelector:'[data-ob="esc-when-detail"]', placement:'auto', advance:'next', optionalTarget:true },
  { id:'esc-notes', emoji:'📝', titleKey:'obx_escnotes_title', subtitleKey:'obx_escnotes_sub', descriptionKey:'obx_escnotes_desc', targetSelector:'[data-ob="esc-notes"]', placement:'auto', advance:'next' },
  { id:'esc-save', emoji:'✅', titleKey:'obx_escsave_title', subtitleKey:'obx_escsave_sub', descriptionKey:'obx_escsave_desc', targetSelector:'[data-ob="btn-esc-save"]', placement:'top', advance:'click', tapHintKey:'obx_escsave_tap', scrollTarget:true },
  { id:'nav-calendar', emoji:'🗓️', titleKey:'obx_navcal_title', subtitleKey:'obx_navcal_sub', descriptionKey:'obx_navcal_desc', targetSelector:'[data-ob="nav-kalender"]', placement:'top', advance:'click', navTarget:true, route:'/kalender', tapHintKey:'obx_navcal_tap' },
  { id:'calendar-show', emoji:'📆', titleKey:'obx_calshow_title', subtitleKey:'obx_calshow_sub', descriptionKey:'obx_calshow_desc', targetSelector:'[data-ob="calendar-main"]', placement:'bottom', advance:'next', route:'/kalender' },
  { id:'sim-confirm', emoji:'☑️', titleKey:'obx_simconfirm_title', subtitleKey:'obx_simconfirm_sub', descriptionKey:'obx_simconfirm_desc', targetSelector:'[data-ob="ob-sim-confirm"]', placement:'top', advance:'click', tapHintKey:'obx_simconfirm_tap', route:'/kalender' },
  { id:'finish', emoji:'🚀', titleKey:'obx_finish_title', subtitleKey:'obx_finish_sub', descriptionKey:'obx_finish_desc', targetSelector:null, placement:'center', advance:'next' },
]
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: grün (Texte fehlen noch → zeigen Keys, kommen in Task 5).

- [ ] **Step 3: Commit**
```bash
git add src/components/onboardingSteps.ts
git commit -m "feat(onboarding): new field-by-field step sequence"
```

---

## Task 4: Simulierte Bestätigungs-Karte (`sim-confirm`)

**Files:**
- Modify: `src/components/Onboarding.tsx`

- [ ] **Step 1: Sandbox-Karte rendern**

In `Onboarding.tsx` vor dem finalen `return (<> … </>)` eine Variable bauen, die bei `meta?.id === 'sim-confirm'` eine fixe Karte (unten über dem Kalender) per `createPortal` rendert. Kein DB-Zugriff. Der Button trägt `data-ob="ob-sim-confirm"` und `data-ob-confirm` (damit der Klick durch den globalen Block-Handler durchgelassen wird). Klick wird über den bestehenden `advance:'click'`-Delegations-Handler erkannt → Tour geht weiter.

```tsx
  const simConfirm = meta?.id === 'sim-confirm' ? createPortal(
    <div style={{
      position:'fixed', left:12, right:12,
      bottom:'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)',
      zIndex: OB_Z.panel - 2,
      background:'var(--surface)', border:'1px solid var(--accent-border)',
      borderRadius:18, padding:'14px 16px',
      boxShadow:'0 12px 40px rgba(0,0,0,0.45)',
      display:'flex', alignItems:'center', gap:12,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:'0.66rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--accent)' }}>
          {t('obx_sim_kicker')}
        </p>
        <p style={{ fontSize:'0.9rem', fontWeight:800, color:'var(--text)' }}>{t('obx_sim_substance')}</p>
        <p style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{t('obx_sim_time')}</p>
      </div>
      <button type="button" data-ob="ob-sim-confirm" data-ob-confirm
        style={{ flexShrink:0, padding:'10px 16px', borderRadius:12, border:'none',
          background:'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #003a6e))',
          color:'var(--accent-contrast)', fontWeight:800, fontSize:'0.85rem', cursor:'pointer' }}>
        <Check size={16} style={{ verticalAlign:'-3px', marginRight:4 }} />{t('obx_sim_btn')}
      </button>
    </div>, document.body) : null
```
Und im finalen Return `{simConfirm}` neben `{confirmBtn}` einsetzen.

- [ ] **Step 2: Build + Lint + Commit**

Run: `npm run build && npx eslint src/components/Onboarding.tsx` → grün.
```bash
git add src/components/Onboarding.tsx
git commit -m "feat(onboarding): simulated due-intake confirmation card"
```

---

## Task 5: i18n — neue Texte (DE) + alle Sprachen + alte Keys entfernen

**Files:**
- Modify: `src/i18n/locales/de.json` (+ alle 13 weiteren)

- [ ] **Step 1: Deutsche `obx_*`-Keys in `de.json` ergänzen**

Folgendes JSON-Block-Inhalt (Werte) in `de.json` aufnehmen (per Text-Append vor schließender Klammer, wie bei früheren i18n-Tasks). Knappe, erklärende Texte:

```json
"obx_welcome_title":"Willkommen bei TYD","obx_welcome_sub":"Track Your Dose","obx_welcome_desc":"Diese kurze Tour legt mit dir Schritt für Schritt deine erste Substanz, einen Zyklus und eine Dosiserhöhung an — und zeigt dir den Kalender.",
"obx_navmystack_title":"My Stack","obx_navmystack_sub":"Schritt 1 · Navigation","obx_navmystack_desc":"Hier verwaltest du deine Substanzen. Tippe unten auf „My Stack".","obx_navmystack_tap":"👇 Tippe auf „My Stack"",
"obx_openpep_title":"Substanz anlegen","obx_openpep_sub":"Schritt 2 · Neu","obx_openpep_desc":"Lege deine erste Substanz an. Tippe oben rechts auf „+ Neu".","obx_openpep_tap":"👉 Tippe auf „+ Neu"",
"obx_pepname_title":"Name","obx_pepname_sub":"Pflichtfeld","obx_pepname_desc":"Gib den Namen der Substanz ein (z. B. BPC-157). Bekannte Namen kannst du auch auswählen.",
"obx_pepcolor_title":"Farbe","obx_pepcolor_sub":"Optik","obx_pepcolor_desc":"Wähle eine Farbe — sie kennzeichnet die Substanz in Listen und Diagrammen.",
"obx_pepmg_title":"Wirkstoff pro Vial","obx_pepmg_sub":"Rekonstitution","obx_pepmg_desc":"Wie viel Wirkstoff (mg) ist im Vial enthalten?",
"obx_pepliquid_title":"Zugefügte Flüssigkeit","obx_pepliquid_sub":"Rekonstitution","obx_pepliquid_desc":"Wie viel ml Lösungsmittel hast du hinzugefügt? Daraus wird die Konzentration berechnet.",
"obx_peprecon_title":"Datum Rekonstitution","obx_peprecon_sub":"Haltbarkeit","obx_peprecon_desc":"Wann hast du das Vial angemischt? Startpunkt für die Haltbarkeit.",
"obx_pepexpiry_title":"Haltbarkeit","obx_pepexpiry_sub":"Haltbarkeit","obx_pepexpiry_desc":"Wähle die Haltbarkeit oder gib eigene Tage ein — du wirst vor Ablauf gewarnt.",
"obx_pepvials_title":"Vorrätige Vials","obx_pepvials_sub":"Bestand","obx_pepvials_desc":"Wie viele Vials hast du aktuell? Der Bestand wird bei Einnahmen automatisch reduziert.",
"obx_pepbatch_title":"Batch","obx_pepbatch_sub":"Herkunft (optional)","obx_pepbatch_desc":"Optional: Chargennummer für deine Nachverfolgung.",
"obx_pepsource_title":"Quelle","obx_pepsource_sub":"Herkunft (optional)","obx_pepsource_desc":"Optional: Bezugsquelle der Substanz.",
"obx_pepdoc_title":"Analyse-Dokument","obx_pepdoc_sub":"Herkunft (optional)","obx_pepdoc_desc":"Optional: lade ein Analysezertifikat oder eine Rechnung als PDF/Bild hoch.",
"obx_pepdose_title":"Standard-Dosis","obx_pepdose_sub":"Dosierung","obx_pepdose_desc":"Lege Standard-Dosis und Einheit fest — als Vorschlag für neue Zyklen.",
"obx_pepmethod_title":"Applikationsart","obx_pepmethod_sub":"Dosierung","obx_pepmethod_desc":"Wie wird verabreicht (z. B. subkutan)?",
"obx_pepnotes_title":"Notizen","obx_pepnotes_sub":"Dosierung (optional)","obx_pepnotes_desc":"Optional: eigene Notizen zur Substanz.",
"obx_pepsave_title":"Substanz speichern","obx_pepsave_sub":"Bestätigen","obx_pepsave_desc":"Passt alles? Speichere die Substanz.","obx_pepsave_tap":"👉 Tippe auf „Speichern"",
"obx_opencyc_title":"Zyklus hinzufügen","obx_opencyc_sub":"Schritt 3 · Zyklus","obx_opencyc_desc":"Ein Zyklus plant Dosis, Frequenz und Erinnerungen. Tippe auf „+ Zyklus hinzufügen".","obx_opencyc_tap":"👉 Tippe auf „+ Zyklus hinzufügen"",
"obx_cycname_title":"Zyklus-Name","obx_cycname_sub":"Zyklus","obx_cycname_desc":"Gib dem Zyklus einen Namen (z. B. „Cut 2024").",
"obx_cycdose_title":"Dosis","obx_cycdose_sub":"Pflichtfeld","obx_cycdose_desc":"Welche Dosis pro Einnahme?",
"obx_cycunit_title":"Einheit","obx_cycunit_sub":"Zyklus","obx_cycunit_desc":"Wähle die Einheit der Dosis.",
"obx_cycmethod_title":"Applikationsart","obx_cycmethod_sub":"Zyklus","obx_cycmethod_desc":"Wie wird in diesem Zyklus verabreicht?",
"obx_cycfreq_title":"Frequenz","obx_cycfreq_sub":"Zyklus","obx_cycfreq_desc":"Wie oft? Täglich, jeden 2. Tag, bestimmte Wochentage usw.",
"obx_cycinterval_title":"Intervall","obx_cycinterval_sub":"Zyklus","obx_cycinterval_desc":"Alle wie viele Tage soll die Einnahme erfolgen?",
"obx_cycweekdays_title":"Wochentage","obx_cycweekdays_sub":"Zyklus","obx_cycweekdays_desc":"Wähle die Wochentage für die Einnahme.",
"obx_cycdates_title":"Start & Ende","obx_cycdates_sub":"Zyklus","obx_cycdates_desc":"Startdatum (Pflicht) und optional ein Enddatum.",
"obx_cycintake_title":"Einnahmezeit","obx_cycintake_sub":"Zyklus","obx_cycintake_desc":"Wann am Tag? Morgens, mittags, abends oder eigene Uhrzeit — Basis für Erinnerungen.",
"obx_cycreminder_title":"Erinnerung","obx_cycreminder_sub":"Zyklus","obx_cycreminder_desc":"Optional: Push-Erinnerungen aktivieren.",
"obx_cycsave_title":"Zyklus speichern","obx_cycsave_sub":"Bestätigen","obx_cycsave_desc":"Speichere den Zyklus.","obx_cycsave_tap":"👉 Tippe auf „Speichern"",
"obx_openesc_title":"Dosiserhöhung","obx_openesc_sub":"Schritt 4 · Steigerung","obx_openesc_desc":"Plane eine spätere Dosissteigerung. Tippe auf „Dosiserhöhung hinzufügen".","obx_openesc_tap":"👉 Tippe auf „Dosiserhöhung hinzufügen"",
"obx_escamount_title":"Erhöhung um","obx_escamount_sub":"Pflichtfeld","obx_escamount_desc":"Um welchen Betrag soll die Dosis steigen?",
"obx_escwhen_title":"Ab wann","obx_escwhen_sub":"Dosiserhöhung","obx_escwhen_desc":"Festes Datum, nach X Tagen oder nach X Wochen?",
"obx_escdetail_title":"Zeitpunkt","obx_escdetail_sub":"Dosiserhöhung","obx_escdetail_desc":"Lege den genauen Zeitpunkt der Erhöhung fest.",
"obx_escnotes_title":"Notizen","obx_escnotes_sub":"Dosiserhöhung (optional)","obx_escnotes_desc":"Optional: Notiz zur Erhöhung.",
"obx_escsave_title":"Erhöhung speichern","obx_escsave_sub":"Bestätigen","obx_escsave_desc":"Speichere die Dosiserhöhung.","obx_escsave_tap":"👉 Tippe auf „Speichern"",
"obx_navcal_title":"Kalender","obx_navcal_sub":"Schritt 5 · Überblick","obx_navcal_desc":"Im Kalender siehst du deinen Tagesplan. Tippe unten auf „Kalender".","obx_navcal_tap":"👇 Tippe auf „Kalender"",
"obx_calshow_title":"Dein Tagesplan","obx_calshow_sub":"Kalender","obx_calshow_desc":"Hier erscheinen fällige Einnahmen. Tippe einen Tag an, um Details zu sehen.",
"obx_simconfirm_title":"Einnahme bestätigen","obx_simconfirm_sub":"Schritt 6 · Übung","obx_simconfirm_desc":"So bestätigst du eine fällige Einnahme. Dies ist eine Übung — es wird nichts gespeichert.","obx_simconfirm_tap":"👉 Tippe auf „Bestätigen"",
"obx_finish_title":"Fertig! 🚀","obx_finish_sub":"Geschafft","obx_finish_desc":"Du kennst jetzt den kompletten Ablauf. Die Tour kannst du jederzeit im Profil neu starten.",
"obx_sim_kicker":"Übung · Noch fällig","obx_sim_substance":"BPC-157 · 250 mcg","obx_sim_time":"Heute · 20:00","obx_sim_btn":"Bestätigen"
```

- [ ] **Step 2: Übrige 13 Sprachen füllen**

Pro Sprache die neuen `obx_*`-Keys aus dem Deutschen übersetzen und in die jeweilige `locales/<code>.json` mergen (per-Sprache-Subagent oder `npm run i18n:onboarding:generate`/`merge`). Platzhalter `{{…}}` (hier keine) und Emojis erhalten. Vollständige Parität sicherstellen (jede Locale enthält alle `obx_*`).

- [ ] **Step 3: Alte `ob_step_*`-Keys entfernen**

Aus allen 14 Locale-Dateien die nicht mehr referenzierten `ob_step_*`-Keys (sowie `ob_step_*_hint`) entfernen. Prüfen via Code-Scan, dass kein `t('ob_step_…')` mehr existiert.

- [ ] **Step 4: Build + Commit**

Run: `npm run build` → grün.
```bash
git add src/i18n/locales/*.json
git commit -m "i18n(onboarding): new obx_* texts in all languages; remove old ob_step_*"
```

---

## Task 6: Abschluss-Verifikation (manueller Durchlauf)

- [ ] **Step 1: Build + Lint**
Run: `npm run build` und per-Datei `npx eslint` der geänderten Dateien → grün / keine neuen Fehler.

- [ ] **Step 2: Manueller Durchlauf** (Dev-Server, Onboarding via Profil → „App-Anleitung neu starten")
Prüfen:
- Welcome → My Stack → „+ Neu" → Peptid Feld für Feld (Name gegated bis ausgefüllt) → Speichern legt Substanz real an.
- Zyklus Feld für Feld (Dosis gegated), bedingte Schritte (Intervall/Wochentage) werden bei „Täglich" automatisch übersprungen → Speichern legt Zyklus an.
- Dosiserhöhung Feld für Feld (Betrag gegated) → Speichern legt Erhöhung an.
- Kalender wird gezeigt → simulierte Karte erscheint → „Bestätigen" beendet Schritt (KEIN neuer `dose_logs`-Eintrag).
- Finish.

- [ ] **Step 3: Positionierung**
In jedem Schritt: Callout verdeckt das markierte Element/Feld nie, bleibt über der Bottom-Nav, scrollt im Formular-Modal korrekt mit. In Dark **und** Light prüfen.

- [ ] **Step 4: Commit (falls Fixes nötig)**
```bash
git add -A
git commit -m "fix(onboarding): verification adjustments"
```

---

## Self-Review (gegen Spec)

- Engine behalten + Flags (`requireFilled`/`optionalTarget`) — Task 1. ✔
- Feld-für-Feld + alle Buttons — Task 2 (Anker) + Task 3 (Schritte). ✔
- Simulierte Bestätigung (kein DB-Write) — Task 4. ✔
- „Nie im Weg / mitwandern" — bestehende Engine + In-Modal-Scroll/Snap; verifiziert Task 6/3. ✔
- i18n inkl. aller Sprachen + alte Keys weg — Task 5. ✔
- Alte Lager/Inventar-Schritte entfernt — Task 3 (Array-Replace) + Task 1/2 (add-stock-Effekt weg). ✔

Keine Platzhalter; Anker-Namen/Keys über Tasks konsistent (Schritt-Targets ↔ Task-2-Anker ↔ Task-5-Keys).
