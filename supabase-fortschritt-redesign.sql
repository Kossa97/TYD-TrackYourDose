-- Fortschritt Redesign: Schema-Ergänzungen
-- In Supabase SQL Editor ausführen.

-- 1. Wohlbefinden als eigenes Feld (getrennt von Libido)
alter table daily_logs add column if not exists wohlbefinden integer;
alter table daily_logs drop constraint if exists daily_logs_wohlbefinden_check;
alter table daily_logs add constraint daily_logs_wohlbefinden_check
  check (wohlbefinden is null or wohlbefinden between 1 and 10);

-- 2. Gewicht: canonical source weight_logs
create table if not exists weight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  logged_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null,
  created_at timestamptz default now()
);

alter table weight_logs enable row level security;
drop policy if exists "Own weight logs" on weight_logs;
create policy "Own weight logs" on weight_logs
  for all using (auth.uid() = user_id);

create index if not exists weight_logs_user_logged_idx
  on weight_logs (user_id, logged_at desc);

-- 3. Fortschrittsfotos
create table if not exists progress_photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  photo_url text not null,
  taken_at date not null default current_date,
  weight_kg numeric(5,1),
  notes text,
  created_at timestamptz default now()
);

alter table progress_photos enable row level security;
drop policy if exists "Own progress photos" on progress_photos;
create policy "Own progress photos" on progress_photos
  for all using (auth.uid() = user_id);

create index if not exists progress_photos_user_taken_idx
  on progress_photos (user_id, taken_at desc);

-- 4. Privater Storage-Bucket für Fortschrittsfotos.
-- Körperfotos sind sensibel: kein public bucket, Zugriff nur über signierte
-- URLs des eigenen Users. Pfad-Konvention: <user_id>/<timestamp>.<ext>
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Own progress photo objects insert" on storage.objects;
create policy "Own progress photo objects insert" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Own progress photo objects select" on storage.objects;
create policy "Own progress photo objects select" on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Own progress photo objects delete" on storage.objects;
create policy "Own progress photo objects delete" on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
