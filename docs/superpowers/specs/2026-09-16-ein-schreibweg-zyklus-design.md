# Ein Schreibweg für einen Zyklus

## Der Befund

Es gab **zwei** Wege, die in `cycles` schrieben:

| | |
|---|---|
| Assistent | → `save_stack_item_with_plan` (RPC) |
| Zyklusformular in `MyStackPage` | → `supabase.from('cycles').update/insert` direkt |

Der zweite ging am RPC vorbei und damit an allen seinen Prüfungen. Sein
`payload` schrieb zwölf Spalten — **nicht** dabei: `slot_doses`, `slot_days`,
`interval_unit`, `cycle_on_days`, `cycle_off_days`. Bei einem `update` bleiben
die stehen, während `intake_time` überschrieben wird:

- `intake_time='morgens,abends'` mit `slot_doses='1000,500'`, geändert auf „nur
  morgens" → `slot_doses` bleibt zweistellig. Der RPC weist das ab
  (*„Slot doses must line up with intake times"*); dieser Weg nicht.
- „Alle 2 Wochen" auf „alle 3 Tage" → `x_days_interval=3`, `interval_unit='week'`
  bleibt → **alle 3 Wochen**.
- `schedKey` verglich ohne `slot_doses`/`slot_days`: eine reine Mengenänderung je
  Zeitpunkt erzeugte **keine** neue Planstufe.

Dazu eine zweite, engere Kopie der Segmentlogik (`nextScheduleHistory`,
`schedKey`, `SchedFields`) neben der des RPC.

Eingetreten war der Fehler nicht: in Produktion trägt keiner der 148 Zyklen
`slot_doses` oder Historie. Mit dem ersten Speichern über den neuen Assistenten
hätte er angefangen.

## Was jetzt gilt

Beide Einstiege führen durch den Assistenten und damit durch den RPC:

| | |
|---|---|
| „Plan ändern" | `intent: 'plan'`, mit dem bestehenden Plan → der RPC schreibt ihn fort |
| „Neuer Zyklus" | `intent: 'plan'`, **ohne** bestehenden Plan → ohne `p_plan.id` legt der RPC einen neuen an |

`intent: 'plan'` verengt die Schritte auf `['plan']` — wer den Plan ändert, wird
nicht durch Substanz, Form und Farbe geführt. Das Muster gab es schon für
`intent: 'pk'`; es ist nur ein zweiter Fall davon.

## Was weg ist

Das Zyklusformular (229 Zeilen JSX), `saveCycle`, `finalizeSave`, der Dialog
„rückwirkend oder ab Datum", `formSchedFields`, `toggleDay`, `nextScheduleHistory`,
`schedKey`, `SchedFields`, `emptyCycleForm`, `CycleForm` und acht
Zustandsvariablen. Netto **486 Zeilen weniger** in `MyStackPage.tsx`, und die
eslint-Baseline sinkt zum ersten Mal: 140 → 139.

Der Dialog „rückwirkend oder ab Datum" fällt ersatzlos: das Stichdatum steht
jetzt im Plan selbst („Gilt ab diesem Datum"), und *rückwirkend* gibt es nicht
mehr — eine vergangene Stufe ist eingetreten, der Kalender hat danach geplant.

**Direkt an `cycles` gehen nur noch** `active`, `end_date` und ein `delete` —
Lebenszyklus, nie Planinhalt. Ein Test hält beides fest: dass die gelöschten
Namen nicht wiederkommen, und dass in keiner `.update(`- oder `.insert(`-Zeile
ein Planfeld steht.

## Was das nicht löst

Der Assistent zeigt bei `intent: 'plan'` genau einen Schritt und darunter
„Speichern". Ob sich das wie ein Formular anfühlt oder wie ein abgeschnittener
Assistent, weiß ich nicht — **gesehen hat es niemand**. Das ist die erste
Stelle, die beim Durchklicken auffallen wird.
