import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'

const obx = {
  obx_welcome_title:"Willkommen bei TYD", obx_welcome_sub:"Track Your Dose", obx_welcome_desc:"Diese kurze Tour legt mit dir Schritt für Schritt deine erste Substanz, einen Zyklus und eine Dosiserhöhung an — und zeigt dir den Kalender.",
  obx_navmystack_title:"My Stack", obx_navmystack_sub:"Schritt 1 · Navigation", obx_navmystack_desc:"Hier verwaltest du deine Substanzen. Tippe unten auf „My Stack".", obx_navmystack_tap:"👇 Tippe auf „My Stack"",
  obx_openpep_title:"Substanz anlegen", obx_openpep_sub:"Schritt 2 · Neu", obx_openpep_desc:"Lege deine erste Substanz an. Tippe oben rechts auf „+ Neu".", obx_openpep_tap:"👉 Tippe auf „+ Neu"",
  obx_pepname_title:"Name", obx_pepname_sub:"Pflichtfeld", obx_pepname_desc:"Gib den Namen der Substanz ein (z. B. BPC-157). Bekannte Namen kannst du auch auswählen.",
  obx_pepcolor_title:"Farbe", obx_pepcolor_sub:"Optik", obx_pepcolor_desc:"Wähle eine Farbe — sie kennzeichnet die Substanz in Listen und Diagrammen.",
  obx_pepmg_title:"Wirkstoff pro Vial", obx_pepmg_sub:"Rekonstitution", obx_pepmg_desc:"Wie viel Wirkstoff (mg) ist im Vial enthalten?",
  obx_pepliquid_title:"Zugefügte Flüssigkeit", obx_pepliquid_sub:"Rekonstitution", obx_pepliquid_desc:"Wie viel ml Lösungsmittel hast du hinzugefügt? Daraus wird die Konzentration berechnet.",
  obx_peprecon_title:"Datum Rekonstitution", obx_peprecon_sub:"Haltbarkeit", obx_peprecon_desc:"Wann hast du das Vial angemischt? Startpunkt für die Haltbarkeit.",
  obx_pepexpiry_title:"Haltbarkeit", obx_pepexpiry_sub:"Haltbarkeit", obx_pepexpiry_desc:"Wähle die Haltbarkeit oder gib eigene Tage ein — du wirst vor Ablauf gewarnt.",
  obx_pepvials_title:"Vorrätige Vials", obx_pepvials_sub:"Bestand", obx_pepvials_desc:"Wie viele Vials hast du aktuell? Der Bestand wird bei Einnahmen automatisch reduziert.",
  obx_pepbatch_title:"Batch", obx_pepbatch_sub:"Herkunft (optional)", obx_pepbatch_desc:"Optional: Chargennummer für deine Nachverfolgung.",
  obx_pepsource_title:"Quelle", obx_pepsource_sub:"Herkunft (optional)", obx_pepsource_desc:"Optional: Bezugsquelle der Substanz.",
  obx_pepdoc_title:"Analyse-Dokument", obx_pepdoc_sub:"Herkunft (optional)", obx_pepdoc_desc:"Optional: lade ein Analysezertifikat oder eine Rechnung als PDF/Bild hoch.",
  obx_pepdose_title:"Standard-Dosis", obx_pepdose_sub:"Dosierung", obx_pepdose_desc:"Lege Standard-Dosis und Einheit fest — als Vorschlag für neue Zyklen.",
  obx_pepmethod_title:"Applikationsart", obx_pepmethod_sub:"Dosierung", obx_pepmethod_desc:"Wie wird verabreicht (z. B. subkutan)?",
  obx_pepnotes_title:"Notizen", obx_pepnotes_sub:"Dosierung (optional)", obx_pepnotes_desc:"Optional: eigene Notizen zur Substanz.",
  obx_pepsave_title:"Substanz speichern", obx_pepsave_sub:"Bestätigen", obx_pepsave_desc:"Passt alles? Speichere die Substanz.", obx_pepsave_tap:"👉 Tippe auf „Speichern"",
  obx_opencyc_title:"Zyklus hinzufügen", obx_opencyc_sub:"Schritt 3 · Zyklus", obx_opencyc_desc:"Ein Zyklus plant Dosis, Frequenz und Erinnerungen. Tippe auf „+ Zyklus hinzufügen".", obx_opencyc_tap:"👉 Tippe auf „+ Zyklus hinzufügen"",
  obx_cycname_title:"Zyklus-Name", obx_cycname_sub:"Zyklus", obx_cycname_desc:"Gib dem Zyklus einen Namen (z. B. „Cut 2024").",
  obx_cycdose_title:"Dosis", obx_cycdose_sub:"Pflichtfeld", obx_cycdose_desc:"Welche Dosis pro Einnahme?",
  obx_cycunit_title:"Einheit", obx_cycunit_sub:"Zyklus", obx_cycunit_desc:"Wähle die Einheit der Dosis.",
  obx_cycmethod_title:"Applikationsart", obx_cycmethod_sub:"Zyklus", obx_cycmethod_desc:"Wie wird in diesem Zyklus verabreicht?",
  obx_cycfreq_title:"Frequenz", obx_cycfreq_sub:"Zyklus", obx_cycfreq_desc:"Wie oft? Täglich, jeden 2. Tag, bestimmte Wochentage usw.",
  obx_cycinterval_title:"Intervall", obx_cycinterval_sub:"Zyklus", obx_cycinterval_desc:"Alle wie viele Tage soll die Einnahme erfolgen?",
  obx_cycweekdays_title:"Wochentage", obx_cycweekdays_sub:"Zyklus", obx_cycweekdays_desc:"Wähle die Wochentage für die Einnahme.",
  obx_cycdates_title:"Start & Ende", obx_cycdates_sub:"Zyklus", obx_cycdates_desc:"Startdatum (Pflicht) und optional ein Enddatum.",
  obx_cycintake_title:"Einnahmezeit", obx_cycintake_sub:"Zyklus", obx_cycintake_desc:"Wann am Tag? Morgens, mittags, abends oder eigene Uhrzeit — Basis für Erinnerungen.",
  obx_cycreminder_title:"Erinnerung", obx_cycreminder_sub:"Zyklus", obx_cycreminder_desc:"Optional: Push-Erinnerungen aktivieren.",
  obx_cycsave_title:"Zyklus speichern", obx_cycsave_sub:"Bestätigen", obx_cycsave_desc:"Speichere den Zyklus.", obx_cycsave_tap:"👉 Tippe auf „Speichern"",
  obx_openesc_title:"Dosiserhöhung", obx_openesc_sub:"Schritt 4 · Steigerung", obx_openesc_desc:"Plane eine spätere Dosissteigerung. Tippe auf „Dosiserhöhung hinzufügen".", obx_openesc_tap:"👉 Tippe auf „Dosiserhöhung hinzufügen"",
  obx_escamount_title:"Erhöhung um", obx_escamount_sub:"Pflichtfeld", obx_escamount_desc:"Um welchen Betrag soll die Dosis steigen?",
  obx_escwhen_title:"Ab wann", obx_escwhen_sub:"Dosiserhöhung", obx_escwhen_desc:"Festes Datum, nach X Tagen oder nach X Wochen?",
  obx_escdetail_title:"Zeitpunkt", obx_escdetail_sub:"Dosiserhöhung", obx_escdetail_desc:"Lege den genauen Zeitpunkt der Erhöhung fest.",
  obx_escnotes_title:"Notizen", obx_escnotes_sub:"Dosiserhöhung (optional)", obx_escnotes_desc:"Optional: Notiz zur Erhöhung.",
  obx_escsave_title:"Erhöhung speichern", obx_escsave_sub:"Bestätigen", obx_escsave_desc:"Speichere die Dosiserhöhung.", obx_escsave_tap:"👉 Tippe auf „Speichern"",
  obx_navcal_title:"Kalender", obx_navcal_sub:"Schritt 5 · Überblick", obx_navcal_desc:"Im Kalender siehst du deinen Tagesplan. Tippe unten auf „Kalender".", obx_navcal_tap:"👇 Tippe auf „Kalender"",
  obx_calshow_title:"Dein Tagesplan", obx_calshow_sub:"Kalender", obx_calshow_desc:"Hier erscheinen fällige Einnahmen. Tippe einen Tag an, um Details zu sehen.",
  obx_simconfirm_title:"Einnahme bestätigen", obx_simconfirm_sub:"Schritt 6 · Übung", obx_simconfirm_desc:"So bestätigst du eine fällige Einnahme. Dies ist eine Übung — es wird nichts gespeichert.", obx_simconfirm_tap:"👉 Tippe auf „Bestätigen"",
  obx_finish_title:"Fertig! 🚀", obx_finish_sub:"Geschafft", obx_finish_desc:"Du kennst jetzt den kompletten Ablauf. Die Tour kannst du jederzeit im Profil neu starten.",
  obx_sim_kicker:"Übung · Noch fällig", obx_sim_substance:"BPC-157 · 250 mcg", obx_sim_time:"Heute · 20:00", obx_sim_btn:"Bestätigen",
}

const dir = 'src/i18n/locales'
mkdirSync('scripts/_onb_todo', { recursive: true })
const files = readdirSync(dir).filter(f => f.endsWith('.json'))
let removedTotal = 0
for (const f of files) {
  const code = f.replace('.json', '')
  const obj = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
  // remove obsolete ob_step_* keys
  let removed = 0
  for (const k of Object.keys(obj)) if (k.startsWith('ob_step_')) { delete obj[k]; removed++ }
  removedTotal += removed
  if (code === 'de') {
    Object.assign(obj, obx)
    writeFileSync(`${dir}/${f}`, JSON.stringify(obj, null, 2) + '\n', 'utf8')
  } else {
    // write todo (German source for all obx keys), and persist the ob_step removal
    writeFileSync(`${dir}/${f}`, JSON.stringify(obj, null, 2) + '\n', 'utf8')
    writeFileSync(`scripts/_onb_todo/${code}.json`, JSON.stringify(obx, null, 2), 'utf8')
  }
  console.log(`${code}: -${removed} ob_step_ ${code === 'de' ? '+' + Object.keys(obx).length + ' obx (de)' : 'todo written'}`)
}
console.log('obx key count:', Object.keys(obx).length, '| total ob_step removed:', removedTotal)
