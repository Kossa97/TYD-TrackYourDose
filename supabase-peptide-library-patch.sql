-- ============================================================
-- PEPTIDE LIBRARY — Schema-Patch (v2 + v3)
-- Einmal im Supabase SQL Editor ausführen, wenn Admin-Speichern
-- Fehler wie "Could not find the 'tags' column" meldet.
-- ============================================================

alter table public.peptide_library
  add column if not exists evidence_human    text not null default 'none',
  add column if not exists evidence_animal   text not null default 'none',
  add column if not exists evidence_clinical text not null default 'none',
  add column if not exists evidence_score    smallint not null default 1,
  add column if not exists research_gaps     text[] not null default '{}',
  add column if not exists tags              text[] not null default '{}';

-- Schreibrechte für eingeloggte Admins (falls noch nicht vorhanden)
drop policy if exists "authenticated_insert" on public.peptide_library;
create policy "authenticated_insert"
  on public.peptide_library for insert to authenticated with check (true);

drop policy if exists "authenticated_update" on public.peptide_library;
create policy "authenticated_update"
  on public.peptide_library for update to authenticated using (true) with check (true);
