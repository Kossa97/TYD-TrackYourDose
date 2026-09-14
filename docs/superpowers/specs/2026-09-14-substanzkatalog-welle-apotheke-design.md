# Substanzkatalog — Welle „Apotheke"

**Datum:** 2026-09-14
**Betrifft:** `scripts/substance-catalog-source.mjs`,
`supabase-my-stack-catalog-expansion.sql` (generiert)
**Status:** umgesetzt, in der Produktion

## Der Befund

Gefragt: sind wir bei Apothekenmedikamenten gut abgedeckt?

Gemessen gegen 99 in Deutschland sehr häufig verordnete Wirkstoffe:
**96 fehlten.** Der Katalog deckte die Biohacker-Seite gut ab — Peptide,
Hormone, Supplemente — und die Apotheke kaum. Vorhanden war jeweils der
naheliegende Erste einer Gruppe (Ibuprofen, Pantoprazol, drei Statine,
Ramipril, Sertralin, Metformin), dahinter Leere.

Ganze Gruppen hatten **keinen einzigen** Eintrag:

| | |
|---|---|
| Gerinnungshemmer | Apixaban, Rivaroxaban, Clopidogrel, Phenprocoumon … |
| Diuretika | HCT, Torasemid, Furosemid, Spironolacton |
| Insulin | alle Analoga und Humaninsulin |
| Verhütung | alle |
| Augentropfen | alle — obwohl `drops` als Form existiert |

Zwei davon sind auch inhaltlich unangenehm: ohne Gerinnungshemmer und ohne
Insulin fehlten genau die Mittel, bei denen Menschen am genauesten
protokollieren.

## Was aufgenommen wurde

**129 Wirkstoffe**, entlang der Verordnungshäufigkeit statt nach Gefühl:

- Gerinnungshemmer und Thrombozytenhemmer (8)
- Diuretika (5), weitere Blutdruck- und Lipidmittel (12)
- Antibiotika und Antiinfektiva (20)
- Insuline und orale Antidiabetika (10)
- Psyche und Nervensystem (20)
- Schmerz und Migräne (12) — darunter **Metamizol**, in Deutschland eines der
  meistverordneten Schmerzmittel und vorher nicht im Katalog
- Magen und Darm (10), Atemwege und Allergie (12)
- Kortison, Immunsuppression, Rheuma (4)
- Urologie, Gicht, Knochen (7)
- Hormonelle Verhütung und Gynäkologie (6)
- Augentropfen (3)

Handelsnamen stehen als Aliase dabei — danach sucht man (Xarelto, Novalgin,
Lantus, Lyrica, Tavor). **Kein Eintrag trägt ein PK-Profil:** für ein
Blutdruckmittel braucht es keine Kurve, nur einen Eintrag zum Tracken. Die
93 bestehenden Profile bleiben unangetastet.

Der Katalog wächst damit von **206 auf 335 Substanzen**, die Medikamente von
69 auf 195. Von den 99 geprüften Wirkstoffen sind jetzt **98** vorhanden; der
eine Rest war ein eigener Platzhalter, kein Wirkstoff.

## Warum das vorher nicht ging

Die Welle hing nicht am Katalog, sondern am **Planschritt**. Kurzzeitmittel —
eine Antibiotikakur, ein Kortisonstoß, ein Schmerzmittel bei Bedarf — ließen
sich nicht sinnvoll anlegen: kein Enddatum, kein „2x täglich", kein „bei
Bedarf". Diese drei Lücken sind vorher geschlossen worden
(`2026-09-14-einnahmeplan-kurzzeit-design.md`); erst danach ergab die Welle
Sinn. Ein Antibiotikum im Katalog, das der Plan in ein Dauerschema zwingt,
wäre schlechter gewesen als keines.

## Verifikation

- Der Vertragstest der Quelldatei (19 Fälle) hält alle 335 Einträge: kein
  Name und kein Alias doppelt, jede Kategorie gültig, jede Form vorhanden,
  jede Einheit passend zu einer der genannten Formen.
- **Trockenlauf** (Postgres 16 lokal, `/var/tmp`): den Ist-Zustand der
  Produktion nachgebaut — 206 Zeilen, 24 Kombinationen, 93 Verknüpfungen —,
  die generierte Datei **zweimal** laufen lassen: 335 Zeilen, der zweite Lauf
  ändert nichts.
- **Produktion:** 206 → **335 Zeilen**, 195 Medikamente, 24 Kombinationen,
  93 PK-Verknüpfungen, **0 Zeilen ohne Form oder Einheit**. Die Prüfsumme über
  alle Zeilen stimmt mit dem Trockenlauf überein:
  `887e1644776c1aaad58a08652c812c7a`.
- 1552 Tests grün, `tsc` sauber, eslint **140** (Baseline).

## Was der Katalog weiterhin nicht ist

Kein Nachschlagewerk. Ein Eintrag trägt Name, Aliase, Kategorie, übliche
Formen, übliche Einheiten — keine Dosierungen, Wirkungen oder
Nebenwirkungen. Genau deshalb ist er billig und kann weiter wachsen, ohne
dass jemand medizinisch haftet.
