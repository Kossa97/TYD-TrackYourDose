-- Soft-Delete / Archiv für Substanzen
-- Archivierte Peptide bleiben in der DB (Historie/Joins funktionieren weiter),
-- werden aber aus "My Stack" ausgeblendet.

alter table peptides
  add column if not exists archived boolean not null default false;

create index if not exists peptides_user_archived_idx
  on peptides (user_id, archived);
