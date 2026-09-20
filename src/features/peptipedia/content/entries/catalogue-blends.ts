import type { PeptipediaCopy, PeptipediaEntry, PeptipediaSource, PeptideCategory } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

interface BlendDefinition {
  slug: string
  name: string
  category: PeptideCategory
  components: NonNullable<PeptipediaEntry['blend']>['components']
  url: string
  de: string
  en: string
}

const catalogueBase = 'https://peptidedosages.com/peptide-blend-dosages/'
const definitions: BlendDefinition[] = [
  { slug: 'aod-cjc-ipamorelin', name: 'AOD-9604 + CJC-1295 + Ipamorelin', category: 'wachstumshormon',
    components: [{ name: 'AOD-9604', slug: 'aod-9604' }, { name: 'CJC-1295' }, { name: 'Ipamorelin', slug: 'ipamorelin' }],
    url: `${catalogueBase}aod-9604-cjc-1295-ipamorelin-12-mg-blend-dosage-protocol/`,
    de: 'Dreifachmischung aus dem Referenzkatalog. Die CJC-Variante ist in der Produktbezeichnung nicht eindeutig spezifiziert.',
    en: 'Three-component mixture from the reference catalogue. The product name does not unambiguously specify the CJC variant.',
  },
  { slug: 'bpc-157-tb-500', name: 'BPC-157 + TB-500', category: 'heilung',
    components: [{ name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }],
    url: `${catalogueBase}bpc-157-tb-500-10mg-blend-dosage-protocol/`,
    de: 'Katalogmischung zweier Forschungspeptide. Unterschiedliche Vial-Stärken sind hier zu einem Profil zusammengefasst.',
    en: 'Catalogue mixture of two research peptides. Different vial strengths are grouped into one profile here.',
  },
  { slug: 'cagrilintide-semaglutide', name: 'Cagrilintide + Semaglutide', category: 'stoffwechsel',
    components: [{ name: 'Cagrilintide', slug: 'cagrilintide' }, { name: 'Semaglutide', slug: 'semaglutid' }],
    url: `${catalogueBase}cagrilintide-semaglutide-10-mg-blend-dosage-protocol/`,
    de: 'Diese Wirkstoffkombination wird klinisch untersucht. Ein beliebiges Katalog-Blend ist nicht automatisch das untersuchte CagriSema-Präparat.',
    en: 'This drug combination is being studied clinically. An arbitrary catalogue blend is not automatically the CagriSema trial product.',
  },
  { slug: 'cjc-ghrp-2', name: 'CJC-1295 + GHRP-2', category: 'wachstumshormon',
    components: [{ name: 'CJC-1295' }, { name: 'GHRP-2', slug: 'ghrp-2' }],
    url: `${catalogueBase}cjc-1295-ghrp-2-10mg-blend-dosage-protocol/`,
    de: 'Katalogmischung aus CJC-1295 und GHRP-2. Ohne eindeutige Produktangabe wird CJC hier keiner DAC-Variante zugeordnet.',
    en: 'Catalogue mixture of CJC-1295 and GHRP-2. Without explicit product identification, no DAC variant is assigned to CJC here.',
  },
  { slug: 'cjc-no-dac-ipamorelin', name: 'CJC-1295 NO DAC + Ipamorelin', category: 'wachstumshormon',
    components: [{ name: 'CJC-1295 NO DAC', slug: 'cjc-1295-no-dac' }, { name: 'Ipamorelin', slug: 'ipamorelin' }],
    url: `${catalogueBase}cjc-1295-no-dac-ipamorelin-10-mg-blend-dosage-protocol/`,
    de: 'Diese Katalogmischung nennt ausdrücklich CJC ohne DAC. Sie ist von Kombinationen mit der DAC-Form zu unterscheiden.',
    en: 'This catalogue mixture explicitly names CJC without DAC. It is distinct from combinations containing the DAC form.',
  },
  { slug: 'glow', name: 'GLOW', category: 'heilung',
    components: [{ name: 'GHK-Cu', slug: 'ghk-cu' }, { name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }],
    url: `${catalogueBase}glow-peptide-blend-70-mg-vial-dosage-protocol/`,
    de: 'GLOW ist ein Blend-Handelsname. Der Referenzkatalog nennt GHK-Cu, BPC-157 und TB-500 als Bestandteile.',
    en: 'GLOW is a blend trade name. The reference catalogue lists GHK-Cu, BPC-157 and TB-500 as its components.',
  },
  { slug: 'klow', name: 'KLOW', category: 'heilung',
    components: [{ name: 'GHK-Cu', slug: 'ghk-cu' }, { name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }, { name: 'KPV', slug: 'kpv' }],
    url: `${catalogueBase}klow-80-mg-vial-dosage-protocol/`,
    de: 'KLOW bezeichnet im Referenzkatalog eine Mischung aus GHK-Cu, BPC-157, TB-500 und KPV.',
    en: 'In the reference catalogue, KLOW denotes a mixture of GHK-Cu, BPC-157, TB-500 and KPV.',
  },
  { slug: 'neuroxelin', name: 'Neuroxelin', category: 'nootropikum',
    components: [{ name: 'PE-22-28', slug: 'pe-22-28' }, { name: 'Pinealon', slug: 'pinealon' }, { name: 'N-acetyl Semax' }, { name: 'N-acetyl Selank' }],
    url: 'https://peptidedosages.com/neuroxelin-blend/',
    de: 'Neuroxelin ist ein nicht standardisierter Blend-Name. Die erfasste Beschreibung nennt zwei Peptide und zwei N-acetylierte Varianten; diese Varianten sind nicht mit normalem Semax oder Selank gleichzusetzen.',
    en: 'Neuroxelin is a non-standardized blend name. The captured description names two peptides and two N-acetylated variants; those variants are not equivalent to unmodified Semax or Selank.',
  },
  { slug: 'tesamorelin-ipamorelin', name: 'Tesamorelin + Ipamorelin', category: 'wachstumshormon',
    components: [{ name: 'Tesamorelin', slug: 'tesamorelin' }, { name: 'Ipamorelin', slug: 'ipamorelin' }],
    url: `${catalogueBase}tesamorelin-5-mg-ipamorelin-5-mg-10-mg-blend-dosage-protocol/`,
    de: 'Katalogmischung aus Tesamorelin und Ipamorelin. Eine Zulassung eines Tesamorelin-Arzneimittels ist keine Zulassung dieses Blends.',
    en: 'Catalogue mixture of tesamorelin and ipamorelin. Approval of a tesamorelin medicine does not approve this blend.',
  },
  { slug: 'tri-heal', name: 'Tri-Heal', category: 'heilung',
    components: [{ name: 'TB-500', slug: 'tb-500' }, { name: 'BPC-157', slug: 'bpc-157' }, { name: 'KPV', slug: 'kpv' }],
    url: `${catalogueBase}tri-heal-tb-500-25-mg-bpc-157-10-mg-kpv-10-mg-vial-dosage-protocol/`,
    de: 'Tri-Heal ist ein Katalogname für TB-500, BPC-157 und KPV in einer Mischung. Der Name ist kein Heilungsnachweis.',
    en: 'Tri-Heal is a catalogue name for a mixture of TB-500, BPC-157 and KPV. The name is not evidence of healing.',
  },
]

