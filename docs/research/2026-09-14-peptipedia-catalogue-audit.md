# Peptipedia: Fakten- und Aktualitätsaudit des Gesamtkatalogs

## Kurzfazit

Der aktuelle Katalog umfasst 66 Profile. Seine Grundhaltung ist für ein Gesundheitslexikon ungewöhnlich vorsichtig: Er trennt Studienpräparate von Handelsprodukten, überträgt Tierdaten meist nicht auf Menschen und kennzeichnet Blends überwiegend als unbestätigt. Das ist eine starke Basis.

Der Katalog ist in der jetzigen Form trotzdem noch nicht als vollständig geprüftes öffentliches Medizinlexikon veröffentlichungsreif. Der Audit findet mehrere seit 2025/2026 veraltete Entwicklungs- oder Zulassungsangaben, mindestens zwei inkonsistente Evidenzanzeigen und viele Profile, deren Aussagen zwar nicht falsch, aber für eine Nutzen-Risiko-Einordnung zu unvollständig sind. Die geprüften PubMed-IDs führen überwiegend zu den gemeinten Arbeiten; das Hauptproblem ist Aktualität und Vollständigkeit, nicht eine Masse erfundener Quellen.

Die dringendsten Korrekturen sind:

1. **Semaglutid:** Das Profil basiert nur auf einer US-Wegovy-Fachinformation und ist seit den Änderungen 2025/2026 unvollständig. Es fehlen insbesondere die US-MASH-Indikation, die EU-Dosis 7,2 mg und die EU-Einstufung der NAION als sehr seltene Nebenwirkung.^2,3
2. **Retatrutid:** „Phase 2“ ist als aktueller Entwicklungsstand überholt. 2026 wurden positive Phase-3-Topline-Ergebnisse aus TRIUMPH-1, -2 und -3 veröffentlicht; Retatrutid bleibt jedoch unzugelassen.^4
3. **Mazdutid:** `human_research` ist ohne Regionalzusatz irreführend. Mazdutid wurde 2025 in China für Gewichtsmanagement und Typ-2-Diabetes zugelassen, nicht jedoch in der EU oder den USA.^5,6
4. **Gonadorelin:** Die Einordnung als bloße Humanforschung lässt bestehende Arzneimittel in Deutschland außer Acht. LHRH Ferring ist ein gonadorelinhaltiges Arzneimittel; Lutrelef/Lutrepulse wird ebenfalls vermarktet.^7,8
5. **GHK-Cu:** `human: none` widerspricht vorhandenen, wenn auch kleinen topischen Humanstudien. Das ist kein Wirksamkeitsnachweis für Injektionen, aber die Anzeige „keine Humandaten“ ist falsch.^9
6. **Cerebrolysin:** Das Profil zeigt nur eine positive CARS-Studie. Eine aktuelle Cochrane-Auswertung beschreibt keinen nachgewiesenen Mortalitätsnutzen und ein mögliches Mehr an nicht tödlichen schweren Ereignissen. Diese gegensätzliche Evidenz muss sichtbar sein.^10
7. **CagriSema:** Die Kombination hat inzwischen mehrere 2026 publizierte Phase-3-Studien. `clinical: none` und eine leere Sicherheitsrubrik sind nicht mehr vertretbar.^11
8. **SS-31/Elamipretid:** Die US-Zulassung wird korrekt genannt, aber die zugelassene Indikation und die Fachinformationsrisiken sind zu knapp dargestellt.^12
9. **Thymosin alpha-1:** Die große TESTS-Phase-3-Studie von 2025 mit 1.106 Sepsispatienten zeigte beim primären 28-Tage-Mortalitätsendpunkt keinen Nutzen und fehlt.^13
10. **AOD-9604:** Der Text ist zwar vorsichtig, verschweigt aber die für Nutzer wichtigste klinische Information: In einer 536-Personen-Studie wurde kein signifikanter Gewichtsverlust erreicht; die damalige Adipositasentwicklung wurde beendet.^26

## Prüfmaßstab

Der Audit bewertet nicht, ob jede einzelne Aussage denkbar oder biologisch plausibel ist. Er prüft, ob die Aussage durch die hinterlegte Quelle gedeckt ist, ob die Quelle tatsächlich zum genannten Molekül und Verabreichungsweg gehört, ob neuere wesentliche Evidenz fehlt und ob Zulassung, Humanforschung, Tierforschung und Laborforschung korrekt getrennt werden.

Der regionale Schwerpunkt liegt auf Deutschland und der EU. US-amerikanische, chinesische, japanische und andere Zulassungen werden getrennt ausgewiesen. „Zugelassen“ ohne Region ist bei einem internationalen Katalog keine ausreichend genaue Angabe.

Die Kategorien in den Tabellen bedeuten:

- **Korrekt:** Kernaussagen und Einordnung sind durch die geprüften Quellen gedeckt. Ergänzungen können weiterhin sinnvoll sein.
- **Korrekt, aber unvollständig:** Es wurde keine klare Falschaussage gefunden, aber wichtige aktuelle Evidenz, Sicherheit oder regionaler Kontext fehlt.
- **Korrektur nötig:** Mindestens eine Quelle, Statusanzeige oder wesentliche Aussage ist falsch, veraltet oder strukturell irreführend.
- **Identität ungeklärt:** Der Name ist katalog- oder markenabhängig; ohne chemische Spezifikation ist keine belastbare medizinische Bewertung möglich.

Ein „korrektes“ Kurzprofil ist nicht automatisch eine vollständige medizinische Nutzen-Risiko-Bewertung. Bei vielen experimentellen Stoffen ist die ehrliche Kernaussage gerade, dass Nutzen, Dosis, Wechselwirkungen und Gegenanzeigen unbekannt sind.

