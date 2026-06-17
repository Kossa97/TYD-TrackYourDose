# Injektionstracker Pro - 3D Injektionskarte (Design)

**Datum:** 2026-06-17
**Status:** Entwurf (Design)
**Ziel-Runner:** Claude Code / Opus 4.8 UltraCode
**Betroffene Bereiche:** `src/pages/InjektionsTracker.tsx`, `src/pages/Home.tsx`, Einnahmebestaetigung in Home/Kalender, Supabase-Schema fuer `injection_logs`, spaeter 3D-Komponenten/Assets unter `src/components`.

## Ziel

Der bestehende Injektions-Tracker wird zu einem hochwertigen, mobile-first **Injektionstracker Pro** weiterentwickelt. Die Detailseite heisst **3D Injektionskarte** und bietet eine fluessige 3D-Karte des Torsos, auf der Nutzer Injektionsstellen exakt markieren, speichern, wiederfinden und fuer Rotation vergleichen koennen.

Das Feature soll auf Mobile zuerst hervorragend funktionieren, aber auf Tablet und Desktop responsiv einwandfrei nutzbar bleiben.

## Nicht-Ziele fuer v1

- Keine medizinische Anleitung zur Injektionstechnik.
- Keine harte Blockade bestimmter Koerperstellen.
- Keine Heatmap- oder Analytics-Vollversion.
- Keine umschaltbaren Visual-Modi in v1. Der Code soll spaeter `Clean`, `Hybrid` und `Anatomisch` ermoeglichen, aber v1 startet nur mit `Hybrid`.
- Keine Pflicht, jede Einnahme ueber den 3D-Tracker zu bestaetigen.
- Kein direkter Kauf/Download eines 3D-Modells ohne vorherige technische Pruefung von Lizenz, Polygonzahl, UVs, Texturen und Raycasting-Tauglichkeit.

## Naming

Home-Hero:

- Titel: **Injektionstracker Pro**
- Unterzeile: **Praezises 3D-Injektionstracking**

Detailseite:

- Titel: **3D Injektionskarte**
- optionales Badge: **Pro**

Kurzlabels:

- Route/Menu: **Injektionen**
- CTA: **3D Tracker oeffnen**
- Interner technischer Name: `InjectionTrackerPro`

## Kern-Erlebnis

Die 3D Injektionskarte startet in einem ruhigen Explore-Modus. Der Nutzer sieht einen hochwertigen 3D-Torso, kann ihn frei drehen, zoomen und umkreisen. Jede Stelle auf der Torso-Oberflaeche kann markiert werden.

Beim ersten Oeffnen erscheint ein kurzer, versionierter Hinweis:

**Markierung setzen**

> Halte eine Stelle auf dem 3D-Torso gedrueckt, um einen Pin zu setzen. Danach kannst du die Position feinjustieren.

Aktionen:

- `Verstanden`
- `Nicht mehr anzeigen`

Die Intro-Anzeige wird versioniert gespeichert, z. B. `seen_injection_map_intro_version = 1`, damit sie bei groesseren Interaktionsupdates erneut erscheinen kann.

## Pinning-Flow

1. Der Nutzer navigiert frei um den Torso.
2. Long-Press auf die Oberflaeche setzt einen vorlaeufigen Pin.
3. Der Pin wird aktiv und kann feinjustiert werden.
4. Die Kamera bleibt waehrend der Feinjustierung bewegbar.
5. Ein kompaktes Bottom Sheet zeigt `Position uebernehmen` und `Abbrechen`.
6. Nach `Position uebernehmen` oeffnet sich das Log-Sheet.
7. Beim Speichern wird die Pin-Position mit Substanz/Zyklus, Dosis und Zeitpunkt verknuepft.

Pflichtfelder beim Speichern:

- 3D-Pin-Position
- automatisch erkannte Koerperregion und Seite
- aktiver Zyklus oder Substanz
- Dosis und Einheit
- Datum/Uhrzeit

Optionale Felder:

- Notiz
- Reaktion/Schmerz
- weitere Details in spaeteren Versionen

Stellen werden nicht hart blockiert. Ausserhalb typischer Rotationsflaechen oder bei Naehe zu kuerzlichen Pins erscheint nur ein sanfter Hinweis.

## 3D-Stil

v1 startet mit dem **Hybrid-Look**:

