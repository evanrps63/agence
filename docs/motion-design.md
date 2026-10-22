# Motion design à l'agence : plan de travail

Le motion design, c'est le mouvement dans un visuel : une présentation qui s'anime, un site qui réagit, une vidéo courte pour les réseaux. Ce document dit comment on s'organise pour que le résultat soit de bon niveau, et quels outils (skills) on utilise.

## 1. Deux familles de motion, deux outils

| Ce qu'on veut produire | Format | Outil | Qui le fait |
|---|---|---|---|
| Une présentation ou un site qui s'anime | HTML, CSS, JavaScript | Skills de motion web | Jade (studio digital), avec la direction de Léa |
| Une vidéo courte (réseaux, TV, pub) | Fichier MP4 | Remotion (vidéo écrite en React) | À décider, voir section 5 |

Le premier cas ne demande rien d'installé : tout reste dans le fichier HTML, comme aujourd'hui. Le second demande une installation (voir section 5).

## 2. Les règles de qualité, avant toute animation

Trois questions, dans cet ordre :

1. **Faut-il animer ?** Un mouvement qui se répète cent fois par jour doit être instantané. Un mouvement rare peut être plus expressif. (Règle de fréquence, skill `design-motion-principles`.)
2. **Quelle durée ?** Pour une interface, entre 200 et 500 ms. Pour une vidéo, le rythme se décide par le storyboard, pas par un chiffre.
3. **Est-ce accessible ?** Tout mouvement doit respecter la préférence « réduire les animations » du système (`prefers-reduced-motion`). C'est obligatoire, pas une option.

Règle d'or : **le meilleur mouvement est celui qu'on ne remarque pas**, sauf quand le mouvement est justement le sujet (présentation de concours, campagne).

## 3. Les skills à mobiliser

Skills déjà disponibles dans l'agence :

- **`anthropic-skills:design-motion-principles`** : la base. Trois regards (Emil Kowalski pour la retenue, Jakub Krehel pour le fini, Jhey Tompkins pour l'expérimentation), pondérés selon le projet. Mode « créer » et mode « auditer ».
- **`audit-suite:web-animation-design`** : le mouvement web en détail.
- **`audit-suite:make-interfaces-feel-better`** : les petits détails qui font la différence (ombres, bordures, typographie animée).
- **`remotion:remotion-best-practices`** : routeur des skills Remotion (vidéo en React) : création de composition, rendu, sous-titres, multimédia.
- **`figma:figma-use-motion`** et **`figma:figma-implement-motion`** : si une animation doit être décrite dans Figma avant d'être codée. À utiliser seulement si un fichier Figma existe.

## 4. Le circuit pour une animation

1. **Brief de mouvement** (Léa) : l'ambiance du mouvement (vif, calme, solennel), les moments clés, ce qui doit être remarqué et ce qui doit passer inaperçu.
2. **Storyboard** (Léa ou Jade) : la liste des plans ou des états, avec la durée de chaque. Une seule page, en français.
3. **Réalisation** (Jade en HTML, ou Remotion pour une vidéo).
4. **Vérification** : le studio ouvre le rendu, Léa critique, Jade corrige. Pour une vidéo, il faut un contrôle image par image des moments clés.
5. **Validation par Evan** : aucun fichier ne part sans ton clic, comme pour le reste de l'agence.

## 5. Ce qu'il faut décider avant d'aller plus loin

**Question 1 : veut-on des vidéos MP4, ou seulement des animations web ?**
- *Animations web seulement* : rien à installer. On améliore les consignes de Jade et de Léa. C'est le plus simple, et il suffit pour les présentations.
- *Vidéos MP4* : il faut installer Remotion dans le dépôt (Node.js, Chrome). Remotion est une bibliothèque de vidéo écrite en React, qui produit un fichier MP4 à partir de code. Il faudra vérifier les conditions de licence de Remotion selon ton usage (à vérifier sur le site officiel avant d'installer).

**Question 2 : quels formats ?** Vertical 9:16 pour les réseaux, 16:9 pour une présentation ou la TV, carré 1:1 pour certains posts. Le format change la mise en scène.

**Question 3 : faut-il un agent dédié au motion ?** Aujourd'hui, Jade fait le web et Léa dirige l'image. Un agent « motion » séparé serait utile si les vidéos deviennent fréquentes. Pour l'instant, je propose de ne pas le créer.

## 6. Première étape proposée

Sans rien installer :
1. Donner à Jade une consigne de motion précise : la règle de fréquence, les durées, `prefers-reduced-motion`, et un storyboard avant le code.
2. Tester sur une présentation réelle, et regarder le résultat dans le studio.

Si tu veux des vidéos : deuxième étape, installer Remotion et faire un premier essai court (une vidéo de 10 secondes), pour voir la qualité avant de s'engager.

## Suivi

- [ ] Décision 1 (web seulement, ou MP4 aussi) : à trancher par Evan
- [ ] Décision 2 (formats) : à trancher par Evan
- [ ] Décision 3 (agent dédié) : à trancher par Evan
- [ ] Consigne de motion pour Jade
- [ ] Premier essai sur une présentation réelle