## Systemische Befunde

### Evidenzmodell

Die 45 neueren Kurzprofile werden technisch nicht vollständig bewertet. Der Hilfsbaustein setzt `human: limited`, sobald genau eine Humanstudie oder Fachinformation hinterlegt ist, setzt `clinical` aber stets auf `none`. Dadurch entstehen Widersprüche: CagriSema besitzt umfangreiche Phase-3-Daten, wird aber als klinisch „keine“ angezeigt; zugelassene Arzneimittel erhalten teilweise nur „begrenzte“ Humandaten. Gleichzeitig behalten elf ältere Profile subjektive Scores von 1 bis 10, während neue Profile „nicht bewertet“ zeigen.

**Empfehlung:** Den numerischen Score entfernen oder durch eine nachvollziehbare Matrix ersetzen: Molekülidentität, höchstes Evidenzniveau, Replikation, patientenrelevante Endpunkte, Sicherheit und Zulassungsregion. Eine einzelne Studie darf nicht automatisch den gesamten Evidenzstatus bestimmen.

### Zulassungsstatus

`approved` ist aktuell global und unqualifiziert. Dadurch stehen eine reine US-Zulassung von Tesamorelin, eine US-Zulassung von Elamipretid, EU-/US-Zulassungen von Semaglutid und eine chinesische Zulassung von Mazdutid nicht sauber nebeneinander. Bei Tesamorelin wurde die EU-Zulassungsanmeldung 2012 zurückgezogen.^14

**Empfehlung:** Status als strukturierte Liste führen, zum Beispiel `EU: approved`, `US: approved`, `CN: approved`, `JP: approved`, jeweils mit Indikation, Produkt und Standdatum. `approved` darf nie eine beliebige Rezeptur oder ein Research-Chemical-Produkt einschließen.

### Leere Sicherheitsfelder

Leere Nebenwirkungs-, Gegenanzeigen- und Interaktionsfelder werden in der Oberfläche zwar vorsichtig erklärt, sehen für Nutzer aber trotzdem wie „nichts bekannt“ aus. Bei experimentellen Stoffen bedeutet die Leere meist „nicht ausreichend untersucht“, nicht „keine Risiken“. Besonders kritisch ist das bei Adipotide, AOD-9604, Melanotan II, GHRP-6, BPC-157 und den Blends.

**Empfehlung:** Leere Sicherheitsfelder nicht als normale Liste rendern. Stattdessen ausdrücklich anzeigen: „Nicht ausreichend untersucht; daraus kann keine Sicherheit abgeleitet werden.“ Bei vorhandenen Behördenbewertungen deren konkrete Bedenken nennen.

### Studienprotokolle

Die alten Profile geben exakte Studienmengen wieder. Das ist wissenschaftlich legitim, kann aber in einer öffentlich zugänglichen Peptid-App wie eine Dosieranleitung gelesen werden. Das Risiko ist besonders hoch, wenn Tiermengen direkt neben einem Rechner stehen.

**Empfehlung:** Studienprotokolle klar mit Population, Forschungszweck, Studienroute und dem Hinweis „nicht auf Menschen übertragbar / keine Anwendungsempfehlung“ versehen. Tierprotokolle nicht in einen Dosierungsrechner überführen.

### Molekül- und Produktidentität

Mehrere Namen sind keine eindeutig standardisierten Wirkstoffnamen: TB-500 ist nicht identisch mit vollständigem Thymosin-β4; „CJC-1295 NO DAC“ ist eine uneinheitliche Handelsbezeichnung; GLOW, KLOW, Tri-Heal und Neuroxelin sind Blend-Namen; Cerebrolysin ist ein komplexes Gemisch; hMG ist ein Gonadotropinpräparat und kein einzelnes kurzes Peptid. Die App erkennt vieles davon bereits richtig, muss es aber als festes Datenfeld statt nur als Fließtext behandeln. Die FDA-Bewertung von CJC-1295 dokumentiert die Nomenklatur- und Formprobleme ausdrücklich.^15

## Profilprüfung 1: Kernkatalog und Stoffwechsel