- hochwertige glatte Torso-Oberflaeche
- subtile anatomische Konturen
- praezise Pin-Visualisierung und kontextuelle Orientierungshilfen
- Premium-Health-App-Anmutung, nicht grafisch-medizinisch ueberladen

Spaetere Visual-Modi werden architektonisch vorbereitet:

- `clean`
- `hybrid`
- `anatomy`

Der sichtbare Torso und die Interaktionslogik werden getrennt:

- sichtbares Hybrid-Modell fuer Optik
- unsichtbares sauberes Hit-Mesh fuer Raycasting
- Raycasting nur gegen das Hit-Mesh
- Pins werden modellrelativ auf dem Hit-Mesh platziert
- Region/Seite wird aus Hit-Mesh-Zonen oder Mapping-Daten abgeleitet

## 3D-Modell-Leitplanken

Bevor ein Modell final genutzt wird, muss es technisch geprueft werden:

- `.glb` bevorzugt, weil eine Datei fuer Web/Mobile einfacher ist.
- Mid-poly statt High-poly; Details ueber Normal Maps.
- Saubere UVs und stabile Oberflaechen fuer wiederholbare Pin-Positionen.
- Keine relevanten offenen/kaputten Mesh-Flaechen an Bauch, Oberschenkel, Schulter, Gesaess.
- Lizenz erlaubt App-/SaaS-Nutzung.
- Texturen mobil-tauglich und spaeter komprimierbar.
- Koerperregionen muessen logisch trennbar sein.

Empfohlener Ansatz:

- Premium-Modell als sichtbares Asset.
- Separates, vereinfachtes unsichtbares Interaction-/Hit-Mesh fuer Praezision und Performance.
- `model_version` mit jedem Pin speichern, damit spaetere Modellupdates migriert werden koennen.

## Speicherung der Pin-Daten

Ein gespeicherter Pin darf nicht als Screen-Koordinate gespeichert werden. Er muss relativ zum 3D-Modell rekonstruierbar sein.

Zu speichern:

- `model_version`
- `body_region` (z. B. `abdomen`, `thigh`, `deltoid`, `glute`)
- `body_side` (`left`, `right`, `center` falls noetig)
- `position` im Modellraum, z. B. `{ x, y, z }`
- `normal` der Oberflaeche, z. B. `{ x, y, z }`
- optional `uv`, falls das Modell/Hit-Mesh stabile UVs bietet
- optional `camera_state`, um Historien-Eintraege mit aehnlicher Ansicht zu oeffnen
- `warning_state` oder berechnete Warnhinweise optional, nicht als harte Autoritaet

Beim Oeffnen eines Historien-Eintrags:

- Kamera dreht/zoomt zur gespeicherten Stelle.
- Der Pin wird hervorgehoben.
- Detaildaten werden angezeigt.

## Rotation und Naehe

Regionen sind nur fuer Lesbarkeit, Filter und automatische Benennung gedacht. Rotation darf nicht nur grob nach Region funktionieren, weil Nutzer mehrere Pins auf derselben Bauchseite mit wenigen Zentimetern Abstand setzen koennen.

v1 nutzt deshalb zwei Ebenen:

1. **Grobe Region:** z. B. rechter Bauch, linker Oberschenkel, rechte Schulter.
2. **Praezise Naehe:** Distanz zu kuerzlichen Pins auf/nahe der Oberflaeche.

Warnlogik:

- gleiche Region ist erlaubt
- nahe an Pin der letzten Tage: sanfter Hinweis
- sehr nahe an Pin der letzten 3 Tage: staerkerer, aber weiterhin nicht blockierender Hinweis
- ausserhalb typischer Rotationsflaechen: sanfter Hinweis

Naehe-Ringe:

- nicht in der normalen Gesamtansicht anzeigen
- nur im Detailzoom oder wenn ein neuer Pin nahe an alten Pins liegt
- transparent und dezent, damit der Torso nicht ueberladen wirkt

## Historie und Referenz-Pins

Die Historie ist mobile-first als Bottom Sheet umgesetzt.

Standard:

- Torso bleibt Hauptfokus
- Historie ist eingeklappt oder halb sichtbar
- vergangene Pins sind standardmaessig ausgeblendet

Bottom-Sheet-Zustaende:

- **Collapsed:** letzte Injektion, kurzer Status, Handle
- **Half-open:** chronologische Liste, neueste oben
- **Full-open:** Filter und Details

Sortierung:

- neueste Injektion ganz oben
- Gruppierung: Heute, Gestern, Diese Woche, Aelter

