alter table profiles add column if not exists share_peptide boolean default true;
alter table profiles add column if not exists share_kalender boolean default false;
alter table profiles add column if not exists share_tagebuch boolean default false;
alter table profiles add column if not exists share_bewertungen boolean default true;