| Profil | Urteil | Wesentlicher Befund | Erforderliche Korrektur oder Ergänzung |
|---|---|---|---|
| BPC-157 | Korrekt, aber unvollständig | Die starke Begrenzung der Humanbasis ist richtig; die 2025-Pilotstudie umfasste nur zwei vorbelastete Personen. | Neue FDA-Bewertung von 2026 ergänzen; klar zwischen intravenöser Pilot-Sicherheit, fehlender Wirksamkeit und Tierheilungsdaten trennen.^16 |
| TB-500 | Korrekt, aber unvollständig | Die Abgrenzung vom vollständigen Thymosin-β4 ist richtig. | FDA-Review 2026 statt nur Sammelseite 2024 verlinken; Identität des verwendeten Fragments ausdrücklich als produktspezifisch kennzeichnen.^17 |
| Ipamorelin | Korrekt, aber unvollständig | PK/PD-Studie und GH-Antwort sind korrekt eingeordnet; klinischer Langzeitnutzen fehlt. | FDA-Sicherheitsbedenken, Studienpopulation und intravenöse Route prominenter; keine Übertragung auf subkutane Wellness-Anwendung.^18 |
| CJC-1295 | Korrekt, aber unvollständig | Die Humanstudien betreffen die DAC-Form und stützen die lange Exposition. | Name überall als CJC-1295 DAC spezifizieren; die FDA weist auf uneinheitliche Formen und fehlende direkte Vergleichsdaten hin.^15 |
| GHRP-2 | Korrekt, aber unvollständig | Kurze Humanstudien zu GH und Appetit werden sachlich beschrieben. | Japanische Arzneimittel-/Diagnostikgeschichte und aktuelle Produktspezifik getrennt ergänzen; FDA-Sicherheitsmeldungen einschließlich unklarer Kausalität nennen.^19 |
| Sermorelin | Korrekt, aber unvollständig | Historische US-Zulassung und fehlender Anti-Aging-Nachweis sind richtig. | Rücknahme/Verfügbarkeit des konkreten Geref-Produkts, heutige Rezepturen und historische Indikationen genauer trennen.^20 |
| Semaglutid | **Korrektur nötig** | Der US-Titrationskern ist richtig, aber das Profil ist produkt- und regionsseitig veraltet. | EU- und US-Produktinformationen getrennt aufnehmen; MASH, kardiovaskuläre Indikation, orale Form, EU 7,2 mg, NAION und aktuelle Versionsdaten ergänzen.^2,3 |
| Tirzepatid | Korrekt, aber unvollständig | US-Zepbound-Titration und 4-Wochen-Verhütungshinweis stimmen. | EU-Mounjaro-Indikationen einschließlich pädiatrischem Typ-2-Diabetes, OSA/HFpEF-Kontext und abweichende EU-Fachinformation ergänzen; US-Label ist im August 2026 revidiert.^21,22 |
| Selank | Korrekt, aber unvollständig | Begrenzte, schwer unabhängig bestätigbare Humanbasis wird angemessen beschrieben. | FDA-Bewertung 2026 und Identitätsunterschiede zwischen freier Base, Salz und Produkt ergänzen; keine russische Zulassung ohne Primärbeleg behaupten.^23 |
| Epithalon | Korrekt, aber unvollständig | Zellbefunde werden nicht als Lebensverlängerungsnachweis ausgegeben. | Herkunftsgruppe, fehlende unabhängige Replikation und Unterschied zu Epitalamin stärker sichtbar machen; Sammelquelle durch substanzbezogene Primär-/Behördenquelle ersetzen. |
| GHK-Cu | **Korrektur nötig** | Systemische Injektionen sind nicht durch topische Daten gedeckt. | `human: none` ändern: kleine topische Humanstudien existieren; Route getrennt bewerten. Keine topische Kosmetikevidenz auf Injektion übertragen.^9 |
| Adipotide | **Korrektur nötig** | Primatenstudie und präklinischer Status sind korrekt, aber das Risikobild ist unvollständig. | Reversible Veränderungen der proximalen Nierentubuli aus der Primatenarbeit nennen; registrierte First-in-Human-Krebsstudie und deren unklaren Registerstatus einordnen.^24,25 |
| AOD-9604 | **Korrektur nötig** | Das Profil ist zu vage und verschweigt die negative klinische Wirksamkeitslage. | Als hGH-Fragment 176–191 identifizieren; 536-Personen-OPTIONS-Studie ohne signifikanten Gewichtsverlust und eingestellte Entwicklung nennen.^26 |
| Cagrilintid | Korrekt, aber unvollständig | Mechanismus und REDEFINE-1-Kontext sind korrekt. | Monotherapie und Kombination strikt trennen; aktuelle Phase-3-Daten und noch fehlende Zulassung ergänzen.^27 |
| Retatrutid | **Korrektur nötig** | Molekülbeschreibung stimmt, Entwicklungsstand nicht mehr. | Phase-3-Topline-Ergebnisse 2026 ergänzen, aber klar „nicht zugelassen“ und „noch nicht vollständig peer-reviewed“ anzeigen.^4 |
| Mazdutid | **Korrektur nötig** | Phase-3-Studie bei chinesischen Erwachsenen ist korrekt. | Chinesische Zulassungen 2025 für Gewicht und Typ-2-Diabetes ergänzen; EU/USA weiterhin nicht zugelassen.^5,6 |
| Survodutid | Korrekt, aber unvollständig | Die 2026-Phase-3-Adipositaspublikation ist aktuell. | Parallel publizierte Phase-3-MASLD-Daten und weiterhin fehlende Zulassung ergänzen; Forschungsergebnisse nicht als Arzneimittelstatus darstellen.^28 |
| MOTS-c | Korrekt, aber unvollständig | PMID `25738459` ist tatsächlich die grundlegende Lee-Arbeit; `25738453` ist ein begleitender Kommentar. Die Aussage zu Mausmodellen ist richtig. | FDA-Review 2026 zu fehlenden Humanexpositions- und Toxizitätsdaten ergänzen; endogene Humanmessungen nicht als Arzneimittelstudien werten.^1,29 |
| Glutathion | Korrekt, aber unvollständig | Die zitierte orale Studie mit 54 Erwachsenen und die Beschränkung auf Biomarker sind korrekt. | Gegensätzliche kleine orale Studie und getrennte Evidenz nach oral, inhalativ und intravenös ergänzen; keine pauschalen „Detox“-Claims.^30,31 |

## Profilprüfung 2: Hormone und GH-Achse

