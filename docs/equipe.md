# L'équipe de l'Agence

Une agence de communication qui tourne sur ton Mac. Tu es le patron : tu donnes les briefs, tu tranches les choix, tu valides chaque livrable. Les agents réfléchissent, cherchent, proposent. Ils ne modifient rien eux-mêmes.

## Qui fait quoi

| | Rôle | Mission | Bureau |
|---|---|---|---|
| **Evan** | Patron | Donne les briefs, choisit, valide chaque fichier, décide d'envoyer sur GitHub | Partout |
| **Claire** · `clientele` | Directrice de clientèle | Reçoit le brief, le reformule, cadre livrable, calendrier et consignes du prof. **Pilote le chat de l'agence** : elle passe le dossier aux autres | Salle du brief |
| **Max** · `planning` | Planneur stratégique | Problématique, insight, tension, cible, positionnement, plateforme de marque, stratégie, brief créatif | Bureau du planning |
| **Inès** · `etudes` | Études et insights | Recherche, veille, benchmark, personas. Sources citées, fait ou hypothèse, aucun chiffre inventé | Open space |
| **Hugo** · `redaction` | Concepteur-rédacteur | Concept, accroches, manifeste, scripts | Salle de créa |
| **Léa** · `direction-artistique` | Directrice artistique | Pistes visuelles, moodboards décrits, codes de marque | Salle de créa |
| **Sam** · `social` | Social media et influence | Plateformes, lignes éditoriales, influence, calendrier éditorial | Open space |
| **Nora** · `media` | Média planneuse | Dispositif, mix paid / owned / earned, budget, KPI | Open space |
| **Jade** · `digital` | Studio créa digital | Met la reco en forme : présentation HTML plein écran ou site internet, au niveau des grandes agences. Tu la vois en aperçu au studio avant de valider | Studio |
| **Le Jury** · `jury` | Relecture et notation | Relit comme un prof : cohérence, sources, méthode, orthographe, grille de notation | Salle du brief |
| **Nino** · `motion` | Motion designer vidéo | Storyboard d'une vidéo courte : format, découpage, rythme, mouvements, sous-titres. Pas de MP4 pour l'instant | Studio, à côté de Jade |
| **Le studio** | Poste de production | Montre chaque fichier proposé. Tu valides ou tu refuses ; rien n'est écrit sans ton clic | Studio |

Inès, Max, Sam, Nora et le Jury peuvent chercher sur le web (en lecture seule). Hugo, Léa et Claire travaillent à partir du dossier.

Chaque agent finit par un verdict : **OK**, **À retravailler** ou **Décision d'Evan**, et dit qui doit intervenir ensuite.

## Le modèle de chaque agent (pour économiser tes crédits)

| Modèle | Pour qui | Pourquoi |
|---|---|---|
| **Opus** (le plus réfléchi, le plus cher) | Max, Jade | La stratégie est le cœur de la reco : c'est là que la réflexion compte le plus. |
| **Sonnet** (équilibré) | Claire, Inès, Hugo, Léa, le Jury, Nino | Bon niveau pour piloter, chercher des sources, écrire et relire. |
| **Haiku** (rapide, le moins cher) | Sam, Nora | Déclinaisons plus cadrées : plateformes, calendrier, mix média. |

Pour changer : la ligne `model:` (haiku, sonnet ou opus) dans `.claude/agents/<agent>.md`, puis relance l'agence. Pour tout faire tourner sur un seul modèle (par exemple pour des essais pas chers) : `AGENCE_MODELE=haiku npm run agence`.

Tous les agents ont aussi une consigne d'économie : aller droit au but, lire seulement les fichiers utiles, 5 recherches web au plus par demande. Claire n'appelle que les agents utiles et leur passe un résumé plutôt que tout l'historique.

## Le circuit d'une recommandation

```
Toi : « Nouveau brief »
  → Claire  : reformulation, livrable, consignes          → tu valides ou tu précises
  → Inès    : marché, concurrents, cible, sources
  → Max     : problématique, insight, positionnement      → tu choisis l'insight, la cible
  → Hugo + Léa : 3 pistes créatives                       → tu choisis la piste
  → Sam + Nora : dispositif social et médias, budget, KPI
  → le Jury : relecture comme un prof, note estimée
  → Jade : présentation.html ou site.html (aperçu en direct au studio)
  → le studio : brief.md, insights.md, strategie.md, idee-creative.md, dispositif-social.md, dispositif-media.md, relecture.md, reco.md, presentation.html → tu valides chaque fichier
```

