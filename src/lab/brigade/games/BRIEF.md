# Cahier des charges des mini-jeux de La Brigade

La page d'accueil « La Brigade » (`/`, `/en/`) présente les projets de Solim Laokpezi (AI Engineer) comme les postes d'une cuisine-diorama en 3D. Chaque poste est un projet ; son mini-jeu fait **comprendre le principe du projet en jouant**, en moins d'une minute et demie. Les projets réels sont confidentiels : **toutes les données sont fictives**, et on ne montre que le principe.

Le jeu du passe (`src/lab/brigade/rush.ts` + la section `.rush` de `src/components/pages/Brigade.astro` + les styles `.rush-*` de `src/lab/brigade/brigade.css`) est la **référence de ton et de style** : lis-le avant de commencer, inspire-t'en pour la cohérence, sans le copier.

## Périmètre

- Tu ne crées et ne modifies **que** des fichiers dans `src/lab/brigade/games/<poste>/` : `game.ts` (à remplacer), `logic.ts`, `logic.test.ts`, `game.css`, et d'autres fichiers si besoin, dans ce dossier uniquement.
- Tout le reste est en lecture seule, notamment `games/types.ts`, `games/index.ts`, `main.ts` et `brigade.css`. Si un changement ailleurs te semble nécessaire, signale-le dans ton rapport au lieu de le faire.
- D'autres agents écrivent en parallèle les jeux des autres postes. N'y touche pas, et ne lance ni n'arrête le serveur de dev. N'utilise pas le navigateur. Pas de commit git, pas d'installation de paquet.

## Contrat

`game.ts` exporte `export const game: StationGame` (voir `games/types.ts`). `mount(root, context)` dessine le jeu dans `root`, et renvoie une fonction de nettoyage qui arrête les minuteries et les animations GSAP, et retire les écouteurs globaux (par exemple un `keydown` sur `window`). Le panneau fournit déjà le titre, l'intro et le bouton « Quitter ». Ne les duplique pas.

`context` fournit : `lang` (`"fr"` ou `"en"`), `sound` (`pop`, `good`, `bad`, `stamp`, `bell`, sans effet si le son est coupé), `say(texte)` (une bulle au-dessus du chef, moins de 30 caractères), `close()` (retour à la cuisine) et `reducedMotion`.

 Les répliques du chef rangées dans `copy.ts` sous une clé `chef`, `say` ou `shout…` sont enregistrées en voix par `npm run voices`, et dites quand le son est activé. Une réplique construite par une fonction (un score, une lettre) reste une bulle muette.

## Technique

- DOM en TypeScript simple : ni React ni Three.js. GSAP est disponible (`import gsap from "gsap"`). Aucune nouvelle dépendance.
- Aucune image ni ressource externe : tout est dessiné en HTML, CSS ou SVG en ligne.
- Logique pure et déterministe dans `logic.ts`, sans accès au DOM. Si tu as besoin d'aléatoire, utilise un générateur à graine. La logique est testée dans `logic.test.ts` avec Vitest.
- CSS dans `game.css`, importé depuis `game.ts` (`import "./game.css";`). Toutes les règles sont préfixées par une classe racine `.g-<poste>`, posée sur le premier élément que tu crées dans `root`.
- Commentaires en anglais, sobres, qui expliquent le pourquoi.

## Langage visuel, à respecter

- Cartes « papier » : fond `var(--paper)` ou `#fff`, bordure `1.5px solid var(--ink)`, ombre décalée `3px 3px 0 var(--ink)`, coins presque droits (2px).
- Note jaune `#fff3cf` pour les consignes et les règles.
- **Le sens des couleurs est fixe** : rouge `var(--check)` pour une vérification ou un contrôle (✓/✗, tampons) ; bleu `var(--model)` pour ce qu'écrit un modèle de langage, avec l'axe « casual » de la police (`--casl: 1`) ; encre `var(--ink)` pour le code et les règles. Les données brutes sont en mono (`--mono: 1; font-family: var(--font-mono)`).
- Autres variables disponibles : `--ink-soft`, `--lamp` (jaune), `--font`.
- Un seul moment « waouh » par jeu, pas d'effets partout. Le mouvement répond à une action du joueur.

## Game design

- Un objectif compris en une phrase, un geste simple, un retour immédiat (son, bulle du chef, tampon, compteur).
- Durée de 30 à 90 secondes, rejouable, et le deuxième essai doit pouvoir être différent.
- Un écran de fin qui : 1) donne le score ; 2) relie en une ou deux phrases le mécanisme au vrai projet de Solim, **uniquement avec les faits de ta fiche** (n'invente ni chiffre ni technologie) ; 3) propose « Rejouer » et « Revenir à la cuisine » (`context.close()`).

## Texte

- Bilingue : `context.lang` vaut `"fr"` ou `"en"`, et le jeu affiche tout dans cette langue, y compris les données fictives (dossiers, comptes rendus, documents). Les textes vivent dans un objet `{ fr: {...}, en: {...} }` de même forme, dont un test vérifie la parité des clés. `title` et `intro` sont des `Record<Lang, string>` déjà typographiés.
- Phrases courtes. En français on vouvoie le visiteur ; en anglais, un ton direct et chaleureux (« you »). Pas de majuscules pour les étiquettes, pas de texte creux.
- En français, toute chaîne affichée contenant `:` `;` `?` `!` `%`, des guillemets, des milliers ou une unité passe par `frTypo` (`src/lib/typo.ts`), avec des guillemets « ». En anglais, pas de `frTypo`, des guillemets “ ”, et les nombres et montants sont formatés avec `Intl` en `en-GB`.
- L'anglais n'est pas du mot à mot : c'est une réécriture idiomatique (anglais britannique), qui garde le même sens, les mêmes faits et la même longueur à peu près. Les jeux de mots français sont remplacés par des équivalents anglais.

## Accessibilité

- On n'interagit qu'avec des `<button>` et des champs natifs. Pas de div cliquable. Pas de glisser-déposer obligatoire : si tu en proposes un, le clic ou le clavier doit suffire.
- Les retours sont annoncés dans une zone `aria-live="polite"`. Aucune information ne passe par la seule couleur (✓/✗ + texte).
- Si `context.reducedMotion` est vrai : pas d'animation, et pas de chrono imposé.
- Le jeu fonctionne à 360 px de large (le panneau passe en pleine largeur sous 760 px).

## Vérifications obligatoires avant de rendre

1. `npx vitest run src/lab/brigade/games/<poste>` : tous les tests passent.
2. `npx biome check --write src/lab/brigade/games/<poste>`, puis `npx biome check src/lab/brigade/games/<poste>` : aucun diagnostic.
3. `npx tsc --noEmit -p tsconfig.json` : aucune erreur dans ton dossier. Si des erreurs viennent d'autres dossiers `games/*` en cours d'écriture, ignore-les mais signale-les.

## Rapport final, court

Le concept retenu et son déroulé, les fichiers créés, les résultats des 3 vérifications, et les points d'attention (ce que tu n'as pas pu faire, ce qui mériterait d'être vu dans le navigateur).