| Profil | Urteil | Wesentlicher Befund | Erforderliche Korrektur oder Ergänzung |
|---|---|---|---|
| Tesamorelin | **Korrektur nötig** | Die US-Indikation für HIV-Lipodystrophie ist korrekt. | Status sichtbar als **US-zugelassen, EU nicht zugelassen**; zurückgezogene EMA-Anmeldung und vollständige Gegenanzeigen ergänzen.^14,32 |
| PT-141 / Bremelanotid | Korrekt, aber unvollständig | Enge US-Indikation bei prämenopausalen Frauen und Hauptwarnungen stimmen. | US-only sichtbar machen; bedeutende Naltrexon-Wechselwirkung und hohe Übelkeitsrate ergänzen.^33 |
| HGH 191AA / Somatropin | Korrekt, aber unvollständig | 191-Aminosäuren-Identität und fehlende allgemeine Anti-Aging-Indikation stimmen. | Nicht alle Somatropin-Produkte/Indikationen mit Genotropin gleichsetzen; EU/DE-Produktinformationen und vollständige Warnungen produktbezogen ergänzen.^34 |
| hCG | Korrekt, aber unvollständig | LH-ähnliche Wirkung und Warnung vor universellen PCT-Plänen sind richtig. | Das konkrete PREGNYL-Präparat als urinär gewonnenes Gonadotropin und die geschlechts-/indikationsspezifischen Risiken genauer darstellen.^35 |
| hMG / Menotropine | Korrekt, aber unvollständig | Richtige Einordnung als FSH-/LH-aktives Präparat und Aktivitätseinheiten. | Vollständige Gegenanzeigen und strenge ärztliche Überwachung sichtbar machen; nicht als normales Peptid behandeln.^36 |
| Oxytocin | Korrekt, aber unvollständig | Geburtshilfliche Anwendung und Abgrenzung zu „Bonding“ sind richtig. | Produkt- und routenspezifische Kontraindikationen sowie Überwachungsbedarf ergänzen; Intranasal-/Wellness-Claims separat behandeln.^37 |
| Gonadorelin | **Korrektur nötig** | Pulsatilität und Studie bei hypogonadotropem Hypogonadismus stimmen. | Status regional auf zugelassen ändern; deutsche Diagnostik mit LHRH Ferring und pumpenbasierte Therapieprodukte getrennt abbilden.^7,8 |
| Kisspeptin | Korrekt, aber unvollständig | Kisspeptin-10 und -54 werden richtig unterschieden; IVF-Studie betrifft -54. | Neuere randomisierte HSDD-Studien bei Frauen und Männern ergänzen, dabei kurzfristige Surrogat-/Neuroimaging-Endpunkte und fehlende Zulassung betonen.^38,39 |
| GHRP-6 | Korrekt, aber unvollständig | Die 34-Stunden-Infusionsstudie mit neun Männern stützt nur eine akute GH-Reaktion. | FDA-Hinweise zu Glukose, Insulinsensitivität, Cortisol und möglicher Immunogenität ergänzen.^40 |
| CJC-1295 NO DAC | Korrekt, aber unvollständig | Die uneinheitliche Handelsbezeichnung wird bereits ehrlich erklärt. | Profil als Identitätswarnung behandeln; ohne Sequenz/Salz keine PK-Aussage. Nicht automatisch mit Mod GRF 1-29 gleichsetzen.^15 |

## Profilprüfung 3: Neuro-, experimentelle und Bioregulator-Profile

