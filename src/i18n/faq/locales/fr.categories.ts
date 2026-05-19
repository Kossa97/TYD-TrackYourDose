import type { FaqCategory } from '../types'

/** FAQ en français */
export const frCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Premiers pas et navigation',
    items: [
      {
        q: 'Qu’est-ce que Peptid Tracker ?',
        a: 'Peptid Tracker est une application personnelle à des fins de recherche. Vous pouvez gérer vos peptides, planifier des cycles de prise, enregistrer les doses, calculer le dosage, noter les effets dans le journal et rédiger des avis — le tout au même endroit.',
      },
      {
        q: 'Comment passer d’une section à l’autre ?',
        a: 'En bas de l’écran, une navigation comporte 5 icônes : Stock, Peptides, Accueil (au centre), Calendrier et Profil. Toutes les autres zones sont accessibles depuis l’écran d’accueil au milieu.',
      },
      {
        q: 'Qu’est-ce que l’écran d’accueil ?',
        a: [
          'L’écran d’accueil (bouton central de la navigation) est votre hub :',
          '• En haut : 3 statistiques rapides — Cycles actifs, Flacons en stock, Mes peptides',
          '• En dessous : des tuiles pour les 8 zones de l’application',
          '• Appuyez sur une tuile pour y accéder directement',
        ],
      },
      {
        q: 'Quelles sont toutes les zones de l’application ?',
        a: [
          '📅 Calendrier – journal quotidien, confirmer les doses et vue d’ensemble des cycles',
          '📦 Stock – inventaire de matière première, stocker et gérer les flacons',
          '🧪 Peptides – peptides reconstitués et création de cycles',
          '🧮 Calculateur – calculateur de dose avec échelle de seringue',
          '📓 Journal – noter effets et effets indésirables',
          '⭐ Avis – comptes rendus d’expérience pour chaque peptide',
          '👤 Profil – données du compte, profil public et lien de partage',
          '❓ FAQ – cette page d’aide',
        ],
      },
      {
        q: 'Comment me déconnecter ?',
        a: 'Allez dans « Profil » et appuyez sur le bouton rouge « Se déconnecter » en haut à droite.',
      },
      {
        q: 'Mes données sont-elles stockées en toute sécurité ?',
        a: 'Oui. Toutes les données sont stockées dans une base Supabase. Chaque utilisateur ne voit que ses propres données — cela est imposé par la Row Level Security (RLS). Les fichiers de lot (PDF/images) sont dans un bucket de stockage séparé et ne sont accessibles qu’à vous.',
      },
      {
        q: 'Puis-je installer l’application sur mon téléphone ?',
        a: [
          'Oui ! Peptid Tracker est une PWA (Progressive Web App) :',
          'iPhone/Safari : icône Partager → « Sur l’écran d’accueil » → « Ajouter »',
          'Android/Chrome : trois points → « Installer l’application » ou « Ajouter à l’écran d’accueil »',
          'L’application s’exécute alors sans la barre du navigateur et ressemble à une app native.',
        ],
      },
      {
        q: 'Par où commencer ?',
        a: [
          'Ordre suggéré :',
          '1. « Peptides » → « + Nouveau » → créer un peptide (nom, principe actif, reconstitution, stock)',
          '2. « Ajouter un cycle » directement sur la carte du peptide',
          '3. Utiliser le « Calculateur » pour calculer unités et concentration',
          '4. Ouvrir le « Calendrier » – le cycle apparaît avec un fond violet',
          '5. Appuyer sur un jour de cycle → enregistrer la dose et confirmer',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Calendrier et journal',
    items: [
      {
        q: 'Que montre le calendrier ?',
        a: [
          'Le calendrier offre une vue d’ensemble rapide :',
          '🟣 Fond violet = cycle actif prévu ce jour-là',
          '🔵 Point bleu = une dose a été enregistrée ce jour-là',
          '🔵 Anneau ciel = aujourd’hui',
          '🟠 Icône flèche orange = une augmentation de dose est active ce jour-là',
        ],
      },
      {
        q: 'Comment enregistrer une dose ?',
        a: [
          '1. Appuyez sur un jour dans le calendrier',
          '2. Les cycles actifs apparaissent sous forme de cartes dans le panneau du jour en dessous',
          '3. Appuyez sur un cycle → le formulaire d’enregistrement s’ouvre prérempli',
          '4. Ajustez dose, méthode ou heure si besoin',
          '5. Appuyez sur « Enregistrer »',
        ],
      },
      {
        q: 'Qu’est-ce que la confirmation de dose ?',
        a: [
          'Après l’enregistrement, vous pouvez confirmer chaque dose :',
          '✅ « Pris » – l’entrée est marquée en vert',
          '❌ « Non pris » – l’entrée est marquée en rouge et des options de report apparaissent',
          'Tant que vous n’avez pas confirmé, les deux boutons restent visibles sur la carte.',
        ],
      },
      {
        q: 'Qu’est-ce que le report (snooze) ?',
        a: [
          'Si vous appuyez sur « Non pris », des boutons de report apparaissent :',
          '⏰ 15 min – rappel dans 15 minutes',
          '⏰ 30 min – rappel dans 30 minutes',
          '⏰ 1 h – rappel dans 1 heure',
          '⏰ 2 h – rappel dans 2 heures',
          'À l’échéance, une notification affiche le peptide et la dose.',
        ],
      },
      {
        q: 'Que signifie la flèche orange dans le calendrier ?',
        a: 'La flèche orange (📈 augmentation active) indique qu’une augmentation de dose de votre cycle s’applique ce jour-là. La dose affichée dans le panneau du jour est déjà la dose totale augmentée.',
      },
      {
        q: 'Comment changer de mois ?',
        a: 'Appuyez sur les flèches à gauche et à droite du nom du mois.',
      },
      {
        q: 'Puis-je supprimer une dose enregistrée ?',
        a: 'Oui. Dans le panneau du jour, un bouton ✕ se trouve à droite de chaque entrée → appuyez dessus et confirmez.',
      },
      {
        q: 'Pourquoi n’y a-t-il pas de fond violet alors que j’ai un cycle ?',
        a: [
          'Raisons possibles :',
          '• Cycle « Inactif » → dans Peptides → cycle → activer l’interrupteur',
          '• Mauvais mois affiché → naviguer jusqu’au mois de début du cycle',
          '• Les dates de début/fin excluent ce mois',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Peptides et stock',
    items: [
      {
        q: 'Comment créer un nouveau peptide ?',
        a: [
          '1. Appuyez sur « + Nouveau » en haut à droite',
          '2. Saisissez un nom ou choisissez dans « Connus »',
          '3. Renseignez principe actif et reconstitution (mg/flacon, liquide, seringue)',
          '4. Indiquez stock, infos de lot et dosage',
          '5. Optionnel : téléversez un PDF ou une image du document d’analyse',
          '6. Appuyez sur « Enregistrer »',
        ],
      },
      {
        q: 'Que montre le flacon animé sur la carte du peptide ?',
        a: [
          'Si vous avez renseigné le stock, un flacon animé apparaît à gauche de la carte :',
          '🟢 Vert = plus de 50 % de stock restant',
          '🟡 Jaune = 25–50 % de stock',
          '🔴 Rouge = moins de 25 % – bientôt épuisé',
          'Le liquide est animé. Sur téléphone, le flacon s’incline avec l’orientation de l’appareil.',
        ],
      },
      {
        q: 'À quoi sert le bouton info (icône note) sur la carte du peptide ?',
        a: [
          'L’icône note (📄) ouvre une fiche avec toutes les données enregistrées :',
          '• Dose et voie d’administration',
          '• Principe actif, volume de liquide, seringue',
          '• Date de reconstitution et expiration avec compte à rebours',
          '• Stock et barre de progression',
          '• Numéro de lot et source',
          '• Document d’analyse : images en ligne, PDF en lien',
          '• Notes',
        ],
      },
      {
        q: 'Qu’est-ce que la gestion du stock ?',
        a: [
          'Vous pouvez indiquer combien de flacons vous possédez :',
          '• « Flacons en main » = stock actuel',
          '• À la première sauvegarde, cette valeur sert de référence à 100 %',
          '• La barre de progression sur la carte montre la consommation en couleur',
          '• L’expiration est calculée à partir de la date de reconstitution + durée de conservation',
        ],
      },
      {
        q: 'Qu’est-ce que l’information de lot ?',
        a: [
          'Les informations de lot documentent l’origine de votre peptide :',
          '• Numéro de lot = identifiant du fabricant',
          '• Source = fabricant ou fournisseur (ex. « Peptide Sciences »)',
          '• Document d’analyse = téléverser PDF ou image (COA, rapport de labo, facture)',
          'Cela apparaît aussi dans la fiche info du peptide.',
        ],
      },
      {
        q: 'Que signifie « Liquide ajouté (mL) » ?',
        a: 'C’est la quantité d’eau (ex. eau BAC, NaCl ou eau stérile pour injection) ajoutée au flacon. Plus de liquide = concentration plus faible. Valeurs typiques : 1–2 mL.',
      },
      {
        q: 'Que signifient les champs seringue « mL » et « unités » ?',
        a: [
          'Ces deux champs décrivent votre seringue :',
          '• mL = volume total de la seringue (ex. 1 mL)',
          '• Unités = graduations maximales (ex. 100 sur une seringue U-100)',
          '→ D’où : unités/mL = graduations par millilitre',
          'Seringue insuline U-100 standard : 1 mL / 100 unités = 100 unités/mL',
        ],
      },
      {
        q: 'Qu’est-ce que la durée de conservation après reconstitution ?',
        a: [
          'Après dissolution, le peptide n’est stable qu’un temps limité (au réfrigérateur) :',
          '10–14 jours = peptides à courte durée',
          '21–28 jours = typique pour les peptides reconstitués',
          '42–90 jours = peptides particulièrement stables',
          'L’expiration est calculée à partir de la date de reconstitution + jours choisis et affichée en couleur.',
        ],
      },
      {
        q: 'Comment ajouter un cycle depuis la carte du peptide ?',
        a: 'Chaque carte de peptide a un bouton violet « Ajouter un cycle » en bas à droite. Appuyez dessus — pas besoin d’ouvrir le peptide d’abord.',
      },
      {
        q: 'Que montre la flèche avec le nombre de cycles en bas ?',
        a: 'La petite flèche en bas à gauche (ex. « ▼ 2 cycles ») développe ou réduit la vue des cycles. Vous voyez d’un coup d’œil combien de cycles existent pour ce peptide.',
      },
      {
        q: 'Comment rechercher un peptide ?',
        a: 'Dès qu’il y a des peptides, un champ de recherche apparaît en haut. Saisissez un nom — la liste se filtre automatiquement. Utilisez le menu déroulant à côté pour trier A→Z ou Z→A.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Calculateur',
    items: [
      {
        q: 'Que peut faire le calculateur ?',
        a: [
          'À partir de vos saisies, le calculateur détermine :',
          '• Unités à prélever – combien de graduations sur la seringue',
          '• Concentration – mg/mL de la solution finie',
          '• Remplissage de la seringue – quel pourcentage de la seringue vous prélevez',
          '• Doses par flacon – combien d’injections par flacon',
        ],
      },
      {
        q: 'Qu’est-ce que l’échelle de seringue ?',
        a: [
          'L’échelle colorée en haut montre visuellement combien d’unités prélever :',
          '• La barre se remplit de gauche (bleu) à droite (violet → rose)',
          '• La ligne blanche marque le point exact',
          '• Le grand chiffre au-dessus indique les unités',
          'Vous voyez tout de suite si votre dose tient dans la seringue.',
        ],
      },
      {
        q: 'Quelles entrées le calculateur nécessite-t-il ?',
        a: [
          '• Taille de seringue – choisir un préréglage (ex. 1 mL / 100 unités) ou saisir des valeurs personnalisées',
          '• Actif par flacon – mg sur le flacon (ex. 10 mg)',
          '• Liquide ajouté – combien de mL ajoutés (ex. 2 mL)',
          '• Dose – dose cible avec unité (mcg, mg, UI)',
        ],
      },
      {
        q: 'Quels préréglages de seringue existent ?',
        a: [
          '• 1 mL · 100 unités (U-100) – seringue insuline standard',
          '• 0,5 mL · 50 unités (U-100) – petite seringue insuline',
          '• 0,3 mL · 30 unités (U-100) – très petite seringue',
          '• 2 mL · 200 unités (U-100) – seringue plus grande',
          '• 1 mL · 40 unités (U-40) – ancienne seringue U-40',
          'Ou : saisir mL et unités personnalisés.',
        ],
      },
      {
        q: 'Exemple – comment fonctionne le calcul ?',
        a: [
          'Exemple : BPC-157, flacon 5 mg, 2 mL d’eau, dose 500 mcg, seringue U-100',
          '→ Concentration : 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volume : 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Unités : 0,200 mL × 100 unités/mL = 20 unités',
          '→ Doses/flacon : 5000 mcg ÷ 500 mcg = 10 doses',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Cycles',
    items: [
      {
        q: 'Qu’est-ce qu’un cycle ?',
        a: 'Un cycle est un plan de prise structuré pour un peptide. Il définit dose, méthode, fréquence, plage horaire, heure de prise optionnelle et rappels.',
      },
      {
        q: 'Comment créer un cycle ?',
        a: [
          '1. Sur la carte du peptide, appuyez sur « + Ajouter un cycle » (bouton violet)',
          '2. Renseignez nom, dose, fréquence et dates',
          '3. Optionnel : heure de prise et rappels',
          '4. Appuyez sur « Enregistrer »',
          'Le cycle apparaît automatiquement dans le calendrier !',
        ],
      },
      {
        q: 'Quelles options de fréquence existent ?',
        a: [
          '• Quotidien · Deux fois par jour · Un jour sur deux',
          '• 5 jours on / 2 off (5on/2off)',
          '• Lun–Ven · Hebdomadaire',
          '• Tous les X jours – intervalle personnalisé',
          '• Choisir les jours – ex. seulement lun, mer, ven',
        ],
      },
      {
        q: 'Que signifie l’interrupteur Actif/Inactif ?',
        a: 'Actif = le cycle apparaît dans le calendrier (jours violets). Inactif = cycle en pause, invisible dans le calendrier. Basculez en appuyant sur l’interrupteur à droite du cycle.',
      },
      {
        q: 'Qu’est-ce que l’heure de prise ?',
        a: [
          'Optionnel – définit le moment de la journée :',
          '🌅 Matin = 08:00 · ☀️ Midi = 12:00 · 🌙 Soir = 20:00 · 🕐 Heure personnalisée',
          'Utilisé pour les rappels. C’est optionnel — vous pouvez laisser vide.',
        ],
      },
      {
        q: 'Comment fonctionnent les rappels ?',
        a: [
          'Les rappels sont à sélection multiple — vous pouvez en choisir plusieurs :',
          '• 1 jour avant – rappel 24 h avant la prise',
          '• 2 h avant – 2 heures d’avance',
          '• À la prise – exactement à l’heure définie',
          'L’application demande l’autorisation de notification à l’enregistrement.',
          'Important : ne fonctionne que tant que l’application est ouverte.',
        ],
      },
      {
        q: 'Puis-je avoir plusieurs cycles pour un même peptide ?',
        a: 'Oui, autant que vous voulez. Tous les cycles actifs apparaissent dans le calendrier. Utile par ex. pour matin + soir ou différentes phases de dosage.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Augmentations de dose',
    items: [
      {
        q: 'Qu’est-ce qu’une augmentation de dose ?',
        a: 'Une hausse planifiée de la dose dans un cycle. Exemple : commencer à 200 mcg, après 2 semaines +100 mcg, après 4 semaines encore +100 mcg. Plusieurs paliers sont possibles.',
      },
      {
        q: 'Comment ajouter une augmentation de dose ?',
        a: [
          '1. Développer le peptide → trouver le cycle → section « Augmentations de dose »',
          '2. Appuyer sur « + Ajouter »',
          '3. Saisir montant et unité de l’augmentation',
          '4. Choisir le début : date fixe / après X jours / après X semaines',
          '5. Optionnel : note → Enregistrer',
        ],
      },
      {
        q: 'L’augmentation est-elle visible dans le calendrier ?',
        a: [
          'Oui ! Dès qu’une augmentation s’applique :',
          '• 📈 orange dans le panneau du jour indique « Palier X actif »',
          '• La dose affichée est déjà le total augmenté (base + augmentation)',
          '• L’icône d’augmentation apparaît dans la légende du calendrier',
        ],
      },
      {
        q: 'Que signifient les options de début ?',
        a: [
          '• Date fixe – à partir de quel jour l’augmentation s’applique',
          '• Après X jours – X jours après le début du cycle',
          '• Après X semaines – équivalent en jours après le début du cycle',
        ],
      },
      {
        q: 'Puis-je avoir plusieurs paliers ?',
        a: 'Oui, autant que vous voulez. Ils sont numérotés #1, #2, #3. Tous les paliers actifs s’additionnent.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Journal',
    items: [
      {
        q: 'Qu’est-ce que le journal ?',
        a: 'Ici vous documentez les effets et effets indésirables de vos peptides. Cela aide à repérer des schémas — quels effets apparaissent quand, avec quelle intensité et pendant combien de temps.',
      },
      {
        q: 'Quelle est la différence entre effet et effet indésirable ?',
        a: [
          '✅ Effet (vert) = résultat souhaité (sommeil, guérison, énergie…)',
          '⚠️ Effet indésirable (orange) = résultat non souhaité (douleur, fatigue…)',
        ],
      },
      {
        q: 'Que signifient les options de statut ?',
        a: [
          '🔘 En attente – pas encore survenu',
          '✅ Survenu – présent activement',
          '⏳ Toujours en cours – se poursuit',
          '✅ Estompé – terminé',
          'Changez le statut directement sur la carte sans ouvrir le formulaire.',
        ],
      },
      {
        q: 'Qu’est-ce que l’échelle d’intensité (1–5) ?',
        a: [
          '1 = À peine perceptible · 2 = Léger · 3 = Modéré · 4 = Fort · 5 = Très fort',
        ],
      },
      {
        q: 'Comment filtrer et rechercher dans le journal ?',
        a: [
          '• Onglets : Tout / Effets / Effets indésirables',
          '• Recherche : filtre par description et nom de peptide',
          '• Tri : date (récent/ancien), intensité (fort/faible)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Avis',
    items: [
      {
        q: 'Que sont les avis ?',
        a: 'Comptes rendus personnels d’expérience pour chaque peptide. Avec étoiles (1–5), expérience globale (bon/moyen/mauvais), avantages et inconvénients, et texte détaillé.',
      },
      {
        q: 'Comment créer un avis ?',
        a: [
          '1. Dans « Avis », appuyez sur « + Nouveau »',
          '2. Choisir le peptide → attribuer les étoiles → choisir l’expérience',
          '3. Saisir le titre (obligatoire) → rapport, avantages, inconvénients optionnels',
          '4. Enregistrer',
        ],
      },
      {
        q: 'Comment rechercher et trier les avis ?',
        a: [
          '• Recherche : titre et nom du peptide',
          '• Tri : plus récent / plus ancien / note haute / note basse',
        ],
      },
      {
        q: 'Puis-je partager les avis sur mon profil ?',
        a: 'Oui. Dans « Profil », activez l’interrupteur « Avis » — ils apparaissent alors sur votre lien de profil public.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profil et partage',
    items: [
      {
        q: 'Que puis-je renseigner dans mon profil ?',
        a: [
          '• Nom d’utilisateur (pour le lien de partage) – obligatoire',
          '• Nom affiché, âge, sexe, poids, taille',
          '• Notes personnelles (uniquement pour vous)',
          '• Bio publique (affichée sur le profil partagé)',
        ],
      },
      {
        q: 'Comment activer le profil public ?',
        a: [
          '1. Saisir le nom d’utilisateur et enregistrer le profil',
          '2. Activer l’interrupteur principal « Partager le profil »',
          '3. Activer les zones individuelles (Peptides / Calendrier / Journal / Avis)',
          '4. Enregistrer → le lien apparaît et peut être copié',
        ],
      },
      {
        q: 'Quel contenu puis-je partager ?',
        a: [
          'Chaque zone a son propre interrupteur :',
          '🧪 Peptides · 📅 Calendrier et cycles · 📖 Journal · ⭐ Avis',
          'Vous pouvez par ex. ne partager que les avis et garder le reste privé.',
        ],
      },
      {
        q: 'Puis-je désactiver le partage à tout moment ?',
        a: 'Oui. Désactivez « Partager le profil » → enregistrez. Le lien affiche immédiatement « Ce profil est privé ».',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Rappels et report',
    items: [
      {
        q: 'Comment configurer les rappels ?',
        a: [
          '1. Créer ou modifier un cycle',
          '2. Définir l’heure de prise (matin/midi/soir/personnalisée)',
          '3. Sous « Rappel », choisir une ou plusieurs options (sélection multiple)',
          '4. Enregistrer → l’app demande l’autorisation de notification',
        ],
      },
      {
        q: 'Puis-je choisir plusieurs heures de rappel ?',
        a: 'Oui. Vous pouvez par ex. activer « 1 jour avant » et « À la prise » en même temps. Des coches indiquent les options actives.',
      },
      {
        q: 'Quelle est la différence entre rappel et report ?',
        a: [
          'Rappel (dans le cycle) = notification planifiée avant la prise',
          'Report (dans le calendrier) = rappel de suivi après avoir marqué une dose « Non pris » (15 min / 30 min / 1 h / 2 h)',
        ],
      },
      {
        q: 'Pourquoi je ne reçois pas de rappels ?',
        a: [
          '• Autorisation de notification refusée → activer dans les réglages du téléphone',
          '• L’application n’était pas ouverte à l’heure du rappel',
          '• L’heure de rappel pour aujourd’hui est déjà passée',
          '• Le cycle est « Inactif »',
        ],
      },
      {
        q: 'Les rappels fonctionnent-ils quand l’app est fermée ?',
        a: 'Pas pour l’instant. Les notifications passent par le navigateur et nécessitent une application ouverte (onglet ou PWA). La livraison en arrière-plan nécessiterait un service push.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Technique et confidentialité',
    items: [
      {
        q: 'Pourquoi vois-je « Erreur lors de l’enregistrement » ?',
        a: [
          '• Pas de connexion Internet',
          '• Champs obligatoires manquants',
          '• Session expirée → se déconnecter et se reconnecter',
          '• Téléversement PDF : bucket de stockage pas encore configuré → exécuter le SQL dans Supabase',
        ],
      },
      {
        q: 'Pourquoi ne puis-je pas téléverser un PDF ?',
        a: [
          'Le bucket de stockage « batch-files » doit être configuré une fois dans Supabase :',
          '1. supabase.com → votre projet → SQL Editor → nouvel onglet',
          '2. Coller et exécuter le SQL de « supabase-inventory.sql »',
          'Les téléversements fonctionnent immédiatement après.',
        ],
      },
      {
        q: 'Qu’advient-il de mes données si je me déconnecte ?',
        a: 'Vos données restent sur le serveur. Après la prochaine connexion, toutes les entrées sont toujours là.',
      },
      {
        q: 'Les données sont-elles supprimées si je désinstalle l’app ?',
        a: 'Non. Les données sont sur le serveur (Supabase) — indépendamment de l’appareil. Reconnectez-vous simplement sur n’importe quel appareil.',
      },
      {
        q: 'L’application convient-elle à un usage médical ?',
        a: 'Non. Uniquement pour la recherche et la documentation. Ne remplace pas un avis médical. Consultez toujours un médecin.',
      },
      {
        q: 'Puis-je utiliser l’app sur une tablette ou un second appareil ?',
        a: [
          'Oui. Comme tout est dans le cloud, l’app fonctionne sur autant d’appareils que vous voulez :',
          '1. Ouvrir la même URL dans le navigateur',
          '2. Se connecter avec le même compte',
          '3. Toutes les données sont disponibles immédiatement',
          'Pour l’accès au code (développement) : cloner le dépôt sur GitHub.',
        ],
      },
    ],
  },
]