Pour un projet de **cours**, l'agence t'aide à réfléchir : elle explique, challenge, structure et relit. Les fichiers sont des fiches de travail (trame `fiche-travail-cours.md`). La version rendue au prof, c'est toi qui l'écris.

## Les trames : le même format à chaque projet

Chaque livrable a sa trame dans `projets/_modeles/`. Les agents reprennent les mêmes titres de sections, dans le même ordre, pour que tu retrouves toujours les mêmes parties d'un projet à l'autre. Le détail de qui remplit quoi est dans `projets/_modeles/README.md`.

## La grille du prof : `consignes-prof.md`

Pour un projet de **cours**, l'agence crée toute seule un fichier `consignes-prof.md` vide. Recopie-y la consigne et la grille de notation, telles quelles. Le Jury le lit en premier : la grille du prof prime sur les habitudes de l'agence. Dans les autres types de projets, tu peux créer ce fichier à la main dans `projets/<projet>/`.

## Le suivi des projets

Le bouton **Suivi des projets** (dans la barre du haut) montre, pour chaque projet :
- l'étape en cours (brief, insights, stratégie, idée créative, dispositif, relecture, reco, présentation) et le nombre d'étapes faites ;
- la date de rendu, si tu l'as indiquée dans le formulaire « Nouveau brief » ;
- si la grille du prof est là ;
- le coût du projet à ce jour.

Clique sur un projet pour l'ouvrir.

## La bibliothèque de sources : `docs/sources.md`

C'est la liste des sources que tu as déjà vérifiées (le lien ouvert, le chiffre relu). Inès part de cette liste avant de chercher sur le web, et évite de recommencer les mêmes recherches. Les sources nouvelles qu'Inès trouve arrivent dans `projets/<projet>/sources.md`. **Tu recopies toi-même dans `docs/sources.md` celles que tu valides** : les agents ne peuvent pas écrire hors d'un projet.

## Comment t'en servir

1. **Lance l'agence** : `npm run agence` dans le Terminal. La page s'ouvre toute seule.
2. **Nouveau brief** (bouton en haut) : un nom, le type (cours, perso, client), la date de rendu si tu la connais (facultatif), le texte du brief. Claire le lit et lance le circuit.
3. **Le chat** à droite : écris comme dans Claude Code. Tu vois chaque étape en direct (« Inès cherche sur le web… »), et le bureau de l'agent qui travaille s'allume.
4. **Les fenêtres** : chaque proposition d'agent s'ouvre dans une fenêtre. Quand une décision te revient, une fenêtre « À toi de décider » propose 2 à 4 options, la recommandée est marquée. Tu cliques, l'agence continue.
5. **Le studio** : chaque fichier s'ouvre avant d'être écrit. Tu peux le modifier, puis « Valider et enregistrer » ou « Refuser ».
6. **Une petite demande** : clique sur un bureau, puis « Écrire à… ». Ou passe par l'accueil du « Nouveau brief », qui t'oriente vers le bon agent.
7. **Envoyer sur GitHub** : seulement quand tu cliques, et seulement le dossier du projet ouvert.

## Les sites et présentations (Jade)

- Demande-la dans le chat : « Jade, fais la présentation de la reco » ou « fais une landing page pour la campagne ». Ou clique sur le studio, puis « Écrire à Jade ».
- **Tes images** : ouvre « Dossier du projet » et glisse tes photos, maquettes ou visuels générés (PNG, JPG, WEBP, GIF, 10 Mo au plus). Tu peux aussi les déposer à la main dans `projets/<projet>/images/`. Jade les regarde et les place dans la présentation. Léa peut t'écrire les prompts pour les générer (Midjourney, ChatGPT, Firefly, Canva).
- **L'atelier de rendu, avant que tu voies quoi que ce soit** :
  1. Jade écrit le fichier ;
  2. le studio l'ouvre dans un vrai navigateur (Google Chrome) et photographie chaque diapo, ou la page en ordinateur et en téléphone ; il repère les textes qui débordent, les erreurs, les images manquantes ;
  3. Léa regarde les photos et critique en directrice artistique ;
  4. Jade voit ses photos, la liste des défauts et la critique, et corrige ;
  5. la version corrigée est rephotographiée, puis elle arrive au studio pour toi, avec un résumé (« Vu au navigateur · critiqué par Léa · corrigé par Jade »).
