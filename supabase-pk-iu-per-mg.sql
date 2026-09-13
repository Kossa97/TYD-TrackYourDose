-- Eine Spalte fuer die Umrechnung von IU in Milligramm.
--
-- Der Grund: eine Internationale Einheit ist keine Masse, sondern eine
-- biologische Wirkstaerke. Ein Milligramm Somatropin sind genau 3 IU, ein
-- Milligramm HCG rund 10.000 — der Faktor gehoert also zur Substanz.
--
-- Ohne ihn gab `toPkMilligrams` fuer jede in IU geplante Einnahme null zurueck,
-- `evaluatePkReadiness` meldete 'unsupported', und `BlutspiegelCarousel`
-- machte daraus ein `return null`: die Substanz verschwand wortlos aus dem
-- Blutspiegel. Betroffen waren HCG und HGH — beide mit PK-Profil, beide
-- korrekt ausgefuellt, beide unsichtbar.
--
-- Null bleibt der Normalfall: die allermeisten Substanzen werden in mg oder
-- mcg dosiert und brauchen keinen Faktor.

begin;

alter table public.pk_profiles
  add column if not exists iu_per_mg numeric
    check (iu_per_mg is null or iu_per_mg > 0);

comment on column public.pk_profiles.iu_per_mg is
  'IU je Milligramm. Null, wenn die Substanz nicht in IU dosiert wird.';

commit;
