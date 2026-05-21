-- ============================================================
-- Admin-Schreibrechte für peptide_library
-- Ausführen im Supabase SQL Editor
-- Ermöglicht eingeloggten Benutzern, die Bibliothek zu bearbeiten
-- ============================================================

-- Eingeloggte Benutzer dürfen neue Peptide einfügen
create policy "authenticated_insert"
  on public.peptide_library
  for insert
  to authenticated
  with check (true);

-- Eingeloggte Benutzer dürfen bestehende Peptide aktualisieren
create policy "authenticated_update"
  on public.peptide_library
  for update
  to authenticated
  using (true)
  with check (true);
