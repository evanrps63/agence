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
| **Le Jury** · `jury` | Relecture et notation | Relit comme un prof : cohérence, sources, méthode, orthographe, grille de notation | Salle du brief |
| **Le studio** | Poste de production | Montre chaque fichier proposé. Tu valides ou tu refuses ; rien n'est écrit sans ton clic | Studio |

Inès, Max, Sam, Nora et le Jury peuvent chercher sur le web (en lecture seule). Hugo, Léa et Claire travaillent à partir du dossier.

Chaque agent finit par un verdict : **OK**, **À retravailler** ou **Décision d'Evan**, et dit qui doit intervenir ensuite.

## Le modèle de chaque agent (pour économiser tes crédits)

| Modèle | Pour qui | Pourquoi |
|---|---|---|
| **Opus** (le plus réfléchi, le plus cher) | Max | La stratégie est le cœur de la reco : c'est là que la réflexion compte le plus. |
| **Sonnet** (équilibré) | Claire, Inès, Hugo, Léa, le Jury | Bon niveau pour piloter, chercher des sources, écrire et relire. |
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
  → le studio : brief.md, insights.md, strategie.md, reco.md → tu valides chaque fichier
```

Pour un projet de **cours**, l'agence t'aide à réfléchir : elle explique, challenge, structure et relit. Les fichiers sont des fiches de travail. La version rendue au prof, c'est toi qui l'écris.

## Comment t'en servir

1. **Lance l'agence** : `npm run agence` dans le Terminal. La page s'ouvre toute seule.
2. **Nouveau brief** (bouton en haut) : un nom, le type (cours, perso, client), le texte du brief. Claire le lit et lance le circuit.
3. **Le chat** à droite : écris comme dans Claude Code. Tu vois chaque étape en direct (« Inès cherche sur le web… »), et le bureau de l'agent qui travaille s'allume.
4. **Les fenêtres** : chaque proposition d'agent s'ouvre dans une fenêtre. Quand une décision te revient, une fenêtre « À toi de décider » propose 2 à 4 options, la recommandée est marquée. Tu cliques, l'agence continue.
5. **Le studio** : chaque fichier s'ouvre avant d'être écrit. Tu peux le modifier, puis « Valider et enregistrer » ou « Refuser ».
6. **Une petite demande** : clique sur un bureau, puis « Écrire à… ». Ou passe par l'accueil du « Nouveau brief », qui t'oriente vers le bon agent.
7. **Envoyer sur GitHub** : seulement quand tu cliques, et seulement le dossier du projet ouvert.

## Les protections (toujours actives)

- La page ne répond **que sur ton Mac** (127.0.0.1) et demande un **jeton secret**, nouveau à chaque lancement, caché dans l'adresse ouverte par `npm run agence`.
- Les agents sont **en lecture seule** : pas de commande, pas d'écriture. Ils ne lisent que le dossier de l'agence, sauf les conversations (`.claude/agence/`) et le dossier git (`.git/`). Ils proposent ; le serveur écrit **seulement dans `projets/<projet>/`**, en `.md`, après ton clic.
- Un fichier proposé ailleurs (autre projet, `../`, sous-dossier, nom réservé comme `CLAUDE.md`) est refusé et signalé en rouge dans le chat ; son contenu reste lisible dans une proposition.
- Une proposition plus ancienne d'un même fichier ne peut pas écraser la nouvelle, ni un fichier que tu as modifié à la main depuis.
- Claire ne peut appeler que les 7 agents de l'équipe (garde-fou `scripts/garde-agents.mjs`).
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
