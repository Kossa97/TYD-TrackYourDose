-- Tagebuch: Dauer + Status + öffentlich
alter table effects add column if not exists status text default 'eingetreten';
alter table effects add column if not exists duration text;
alter table effects add column if not exists is_public boolean default false;

-- Profil: öffentlich teilen
alter table profiles add column if not exists is_public boolean default false;
alter table profiles add column if not exists public_bio text;
