-- Bewertungen v2, Etappe 4: oeffentliches Profil — nur freigegebene Bewertungen.
--
-- Bisher konnte ein Besucher von /u/<name> nichts lesen: `profiles` und
-- `reviews` lassen nur den Eigentuemer zu. Statt die Tabellen zu oeffnen,
-- gibt es eine einzige Funktion, die genau das herausgibt, was der Nutzer
-- freigegeben hat:
--   * nur Profile mit `is_public = true`
--   * daraus nur Anzeigename, Nutzername, oeffentliche Bio
--   * nur Bewertungen mit `is_public = true`, und von denen nur Sterne,
--     Kriterien, Texte, Substanzname und den Monat — nie Dosis, nie Zyklus,
--     nie genaues Datum, nie IDs des Nutzers
-- Alter, Geschlecht und alles andere im Profil bleibt drinnen.
--
-- Rein additiv und idempotent: keine Tabelle, keine Zeile, keine Policy
-- wird geaendert. Vorher im Container geprueft (siehe HANDOFF.md).

begin;

create or replace function public.public_profile_reviews(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profil record;
begin
  select p.id, p.username, p.display_name, p.public_bio
    into profil
    from public.profiles p
   where lower(p.username) = lower(trim(p_username))
     and p.is_public = true
   limit 1;

  -- Kein Unterschied zwischen „gibt es nicht" und „ist privat": beides null.
  if profil.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'username', profil.username,
    'display_name', profil.display_name,
    'public_bio', profil.public_bio,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id,
          'substanz', s.display_name,
          'rating', r.rating,
          'title', nullif(r.title, ''),
          'body', r.body,
          'pros', r.pros,
          'cons', r.cons,
          'wirkung', r.wirkung,
          'vertraeglichkeit', r.vertraeglichkeit,
          'wieder_nehmen', r.wieder_nehmen,
          'monat', to_char(r.created_at at time zone 'UTC', 'YYYY-MM')
        ) order by r.created_at desc)
        from public.reviews r
        join public.stack_items s on s.id = r.stack_item_id
       where r.user_id = profil.id
         and r.is_public = true
    ), '[]'::jsonb)
  );
end;
$$;

-- Aufrufbar fuer Besucher (anon) und Angemeldete — sonst niemand.
revoke all on function public.public_profile_reviews(text) from public;
grant execute on function public.public_profile_reviews(text) to anon, authenticated;

commit;