| Profil | Urteil | Wesentlicher Befund | Erforderliche Korrektur oder Ergänzung |
|---|---|---|---|
| ARA-290 / Cibinetid | Korrekt, aber unvollständig | Kleine Humanstudie zu Sarkoidose-assoziierter Small-Fiber-Neuropathie korrekt. | Spätere klinische Studien, Endpunkte und fehlende Zulassung ergänzen; keine allgemeine Nervenheilung ableiten.^41 |
| Cerebrolysin | **Korrektur nötig** | Das Präparat ist korrekt als porzines Peptid-/Aminosäuregemisch beschrieben. | Positive CARS-Einzelstudie gegen Cochrane-Gesamtevidenz spiegeln; regionale nationale Zulassungen getrennt, EU-weit keine zentrale Zulassung.^10 |
| DSIP | Korrekt, aber unvollständig | Sechs-Personen-Studie und extrem schwache Schlafevidenz korrekt. | FDA-Review 2026, Identitäts-/Qualitätsfragen und fehlende belastbare klinische Wirksamkeit ergänzen.^42 |
| Semax | Korrekt, aber unvollständig | Studie mit 110 Schlaganfallpatienten wird nicht als sauber randomisiert verkauft. | FDA-Review 2026 ergänzen; freie Base und Acetat sowie normales und N-acetyliertes Semax trennen; regionale Zulassungen nur mit Originaldokument.^23 |
| PE-22-28 | Korrekt | Spadin-Analogon, TREK-1 und Mausmodelle werden sauber als präklinisch beschrieben. | Nur Quellenjahr/Reviewdatum pflegen; keine Humanwirkung ergänzen, solange keine belastbare Studie existiert.^43 |
| Pinealon | Korrekt, aber unvollständig | Zellstudie wird korrekt nicht als Gedächtnisstudie dargestellt. | Molekülidentität und unabhängige Replikation belegen; Marketingaussagen nicht aus Zellviabilität ableiten.^44 |
| FOXO4-DRI | Korrekt, aber unvollständig | Senolytischer Zell-/Mausansatz korrekt, kein Humanbeleg. | Replikationsstand, Toxikologie und fehlende Humanstudien ergänzen; „Anti-Aging“ nur als Forschungsgebiet.^45 |
| IGF-1 LR3 | Korrekt, aber unvollständig | Richtige Abgrenzung zu natürlichem IGF-1 und Zellstudien. | Klinische Sicherheit als unbekannt markieren; nicht von zugelassenem Mecasermin oder IGF-1 ableiten.^46 |
| KPV | Korrekt, aber unvollständig | Zell-/Mausdaten und fehlende Blendübertragbarkeit stimmen. | FDA-Review 2026 ergänzen: keine identifizierten Humanexpositionsdaten, fehlende Toxikologie und unbekannte Immunogenität.^29 |
| LL-37 | Korrekt, aber unvollständig | Die topische RCT hatte in der Gesamtgruppe keinen signifikanten Heilungsvorteil. | Dosis-/Subgruppenbefunde, lokale Sicherheit und strikte Trennung von systemischer Injektion ergänzen.^47 |
| Melanotan II | **Korrektur nötig** | Drei-Personen-Pilot und akute Nebenwirkungen stimmen. | Schwerwiegende reale Produktsicherheitswarnungen, fehlende Zulassung und publizierte Fallberichte zu Pigmentveränderungen/Priapismus ergänzen; nicht nur Pilotnebenwirkungen zeigen.^48 |
| MGF | Korrekt, aber unvollständig | Uneinheitlicher Begriff und negative Zellbefunde werden korrekt dargestellt. | Exakte Sequenz des Katalogprodukts verlangen; vollständige IGF-1-Splicevariante und synthetisches Fragment separat führen.^49 |
| PEG-MGF | Identität ungeklärt | Profil behauptet zu Recht keine bestätigte Wirkung. | PEG-Größe, Kopplungsstelle, Sequenz, Salz und Analytik als Pflichtfelder; Sammel-FDA-Quelle durch substanzspezifischen Beleg ersetzen. |
| PNC-27 | Korrekt, aber unvollständig | Onkologische Zellforschung wird nicht als Krebstherapie verkauft. | Unabhängige Replikation, Tierdaten und fehlende Humanstudien ergänzen; „Krebs“ nie als Behandlungsversprechen darstellen.^50 |
| SNAP-8 | **Korrektur nötig** | Der Text sagt korrekt, dass die Serumstudie den Einzelstoffeffekt nicht isoliert. | `human: limited` ist dennoch irreführend: Die Quelle ist ein Multi-Ingredient-Produkt. Evidenz für isoliertes SNAP-8 separat bewerten oder auf „keine direkt zurechenbare Humanwirksamkeit“ setzen.^51 |
| SS-31 / Elamipretid | **Korrektur nötig** | Beschleunigte US-Zulassung 2025 wird korrekt genannt. | Genaue US-Indikation (Barth-Syndrom, ≥30 kg, Verbesserung der Kniestreckmuskelkraft als Surrogat), fehlende EU-Zulassung und Fachinformationssicherheit ergänzen.^12 |
| Thymosin alpha-1 | **Korrektur nötig** | ETASS-Kontext und Warnung vor „Immunboost“ sind richtig. | TESTS-Phase-3-Nullergebnis 2025 und länderspezifische Zulassungen ergänzen; Sepsisstudien nicht auf Gesunde übertragen.^13 |
| Chonluten | Korrekt | THP-1-Zelllinie wird korrekt als Labor- und nicht als Humanstudie dargestellt. | Fehlende unabhängige Replikation und Herkunft der Evidenzgruppe ergänzen.^52 |
| Cortagen | Korrekt, aber unvollständig | Kultivierte Lymphozyten und Chromatinbefund werden vorsichtig eingeordnet. | Sequenz/Identität und direkte Primärquelle präzisieren; keine Neurologie- oder Organwirkung behaupten.^53 |
| Prostamax | Korrekt, aber unvollständig | Quelle wird korrekt nicht als Prostatatherapiestudie ausgegeben. | Chemische Identität fehlt; bis dahin eher „ungeklärt“ als preclinical. |
| Livagen | Korrekt, aber unvollständig | In-vitro-Chromatinbefund korrekt, keine Leberverjüngung behauptet. | Sequenz, Interessenkontext und fehlende unabhängige/in-vivo Replikation ergänzen.^54 |
| Vilon | Korrekt, aber unvollständig | Laborbefund korrekt, keine Lebensverlängerung behauptet. | Sequenz und weitere Primärquellen sauber trennen; keine klinische Aussage aus kultivierten Zellen.^54 |
| Testagen | Korrekt, aber unvollständig | HeLa-/DNA-Arbeit korrekt und kein Testosteronanstieg behauptet. | Molekülidentität, Funktion und unabhängige Replikation ergänzen; Name kann Nutzer irreführen.^55 |
| Vesugen | Korrekt, aber unvollständig | Zell-/Tierkontext wird überwiegend korrekt als nicht klinisch dargestellt. | Quelle erwähnt Tierzellen und frühere Menschenbefunde, belegt diese aber nicht selbst; diese Ebenen ausdrücklich trennen.^56 |
| Adamax | Identität ungeklärt | App bestätigt nur den Katalognamen und macht keine medizinische Aussage. | Nicht als normales Peptidprofil veröffentlichen, bis Sequenz, Herstellerbegriff und Primärquellen geklärt sind. |
| Cartalax | Identität ungeklärt | Gleiches korrekt vorsichtiges Platzhalterprofil. | Chemische Identität und belastbare Primärquelle zuerst klären. |
| Ovagen | Identität ungeklärt | Gleiches korrekt vorsichtiges Platzhalterprofil. | Chemische Identität und belastbare Primärquelle zuerst klären. |

## Profilprüfung 4: Blends

Für neun der zehn Blends belegt die hinterlegte Quelle im Wesentlichen nur, dass ein Anbieter diesen Namen und diese Zusammensetzung verwendet. Das ist keine klinische Evidenz. Handelsnamen können zwischen Anbietern variieren; eine Zusammensetzung muss daher immer als katalogbezogene Momentaufnahme mit Abrufdatum, Mengenverhältnis und Anbieter gekennzeichnet werden.

