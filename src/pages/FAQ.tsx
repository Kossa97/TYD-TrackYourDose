import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Search,
  CalendarDays, FlaskConical, BookHeart, Star, User,
  TrendingUp, Bell, HelpCircle, Shield, Calculator, Package,
} from 'lucide-react'

interface QA { q: string; a: string | string[] }
interface Category {
  id: string
  icon: React.ReactNode
  title: string
  color: string
  items: QA[]
}

const CATEGORIES: Category[] = [
  {
    id: 'start',
    icon: <HelpCircle size={16} />,
    title: 'Erste Schritte & Navigation',
    color: 'text-sky-400',
    items: [
      {
        q: 'Was ist der Peptid Tracker?',
        a: 'Der Peptid Tracker ist eine persönliche App für Forschungszwecke. Du kannst damit deine Peptide verwalten, Einnahmezyklen planen, Dosen protokollieren, Dosierungen berechnen, Wirkungen im Tagebuch festhalten und Bewertungen schreiben – alles an einem Ort.',
      },
      {
        q: 'Wie navigiere ich zwischen den Bereichen?',
        a: 'Unten am Bildschirm befindet sich eine Navigationsleiste mit 7 Symbolen: Kalender, Peptide, Rechner, Tagebuch, Bewertungen, Profil und FAQ. Tippe einfach auf das jeweilige Symbol um den Bereich zu öffnen.',
      },
      {
        q: 'Was sind die 7 Hauptbereiche der App?',
        a: [
          '📅 Kalender – Übersicht aller Aktivitäten, Dosen protokollieren & bestätigen',
          '🧪 Peptide – Peptide anlegen, Bestand & Batch verwalten, Zyklen & Dosiserhöhungen',
          '🧮 Rechner – Dosierungsrechner mit Spritzenskala',
          '📖 Tagebuch – Wirkungen und Nebenwirkungen aufzeichnen',
          '⭐ Bewertungen – Erfahrungsberichte zu einzelnen Peptiden',
          '👤 Profil – Accountdaten, öffentliches Profil & Teilen-Link',
          '❓ FAQ – Diese Hilfeseite',
        ],
      },
      {
        q: 'Wie melde ich mich ab?',
        a: 'Gehe zu „Profil" und tippe oben rechts auf den roten „Abmelden"-Button.',
      },
      {
        q: 'Werden meine Daten sicher gespeichert?',
        a: 'Ja. Alle Daten werden in einer Supabase-Datenbank gespeichert. Jeder Nutzer sieht ausschließlich seine eigenen Daten – das wird durch Row Level Security (RLS) erzwungen. Batch-Dateien (PDFs/Bilder) liegen in einem separaten Storage-Bucket ebenfalls nur für dich zugänglich.',
      },
      {
        q: 'Kann ich die App auf meinem Handy installieren?',
        a: [
          'Ja! Der Peptid Tracker ist eine PWA (Progressive Web App):',
          'iPhone/Safari: Teilen-Symbol → „Zum Home-Bildschirm" → „Hinzufügen"',
          'Android/Chrome: Drei Punkte → „App installieren" oder „Zum Startbildschirm"',
          'Die App funktioniert dann ohne Browser und sieht aus wie eine native App.',
        ],
      },
      {
        q: 'Wo fange ich am besten an?',
        a: [
          'Empfohlene Reihenfolge:',
          '1. „Peptide" → „+ Neu" → Peptid anlegen (Name, Wirkstoff, Rekonstitution, Bestand)',
          '2. „Zyklus hinzufügen" direkt auf der Peptid-Karte',
          '3. „Rechner" nutzen um Einheiten & Konzentration zu berechnen',
          '4. „Kalender" öffnen – Zyklus erscheint violett hinterlegt',
          '5. Auf einen Zyklus-Tag tippen → Dosis protokollieren & bestätigen',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    icon: <CalendarDays size={16} />,
    title: 'Kalender & Protokoll',
    color: 'text-violet-400',
    items: [
      {
        q: 'Was zeigt der Kalender an?',
        a: [
          'Der Kalender gibt dir auf einen Blick eine Übersicht:',
          '🟣 Violetter Hintergrund = aktiver Zyklus für diesen Tag geplant',
          '🔵 Blauer Punkt = Dosis wurde für diesen Tag protokolliert',
          '🔵 Sky-Ring = heute',
          '🟠 Orange Pfeil-Icon = eine Dosiserhöhung ist an diesem Tag aktiv',
        ],
      },
      {
        q: 'Wie protokolliere ich eine Dosis?',
        a: [
          '1. Tippe im Kalender auf einen Tag',
          '2. Im Tages-Panel unten erscheinen die aktiven Zyklen als Karten',
          '3. Tippe auf einen Zyklus → das Protokoll-Formular öffnet sich vorausgefüllt',
          '4. Passe Dosis, Methode oder Uhrzeit bei Bedarf an',
          '5. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Was ist die Einnahme-Bestätigung?',
        a: [
          'Nach dem Protokollieren kannst du jede Dosis bestätigen:',
          '✅ „Eingenommen" – Eintrag wird grün markiert',
          '❌ „Nicht eingenommen" – Eintrag wird rot markiert und Snooze-Optionen erscheinen',
          'Solange nichts bestätigt ist, erscheinen beide Buttons auf der Eintragskarte.',
        ],
      },
      {
        q: 'Was ist die Snooze-Funktion?',
        a: [
          'Wenn du „Nicht eingenommen" tippst, erscheinen Snooze-Buttons:',
          '⏰ 15 Min – Erinnerung in 15 Minuten',
          '⏰ 30 Min – Erinnerung in 30 Minuten',
          '⏰ 1 Std – Erinnerung in 1 Stunde',
          '⏰ 2 Std – Erinnerung in 2 Stunden',
          'Nach Ablauf erscheint ein Toast-Hinweis mit Peptid und Dosis.',
        ],
      },
      {
        q: 'Was bedeutet der orange Pfeil im Kalender?',
        a: 'Das orange Pfeil-Symbol (📈 Erhöhung aktiv) zeigt dass an diesem Tag eine Dosiserhöhung aus deinem Zyklus greift. Die angezeigte Dosis im Tages-Panel ist bereits die erhöhte Gesamtdosis.',
      },
      {
        q: 'Wie navigiere ich zwischen Monaten?',
        a: 'Tippe auf die Pfeile links/rechts neben dem Monatsnamen.',
      },
      {
        q: 'Kann ich eine protokollierte Dosis löschen?',
        a: 'Ja. Im Tages-Panel rechts neben jedem Eintrag steht ein ✕-Button → tippe darauf und bestätige.',
      },
      {
        q: 'Warum sehe ich keinen violetten Hintergrund obwohl ich einen Zyklus habe?',
        a: [
          'Mögliche Gründe:',
          '• Zyklus ist „Inaktiv" → in Peptide → Zyklus → Schalter aktivieren',
          '• Falscher Monat angezeigt → zum Startmonat des Zyklus blättern',
          '• Start-/Enddatum schließt den Monat aus',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    icon: <FlaskConical size={16} />,
    title: 'Peptide & Bestand',
    color: 'text-sky-400',
    items: [
      {
        q: 'Wie lege ich ein neues Peptid an?',
        a: [
          '1. Tippe oben rechts auf „+ Neu"',
          '2. Gib den Namen ein oder wähle aus „Bekannte"',
          '3. Fülle Wirkstoff & Rekonstitution aus (mg/Vial, Flüssigkeit, Spritze)',
          '4. Trage Bestand, Batch-Infos und Dosierung ein',
          '5. Optional: PDF oder Bild des Analyse-Dokuments hochladen',
          '6. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Was zeigt das animierte Vial auf der Peptid-Karte?',
        a: [
          'Wenn du einen Bestand eingetragen hast, erscheint links auf der Karte ein animiertes Fläschchen:',
          '🟢 Grün = mehr als 50% Vorrat vorhanden',
          '🟡 Gelb = 25–50% Vorrat',
          '🔴 Rot = weniger als 25% – bald leer',
          'Die Flüssigkeit bewegt sich animiert. Auf dem Handy neigt sich das Vial mit der Geräteschräglage.',
        ],
      },
      {
        q: 'Was ist der Info-Button (Zettel-Symbol) auf der Peptid-Karte?',
        a: [
          'Das Zettel-Symbol (📄) öffnet ein Info-Sheet mit allen gespeicherten Daten:',
          '• Dosierung & Applikationsart',
          '• Wirkstoff, Flüssigkeitsmenge, Spritze',
          '• Rekonstitutionsdatum & Ablaufdatum mit Countdown',
          '• Bestand & Fortschrittsbalken',
          '• Batch-Nummer & Quelle',
          '• Analyse-Dokument: Bilder werden direkt angezeigt, PDFs als Link',
          '• Notizen',
        ],
      },
      {
        q: 'Was ist die Bestandsverwaltung?',
        a: [
          'Du kannst die Anzahl vorhandener Vials eintragen:',
          '• „Vorrätige Vials" = aktueller Bestand',
          '• Beim ersten Speichern wird dieser Wert automatisch als 100%-Basis gemerkt',
          '• Der Fortschrittsbalken auf der Karte zeigt den Verbrauch farblich an',
          '• Ablaufdatum: wird aus Rekonstitutionsdatum + Haltbarkeit berechnet',
        ],
      },
      {
        q: 'Was sind Batch-Informationen?',
        a: [
          'Batch-Informationen dokumentieren die Herkunft deines Peptids:',
          '• Batch-Nummer = Chargen-ID des Herstellers',
          '• Quelle = Hersteller oder Lieferant (z.B. "Peptide Sciences")',
          '• Analyse-Dokument = PDF oder Bild hochladen (COA, Laborbericht, Rechnung)',
          'Diese Infos erscheinen auch im Info-Sheet des Peptids.',
        ],
      },
      {
        q: 'Was bedeutet "Zugefügte Flüssigkeit (mL)"?',
        a: 'Das ist die Menge Wasser (z.B. BAC-Wasser, NaCl oder Wasser für Injektionszwecke) die du in das Vial gibst. Je mehr Flüssigkeit, desto geringer die Konzentration. Standard sind 1–2 mL.',
      },
      {
        q: 'Was bedeuten die Spritzenfelder "mL" und "Einheiten"?',
        a: [
          'Diese zwei Felder beschreiben deine Spritze:',
          '• mL = Gesamtvolumen der Spritze (z.B. 1 mL)',
          '• Einheiten = maximale Skalenstriche (z.B. 100 bei U-100-Spritze)',
          '→ Daraus berechnet sich: Einheiten/mL = Skalenstriche pro Milliliter',
          'Standard-Insulinspritze U-100: 1 mL / 100 Einheiten = 100 Einh./mL',
        ],
      },
      {
        q: 'Was ist die Haltbarkeit nach Rekonstitution?',
        a: [
          'Nach dem Auflösen des Peptids ist es nur begrenzt haltbar (im Kühlschrank):',
          '10–14 Tage = kurzfristige Peptide',
          '21–28 Tage = typische Haltbarkeit rekonstituierter Peptide',
          '42–90 Tage = für besonders stabile Peptide',
          'Das Ablaufdatum wird aus Rekonstitutionsdatum + gewählten Tagen berechnet und farblich angezeigt.',
        ],
      },
      {
        q: 'Wie füge ich einen Zyklus direkt von der Peptid-Karte hinzu?',
        a: 'Jede Peptid-Karte hat unten rechts den violetten Button „Zyklus hinzufügen". Tippe darauf – du musst das Peptid nicht erst aufklappen.',
      },
      {
        q: 'Was zeigt der Pfeil mit Zyklusanzahl unten auf der Karte?',
        a: 'Der kleine Pfeil links unten (z.B. „▼ 2 Zyklen") klappt die Zyklus-Ansicht auf oder zu. Du siehst auf einen Blick wie viele Zyklen für dieses Peptid existieren.',
      },
      {
        q: 'Wie suche ich nach einem Peptid?',
        a: 'Sobald Peptide vorhanden sind, erscheint oben ein Suchfeld. Tippe den Namen ein – die Liste filtert automatisch. Mit dem Dropdown daneben kannst du A→Z oder Z→A sortieren.',
      },
    ],
  },
  {
    id: 'rechner',
    icon: <Calculator size={16} />,
    title: 'Rechner',
    color: 'text-emerald-400',
    items: [
      {
        q: 'Was kann der Rechner?',
        a: [
          'Der Rechner berechnet aus deinen Eingaben:',
          '• Einheiten aufziehen – wie viele Skalenstriche auf der Spritze',
          '• Konzentration – mg/mL der fertigen Lösung',
          '• Spritze gefüllt – wie viel Prozent der Spritze du aufziehst',
          '• Dosen pro Vial – wie viele Injektionen du aus einem Vial bekommst',
        ],
      },
      {
        q: 'Was ist die Spritzenskala?',
        a: [
          'Die farbige Skala oben im Rechner zeigt visuell wie viele Einheiten du aufziehen musst:',
          '• Der Balken füllt sich von links (blau) nach rechts (lila → pink)',
          '• Die weiße Linie markiert den exakten Punkt',
          '• Die große Zahl darüber zeigt die Einheiten',
          'Du siehst sofort ob deine Dosis in die Spritze passt.',
        ],
      },
      {
        q: 'Welche Eingaben brauche ich für den Rechner?',
        a: [
          '• Spritzengröße – wähle einen Preset (z.B. 1 mL / 100 Einh.) oder trage eigene Werte ein',
          '• Wirkstoff pro Vial – mg-Menge auf dem Fläschchen (z.B. 10 mg)',
          '• Zugefügte Flüssigkeit – wie viel mL du hinzugegeben hast (z.B. 2 mL)',
          '• Dosis – deine gewünschte Dosis mit Einheit (mcg, mg, IU)',
        ],
      },
      {
        q: 'Welche Spritzen-Presets gibt es?',
        a: [
          '• 1 mL · 100 Einh. (U-100) – Standard-Insulinspritze',
          '• 0,5 mL · 50 Einh. (U-100) – kleine Insulinspritze',
          '• 0,3 mL · 30 Einh. (U-100) – sehr kleine Spritze',
          '• 2 mL · 200 Einh. (U-100) – größere Spritze',
          '• 1 mL · 40 Einh. (U-40) – ältere U-40-Spritze',
          'Oder: eigene mL und Einheiten eingeben.',
        ],
      },
      {
        q: 'Rechenbeispiel – wie funktioniert die Berechnung?',
        a: [
          'Beispiel: BPC-157, 5 mg Vial, 2 mL Wasser, 500 mcg Dosis, U-100 Spritze',
          '→ Konzentration: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volumen: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Einheiten: 0,200 mL × 100 Einh./mL = 20 Einheiten',
          '→ Dosen/Vial: 5000 mcg ÷ 500 mcg = 10 Dosen',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    icon: <CalendarDays size={16} />,
    title: 'Zyklen',
    color: 'text-violet-400',
    items: [
      {
        q: 'Was ist ein Zyklus?',
        a: 'Ein Zyklus ist ein strukturierter Einnahmeplan für ein Peptid. Er legt fest: Dosis, Methode, Frequenz, Zeitraum, optionaler Einnahmezeitpunkt und Erinnerungen.',
      },
      {
        q: 'Wie erstelle ich einen Zyklus?',
        a: [
          '1. Tippe auf der Peptid-Karte auf „+ Zyklus hinzufügen" (lila Button)',
          '2. Fülle Name, Dosis, Frequenz und Datum aus',
          '3. Optional: Einnahmezeitpunkt und Erinnerungen wählen',
          '4. Tippe auf „Speichern"',
          'Der Zyklus erscheint automatisch im Kalender!',
        ],
      },
      {
        q: 'Welche Frequenz-Optionen gibt es?',
        a: [
          '• Täglich · 2x täglich · Jeden 2. Tag',
          '• 5 Tage an / 2 aus (5on/2off)',
          '• Mo-Fr · Wöchentlich',
          '• Alle X Tage – eigenes Intervall',
          '• Wochentage wählen – z.B. nur Mo, Mi, Fr',
        ],
      },
      {
        q: 'Was bedeutet der Aktiv/Inaktiv-Schalter?',
        a: 'Aktiv = Zyklus erscheint im Kalender (violette Tage). Inaktiv = Zyklus pausiert, nicht im Kalender sichtbar. Umschalten per Tippen auf den Schalter rechts am Zyklus.',
      },
      {
        q: 'Was ist der Einnahmezeitpunkt?',
        a: [
          'Optional – legt die Tageszeit fest:',
          '🌅 Morgens = 08:00 · ☀️ Mittags = 12:00 · 🌙 Abends = 20:00 · 🕐 Eigene Uhrzeit',
          'Wird für die Erinnerungsfunktion verwendet. Ist optional – du kannst ihn leer lassen.',
        ],
      },
      {
        q: 'Wie funktioniert die Erinnerungsfunktion?',
        a: [
          'Erinnerungen sind Mehrfachauswahl – du kannst mehrere gleichzeitig wählen:',
          '• 1 Tag vorher – Erinnerung 24 Stunden vor der Einnahme',
          '• 2 Std vorher – 2 Stunden Vorlauf',
          '• Bei Einnahme – genau zur eingestellten Zeit',
          'Die App fragt beim Speichern nach der Benachrichtigungs-Berechtigung.',
          'Wichtig: Funktioniert nur wenn die App geöffnet ist.',
        ],
      },
      {
        q: 'Kann ich mehrere Zyklen für ein Peptid haben?',
        a: 'Ja, beliebig viele. Alle aktiven Zyklen erscheinen im Kalender. Nützlich z.B. für morgens + abends oder verschiedene Dosierungsphasen.',
      },
    ],
  },
  {
    id: 'escalation',
    icon: <TrendingUp size={16} />,
    title: 'Dosiserhöhungen',
    color: 'text-orange-400',
    items: [
      {
        q: 'Was ist eine Dosiserhöhung?',
        a: 'Ein geplanter Anstieg der Dosis innerhalb eines Zyklus. Beispiel: Start mit 200 mcg, nach 2 Wochen +100 mcg, nach 4 Wochen nochmals +100 mcg. Mehrere Stufen sind möglich.',
      },
      {
        q: 'Wie füge ich eine Dosiserhöhung hinzu?',
        a: [
          '1. Peptid aufklappen → Zyklus suchen → Bereich „Dosiserhöhungen"',
          '2. Tippe auf „+ Hinzufügen"',
          '3. Erhöhungsbetrag und Einheit eingeben',
          '4. Startzeitpunkt wählen: Festes Datum / Nach X Tagen / Nach X Wochen',
          '5. Optional eine Notiz hinzufügen → Speichern',
        ],
      },
      {
        q: 'Wird die Dosiserhöhung im Kalender angezeigt?',
        a: [
          'Ja! Ab dem Zeitpunkt wo eine Erhöhung greift:',
          '• Oranges 📈-Symbol im Tages-Panel zeigt „Stufe X aktiv"',
          '• Die angezeigte Dosis ist bereits die erhöhte Gesamtdosis (Basis + Erhöhung)',
          '• Im Kalender erscheint das Erhöhungs-Icon in der Legende',
        ],
      },
      {
        q: 'Was bedeuten die Startzeitpunkt-Optionen?',
        a: [
          '• Festes Datum – konkret ab wann die Erhöhung gilt',
          '• Nach X Tagen – X Tage nach Zyklusstart',
          '• Nach X Wochen – entsprechende Tagesanzahl nach Zyklusstart',
        ],
      },
      {
        q: 'Kann ich mehrere Stufen haben?',
        a: 'Ja, beliebig viele. Sie werden #1, #2, #3 nummeriert. Alle aktiven Stufen werden addiert.',
      },
    ],
  },
  {
    id: 'tagebuch',
    icon: <BookHeart size={16} />,
    title: 'Tagebuch',
    color: 'text-emerald-400',
    items: [
      {
        q: 'Was ist das Tagebuch?',
        a: 'Hier dokumentierst du Wirkungen und Nebenwirkungen deiner Peptide. Hilft dir Muster zu erkennen – welche Effekte wann auftreten, wie stark und wie lange sie anhalten.',
      },
      {
        q: 'Was ist der Unterschied zwischen Wirkung und Nebenwirkung?',
        a: [
          '✅ Wirkung (grün) = gewünschter Effekt (Schlaf, Heilung, Energie...)',
          '⚠️ Nebenwirkung (orange) = unerwünschter Effekt (Schmerzen, Müdigkeit...)',
        ],
      },
      {
        q: 'Was bedeuten die Status-Optionen?',
        a: [
          '🔘 Steht noch an – noch nicht eingetreten',
          '✅ Eingetreten – aktiv vorhanden',
          '⏳ Noch anhaltend – dauert an',
          '✅ Abgeklungen – vorbei',
          'Status direkt auf der Karte ändern ohne Formular zu öffnen.',
        ],
      },
      {
        q: 'Was ist die Intensitätsskala (1–5)?',
        a: [
          '1 = Kaum spürbar · 2 = Leicht · 3 = Mittel · 4 = Stark · 5 = Sehr stark',
        ],
      },
      {
        q: 'Wie filtere und suche ich im Tagebuch?',
        a: [
          '• Tabs: Alle / Wirkungen / Nebenwirkungen',
          '• Suchfeld: filtert nach Beschreibung und Peptidname',
          '• Sortierung: Datum (neu/alt), Intensität (hoch/niedrig)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    icon: <Star size={16} />,
    title: 'Bewertungen',
    color: 'text-amber-400',
    items: [
      {
        q: 'Was sind Bewertungen?',
        a: 'Persönliche Erfahrungsberichte zu einzelnen Peptiden. Mit Sternen (1–5), Gesamterfahrung (Gut/Mittel/Schlecht), Vor- und Nachteilen sowie einem ausführlichen Bericht.',
      },
      {
        q: 'Wie erstelle ich eine Bewertung?',
        a: [
          '1. In „Bewertungen" auf „+ Neu" tippen',
          '2. Peptid auswählen → Sterne vergeben → Erfahrung wählen',
          '3. Titel eingeben (Pflicht) → optional Bericht, Vorteile, Nachteile',
          '4. Speichern',
        ],
      },
      {
        q: 'Wie suche und sortiere ich Bewertungen?',
        a: [
          '• Suchfeld: Titel und Peptidname',
          '• Sortierung: Neueste / Älteste / Bewertung hoch / Bewertung niedrig',
        ],
      },
      {
        q: 'Kann ich Bewertungen im Profil teilen?',
        a: 'Ja. In „Profil" den Schalter „Bewertungen" aktivieren – dann erscheinen sie auf deinem öffentlichen Profil-Link.',
      },
    ],
  },
  {
    id: 'profil',
    icon: <User size={16} />,
    title: 'Profil & Teilen',
    color: 'text-slate-300',
    items: [
      {
        q: 'Was kann ich im Profil eintragen?',
        a: [
          '• Benutzername (für den Teilen-Link) – Pflichtfeld',
          '• Anzeigename, Alter, Geschlecht, Gewicht, Größe',
          '• Persönliche Notizen (nur für dich)',
          '• Öffentliche Bio (erscheint auf dem geteilten Profil)',
        ],
      },
      {
        q: 'Wie aktiviere ich das öffentliche Profil?',
        a: [
          '1. Benutzernamen eintragen und Profil speichern',
          '2. Hauptschalter „Profil teilen" aktivieren',
          '3. Einzelne Bereiche freigeben (Peptide / Kalender / Tagebuch / Bewertungen)',
          '4. Speichern → Link erscheint und kann kopiert werden',
        ],
      },
      {
        q: 'Welche Inhalte kann ich freigeben?',
        a: [
          'Jeder Bereich hat einen eigenen Schalter:',
          '🧪 Peptide · 📅 Kalender & Zyklen · 📖 Tagebuch · ⭐ Bewertungen',
          'Du kannst z.B. nur Bewertungen teilen, alles andere bleibt privat.',
        ],
      },
      {
        q: 'Kann ich das Teilen jederzeit deaktivieren?',
        a: 'Ja. Hauptschalter „Profil teilen" aus → speichern. Der Link zeigt sofort „Dieses Profil ist privat".',
      },
    ],
  },
  {
    id: 'erinnerung',
    icon: <Bell size={16} />,
    title: 'Erinnerungen & Snooze',
    color: 'text-sky-400',
    items: [
      {
        q: 'Wie richte ich Erinnerungen ein?',
        a: [
          '1. Zyklus erstellen oder bearbeiten',
          '2. Einnahmezeitpunkt setzen (Morgens/Mittags/Abends/Eigene Uhrzeit)',
          '3. Unter „Erinnerung" eine oder mehrere Optionen wählen (Mehrfachauswahl)',
          '4. Speichern → App fragt nach Benachrichtigungs-Berechtigung',
        ],
      },
      {
        q: 'Kann ich mehrere Erinnerungszeitpunkte gleichzeitig wählen?',
        a: 'Ja. Du kannst z.B. „1 Tag vorher" und „Bei Einnahme" gleichzeitig aktivieren. Häkchen zeigen welche aktiv sind.',
      },
      {
        q: 'Was ist der Unterschied zwischen Erinnerung und Snooze?',
        a: [
          'Erinnerung (im Zyklus) = geplante Benachrichtigung vor der Einnahme',
          'Snooze (im Kalender) = nachträgliche Erinnerung wenn du eine Dosis als „Nicht eingenommen" markiert hast (15 Min / 30 Min / 1 Std / 2 Std)',
        ],
      },
      {
        q: 'Warum bekomme ich keine Erinnerung?',
        a: [
          '• Benachrichtigungs-Berechtigung verweigert → in Handyeinstellungen freischalten',
          '• App war zur Erinnerungszeit nicht geöffnet',
          '• Erinnerungszeit ist heute bereits vergangen',
          '• Zyklus ist „Inaktiv"',
        ],
      },
      {
        q: 'Funktionieren Erinnerungen bei geschlossener App?',
        a: 'Aktuell nicht. Die Benachrichtigungen sind Browser-basiert und benötigen eine geöffnete App (Tab oder PWA). Für Hintergrund-Benachrichtigungen wäre ein Push-Service nötig.',
      },
    ],
  },
  {
    id: 'technik',
    icon: <Shield size={16} />,
    title: 'Technisches & Datenschutz',
    color: 'text-slate-400',
    items: [
      {
        q: 'Warum erscheint "Fehler beim Speichern"?',
        a: [
          '• Keine Internetverbindung',
          '• Pflichtfelder nicht ausgefüllt',
          '• Sitzung abgelaufen → ab- und wieder anmelden',
          '• Bei PDF-Upload: Storage-Bucket noch nicht eingerichtet → SQL in Supabase ausführen',
        ],
      },
      {
        q: 'Warum kann ich keine PDF hochladen?',
        a: [
          'Der Speicher-Bucket „batch-files" muss einmalig in Supabase eingerichtet werden:',
          '1. supabase.com → dein Projekt → SQL Editor → neuer Tab',
          '2. Den SQL-Code aus „supabase-inventory.sql" einfügen und ausführen',
          'Danach funktioniert der Upload sofort.',
        ],
      },
      {
        q: 'Was passiert mit meinen Daten wenn ich mich abmelde?',
        a: 'Deine Daten bleiben erhalten. Beim nächsten Login sind alle Einträge noch vorhanden.',
      },
      {
        q: 'Werden Daten gelöscht wenn ich die App deinstalliere?',
        a: 'Nein. Die Daten liegen auf dem Server (Supabase) – unabhängig vom Gerät. Auf jedem Gerät einfach neu anmelden.',
      },
      {
        q: 'Ist die App für medizinische Zwecke geeignet?',
        a: 'Nein. Ausschließlich für Forschungs- und Dokumentationszwecke. Kein Ersatz für medizinische Beratung. Konsultiere immer einen Arzt.',
      },
      {
        q: 'Kann ich die App auf Tablet oder zweitem Gerät nutzen?',
        a: [
          'Ja. Da alle Daten in der Cloud liegen, funktioniert die App auf beliebig vielen Geräten:',
          '1. Gleiche URL im Browser öffnen',
          '2. Mit demselben Account einloggen',
          '3. Alle Daten sind sofort verfügbar',
          'Für den Code-Zugriff (Entwicklung): Repository auf GitHub klonen.',
        ],
      },
    ],
  },
]

function AccordionItem({ item }: { item: QA }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border-b border-slate-800 last:border-b-0`}>
      <button
        className="w-full text-left flex items-start justify-between gap-3 py-3.5 px-1"
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

export function FAQ() {
  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['start']))

  const toggleCat = (id: string) =>
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const q = search.toLowerCase().trim()

  const visible = q
    ? CATEGORIES.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(q) ||
          (Array.isArray(item.a) ? item.a.join(' ') : item.a).toLowerCase().includes(q)
        ),
      })).filter(cat => cat.items.length > 0)
    : CATEGORIES

  const totalQ = CATEGORIES.reduce((s, c) => s + c.items.length, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle size={20} className="text-sky-400" />
        <h1 className="text-xl font-bold">FAQ</h1>
      </div>
      <p className="text-slate-500 text-sm mb-4">{totalQ} Fragen & Antworten zu allen Funktionen</p>

      {/* Suche */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Frage suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Suchergebnis leer */}
      {q && visible.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
          <p>Keine Antwort gefunden für „{search}"</p>
        </div>
      )}

      {/* Kategorien */}
      <div className="space-y-3">
        {visible.map(cat => (
          <div key={cat.id} className="card overflow-hidden p-0">
            {/* Kategorie-Header */}
            <button
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

            {/* Q&A-Liste */}
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
        Peptid Tracker · Nur für Forschungszwecke
      </p>
    </div>
  )
}