- Tu suis tout dans le chat. Les photos sont rangées dans `.claude/rendus/` si tu veux les voir.
- Il faut **Google Chrome** sur le Mac. Sans lui, le fichier arrive quand même, marqué « pas vu au navigateur ».
- Nombre de corrections : 1 par défaut. `AGENCE_TOURS=2 npm run agence` pour deux tours (plus cher), `AGENCE_TOURS=0` pour seulement photographier et vérifier, sans critique.
- Au studio, l'aperçu se joue en vrai (flèches pour avancer). « Ouvrir en grand » l'affiche dans un onglet, F pour le plein écran. Une fois validé, le fichier est dans `projets/<projet>/` avec son dossier `images/` : double-clique dessus dans le Finder.
- **Coût** : c'est l'étape la plus chère (Jade en opus écrit deux fois un gros fichier, Léa regarde des images). Demande-la une fois la stratégie et l'idée validées.
- L'aperçu et le navigateur de l'atelier sont isolés : le code d'une présentation ne peut ni lire tes fichiers, ni parler à l'agence, ni charger autre chose que les polices Google.

## Les protections (toujours actives)

- La page ne répond **que sur ton Mac** (127.0.0.1) et demande un **jeton secret**, nouveau à chaque lancement, caché dans l'adresse ouverte par `npm run agence`.
- Les agents sont **en lecture seule** : pas de commande, pas d'écriture. Ils ne lisent que le dossier de l'agence, sauf les conversations (`.claude/agence/`) et le dossier git (`.git/`). Ils proposent ; le serveur écrit **seulement dans `projets/<projet>/`**, en `.md`, après ton clic.
- Un fichier proposé ailleurs (autre projet, `../`, sous-dossier, nom réservé comme `CLAUDE.md`) est refusé et signalé en rouge dans le chat ; son contenu reste lisible dans une proposition.
- Une proposition plus ancienne d'un même fichier ne peut pas écraser la nouvelle, ni un fichier que tu as modifié à la main depuis.
- Claire ne peut appeler que les 8 agents de l'équipe (garde-fou `scripts/garde-agents.mjs`).
- Si Claude Code est trop ancien (sans le mode restreint), l'agence refuse de lancer les agents et te dit de taper `claude update`.
- **Rien ne part sur GitHub** sans ton clic sur « Envoyer sur GitHub », et seulement des livrables du dossier `projets/` : si du code de l'agence attend d'être envoyé, l'envoi est refusé avec une explication.
- Fermer la fenêtre du Terminal arrête aussi les agents en cours (pas de crédits consommés dans le vide).
- Garde-fou pour les sessions Claude Code ouvertes à la main dans ce dossier : `.claude/hooks/garde-fous.py` (pas de `git add -A`, confirmation avant `git push`).
- Les conversations restent sur ton Mac, dans `.claude/agence/` (jamais envoyées sur GitHub).

## Limites honnêtes

- Les agents suivent des **consignes**, pas des verrous : vérifie toujours les sources qu'ils citent (le Jury en contrôle quelques-unes).
- Le contenu d'une page web peut contenir des instructions piégées : les agents ont pour consigne de les ignorer et de te les signaler. Ils ne peuvent de toute façon rien écrire sans toi.
- Les agents qui cherchent sur le web (Inès, Max, Sam, Nora, le Jury) peuvent ouvrir n'importe quelle adresse. Une page piégée pourrait donc, en théorie, pousser un agent à envoyer le contenu du projet ouvert vers un site. Ne mets pas d'informations confidentielles d'un client (contrats, données personnelles) dans un projet.
- Chaque message coûte un peu de crédit Claude : le coût s'affiche sous chaque réponse. Une reco complète avec toute l'équipe coûte plus qu'une question. Bouton **Arrêter** toujours disponible.
- Pour changer un prénom : la ligne `prenom:` dans `.claude/agents/<agent>.md`, puis relance l'agence.
