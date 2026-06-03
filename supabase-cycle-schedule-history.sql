-- Versionierte Zyklus-Planung: Array von Segmenten { effective_from, frequency,
-- intake_time, intake_time_custom, x_days_interval, schedule_days, dose, unit }.
-- Leere/NULL-Historie => flache cycles-Felder gelten ab start_date (abwärtskompatibel).
alter table cycles add column if not exists schedule_history jsonb;
