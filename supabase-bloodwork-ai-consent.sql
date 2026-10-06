-- Blutwerte, Etappe 0: Einwilligung in die KI-Auswertung von Befunden.
--
-- Der Befund-Import schickt Foto oder PDF an Anthropic (Edge Function
-- `bloodwork-extract`). Apple 5.1.2(i) und Art. 9 DSGVO verlangen dafuer eine
-- ausdrueckliche Einwilligung vorab. Sie steht mit Zeitpunkt im Profil; null
-- heisst: nicht erteilt oder widerrufen. Die Edge Function prueft sie selbst.
--
-- Rein additiv und idempotent: eine neue Spalte, keine Zeile wird geaendert.

begin;

alter table public.profiles add column if not exists ai_import_consent_at timestamptz;

commit;
