-- Vorrat, Batch, Rekonstitutionsdaten für Peptide
alter table peptides
  add column if not exists vials_in_stock    numeric(8,2) default 0,
  add column if not exists vials_initial     numeric(8,2) default 0,
  add column if not exists reconstitution_date date,
  add column if not exists expiry_days       integer default 28,
  add column if not exists batch_number      text,
  add column if not exists batch_source      text,
  add column if not exists batch_file_url    text;

-- Einnahme-Bestätigung für Dosis-Protokolle
alter table dose_logs
  add column if not exists taken boolean default null;

-- Storage-Bucket für Batch-Dateien (PDF/Bilder)
insert into storage.buckets (id, name, public)
values ('batch-files', 'batch-files', true)
on conflict do nothing;

-- Jeder eingeloggte User darf in seinem Ordner Dateien hochladen/lesen/löschen
create policy "Batch upload" on storage.objects
  for insert with check (bucket_id = 'batch-files' and auth.uid() is not null);

create policy "Batch read" on storage.objects
  for select using (bucket_id = 'batch-files');

create policy "Batch delete" on storage.objects
  for delete using (
    bucket_id = 'batch-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