| Profil | Urteil | Wesentlicher Befund | Erforderliche Korrektur oder Ergänzung |
|---|---|---|---|
| AOD-9604 + CJC-1295 + Ipamorelin | Identität ungeklärt | App warnt korrekt, dass die CJC-Variante unklar ist. | Ohne DAC-Form, Sequenz und Komponentenmenge kein belastbares Profil; Einzelstoffdaten nicht als Blendwirkung darstellen. |
| BPC-157 + TB-500 | Korrekt, aber unvollständig | Zwei Research-Peptide und verschiedene Vialstärken werden korrekt zusammengefasst. | TB-500-Identität und konkrete Zusammensetzung pro Produktversion nennen; keine Synergie- oder Heilungsbehauptung. |
| Cagrilintid + Semaglutid / CagriSema | **Korrektur nötig** | Definiertes Studienpräparat wird richtig von beliebigen Mischungen getrennt. | Evidenz auf aktuelle Phase 3 anheben, Sicherheit ergänzen und REDEFINE 4 samt verfehltem Nichtunterlegenheitsendpunkt nennen.^11,57 |
| CJC-1295 + GHRP-2 | Identität ungeklärt | App ordnet CJC bewusst keiner DAC-Variante zu. | Solange das ungeklärt bleibt, keinen Wirkmechanismus oder PK-Wert des Blends anzeigen. |
| CJC-1295 NO DAC + Ipamorelin | Korrekt, aber unvollständig | Katalogname nennt NO DAC ausdrücklich. | „NO DAC“ bleibt keine ausreichend genaue chemische Spezifikation; Mod GRF nicht automatisch gleichsetzen.^15 |
| GLOW | Identität ungeklärt | Zusammensetzung ist nur für den Referenzkatalog belegt. | Als anbieterspezifischen Blend-Namen kennzeichnen; Chargen-/Mengenidentität und fehlende Kombinationsstudien sichtbar machen. |
| KLOW | Identität ungeklärt | Zusammensetzung ist nur katalogbezogen. | Gleiche Einschränkungen wie GLOW; KPV besitzt keine Humanexpositionsdaten.^29 |
| Neuroxelin | Identität ungeklärt | App warnt korrekt vor nicht standardisiertem Namen und N-acetylierten Varianten. | Sequenzen, Mengen und Belege für N-Acetyl-Semax/-Selank separat fordern; keine Daten der Ausgangspeptide übertragen. |
| Tesamorelin + Ipamorelin | Identität ungeklärt | App sagt korrekt, dass Tesamorelin-Zulassung den Blend nicht zulässt. | Keine zugelassenen Tesamorelin-Daten als Kombinationsevidenz zeigen; Produktzusammensetzung verifizieren. |
| Tri-Heal | Identität ungeklärt | Name und Komponenten werden korrekt als Katalogmischung bezeichnet. | Der Markenname darf in Suche/SEO nicht als Heilungsclaim erscheinen; keine klinischen Blenddaten vorhanden. |

## Priorisierter Korrekturplan

### P0 – vor jeder öffentlichen Veröffentlichung

- Regionale Zulassungslogik einführen und Semaglutid, Tirzepatid, Mazdutid, Tesamorelin, Gonadorelin, PT-141, Somatropin, hCG, hMG, Oxytocin und Elamipretid neu kennzeichnen.
- `clinical: none` bei zugelassenen Präparaten und CagriSema beseitigen.
- Numerische Evidenzscores ausblenden, bis eine dokumentierte Bewertungsmethode existiert.
- Leere Sicherheitsfelder als „nicht ausreichend untersucht“ ausgeben.
- GHK-Cu-Humanstatus und SNAP-8-Zurechenbarkeit korrigieren.
- Cerebrolysin nicht nur über eine positive Einzelstudie darstellen.

### P1 – inhaltliche Aktualisierung

- Neue 2025/2026-Evidenz zu Semaglutid, Tirzepatid, Retatrutid, Mazdutid, Survodutid, CagriSema, SS-31, Thymosin alpha-1, BPC-157, TB-500, KPV, MOTS-c, Semax und DSIP einpflegen.
- Für jedes Profil mindestens eine substanzspezifische Quelle für Identität und eine getrennte Quelle für den höchsten Evidenzstand hinterlegen.
- Sicherheit, Gegenanzeigen und Wechselwirkungen nicht aus einer einzigen Studie ableiten; bei fehlenden Daten die Unsicherheit explizit ausdrücken.
- Alle Studienprotokolle als Studienbeschreibung und nicht als Anwendungsplan gestalten.

### P2 – redaktionelle Reife

- Jedes Profil mit „Stand der Evidenz“, „Zulassungen nach Region“, „Was wurde tatsächlich untersucht?“, „Was ist unbekannt?“ und „Produkt-/Routenabgrenzung“ strukturieren.
- Autoreninteressen, kleine Stichproben, fehlende Verblindung und fehlende unabhängige Replikation sichtbar machen.
- Blends als eigene Objektklasse führen; Handelsname, Anbieter, Komponenten, Mengenverhältnis und Abrufdatum versionieren.
- Für Adamax, Cartalax, Ovagen, PEG-MGF und mehrere Blends erst Identitätsdossiers anlegen, bevor medizinische Texte erweitert werden.

## Belastbarkeit und Grenzen dieses Audits

Der Audit umfasst alle 66 im Code veröffentlichten Profile und die dort hinterlegten deutschen und englischen Kernaussagen, Quellen, Evidenz- und Zulassungsfelder. Er gleicht priorisiert Primärpublikationen, Fachinformationen, Behördenunterlagen und Studienregister bis 14. September 2026 ab.

Er ist kein formales systematisches Review mit doppelter unabhängiger Studienselektion, vollständiger Volltextbeschaffung und Metaanalyse für 66 Substanzen. Bei russischsprachigen Bioregulatoren, nicht standardisierten Handelsnamen und nicht öffentlich dokumentierten Mischprodukten lässt sich eine globale Vollständigkeit nicht beweisen. Die richtige Ausgabe ist dort „Identität/Evidenz ungeklärt“, nicht eine erfundene Sicherheit oder Wirksamkeit.

