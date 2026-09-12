import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'
import type { DosageFormKey, StackCategory } from '../types'

// Der Vertrag des Substanzkatalogs.
//
// Die Quelldatei ist Daten, kein Code — und Daten werden durch Abschreiben
// falsch, nicht durch Denkfehler. Ein Alias, der zweimal vorkommt, macht die
// Suche mehrdeutig; ein PK-Profilname mit Tippfehler laesst die Verknuepfung
// ins Leere laufen, ohne dass irgendwo etwas kaputtgeht. Diese Faelle faengt
// kein Typ ab, nur ein Test.
//
// Der Lueckentest am Ende ist der wichtigste: er sagt, welche
// Darreichungsform noch keine einzige Substanz hat.

interface SubstanceSeed {
  name: string
  aliases: string[]
  category: StackCategory
  dosageForms: DosageFormKey[]
  units: string[]
  pkProfile: string | null
}

const quelle = await import(
  pathToFileURL(resolve('scripts/substance-catalog-source.mjs')).href
) as { SUBSTANCE_CATALOG: SubstanceSeed[] }
const KATALOG = quelle.SUBSTANCE_CATALOG

const KATEGORIEN: StackCategory[] = ['peptide', 'medication', 'hormone', 'supplement', 'vitamin']
const FORMSCHLUESSEL = new Set(DOSAGE_FORMS.map(form => form.key))

function pkProfilNamen(): Set<string> {
  const text = readFileSync(resolve('scripts/seed-pk-profiles.ts'), 'utf8')
  const namen = new Set<string>()
  for (const treffer of text.matchAll(/\bname: '([^']+)'/g)) namen.add(treffer[1].toLowerCase())
  for (const treffer of text.matchAll(/\baliases: \[([^\]]*)\]/g)) {
    for (const alias of treffer[1].matchAll(/'([^']+)'/g)) namen.add(alias[1].toLowerCase())
  }
  return namen
}

describe('Substanzkatalog (Quelldatei)', () => {
  it('haelt jeden Namen und jeden Alias genau einmal — auch ueber Eintraege hinweg', () => {
    // Der Unique-Index in Postgres prueft dasselbe fuer den Namen. Die Aliase
    // pruefte bisher niemand, und ein doppelter macht die Suche mehrdeutig.
    const gesehen = new Map<string, string>()
    for (const eintrag of KATALOG) {
      for (const bezeichnung of [eintrag.name, ...eintrag.aliases]) {
        const schluessel = bezeichnung.trim().toLowerCase()
        expect(schluessel.length, `${eintrag.name}: leere Bezeichnung`).toBeGreaterThan(0)
        const schon = gesehen.get(schluessel)
        expect(schon, `„${bezeichnung}" steht bei ${schon} und bei ${eintrag.name}`).toBeUndefined()
        gesehen.set(schluessel, eintrag.name)
      }
    }
  })

  it('gibt jedem Eintrag eine gueltige Kategorie', () => {
    for (const eintrag of KATALOG) {
      expect(KATEGORIEN, eintrag.name).toContain(eintrag.category)
    }
  })

  it('nennt nur Darreichungsformen, die es gibt — und keinen Eintrag ohne', () => {
    for (const eintrag of KATALOG) {
      expect(eintrag.dosageForms.length, `${eintrag.name}: keine Form`).toBeGreaterThan(0)
      for (const form of eintrag.dosageForms) {
        expect(FORMSCHLUESSEL.has(form), `${eintrag.name}: „${form}"`).toBe(true)
      }
      expect(new Set(eintrag.dosageForms).size, `${eintrag.name}: Form doppelt`)
        .toBe(eintrag.dosageForms.length)
    }
  })

  it('nennt nur Einheiten, die zu einer der genannten Formen passen', () => {
    // „g" bei einem Vial waere kein Tippfehler, den man sieht — die Form
    // bietet die Einheit gar nicht an, und der Vorschlag liefe ins Leere.
    for (const eintrag of KATALOG) {
      expect(eintrag.units.length, `${eintrag.name}: keine Einheit`).toBeGreaterThan(0)
      const erlaubt = new Set(
        eintrag.dosageForms.flatMap(form => getDosageForm(form).suggestedUnits),
      )
      for (const einheit of eintrag.units) {
        expect(erlaubt.has(einheit), `${eintrag.name}: „${einheit}" passt zu keiner seiner Formen`)
          .toBe(true)
      }
    }
  })

  it('verweist nur auf PK-Profile, die es wirklich gibt', () => {
    // Ein Tippfehler hier bricht nichts — die Unterabfrage findet einfach
    // nichts, und die Substanz hat still kein PK-Profil mehr.
    const profile = pkProfilNamen()
    for (const eintrag of KATALOG) {
      if (eintrag.pkProfile === null) continue
      expect(profile.has(eintrag.pkProfile.toLowerCase()), `${eintrag.name} → „${eintrag.pkProfile}"`)
        .toBe(true)
    }
  })

  it('fuehrt zu jedem eingedeutschten Namen die englische Schreibweise als Alias', () => {
    // Der Fall, an dem es schon einmal scheiterte: der Katalog schrieb
    // „Semaglutid", das PK-Profil „Semaglutide" — ohne Alias finden sich die
    // beiden nie, und die Suche nach dem englischen Namen geht ins Leere.
    for (const eintrag of KATALOG) {
      if (eintrag.pkProfile === null) continue
      if (eintrag.pkProfile.toLowerCase() === eintrag.name.toLowerCase()) continue
      const aliase = eintrag.aliases.map(alias => alias.toLowerCase())
      expect(aliase, `${eintrag.name}: „${eintrag.pkProfile}" fehlt als Alias`)
        .toContain(eintrag.pkProfile.toLowerCase())
    }
  })

  it('deckt jede Darreichungsform mit mindestens einer Substanz ab', () => {
    // Die Lueckenanzeige. Schlaegt sie fehl, nennt sie die Form, fuer die
    // niemand etwas anlegen kann, ohne den Namen selbst zu tippen.
    // 'other' ist ausgenommen: das ist der Auffangkorb fuer alles, was die
    // Liste nicht kennt, kein Produkt, das jemand kauft.
    const belegt = new Set(KATALOG.flatMap(eintrag => eintrag.dosageForms))
    const fehlend = DOSAGE_FORMS
      .map(form => form.key)
      .filter(key => key !== 'other' && !belegt.has(key))

    expect(fehlend, `Formen ohne Substanz: ${fehlend.join(', ')}`).toEqual([])
  })

  it('erntet jedes PK-Profil, das die App kennt', () => {
    // Der Befund, mit dem diese Welle anfing: 44 Profile in der Datenbank,
    // rund 30 davon ohne Katalogeintrag. Die App kannte ihre Pharmakokinetik,
    // aber man konnte sie nicht auswaehlen.
    const verknuepft = new Set(
      KATALOG.map(eintrag => eintrag.pkProfile?.toLowerCase()).filter(Boolean),
    )
    const text = readFileSync(resolve('scripts/seed-pk-profiles.ts'), 'utf8')
    const profilNamen = [...text.matchAll(/\bname: '([^']+)'/g)].map(treffer => treffer[1])
    const ohneEintrag = profilNamen.filter(name => !verknuepft.has(name.toLowerCase()))

    expect(ohneEintrag, `PK-Profile ohne Substanz: ${ohneEintrag.join(', ')}`).toEqual([])
  })
})
