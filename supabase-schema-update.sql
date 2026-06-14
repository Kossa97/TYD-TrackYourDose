-- Neue Felder zur peptides Tabelle hinzufügen
alter table peptides add column if not exists vial_amount_mg numeric(10,3);
alter table peptides add column if not exists vial_amount_unit text default 'mg';
alter table peptides add column if not exists reconstitution_ml numeric(6,2);
alter table peptides add column if not exists syringe_type text default '1 mL (100 Einheiten)';
alter table peptides add column if not exists schedule_days text[] default '{}';
alter table peptides add column if not exists shot_time text;
alter table peptides add column if not exists reminders_enabled boolean default false;
