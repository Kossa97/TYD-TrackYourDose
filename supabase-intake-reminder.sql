-- Einnahmezeitpunkt + Erinnerung für Zyklen
alter table cycles
  add column if not exists intake_time       text default 'morgens',
  add column if not exists intake_time_custom text,
  add column if not exists reminder          text default 'none';
