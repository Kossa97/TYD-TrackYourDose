# Bereits bestätigte Injektionen nachträglich verknüpfen

## Ziel

Im Injektions-Log-Sheet sollen neben offenen Einnahmen auch bereits bestätigte injizierbare Einnahmen auswählbar sein, sofern ihnen noch kein 3D-Injektions-Pin zugeordnet wurde.

## Zustände

- **Offen:** Geplante Einnahme ohne bestätigten `dose_log`. Beim Speichern wird ein bestätigter `dose_log` erzeugt, der Bestand einmal abgezogen und der neue `injection_log` über `dose_log_id` verknüpft.
- **Bestätigt ohne Pin:** Vorhandener `dose_log` mit `taken = true`, dessen ID in keinem `injection_log.dose_log_id` verwendet wird. Beim Speichern wird ausschließlich ein `injection_log` mit dieser bestehenden `dose_log_id` erzeugt. Es erfolgt keine neue Einnahmebestätigung und kein Bestandsabzug.
- **Bestätigt mit Pin:** Vorhandener `dose_log`, dessen ID bereits durch einen `injection_log` referenziert wird. Dieser Eintrag ist nicht erneut auswählbar.

## Oberfläche

Die bisherige Liste „Offene Einnahme“ wird zu einer gemeinsamen Einnahmeliste.

Jede Karte zeigt einen textlichen Status und ein Symbol:

- Uhrsymbol und `Offen`
- Häkchen und `Bereits bestätigt`

Oberhalb der Liste erscheint ein Filter mit `Alle`, `Offen` und `Bestätigt ohne Pin`. Standard ist `Alle`. Die bestehenden Standardwerte bleiben `Alle Zyklen`, `7 Tage` und `Neueste zuerst`.

Der primäre Button richtet sich nach dem gewählten Zustand:

- Offen: `Speichern & bestätigen`
- Bereits bestätigt: `Injektionsstelle hinzufügen`

Bei beiden Zuständen bleiben Datum, Dosis, Einheit und Methode unveränderbar. Die Uhrzeit bleibt gemäß bestehender Produktentscheidung editierbar, wobei der Kalendertag erhalten bleibt.

## Datenfluss

Die Ladefunktion liefert eine gemeinsame Auswahlstruktur mit einem eindeutigen Status sowie optionaler `doseLogId`.

Beim Speichern entscheidet der Status:

1. `open`: bestehenden Bestätigungsablauf ausführen und anschließend den Pin mit der neuen `dose_log_id` speichern.
2. `confirmed`: vorhandene `dose_log_id` direkt verwenden und nur den Pin speichern.

Die bestehende `injection_logs.dose_log_id`-Beziehung bleibt die einzige Quelle für die Pin-Zuordnung. Eine zusätzliche Datenbankspalte ist nicht erforderlich.

## Fehler- und Konsistenzschutz

- Ein bereits verknüpfter `dose_log` darf weder geladen noch erneut gespeichert werden.
- Die bestätigte Variante darf `confirmIntakeDoseLog` und den Bestandsabzug niemals aufrufen.
- Falls ein Eintrag zwischen Laden und Speichern anderweitig verknüpft wurde, muss das Speichern ohne zweiten Pin abbrechen und die Liste neu laden.
- Manuelle Injektionen bleiben unverändert.

## Tests

- Offene Einnahmen werden mit Status `open` geliefert.
- Bestätigte Einnahmen ohne Pin werden mit bestehender `doseLogId` geliefert.
- Bestätigte Einnahmen mit Pin werden ausgeschlossen.
- Speichern eines offenen Eintrags bestätigt und belastet den Bestand genau einmal.
- Speichern eines bestätigten Eintrags erstellt nur den `injection_log`.
- Statusfilter, Standardsortierung und Buttonbeschriftung entsprechen dem Zustand.