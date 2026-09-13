# Live-Blutspiegel — IU-Substanzen verschwanden wortlos

**Datum:** 2026-09-13
**Betrifft:** `pkReadiness`, `blutspiegelHistory`, `liveBlutspiegelChart`, `BlutspiegelCarousel`, `pk_profiles.iu_per_mg`
**Status:** umgesetzt und eingespielt

## Der Befund

HCG und HGH haben ein PK-Profil, werden korrekt ausgefüllt — und tauchten im
Blutspiegel nicht auf. Kein Hinweis, keine Fehlermeldung. Weg.

Die Kette:

```
toPkMilligrams(5000, 'IU')        → null      (kannte nur mg und mcg)
  ↓
evaluatePkReadiness               → 'unsupported', reason 'unit_conversion'
  ↓
BlutspiegelCarousel.tsx:553       → return null
  ↓
die Karte existiert nicht
```

**Was die App richtig machte:** sie verwechselte „können wir nicht umrechnen"
nicht mit „hat der Nutzer vergessen". `missing.push('unit')` feuert nur bei
einem *leeren* Feld; eine vorhandene, unbekannte Einheit ergibt sauber
`unsupported`. Falsch war nur, was danach damit geschah.

## Warum es keine allgemeine Umrechnung gibt

Eine Internationale Einheit ist keine Masse, sondern eine **biologische
Wirkstärke**. Der Umrechnungsfaktor gehört zur Substanz:

| | |
|---|---|
| Somatropin (HGH) | **3 IU je mg** — WHO-Standard, fest |
| HCG | **rund 10.000 IU je mg** — hängt an der Zubereitung, die Kurve ist dort eine Näherung |

Deshalb eine Spalte am Profil (`pk_profiles.iu_per_mg`), kein globaler Faktor
im Code. Null bleibt der Normalfall: fast alles wird in mg oder mcg dosiert.

## Der Weg durch den Code

`toPkMilligrams(value, unit, iuPerMg = null)` — bei `IU` und brauchbarem Faktor
kommt `value / iuPerMg` heraus, sonst weiterhin `null`. Ohne Faktor bleibt es
beim alten Verhalten, und das ist richtig: was wir nicht umrechnen können,
sollen wir nicht schätzen.

Der Faktor läuft dieselbe Kette entlang wie `bioavailability`, die es schon gab
— hinten angehängt, damit keine Stelle mit Positionsargumenten verrutscht:

```
BlutspiegelCarousel / liveBlutspiegelChart   (lesen iu_per_mg mit)
  → getCurrentBlutspiegelLevel
  → calculateHistoryBlutspiegelCurve / calculateCurveTo
  → toPkMilligrams
```

**Anmerkung zum Zustand:** `calculateHistoryBlutspiegelCurve` hat damit sieben
Positionsparameter. Das ist einer zu viel; ein Optionsobjekt wäre richtig, war
aber in dieser Runde ein größerer Umbau als der Fehler.

## Was beim Testen auffiel

**Die Kurve ist auf ihren eigenen Höchstwert normiert** (0–100 %). Bei einer
einzelnen Einnahme kann der Faktor die Form deshalb gar nicht ändern — nur, ob
überhaupt eine Kurve entsteht. Mein erster Testentwurf nahm an, ein größerer
Faktor drücke den Gipfel; das ist falsch.

Sichtbar wird der Faktor erst bei **gemischten Einheiten** in einer Historie:
dort entscheidet er, wie hoch eine IU-Gabe neben einer mg-Gabe steht. Genau das
prüft der Test jetzt.

Zweiter Stolperstein: die Kurve endet bei `new Date()`. Ein Test mit festen
Zeitstempeln ist je nach Uhrzeit halb abgeschnitten — die Zeitpunkte liegen
deshalb relativ zu jetzt.

## Geprüft

`pkReadiness.test.ts` — IU mit Faktor, ohne Faktor, mit unbrauchbarem Faktor
(null, 0, negativ, NaN), und dass ein Faktor Einheiten unberührt lässt, die
keine IU sind.
`blutspiegelHistory.iu.test.ts` (neu) — der gemeldete Fall von Ende zu Ende:
flach ohne Faktor, nicht flach mit Faktor, deckungsgleich mit demselben Betrag
in Milligramm, und die Gewichtung bei gemischten Einheiten.

## Gemessen nach dem Lauf

93 PK-Profile, **2 mit IU-Faktor** (HCG 10.000, HGH 3). Fünf Substanzen führen
`IU` in ihren Einheiten; die übrigen drei — Vitamin A, D3, E — haben bewusst
kein PK-Profil. **Keine Substanz mit IU-Einheit und Profil bleibt ohne Faktor.**

## Was offen bleibt

Substanzen mit Einheiten, die sich grundsätzlich nicht in eine Masse umrechnen
lassen (ml bei Cerebrolysin, Sprühstöße, Stück), fallen weiterhin aus dem
Karussell — und weiterhin wortlos. Der Weg dorthin ist jetzt sauber; was fehlt,
ist eine Karte, die sagt „für diese Einheit rechnen wir keinen Spiegel".
