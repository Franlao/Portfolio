## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Projet

Portfolio de Solim Laokpezi (AI Engineer), bilingue FR (défaut, sans préfixe) / EN (`/en/`).

Routes : `/` et `/en/` = « La Brigade » (page d'accueil) ; `/carte/` et `/en/menu/` = la version texte ; `/projets/<slug>/` et `/en/projects/<slug>/` = les pages projet. `homePath` et `menuPath` dans `src/i18n/ui.ts`.

Concept : « le site qui lit l'offre ». Le recruteur colle une fiche de poste, le site la traite sous ses yeux comme un pipeline RAG/agents dont chaque étape est inspectable, puis réordonne les projets par pertinence. Chaque projet est une démo interactive de son _concept_ : les projets pros sont confidentiels, toutes les données sont fictives.

Stack : Astro 7, îlots React 19 (chargés avec `client:visible`), MDX, React Flow (`@xyflow/react`), GSAP, Rough.js (style « carnet d'ingénieur »), Zod, nanostores (état partagé entre îlots). Hébergement Vercel.

Langage visuel (bloc de calcul d'ingénieur), à respecter partout :

- Tracé à la règle (graphite `--rule`) = code déterministe.
- Tracé à main levée bleu (Rough.js, `--model`, police Recursive `.casual`) = étape confiée à un modèle.
- Crayon rouge (`--check`) = contrôle ou vérification. Jamais décoratif.
- Une seule police, Recursive, auto-hébergée dans `public/fonts` : linéaire pour le texte, `.casual` pour le texte produit par un modèle, `.mono` pour les données.

Organisation :

- `src/data/projects.ts` : données communes aux deux langues (ordre, état de la démo, profil de compétences). `src/content/projects/{fr,en}/<slug>.mdx` : textes. Une page projet n'est générée que si `demo: "ready"`.
- `src/lib/offer/` : moteur d'analyse des offres (lexique bilingue, découpage, repérage, rapprochement, synthèse), testé dans `engine.test.ts`.
- Lecture des offres par un modèle (`src/lib/offer/reader.ts`, `remote.ts`, `src/pages/api/read-offer.ts`) : Mistral (`mistral-medium-latest`, retenu après comparaison avec Small et Large sur une vraie offre ; en dev, `model` dans la requête permet d'en essayer un autre ; sortie contrainte par schéma JSON) range chaque exigence dans une compétence du lexique ou « other », avec son importance et une citation exacte. Le code vérifie ensuite chaque citation (tolérance de quelques mots sautés), et reclasse en génie logiciel une ligne Python ou TypeScript qui ne nomme pas le langage. Seules les lignes vérifiées comptent ; le ticket ne montre que le résultat propre, pas les erreurs du modèle ; le rapprochement reste déterministe, et le site n'affiche jamais de texte libre du modèle. Clé `MISTRAL_API_KEY` (`.env` en local, variables d'environnement Vercel en ligne), déclarée dans `astro.config.mjs`. Sans clé ou en cas d'échec, repli sur le lexique. La Brigade l'utilise ; la carte (`/carte/`) reste 100 % locale.
- `src/components/demos/<démo>/` : `engine.ts` (logique pure, testée), `copy.ts` (textes FR/EN), composant React, CSS.

Conventions :

- Chaque texte d'interface passe par `src/i18n/ui.ts` (ou `copy.ts` pour une démo), aucun texte en dur dans les composants.
- Typographie française automatique (`src/lib/typo.ts`) : `getTranslations`, `typographize(copy.fr)` et le plugin Sätteri pour les MDX sous `/fr/`. Guillemets « » en français, “ ” en anglais.
- Astro 7 utilise Sätteri comme moteur Markdown : les plugins remark/rehype ne marchent pas, utiliser `defineMdastPlugin` de `satteri`.
- Les étapes LLM des démos sont pré-calculées et rejouées, pas d'appel LLM au runtime, sauf la lecture de l'offre dans la Brigade.
- Après un changement de `content.config.ts` ou une installation de dépendance : `astro dev stop`, supprimer `node_modules/.vite`, puis relancer le serveur.
- Avant de conclure : `npm test`, `npm run check` puis `npm run build`.

## « La Brigade », la page d'accueil

La direction retenue après la première maquette, jugée trop proche d'un CV : les projets sont les postes d'une cuisine-diorama en 3D (Three.js), dans un style ligne claire BD. L'offre du recruteur y devient un bon de commande traité par la brigade. La première maquette est devenue « la carte » (`/carte/`), la version texte.

Univers, à garder cohérent : le restaurant = le portfolio ; le recruteur = le client ; son offre d'emploi = sa commande ; la brigade = des agents ; chaque poste = un projet jouable ; le chef (Solim) au passe = le contrôle humain ; « cuisine ouverte, recettes vraies, produits fictifs » = projets confidentiels reconstitués avec des données fictives ; la carte = la version texte.

- `src/components/pages/Brigade.astro` : la page (FR et EN). `src/lab/brigade/copy.ts` : ses textes `{ fr, en }`, dont un test vérifie la parité.
- `src/lab/brigade/` : `main.ts` (mise en scène, caméra, service), `kitchen.ts` (le décor, dessiné en code), `cook.ts` (cuisiniers animés), `stations.ts` (postes ↔ projets), `toon.ts` (ombrage 3 tons et contours encrés), `sound.ts` (effets synthétisés, trois bus : effets, ambiance, voix ; coupés par défaut), `ambience.ts` (ambiances et bruitages synthétisés : la rue de Lyon le soir, la cuisine, le taxi, les portières ; fondu de la rue à la cuisine quand la maison s'ouvre), `rush.ts` (le jeu du passe).
- `src/lab/brigade/prologue/` : l'arrivée, un soir, dans une rue de Lyon. `facade.ts` (le restaurant, dont les murs tombent comme ceux d'une maison de poupée), `street.ts` (la rue : immeubles voisins, café en terrasse, quai de Saône, Fourvière ; des couches qu'on escamote à l'ouverture), `people.ts` (passants, maître d'hôtel, recruteur), `traffic.ts` (foule, voitures, clients attablés, testé), `vehicles.ts` (voitures et taxi), `prologue.ts` (la mise en scène : le taxi arrive, le maître d'hôtel ouvre la portière et accueille le recruteur, la porte, l'ouverture, le recruteur prend place à la table du chef, accueil du chef en 3 bulles), `narration.ts` (pendant la première commande, chaque étape est nommée en mots de cuisine puis en mots d'IA), `copy.ts`. Le téléphone du recruteur (sa réservation et les messages du restaurant) est rendu côté serveur (`src/components/brigade/Arrival.astro`) : un script en ligne marque `<html class="brigade-arriving">` avant le premier affichage. L'arrivée joue à la première visite, avec `?arrivee`, et jamais avec `?cuisine` (liens à partager) ni `?carnet` (retour d'une page projet).
 - `src/lab/brigade/voice/` : les voix, quand le visiteur active le son. Principe : l'écran garde ses textes courts, les personnages en disent plus à voix haute (le chef développe son accueil et explique chaque étape du premier service ; la patronne accueille le visiteur ; textes parlés dans `voice/copy.ts`, `spoken`). Le bouton « Sous-titres » affiche dans la carte et la narration ce que dit le chef. Les répliques sont pré-enregistrées avec Voxtral (Mistral) par `npm run voices` (`scripts/voices.mjs`) : le script (`script.ts`) est tiré des textes de la page, y compris les répliques du chef dans les jeux ; le casting est dans `cast.ts` (Marie pour la patronne, une « mère lyonnaise » ; pour le chef, une voix française fabriquée, Marie abaissée puis clonée, en attendant la voix de Solim). Chaque prise est retranscrite par un modèle de reconnaissance vocale et comparée au script (`check.ts`) : une voix qui dit « We chef » est refusée. ffmpeg coupe les silences, égalise le volume et calcule l'enveloppe qui anime les bouches et les bulles. Sorties : `public/voices/<langue>/` (clips et `manifest.json`) et `voices.lock.json` (quelle voix a dit quoi, ce que le contrôle a entendu). Aucune synthèse à l'exécution : le chef annonce la commande en enchaînant des clips d'une liste fermée (`announce.ts`), il ne peut donc dire que ce que le code a vérifié. `voices.ts` joue les clips sur le bus voix : chaque voix suit son personnage à l'écran, sur trois plans (la salle, l'aparté du chef au visiteur, la rue), et l'ambiance baisse sous les voix. Après avoir modifié une réplique : `npm run voices` (un test vérifie que chaque réplique a son clip).
- `src/lab/brigade/notebook/` : « le carnet du chef », chargé à la demande. Au passe (fin du coup de feu, ou « Ouvrir le carnet du chef » dans la visite), le chef sort son carnet : il vole de ses mains vers le visiteur et s'ouvre par-dessus la cuisine, sans la quitter. Page de gauche : les dossiers que le visiteur vient de juger (sa décision contre celle de l'agent) ou le dossier de la maison, et leurs ingrédients modifiables. Page de droite : la recette de l'agent, c'est-à-dire le vrai moteur (`recipe.ts`, testé) dessiné étape par étape dans les trois traits du site ; les contrôles en défaut sont en rouge, la suite choisie est entourée au crayon rouge. La première fois, avec le son, le chef la lit à voix haute. « Lire la fiche complète » mène à la page projet, habillée en page du même carnet (kraft, papier crème) ; une transition de vue (`view-transition-name: carnet`) fait passer de l'un à l'autre, et « Retour à la cuisine » (`?carnet=<slug>`) rouvre le carnet.
- La visite est gardée pour la session (`src/lib/visit.ts`, sessionStorage) : l'addition, la dernière commande (reprise dans « Vérifié pour » des autres pages) et le dernier coup de feu. Quitter la cuisine et y revenir ne fait rien perdre.
- `src/lab/brigade/games/<poste>/` : un mini-jeu par poste, chargé à la demande. Contrat dans `games/types.ts`, cahier des charges dans `games/BRIEF.md` (à suivre pour tout nouveau jeu).
- Performance : garder `THREE.BasicShadowMap`. Les ombres PCF de Three r186 font tomber la scène à 2 images par seconde sur une carte graphique intégrée, contre plus de 200 avec des ombres nettes.
- `frTypo` gère la ponctuation, les milliers et les unités courantes. Les jeux ajoutent leurs unités métier localement.