const cagriSemaSources: PeptipediaSource[] = [
  {
    id: 'pmid-40544433', kind: 'human_study', year: 2025,
    title: 'Coadministered cagrilintide and semaglutide in adults with overweight or obesity',
    publisherOrAuthors: 'Garvey WT et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40544433/', accessedAt: '2026-09-14',
  },
  {
    id: 'pmid-42251860', kind: 'human_study', year: 2026,
    title: 'CagriSema in early type 2 diabetes: REIMAGINE 1 phase 3a',
    publisherOrAuthors: 'Aroda VR et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/42251860/', accessedAt: '2026-09-14',
  },
  {
    id: 'pmid-42251859', kind: 'human_study', year: 2026,
    title: 'Cagrilintide-semaglutide (CagriSema) versus semaglutide or cagrilintide in people with type 2 diabetes (REIMAGINE 2): a double-blind, randomised, controlled, phase 3 study',
    publisherOrAuthors: 'Buse JB et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/42251859/', accessedAt: '2026-09-14',
  },
  {
    id: 'pmid-42251856', kind: 'human_study', year: 2026,
    title: 'Cagrilintide-semaglutide (CagriSema) as an add-on to basal insulin in adults with type 2 diabetes (REIMAGINE 3): a randomised, double-blind, placebo-controlled, multicentre, phase 3 study',
    publisherOrAuthors: 'Rosenstock J et al.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/42251856/', accessedAt: '2026-09-14',
  },
  {
    id: 'redefine-4-2026', kind: 'manufacturer', year: 2026,
    title: 'REDEFINE 4 headline results',
    publisherOrAuthors: 'Novo Nordisk A/S',
    url: 'https://www.novonordisk.com/news-and-media/news-and-ir-materials/news-details.html?id=916501',
    accessedAt: '2026-09-14',
  },
]

