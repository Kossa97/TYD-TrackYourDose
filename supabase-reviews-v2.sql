-- Bewertungen v2: Bewertung je Zyklus, drei Kriterien, Teilen nur auf Wunsch.
--
-- Rein additiv und idempotent (zweimal laufen lassen schadet nicht):
--   * kein drop, kein delete, kein update bestehender Zeilen
--   * bestehende Bewertungen behalten alles; neue Spalten sind leer bzw.
--     `is_public = false`
--
-- Vorher im Container geprueft (Postgres 16, Ist-Zustand nachgestellt,
-- zweimal gelaufen, nachgezaehlt) — siehe HANDOFF.md.

begin;

-- ── Neue Spalten ────────────────────────────────────────────────────────────
-- Zyklus, zu dem die Bewertung gehoert. Wird der Zyklus geloescht, bleibt die
-- Bewertung und verliert nur den Bezug.
alter table public.reviews
  add column if not exists cycle_id uuid references public.cycles(id) on delete set null;

-- Kriterien, je 1–5; leer bei alten Bewertungen.
alter table public.reviews add column if not exists wirkung smallint;
alter table public.reviews add column if not exists vertraeglichkeit smallint;
-- „Wieder nehmen?" — ja / unsicher / nein. `would_recommend` (boolean, nie
-- benutzt, Standard true) bleibt unangetastet stehen: drei Stufen passen
-- nicht hinein, und alte Zeilen haben dort nur den Standardwert.
alter table public.reviews add column if not exists wieder_nehmen text;
-- Oeffentlich zeigen: nur, wenn man es je Bewertung einschaltet.
alter table public.reviews add column if not exists is_public boolean not null default false;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();

-- `experience` lebte bisher nur in der Produktion, in keiner Datei. Hier
-- festgehalten — fuer neu aufgesetzte Datenbanken.
alter table public.reviews add column if not exists experience text default 'gut';

-- ── Pruefregeln (idempotent ueber den Namen) ───────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_wirkung_check' and conrelid = 'public.reviews'::regclass) then
    alter table public.reviews add constraint reviews_wirkung_check check (wirkung between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_vertraeglichkeit_check' and conrelid = 'public.reviews'::regclass) then
    alter table public.reviews add constraint reviews_vertraeglichkeit_check check (vertraeglichkeit between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_wieder_nehmen_check' and conrelid = 'public.reviews'::regclass) then
    alter table public.reviews add constraint reviews_wieder_nehmen_check check (wieder_nehmen in ('ja', 'unsicher', 'nein'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_experience_check' and conrelid = 'public.reviews'::regclass) then
    alter table public.reviews add constraint reviews_experience_check check (experience in ('gut', 'mittel', 'schlecht'));
  end if;
end $$;

-- Eine Bewertung je Zyklus.
create unique index if not exists reviews_cycle_id_unique
  on public.reviews (cycle_id) where cycle_id is not null;

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.set_review_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_review_updated_at();

-- ── Zugriff ────────────────────────────────────────────────────────────────
-- Bisher: lesen und schreiben, wenn `user_id` passt — Substanz und Zyklus
-- wurden nicht geprueft. Jetzt muessen beide dem Nutzer gehoeren, und der
-- Zyklus muss zur Substanz passen. Lesen und Loeschen bleiben wie sie sind.
-- (`alter policy` statt neu anlegen: kein drop.)
alter policy "Own reviews" on public.reviews
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.stack_items s
      where s.id = reviews.stack_item_id and s.user_id = auth.uid()
    )
    and (
      reviews.cycle_id is null
      or exists (
        select 1 from public.cycles c
        where c.id = reviews.cycle_id and c.user_id = auth.uid() and c.stack_item_id = reviews.stack_item_id
      )
    )
  );

-- Teilen im Profil: ab jetzt standardmaessig aus. Bestehende Profile
-- behalten ihren Wert (kein update).
alter table public.profiles alter column share_bewertungen set default false;

commit;