## Quellen

1. Lee C et al. „[The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance](https://pubmed.ncbi.nlm.nih.gov/25738459/).“ *Cell Metabolism*, 2015. Begleitkommentar: Zarse K, Ristow M, [PMID 25738453](https://pubmed.ncbi.nlm.nih.gov/25738453/).
2. EMA. „[Wegovy: Product Information](https://www.ema.europa.eu/en/documents/product-information/wegovy-epar-product-information_en.pdf).“ Stand 2026.
3. EMA PRAC. „[PRAC concludes eye condition NAION is a very rare side effect of semaglutide medicines](https://www.ema.europa.eu/en/news/meeting-highlights-pharmacovigilance-risk-assessment-committee-prac-2-5-june-2025).“ 6. Juni 2025.
4. Eli Lilly. „[What to know about retatrutide](https://www.lilly.com/news/stories/what-to-know-about-retatrutide).“ aktualisiert 2026.
5. Innovent. „[Mazdutide received NMPA approval for chronic weight management](https://en.innoventbio.com/InvestorsAndMedia/PressReleaseDetail?key=546).“ 2025.
6. Innovent. „[Mazdutide received NMPA approval for glycemic control in adults with type 2 diabetes](https://en.innoventbio.com/InvestorsAndMedia/PressReleaseDetail?key=556).“ 19. September 2025.
7. Ferring. „[Our products: Lutrepulse/Lutrelef](https://www.ferring.com/science-innovation/our-products/).“ abgerufen September 2026.
8. Ferring. „[LHRH Ferring 0,1 mg/1 ml: Fachinformation](https://www.fachinfo.de/fi/pdf/004568/lhrh-ferring-0-1-mg-1-ml-injektionsloesung).“
9. Miller TR et al. „[Effects of topical copper tripeptide complex on CO2 laser-resurfaced skin](https://pubmed.ncbi.nlm.nih.gov/16847171/).“ *Archives of Facial Plastic Surgery*, 2006.
10. Ziganshina LE et al. „[Cerebrolysin for acute ischaemic stroke](https://pubmed.ncbi.nlm.nih.gov/37818733/).“ Cochrane Review, 2023.
11. Aroda VR et al. „[REIMAGINE 1](https://pubmed.ncbi.nlm.nih.gov/42251860/)“; Pieber TR et al. „[REIMAGINE 2](https://pubmed.ncbi.nlm.nih.gov/42251859/)“; Rosenstock J et al. „[REIMAGINE 3](https://pubmed.ncbi.nlm.nih.gov/42251856/).“ Randomisierte Phase-3a-Studien zu CagriSema, 2026.
12. FDA. „[FDA grants accelerated approval to first treatment for Barth syndrome](https://www.fda.gov/news-events/press-announcements/fda-grants-accelerated-approval-first-treatment-barth-syndrome).“ 19. September 2025; „[Forzinity Prescribing Information](https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/215244s000lbl.pdf).“ revidiert September 2025.
13. TESTS Study Group. „[Thymosin alpha-1 for sepsis: randomized phase 3 trial](https://pubmed.ncbi.nlm.nih.gov/39814420/).“ 2025.
14. EMA. „[Egrifta: withdrawal of the marketing-authorisation application](https://www.ema.europa.eu/en/medicines/human/EPAR/egrifta).“ 2012.
15. FDA. „[CJC-1295-related bulk drug substances: PCAC briefing](https://www.fda.gov/media/183819/download).“ 4. Dezember 2024.
16. FDA. „[BPC-157: PCAC briefing document](https://www.fda.gov/media/193343/download).“ 11. Mai 2026 / Sitzung Juli 2026.
17. FDA. „[July 2026 PCAC meeting materials: TB-500](https://www.fda.gov/advisory-committees/advisory-committee-calendar/july-23-24-2026-meeting-pharmacy-compounding-advisory-committee-07232026).“ Juli 2026.
18. FDA. „[Certain bulk drug substances for use in compounding that may present significant safety risks](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks).“ abgerufen 14. September 2026.
19. PMDA. „[GHRP Kaken product information](https://www.pmda.go.jp/PmdaSearch/rdDetail/iyaku/7223407D2023_1?user=1).“ Stand 2025.
20. FDA. „[Historical Geref approval documents](https://www.accessdata.fda.gov/drugsatfda_docs/nda/pre96/019863_S001_GEREF.pdf).“ 1991.
21. EMA. „[Mounjaro: Product Information](https://www.ema.europa.eu/en/documents/product-information/mounjaro-epar-product-information_en.pdf).“ Stand August 2026.
22. FDA/DailyMed. „[Zepbound prescribing information](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b).“ revidiert August 2026.
23. FDA. „[Semax-related bulk drug substances: PCAC briefing](https://www.fda.gov/media/193348/download).“ 11. Mai 2026 / Sitzung Juli 2026.
24. Barnhart KF et al. „[A peptidomimetic targeting white fat causes weight loss and improved insulin resistance in obese monkeys](https://pubmed.ncbi.nlm.nih.gov/22072637/).“ *Science Translational Medicine*, 2011.
25. ClinicalTrials.gov. „[NCT01262664: Prohibitin Targeting Peptide 1 in metastatic prostate cancer and obesity](https://clinicaltrials.gov/study/NCT01262664?tab=table).“ Registereintrag.
26. FDA PCAC. „[AOD-9604 evaluation](https://www.fda.gov/media/183584/download).“ 4. Dezember 2024.
27. Garvey WT et al. „[Coadministered cagrilintide and semaglutide in adults with overweight or obesity](https://pubmed.ncbi.nlm.nih.gov/40544433/).“ *New England Journal of Medicine*, 2025.
28. Colquhoun D et al. „[Survodutide once weekly for the treatment of adults with obesity](https://pubmed.ncbi.nlm.nih.gov/42253238/).“ 2026; sowie „[SYNCHRONIZE-MASLD](https://pubmed.ncbi.nlm.nih.gov/42252333/).“ 2026.
29. FDA. „[July 2026 PCAC presentations: KPV and MOTS-c](https://www.fda.gov/media/193773/download).“ Juli 2026.
30. Richie JP Jr et al. „[Randomized controlled trial of oral glutathione supplementation on body stores](https://pubmed.ncbi.nlm.nih.gov/24791752/).“ *European Journal of Nutrition*, 2015.
31. Allen J, Bradley RD. „[Effects of oral glutathione supplementation on systemic oxidative stress biomarkers](https://pubmed.ncbi.nlm.nih.gov/21875351/).“ 2011.
32. DailyMed. „[Egrifta WR prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=839334d3-8c1d-4c26-9036-2ab524a6ea75).“ abgerufen September 2026.
33. DailyMed. „[Vyleesi prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f1d0c1b5-2f39-4bad-a6a4-0066e3ad5dcf).“ abgerufen September 2026.
34. DailyMed. „[Genotropin prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ffebf88b-d257-4542-9808-74d9b7167765).“ abgerufen September 2026.
35. DailyMed. „[Pregnyl prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1e94155f-19be-4944-b197-be4edbb4faf9).“ abgerufen September 2026.
36. DailyMed. „[Menopur prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=22c8db95-c3db-1770-8086-31356fbabe35).“ abgerufen September 2026.
37. DailyMed. „[Pitocin prescribing information](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6e5a66fc-e507-497c-b5ce-44a8c95898ad).“ abgerufen September 2026.
38. Thurston L et al. „[Effects of kisspeptin administration in women with HSDD](https://pubmed.ncbi.nlm.nih.gov/36287566/).“ *JAMA Network Open*, 2022.
39. Mills EG et al. „[Effects of kisspeptin on sexual brain processing and penile tumescence in men with HSDD](https://pubmed.ncbi.nlm.nih.gov/36735255/).“ *JAMA Network Open*, 2023.
40. FDA. „[Compounding safety overview: GHRP-6](https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks).“ abgerufen September 2026.
41. Brines M et al. „[ARA-290 in sarcoidosis-associated small-fiber neuropathy](https://pubmed.ncbi.nlm.nih.gov/24136731/).“ 2013.
42. FDA. „[DSIP-related bulk drug substances: PCAC briefing](https://www.fda.gov/media/193344/download).“ 2026.
43. Moha ou Maati H et al. „[Short spadin analogues and TREK-1](https://pmc.ncbi.nlm.nih.gov/articles/PMC5601071/).“ 2017.
44. Khavinson VKh et al. „[Pinealon: cell viability and oxidative stress experiments](https://pubmed.ncbi.nlm.nih.gov/21978084/).“ 2011.
45. Baar MP et al. „[Targeted apoptosis of senescent cells restores tissue homeostasis](https://pubmed.ncbi.nlm.nih.gov/28340339/).“ *Cell*, 2017.
46. Forbes BE et al. „[IGF analogues and binding-protein interactions](https://pubmed.ncbi.nlm.nih.gov/8691093/).“ 1996.
47. Grönberg A et al. „[Topical LL-37 for hard-to-heal venous leg ulcers](https://pubmed.ncbi.nlm.nih.gov/34687253/).“ 2021.
48. Dorr RT et al. „[Melanotan-II: pilot phase I clinical study](https://pubmed.ncbi.nlm.nih.gov/8637402/).“ 1996.
49. Matheny RW Jr et al. „[Synthetic mechano-growth factor peptide and muscle-cell experiments](https://pubmed.ncbi.nlm.nih.gov/24253050/).“ 2014.
50. Sarafraz-Yazdi E et al. „[PNC-27 and membrane HDM-2 in cancer-cell models](https://pubmed.ncbi.nlm.nih.gov/20080680/).“ 2010.
51. Bruce S. „[Safety and efficacy of a multi-ingredient facial serum](https://pmc.ncbi.nlm.nih.gov/articles/PMC3140905/).“ 2011.
52. Avolio E et al. „[Peptides regulating inflammatory pathways in THP-1 cells](https://pubmed.ncbi.nlm.nih.gov/35408963/).“ 2022.
53. Khavinson VKh, Lezhava TA, Malinin VV. „[Effects of short peptides on lymphocyte chromatin in senile subjects](https://pubmed.ncbi.nlm.nih.gov/15085253/).“ 2004. Untersucht wurden Vilon, Epithalon, Livagen, Prostamax und Cortagen ex vivo an Leukozyten älterer Menschen.
54. Lezhava T et al. „[Anti-aging peptide bioregulators induce reactivation of chromatin](https://pubmed.ncbi.nlm.nih.gov/16705247/).“ 2006.
55. Khavinson VKh et al. „[Penetration of short fluorescence-labeled peptides into HeLa-cell nuclei](https://pubmed.ncbi.nlm.nih.gov/22117547/).“ 2011.
56. Khavinson VKh et al. „[Peptidergic regulation of vascular endothelial-cell proliferation](https://pubmed.ncbi.nlm.nih.gov/25051766/).“ 2014.
57. Novo Nordisk. „[REDEFINE 4 headline results](https://www.novonordisk.com/news-and-media/news-and-ir-materials/news-details.html?id=916501).“ 23. Februar 2026.