export const blendProfiles: PeptipediaEntry[] = definitions.map(definition => {
  const source: PeptipediaSource = {
    id: `catalog-${definition.slug}`,
    kind: 'catalog',
    title: `PeptideDosages: ${definition.name} composition listing`,
    publisherOrAuthors: 'Peptide Dosages',
    year: 2026,
    url: definition.url,
    accessedAt: '2026-09-14',
  }
  const isCagriSema = definition.slug === 'cagrilintide-semaglutide'
  const copy = (locale: 'de' | 'en'): PeptipediaCopy => ({
    tldr: definition[locale],
    mechanism: isCagriSema
      ? (locale === 'de' ? 'Die Kombination adressiert Amylin- und GLP-1-Signalwege. Studienergebnisse betreffen das definierte Prüfpräparat.' : 'The combination targets amylin and GLP-1 pathways. Trial findings concern the defined investigational product.')
      : (locale === 'de' ? 'Für die hier beschriebene Mischung ist in diesem Profil kein klinisch bestätigter Gesamtmechanismus hinterlegt. Die Einzelprofile erklären den jeweiligen Forschungsstand; daraus lässt sich keine Synergie ableiten.' : 'This profile records no clinically confirmed overall mechanism for the described mixture. Individual profiles explain their research context; this does not establish synergy.'),
    researchAreas: [locale === 'de' ? 'Peptid-Blends' : 'Peptide blends'],
    overviewFacts: [
      {
        id: 'catalogue-composition',
        label: locale === 'de' ? 'Katalogzusammensetzung' : 'Catalogue composition',
        value: locale === 'de'
          ? 'Der zitierte Katalog führt die in diesem Profil genannten Bestandteile gemeinsam unter diesem Blendnamen.'
          : 'The cited catalogue lists the components named in this profile together under this blend name.',
        sourceIds: [source.id],
      },
      ...(isCagriSema ? [
        {
          id: 'published-trials',
          label: locale === 'de' ? 'Publizierte Studien' : 'Published trials',
          value: locale === 'de'
            ? 'REDEFINE 1 sowie die 2026 publizierten REIMAGINE-1-, -2- und -3-Studien untersuchten definierte CagriSema-Prüfpräparate; ein Katalog-Blend ist nicht automatisch eines dieser Präparate.'
            : 'REDEFINE 1 and the 2026 REIMAGINE 1, 2 and 3 publications studied defined CagriSema trial products; a catalogue blend is not automatically one of those products.',
          sourceIds: ['pmid-40544433', 'pmid-42251860', 'pmid-42251859', 'pmid-42251856'],
        },
        {
          id: 'redefine-4-headline',
          label: locale === 'de' ? 'REDEFINE 4' : 'REDEFINE 4',
          value: locale === 'de'
            ? 'Laut Hersteller verfehlte das untersuchte CagriSema-Präparat den Nichtunterlegenheitsendpunkt gegenüber Tirzepatid.'
            : 'According to the manufacturer, the studied CagriSema product missed its non-inferiority endpoint versus tirzepatide.',
          sourceIds: ['redefine-4-2026'],
        },
      ] : []),
    ],
    researchGaps: [isCagriSema
      ? (locale === 'de' ? 'CagriSema ist weiterhin ein Studienpräparat. Langzeitsicherheit und behördliche Nutzen-Risiko-Bewertung stehen aus; die Daten validieren keine selbst gemischte Rezeptur.' : 'CagriSema remains investigational. Long-term safety and regulatory benefit–risk review remain outstanding; the data do not validate self-mixed formulations.')
      : (locale === 'de' ? 'Für dieses Mischprodukt sind hier keine vollständig ausgewerteten klinischen Wirksamkeits- und Sicherheitsdaten hinterlegt.' : 'Fully assessed clinical efficacy and safety data for this mixed product are not recorded here.')],
    sideEffects: [isCagriSema
      ? (locale === 'de' ? 'In den Studien traten vor allem gastrointestinale Nebenwirkungen auf. Es existiert noch keine zugelassene CagriSema-Fachinformation mit abschließender Sicherheitsbewertung.' : 'Trials primarily reported gastrointestinal adverse events. No approved CagriSema prescribing information with a final safety assessment is available.')
      : (locale === 'de' ? 'Die Sicherheit dieser konkreten Mischung ist nicht ausreichend untersucht; Sicherheitsdaten der Einzelbestandteile lassen sich nicht auf den Blend übertragen.' : 'The safety of this specific mixture has not been adequately studied; safety data for individual components cannot be transferred to the blend.')],
    contraindications: [locale === 'de' ? 'Gegenanzeigen der Bestandteile müssen einzeln geprüft werden. Das ersetzt keine Sicherheitsbewertung der Kombination.' : 'Component contraindications require individual assessment. This does not replace a safety assessment of the combination.'],
    interactions: [locale === 'de' ? 'Aus fehlenden Blend-Studien darf nicht auf fehlende Wechselwirkungen geschlossen werden.' : 'Missing blend studies must not be interpreted as absence of interactions.'],
    protocols: [],
  })
  return {
    slug: definition.slug, name: definition.name, fullName: null, category: definition.category,
    aliases: isCagriSema ? ['CagriSema'] : undefined,
    researchStatus: isCagriSema ? 'human_research' : 'unverified',
    identity: {
      status: 'brand_or_blend',
      description: {
        de: `Dieser Blend- oder Handelsname bezeichnet nur die vom zitierten Katalog beschriebene, produkt- und quellenabhängige Zusammensetzung; andere Produkte können abweichen. ${definition.de}`,
        en: `This blend or trade name denotes only the product- and source-specific composition described by the cited catalogue; other products may differ. ${definition.en}`,
      },
    },
    evidence: { human: isCagriSema ? 'strong' : 'none', animal: 'none', clinical: isCagriSema ? 'extensive' : 'none' },
    evidenceMatrix: isCagriSema
      ? { human: 'strong', replication: 'single_group', endpoints: 'symptom_or_function', safety: 'limited' }
      : { human: 'none', replication: 'none', endpoints: 'none', safety: 'insufficient' },
    editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
    blend: { components: definition.components, sourceIds: [source.id] },
    sources: isCagriSema ? [source, ...cagriSemaSources] : [source],
    mechanismSourceIds: isCagriSema ? ['pmid-40544433'] : [source.id],
    safetySourceIds: isCagriSema
      ? ['pmid-40544433', 'pmid-42251860', 'pmid-42251859', 'pmid-42251856']
      : [source.id],
    reviewedAt: '2026-09-14',
    contentVersion: isCagriSema ? 3 : 2,
    copy: { de: copy('de'), en: copy('en') },
  }
})
