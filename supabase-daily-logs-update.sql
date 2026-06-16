-- daily_logs: Skala 1–10 + Gewicht/Körperfett (Progress-Seite)
-- Im Supabase SQL Editor ausführen, falls Speichern mit „Konnte nicht gespeichert werden“ fehlschlägt

-- Alte 1–5-Constraints entfernen
alter table daily_logs drop constraint if exists daily_logs_energie_check;
alter table daily_logs drop constraint if exists daily_logs_schlaf_check;
alter table daily_logs drop constraint if exists daily_logs_libido_check;

-- Neue Constraints: optional, Werte 1–10
alter table daily_logs add constraint daily_logs_energie_check
  check (energie is null or energie between 1 and 10);
alter table daily_logs add constraint daily_logs_schlaf_check
  check (schlaf is null or schlaf between 1 and 10);
alter table daily_logs add constraint daily_logs_libido_check
  check (libido is null or libido between 1 and 10);

-- Felder für Gewicht & Körperfett
alter table daily_logs add column if not exists weight_kg numeric(5,1);
alter table daily_logs add column if not exists body_fat_pct numeric(4,1);