Interaktionen:

- Tap auf Historien-Eintrag: Kamera faehrt zur gespeicherten Stelle.
- Haken am Eintrag: alter Pin bleibt als Referenz sichtbar.
- Schnellfilter `Letzte 7 Tage`: blendet relevante alte Pins dezent ein.
- Vergangene Pins bleiben kleiner und ruhiger als der neue/aktive Pin.

Filter fuer v1:

- `Letzte 7 Tage`

Vorbereitet fuer spaeter:

- Substanz
- Koerperbereich
- Zyklus
- Suche

Tablet/Desktop:

- gleiche Logik
- bei mehr Breite darf das Bottom Sheet zu einem seitlichen Panel werden
- Interaktionsmodell bleibt identisch

## Einnahmebestaetigung und Zyklen

Die normale Einnahmebestaetigung bleibt separat moeglich. Nutzer koennen aus Home/Kalender weiterhin bestaetigen, ohne den 3D-Tracker zu oeffnen.

Fuer injizierbare aktive Zyklen wird der 3D-Tracker nahtlos angebunden:

- Start aus der 3D Injektionskarte: Nutzer waehlt aktiven Zyklus; Dosis, Einheit, Methode und Zeitpunkt werden vorausgefuellt.
- Speichern im Tracker kann gleichzeitig die Einnahme bestaetigen und die Injektionsstelle dokumentieren.
- Normale Bestaetigung aus Home/Kalender kann danach optional fragen: **Injektionsstelle hinzufuegen?**

Dialog nach normaler Bestaetigung injizierbarer Einnahmen:

- `Jetzt markieren`
- `Spaeter`
- `Nicht mehr fragen`

`Nicht mehr fragen` gilt global, z. B. `prompt_injection_site_after_dose = false`.

Spaeter in Einstellungen wieder aktivierbar:

- **Nach Einnahmebestaetigung Injektionsstelle anbieten**

Nachtragen:

- Ein bestaetigter `dose_log` darf ohne `injection_log` existieren.
- Spaeter kann ueber **Stelle nachtragen** ein 3D-Pin mit diesem bestehenden `dose_log` verknuepft werden.

## Datenmodell

Bestehende Idee:

- `dose_logs` bleibt Quelle fuer Einnahme, Zyklus/Substanz, Dosis, Einheit, Methode, Zeitpunkt und Bestaetigung.
- `injection_logs` speichert 3D-Stelle, Region, Pin-Daten und optionale Notizen.
- Beide werden ueber `dose_log_id` verknuepft.

`injection_logs` sollte gegenueber dem aktuellen Schema erweitert werden.

Konzeptionelle Felder:

```sql
alter table injection_logs
  add column if not exists peptide_id uuid references peptides on delete set null,
  add column if not exists cycle_id uuid references cycles on delete set null,
  add column if not exists dose numeric(10,3),
  add column if not exists unit text,
  add column if not exists method text,
  add column if not exists body_region text,
  add column if not exists body_side text,
  add column if not exists model_version text,
  add column if not exists position jsonb,
  add column if not exists normal jsonb,
  add column if not exists uv jsonb,
  add column if not exists camera_state jsonb,
  add column if not exists warning_state text;
```

Die genaue Migration soll in der Implementierungsplanung finalisiert werden. Alte `site`-Werte muessen abwaertskompatibel bleiben oder in `body_region`/`body_side` gemappt werden.

## Home-Integration

Home zeigt das Feature relativ weit oben als grosse, hochwertige Hero-Karte.

Inhalt:

- **Injektionstracker Pro**
- **Praezises 3D-Injektionstracking**
- hochwertige 3D-/Torso-Preview oder abstrakte Vorschau
- letzter geloggter Pin oder **Noch keine Stelle geloggt**
- Anzahl geloggter Pins der letzten 7 Tage
- CTA: `3D Tracker oeffnen`
- falls heute ein injizierbarer Zyklus offen ist: `Mit Stelle loggen`

Die Karte ist kein Marketingbanner, sondern ein aktiver Arbeitsbereich mit Live-Status. Sie soll hochwertig wirken, aber die taegliche Nutzung nicht verlangsamen.

## Responsives Verhalten

Mobile:

- 3D-Torso ist die Hauptbuehne.
- Bottom Sheet steuert Historie, Filter und Details.
- Long-Press ist primaere Pin-Geste.
- Touch-Gesten muessen priorisiert werden: drehen, zoomen, feinjustieren.

