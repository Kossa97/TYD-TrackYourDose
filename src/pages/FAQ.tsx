import { useState } from 'react'
import {
  ChevronDown, ChevronUp, Search,
  CalendarDays, FlaskConical, BookHeart, Star, User,
  TrendingUp, Bell, HelpCircle, Syringe, Globe, Shield,
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
        a: 'Der Peptid Tracker ist eine persönliche App für Forschungszwecke. Du kannst damit deine Peptide verwalten, Einnahmezyklen planen, Dosen protokollieren, Wirkungen im Tagebuch festhalten und Bewertungen schreiben – alles an einem Ort.',
      },
      {
        q: 'Wie navigiere ich zwischen den Bereichen?',
        a: 'Unten am Bildschirm befindest du eine Navigationsleiste mit 6 Symbolen: Kalender, Peptide, Tagebuch, Bewertungen, Profil und FAQ. Tippe einfach auf das jeweilige Symbol um den Bereich zu öffnen.',
      },
      {
        q: 'Was sind die 6 Hauptbereiche der App?',
        a: [
          '📅 Kalender – Übersicht aller Aktivitäten, Dosen protokollieren',
          '🧪 Peptide – Peptide anlegen, Zyklen & Dosiserhöhungen verwalten',
          '📖 Tagebuch – Wirkungen und Nebenwirkungen aufzeichnen',
          '⭐ Bewertungen – Erfahrungsberichte zu einzelnen Peptiden',
          '👤 Profil – Accountdaten, öffentliches Profil & Teilen-Link',
          '❓ FAQ – Diese Hilfeseite',
        ],
      },
      {
        q: 'Wie melde ich mich ab?',
        a: 'Gehe zu „Profil" (unten rechts das Person-Symbol) und tippe oben rechts auf den roten „Abmelden"-Button.',
      },
      {
        q: 'Werden meine Daten sicher gespeichert?',
        a: 'Ja. Alle Daten werden verschlüsselt in einer Supabase-Datenbank gespeichert. Jeder Nutzer sieht ausschließlich seine eigenen Daten – das wird durch Row Level Security (RLS) erzwungen. Niemand anderes kann auf deine Daten zugreifen.',
      },
      {
        q: 'Kann ich die App auf meinem Handy installieren?',
        a: [
          'Ja! Der Peptid Tracker ist eine PWA (Progressive Web App) – du kannst sie wie eine normale App installieren:',
          'iPhone/Safari: Tippe auf das Teilen-Symbol → „Zum Home-Bildschirm" → „Hinzufügen"',
          'Android/Chrome: Tippe auf die drei Punkte → „App installieren" oder „Zum Startbildschirm hinzufügen"',
          'Die App funktioniert dann ohne Browser und sieht aus wie eine native App.',
        ],
      },
      {
        q: 'Wo fange ich am besten an?',
        a: [
          'Empfohlene Reihenfolge für den Start:',
          '1. Gehe zu „Peptide" und lege dein erstes Peptid an',
          '2. Erstelle darin einen Zyklus mit Dosis, Frequenz und Einnahmezeitpunkt',
          '3. Öffne den „Kalender" – dein Zyklus erscheint dort automatisch (violett hinterlegt)',
          '4. Protokolliere deine erste Dosis über den Kalender',
          '5. Schreibe nach einigen Tagen einen Tagebucheintrag über Wirkungen',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    icon: <CalendarDays size={16} />,
    title: 'Kalender',
    color: 'text-violet-400',
    items: [
      {
        q: 'Was zeigt der Kalender an?',
        a: 'Der Kalender zeigt dir auf einen Blick: violett hinterlegte Tage = ein aktiver Zyklus ist für diesen Tag geplant. Blaue Punkte = du hast an diesem Tag bereits eine Dosis protokolliert. Beides gleichzeitig ist möglich.',
      },
      {
        q: 'Was bedeuten die Farben im Kalender?',
        a: [
          '🟣 Violetter Hintergrund = mindestens ein aktiver Zyklus ist für diesen Tag geplant',
          '🔵 Blauer Punkt = du hast an diesem Tag manuell eine Dosis protokolliert',
          '🔵 Sky-blauer Ring = heute (das aktuelle Datum)',
          '🔵 Hellblauer Hintergrund = der aktuell ausgewählte Tag',
        ],
      },
      {
        q: 'Was ist der Unterschied zwischen "geplanter Zyklus" und "protokollierter Dosis"?',
        a: 'Ein geplanter Zyklus (violett) zeigt dir, dass laut deinem Protokoll heute eine Einnahme vorgesehen ist – er wird automatisch aus deinen Zyklus-Einstellungen berechnet. Eine protokollierte Dosis (blauer Punkt) bedeutet, dass du die Einnahme manuell bestätigt und eingetragen hast.',
      },
      {
        q: 'Wie protokolliere ich eine Dosis?',
        a: [
          '1. Tippe im Kalender auf den gewünschten Tag',
          '2. Unten erscheint die Tagesansicht für diesen Tag',
          '3. Tippe auf den blauen „Protokollieren"-Button',
          '4. Wähle Peptid, Dosis, Einheit, Methode und Uhrzeit',
          '5. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Was ist das "Heutige Protokoll" unter dem Kalender?',
        a: 'Direkt unter dem Kalender siehst du immer das Protokoll des aktuell ausgewählten Tages. Standardmäßig ist heute ausgewählt, daher steht dort „Heutiges Protokoll". Wenn du auf einen anderen Tag klickst, wechselt die Ansicht entsprechend. Mit dem „→ Heute"-Button kommst du jederzeit zurück.',
      },
      {
        q: 'Wie navigiere ich zwischen Monaten?',
        a: 'Tippe auf die Pfeile links und rechts neben dem Monatsnamen um vorwärts oder rückwärts zu blättern.',
      },
      {
        q: 'Kann ich eine protokollierte Dosis löschen?',
        a: 'Ja. Tippe auf den Tag mit der Eintragung → in der Tagesansicht erscheint ein ✕-Symbol rechts neben dem Eintrag → tippe darauf und bestätige die Löschung.',
      },
      {
        q: 'Warum sehe ich im Kalender keinen violetten Hintergrund obwohl ich einen Zyklus habe?',
        a: [
          'Mögliche Gründe:',
          '• Der Zyklus ist als "Inaktiv" markiert – gehe zu Peptide → Zyklus → aktiviere ihn',
          '• Du bist in einem anderen Monat – blättere zum Monat in dem der Zyklus startet',
          '• Das Start- oder Enddatum schließt den angezeigten Monat aus',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    icon: <FlaskConical size={16} />,
    title: 'Peptide',
    color: 'text-sky-400',
    items: [
      {
        q: 'Wie lege ich ein neues Peptid an?',
        a: [
          '1. Tippe in „Peptide" oben rechts auf „+ Neu"',
          '2. Gib den Namen ein oder wähle aus der „Bekannte"-Liste',
          '3. Fülle Vial-Menge, gewünschte Dosis und Einheit aus',
          '4. Wähle Spritzentyp und Rekonstitutionsvolumen',
          '5. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Was ist die "Bekannte"-Liste beim Peptidnamen?',
        a: 'Das ist eine vorgefertigte Liste populärer Peptide (BPC-157, TB-500, Ipamorelin usw.). Tippe auf „Bekannte" um ein Peptid schnell auszuwählen – der Name wird dann automatisch eingetragen.',
      },
      {
        q: 'Was bedeutet "Vial-Menge (mg)"?',
        a: 'Das ist die Gesamtmenge des Wirkstoffs in deinem Fläschchen (Vial). Wenn auf dem Vial z.B. „10 mg" steht, trägst du dort 10 ein. Diese Angabe wird für den Dosierungsrechner benötigt.',
      },
      {
        q: 'Was bedeutet "Rekonstitution (mL)"?',
        a: 'Rekonstitution bedeutet das Auflösen des Peptid-Pulvers in Wasser (z.B. BAC-Wasser). Wenn du 2 mL Wasser in das Vial gibst, trägst du dort 2 ein. Je mehr Wasser, desto niedriger die Konzentration.',
      },
      {
        q: 'Wie funktioniert der Dosierungsrechner?',
        a: [
          'Der Rechner berechnet automatisch wie viele Einheiten du aufziehen musst:',
          '• mg/mL = Konzentration (Vial-mg ÷ Rekonstitutions-mL)',
          '• mL = benötigtes Volumen für deine Zieldosis',
          '• Einheiten = Skalenstufen auf der Spritze',
          'Beispiel: 10 mg Vial, 2 mL Wasser, Zieldosis 500 mcg → du musst 10 Einheiten aufziehen',
        ],
      },
      {
        q: 'Was bedeuten die verschiedenen Einheiten?',
        a: [
          '• mcg (Mikrogramm) = 1/1000 mg – für sehr niedrig dosierte Peptide typisch',
          '• mg (Milligramm) = 1/1000 g – häufig bei höheren Dosierungen',
          '• IU (International Units) = biologische Einheit, z.B. bei HGH und Insulin',
          '• ml = Volumen (nicht Wirkstoffmenge)',
          '• nmol = Nanomol, seltenere wissenschaftliche Einheit',
        ],
      },
      {
        q: 'Was ist der Unterschied zwischen Peptid und Zyklus?',
        a: 'Ein Peptid ist das Mittel selbst (z.B. BPC-157 mit Dosierungsinfos). Ein Zyklus ist ein Einnahmeplan für dieses Peptid – mit Frequenz, Zeitraum, Einnahmezeitpunkt und Erinnerung. Du kannst zu einem Peptid mehrere Zyklen erstellen.',
      },
      {
        q: 'Wie suche ich nach einem Peptid?',
        a: 'Sobald mindestens ein Peptid vorhanden ist, erscheint oben ein Suchfeld. Tipp dort den Namen ein und die Liste filtert sich automatisch. Mit dem Dropdown daneben kannst du A→Z oder Z→A sortieren.',
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
        a: 'Ein Zyklus ist ein strukturierter Einnahmeplan für ein bestimmtes Peptid. Er legt fest: wie viel (Dosis + Einheit), wie (Methode), wie oft (Frequenz), wann (Start-/Enddatum), zu welcher Zeit (Einnahmezeitpunkt) und ob du eine Erinnerung möchtest.',
      },
      {
        q: 'Wie erstelle ich einen Zyklus?',
        a: [
          '1. Öffne „Peptide" und tippe auf ein Peptid um es aufzuklappen',
          '2. Tippe auf „+ Neuer Zyklus"',
          '3. Fülle Name, Dosis, Frequenz, Datum und Einnahmezeitpunkt aus',
          '4. Optional: Erinnerung aktivieren',
          '5. Tippe auf „Speichern"',
          'Der Zyklus erscheint danach automatisch im Kalender!',
        ],
      },
      {
        q: 'Welche Frequenz-Optionen gibt es?',
        a: [
          '• Täglich – jeden Tag',
          '• 2x täglich – zweimal pro Tag',
          '• Jeden 2. Tag – jeden zweiten Tag',
          '• 5 Tage an / 2 aus – typisches "5 on / 2 off" Protokoll',
          '• Mo-Fr – Montag bis Freitag',
          '• Wöchentlich – einmal pro Woche',
          '• Alle X Tage – du bestimmst das Intervall (z.B. alle 4 Tage)',
          '• Wochentage wählen – du wählst gezielt Mo, Mi, Fr etc.',
        ],
      },
      {
        q: 'Was bedeutet "Aktiv" und "Inaktiv" beim Zyklus?',
        a: 'Ein aktiver Zyklus wird im Kalender angezeigt (violette Tage). Ein inaktiver Zyklus ist pausiert und erscheint nicht im Kalender. Du kannst den Status jederzeit durch Tippen auf den „Aktiv/Inaktiv"-Button umschalten.',
      },
      {
        q: 'Was ist der Einnahmezeitpunkt?',
        a: [
          'Der Einnahmezeitpunkt legt fest, zu welcher Tageszeit du dein Peptid nehmen möchtest:',
          '🌅 Morgens = 08:00 Uhr',
          '☀️ Mittags = 12:00 Uhr',
          '🌙 Abends = 20:00 Uhr',
          '🕐 Uhrzeit = du gibst eine beliebige Uhrzeit ein',
          'Diese Information wird im Zyklus angezeigt und für die Erinnerungsfunktion verwendet.',
        ],
      },
      {
        q: 'Wie funktioniert die Erinnerungsfunktion?',
        a: [
          'Wenn du beim Zyklus eine Erinnerung einstellst, fragt die App beim Speichern nach der Berechtigung für Browser-Benachrichtigungen. Wenn du zustimmst, wird für heute eine Benachrichtigung geplant:',
          '• „Keine" = keine Erinnerung',
          '• „1 Tag vorher" = Benachrichtigung 24 Stunden vor dem Einnahmezeitpunkt',
          '• „2 Std vorher" = Benachrichtigung 2 Stunden vorher',
          '• „Bei Einnahme" = Benachrichtigung genau zur Einnahmezeit',
          'Wichtig: Die Erinnerung funktioniert nur, wenn die App an dem Tag geöffnet ist.',
        ],
      },
      {
        q: 'Wie bearbeite ich einen Zyklus?',
        a: 'Klappe das Peptid auf → beim gewünschten Zyklus tippe auf den Stift-Button (✏️) rechts → das Bearbeitungsformular öffnet sich → ändere was du möchtest → „Speichern".',
      },
      {
        q: 'Kann ich mehrere Zyklen für ein Peptid haben?',
        a: 'Ja, du kannst beliebig viele Zyklen pro Peptid erstellen – z.B. einen für morgens und einen für abends, oder verschiedene Dosierungsphasen. Alle aktiven Zyklen werden im Kalender angezeigt.',
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
        a: 'Eine Dosiserhöhung (Dose Escalation) ist ein geplanter Anstieg der Dosis innerhalb eines Zyklus. Zum Beispiel: Starte mit 200 mcg täglich, erhöhe nach 2 Wochen auf 300 mcg, nach 4 Wochen auf 400 mcg. Du kannst mehrere Stufen planen.',
      },
      {
        q: 'Wie füge ich eine Dosiserhöhung hinzu?',
        a: [
          '1. Öffne ein Peptid und klappe es auf',
          '2. Beim gewünschten Zyklus siehst du den Bereich „Dosiserhöhungen"',
          '3. Tippe auf „+ Hinzufügen"',
          '4. Gib den Erhöhungsbetrag und die Einheit ein',
          '5. Wähle wann: Festes Datum, Nach X Tagen oder Nach X Wochen',
          '6. Optional: Notiz hinzufügen',
          '7. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Was bedeuten die Startzeitpunkt-Optionen?',
        a: [
          '• Festes Datum – du wählst ein konkretes Datum für die Erhöhung',
          '• Nach X Tagen – die Erhöhung tritt X Tage nach dem Zyklusstart ein',
          '• Nach X Wochen – die Erhöhung tritt nach X Wochen ein (intern als Tage gespeichert)',
        ],
      },
      {
        q: 'Kann ich mehrere Dosiserhöhungen haben?',
        a: 'Ja. Du kannst beliebig viele Dosiserhöhungen pro Zyklus erstellen. Sie werden als #1, #2, #3 usw. nummeriert und der Zeitpunkt wird angezeigt (z.B. „nach 2 Wochen", „ab 15.06.2025").',
      },
      {
        q: 'Beeinflusst die Dosiserhöhung den Kalender?',
        a: 'Aktuell werden Dosiserhöhungen als Information gespeichert und im Zyklus angezeigt. Die Kalenderansicht zeigt noch nicht die angepasste Dosis nach Eskalation – das ist eine mögliche zukünftige Erweiterung.',
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
        a: 'Im Tagebuch dokumentierst du Wirkungen und Nebenwirkungen deiner Peptide. Es hilft dir Muster zu erkennen – z.B. welche Wirkungen regelmäßig auftreten, wie lange sie anhalten und wie stark sie sind.',
      },
      {
        q: 'Was ist der Unterschied zwischen Wirkung und Nebenwirkung?',
        a: [
          '• Wirkung (grün) = erwünschter Effekt, z.B. besserer Schlaf, schnellere Heilung, mehr Energie',
          '• Nebenwirkung (orange/gelb) = unerwünschter Effekt, z.B. Schmerzen an der Injektionsstelle, Müdigkeit, Kopfschmerzen',
        ],
      },
      {
        q: 'Was bedeuten die Status-Optionen?',
        a: [
          '• 🔘 Steht noch an – du hast den Effekt erwartet aber er ist noch nicht eingetreten',
          '• ✅ Eingetreten – der Effekt ist aktiv eingetreten',
          '• ⏳ Noch anhaltend – der Effekt dauert noch an',
          '• ✅ Abgeklungen – der Effekt ist vorbei',
          'Den Status kannst du direkt auf der Karte ändern ohne das Formular zu öffnen.',
        ],
      },
      {
        q: 'Wie ändere ich den Status direkt auf der Karte?',
        a: 'Tippe einfach auf einen der vier Status-Buttons am unteren Rand jeder Eintragskarte. Der neue Status wird sofort gespeichert.',
      },
      {
        q: 'Was ist die Intensitätsskala?',
        a: [
          'Die Intensität (1–5) zeigt wie stark der Effekt war:',
          '1 = Sehr leicht (kaum spürbar)',
          '2 = Leicht',
          '3 = Mittel (deutlich spürbar)',
          '4 = Stark',
          '5 = Sehr stark (dominierend)',
        ],
      },
      {
        q: 'Wie gebe ich die Dauer an?',
        a: 'Im Formular gibt es vorgefertigte Dauer-Buttons (15 Min, 30 Min, 1 Std, usw.). Wenn du eine andere Dauer möchtest, tippe auf „Individuell" und gib eine freie Texteingabe ein (z.B. „3 Stunden 20 Min").',
      },
      {
        q: 'Kann ich einen Eintrag einem Peptid zuordnen?',
        a: 'Ja. Im Formular gibt es das optionale Feld „Peptid (optional)". Damit kannst du den Eintrag einem bestimmten Peptid zuordnen – nützlich wenn du mehrere Peptide gleichzeitig nimmst.',
      },
      {
        q: 'Wie filtere und suche ich im Tagebuch?',
        a: [
          '• Filter-Tabs oben: Alle / Wirkungen / Nebenwirkungen',
          '• Suchfeld: sucht in Beschreibung und Peptidname',
          '• Sortierung: Neueste zuerst, Älteste zuerst, Intensität hoch→niedrig, Intensität niedrig→hoch',
        ],
      },
      {
        q: 'Was ist der Unterschied zwischen Tagebuch und Bewertungen?',
        a: 'Das Tagebuch ist für kurzfristige, tagesaktuelle Beobachtungen (heute hatte ich diese Wirkung, sie dauerte X Stunden). Bewertungen sind für ein Gesamtfazit zu einem Peptid nach längerer Anwendung (Sterne, Vor-/Nachteile, Gesamterfahrung).',
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
        a: 'Bewertungen sind persönliche Erfahrungsberichte zu einzelnen Peptiden. Du kannst Sterne vergeben (1–5), deine Gesamterfahrung (Gut/Mittel/Schlecht) beschreiben, Vorteile und Nachteile auflisten und einen detaillierten Bericht schreiben.',
      },
      {
        q: 'Wie erstelle ich eine Bewertung?',
        a: [
          '1. Tippe in „Bewertungen" auf „+ Neu"',
          '2. Wähle das Peptid',
          '3. Vergib Sterne (1–5)',
          '4. Wähle deine Gesamterfahrung: 😊 Gut / 😐 Mittel / 😞 Schlecht',
          '5. Gib einen Titel ein (Pflichtfeld)',
          '6. Optional: Erfahrungsbericht, Vorteile, Nachteile',
          '7. Tippe auf „Speichern"',
        ],
      },
      {
        q: 'Kann ich eine Bewertung nachträglich bearbeiten?',
        a: 'Ja. Tippe auf dem Stift-Symbol (✏️) rechts oben auf der Bewertungskarte um die Bewertung zu öffnen und zu bearbeiten.',
      },
      {
        q: 'Wie suche und sortiere ich Bewertungen?',
        a: [
          '• Suchfeld: sucht in Titel und Peptidname',
          '• Sortierung: Neueste / Älteste / Bewertung hoch→niedrig / Bewertung niedrig→hoch',
        ],
      },
      {
        q: 'Kann ich eine Bewertung im öffentlichen Profil teilen?',
        a: 'Ja. Wenn du in „Profil" das öffentliche Profil aktivierst und den Schalter „Bewertungen" einschaltest, werden deine Bewertungen auf deinem Profil-Link sichtbar.',
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
          '• Benutzername (erscheint im Teilen-Link) – Pflichtfeld',
          '• Anzeigename (Name der auf dem öffentlichen Profil steht)',
          '• Gesundheitsdaten: Alter, Geschlecht, Gewicht, Größe (alle freiwillig)',
          '• Persönliche Notizen (nur für dich sichtbar, nicht im öffentlichen Profil)',
          '• Öffentliche Bio (erscheint auf dem geteilten Profil)',
        ],
      },
      {
        q: 'Was ist das öffentliche Profil?',
        a: 'Das öffentliche Profil ist eine Webseite die du mit anderen teilen kannst. Andere können dein Profil besuchen ohne ein Konto zu haben. Du bestimmst selbst welche Inhalte sichtbar sind.',
      },
      {
        q: 'Wie aktiviere ich das Teilen?',
        a: [
          '1. Gehe zu „Profil"',
          '2. Gib zuerst einen Benutzernamen ein und speichere das Profil',
          '3. Aktiviere den Schalter „Profil teilen"',
          '4. Wähle welche Bereiche sichtbar sein sollen',
          '5. Tippe auf „Profil speichern"',
          '6. Dein Teilen-Link erscheint (z.B. peptidtracker.app/u/deinname)',
        ],
      },
      {
        q: 'Welche Inhalte kann ich im öffentlichen Profil freigeben?',
        a: [
          '🧪 Peptide – deine Peptid-Liste mit Dosierungen',
          '📅 Kalender & Zyklen – protokollierte Dosen und aktive Zyklen',
          '📖 Tagebuch – Wirkungen und Nebenwirkungen',
          '⭐ Bewertungen – deine Erfahrungsberichte',
          'Jeder Bereich hat einen eigenen An/Aus-Schalter. Du kannst z.B. nur Peptide und Bewertungen teilen aber Tagebuch und Kalender privat halten.',
        ],
      },
      {
        q: 'Wie kopiere ich den Teilen-Link?',
        a: 'Wenn das öffentliche Profil aktiviert ist, siehst du den Link mit einem Kopier-Button rechts daneben. Tippe darauf – der Link wird in deine Zwischenablage kopiert und du kannst ihn teilen.',
      },
      {
        q: 'Was sieht jemand der meinen Link aufruft?',
        a: 'Dein Name/Anzeigename, Benutzername, Alter und Geschlecht (falls eingetragen), deine Bio und die Bereiche die du freigegeben hast. Persönliche Notizen, deine E-Mail-Adresse und private Gesundheitsdaten sind niemals sichtbar.',
      },
      {
        q: 'Kann ich das Teilen jederzeit deaktivieren?',
        a: 'Ja. Schalte in „Profil" den Hauptschalter „Profil teilen" aus und speichere. Der Link zeigt dann sofort „Dieses Profil ist privat" für alle Besucher.',
      },
    ],
  },
  {
    id: 'erinnerung',
    icon: <Bell size={16} />,
    title: 'Erinnerungen',
    color: 'text-sky-400',
    items: [
      {
        q: 'Wie richte ich eine Erinnerung ein?',
        a: [
          '1. Öffne ein Peptid → klappe es auf',
          '2. Erstelle oder bearbeite einen Zyklus',
          '3. Setze den Einnahmezeitpunkt (Morgens/Mittags/Abends/Uhrzeit)',
          '4. Wähle unter „Erinnerung" eine Option',
          '5. Speichere den Zyklus – die App fragt nach Benachrichtigungs-Berechtigung',
          '6. Erlaube Benachrichtigungen wenn die Abfrage erscheint',
        ],
      },
      {
        q: 'Warum bekomme ich keine Erinnerung?',
        a: [
          'Mögliche Gründe:',
          '• Du hast die Benachrichtigungs-Berechtigung verweigert → in den Handyeinstellungen freischalten',
          '• Die App war zum Zeitpunkt der Erinnerung nicht geöffnet (lokale Benachrichtigungen benötigen eine offene App)',
          '• Die Erinnerungszeit ist heute bereits vergangen',
          '• Der Zyklus ist als „Inaktiv" markiert',
        ],
      },
      {
        q: 'Funktionieren Erinnerungen wenn die App geschlossen ist?',
        a: 'Aktuell werden lokale Browser-Benachrichtigungen verwendet, die nur funktionieren wenn die App als Tab oder PWA geöffnet ist. Für vollständige Hintergrund-Benachrichtigungen (auch bei geschlossener App) wäre ein Push-Notification-Service nötig.',
      },
      {
        q: 'Wie erlaube ich Benachrichtigungen nach einer Ablehnung?',
        a: [
          'iPhone: Einstellungen → Safari (oder dein Browser) → Webseiten-Einstellungen → Benachrichtigungen',
          'Android: Einstellungen → Apps → Chrome/Browser → Benachrichtigungen → erlauben',
          'Dann musst du den Zyklus erneut speichern um die Berechtigung erneut anzufragen.',
        ],
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
        q: 'Warum erscheint manchmal "Fehler beim Speichern"?',
        a: [
          'Mögliche Ursachen:',
          '• Keine Internetverbindung – prüfe dein WLAN oder mobile Daten',
          '• Pflichtfelder nicht ausgefüllt – überprüfe alle markierten Felder',
          '• Sitzung abgelaufen – melde dich ab und wieder an',
          '• Serverproblem – warte kurz und versuche es erneut',
        ],
      },
      {
        q: 'Was passiert mit meinen Daten wenn ich mich abmelde?',
        a: 'Deine Daten bleiben in der Datenbank gespeichert. Wenn du dich wieder anmeldest, sind alle Einträge noch vorhanden.',
      },
      {
        q: 'Werden meine Daten gelöscht wenn ich die App deinstalliere?',
        a: 'Nein. Da es sich um eine Web-App handelt und die Daten auf dem Server (Supabase) gespeichert sind, bleiben sie erhalten. Du kannst dich jederzeit wieder anmelden und auf alle Daten zugreifen.',
      },
      {
        q: 'Kann ich meine Daten exportieren?',
        a: 'Eine Export-Funktion ist aktuell nicht eingebaut. Da die Daten in Supabase liegen, können sie über den Supabase-Dashboard exportiert werden – dies ist jedoch ein technischer Schritt.',
      },
      {
        q: 'Ist die App für medizinische Zwecke geeignet?',
        a: 'Nein. Der Peptid Tracker ist ausschließlich für Forschungs- und Dokumentationszwecke gedacht. Er ersetzt keine medizinische Beratung und sollte nicht als medizinisches Gerät verwendet werden. Konsultiere immer einen Arzt.',
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