Tablet:

- Torso bleibt zentral.
- Historie kann als breiteres Bottom Sheet oder seitliches Dock erscheinen.

Desktop:

- Torso im Zentrum.
- Historie/Details duerfen seitlich gedockt werden.
- Mausinteraktion ergaenzt Touch: drag rotate, wheel zoom, long-press/hold oder expliziter Markierungsbutton als Desktop-Fallback.

## Fehler- und Fallback-Verhalten

- Wenn 3D nicht laedt, zeigt die Seite eine einfache Historie plus Hinweis und Retry.
- Speichern darf keine Doppel-Logs erzeugen.
- Wenn ein `dose_log` schon existiert, wird er verknuepft statt erneut erzeugt.
- Wenn kein aktiver injizierbarer Zyklus existiert, kann der Nutzer entweder eine Substanz waehlen oder nur die Stelle nicht speichern, bis Pflichtfelder erfuellt sind.
- Warnungen sind Hinweise, keine medizinischen Freigaben.

## Accessibility und Motion

- Alle wichtigen Aktionen muessen per Tastatur erreichbar sein.
- Icon-only Buttons brauchen `aria-label`.
- Touch-Ziele mindestens 44x44 px.
- `prefers-reduced-motion` respektieren: Kamerafahrten und Glow/Transitions reduzieren.
- Farbstatus nie als einzige Information verwenden.
- Bottom Sheet muss fokussierbar und schliessbar sein.

## Test- und Verifikationskriterien

Funktional:

- Long-Press setzt Pin auf der getroffenen Torso-Oberflaeche.
- Pin kann feinjustiert werden.
- Kamera bleibt waehrend Feinjustierung nutzbar.
- Speichern erzeugt/verknuepft korrekte `dose_logs` und `injection_logs`.
- Historien-Tap oeffnet die gespeicherte Stelle.
- `Letzte 7 Tage` blendet nur relevante alte Pins ein.
- Haken an Historien-Eintrag haelt diesen Pin als Referenz sichtbar.
- Normale Einnahmebestaetigung funktioniert ohne Tracker.
- `Nicht mehr fragen` deaktiviert globale Nachfragen nach Injektionsstelle.

3D/Persistenz:

- Pins sitzen nach Reload wieder an derselben Modellstelle.
- `model_version` wird gespeichert.
- Region/Seite wird automatisch gesetzt.
- Naehe-Warnung basiert auf konkreten Pins, nicht nur grober Region.

UX:

- Mobile bei ca. 375 px Breite ohne horizontales Scrollen.
- Tablet und Desktop ohne ueberlappende Panels.
- Keine ueberladene Ansicht durch alte Pins/Ringe.
- Neue Pin-Markierung bleibt visuell dominant.

Performance:

- 3D-Szene bleibt auf Mobile fluessig.
- Texturen und Modellgroesse sind mobil-tauglich.
- Raycasting nutzt Hit-Mesh, nicht das komplexe sichtbare Modell.

## Offene Punkte fuer die Implementierungsplanung

- Konkretes 3D-Modell auswaehlen oder erstellen lassen.
- Asset-Pipeline definieren: Blender-Optimierung, `.glb`, Texture Compression, ggf. Meshopt/Draco.
- Exakte Region-Mapping-Strategie festlegen: Mesh-Namen, Vertex Groups, UV-Map oder Bounding Volumes.
- Detaildefinition der Naehe-Metrik: Modellraum-Distanz vs. approximierte Oberflaechen-Distanz.
- Supabase-Migration final formulieren.
- Bestehende alte `site`-Logs in neue Historie integrieren.
- Desktop-Fallback fuer Long-Press final entscheiden.

## Empfohlene v1-Umsetzung

Variante 2 aus der Diskussion: echtes 3D mit freiem Pinning und History.

Nicht nur den bestehenden 2D-Tracker optisch ersetzen, sondern einen fokussierten Premium-v1 bauen:

- Hybrid-3D-Torso
- freie Kamera
- Long-Press Pinning
- Feinjustierung
- aktive Zyklen vorausgefuellt
- verknuepfte Einnahmebestaetigung
- Bottom-Sheet-Historie
- `Letzte 7 Tage` Referenz-Pins
- sanfte Warnhinweise
- Home-Hero als Feature-Einstieg

Spaetere Erweiterungen bleiben moeglich, ohne v1 zu ueberladen.
