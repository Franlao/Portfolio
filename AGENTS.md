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
- `src/components/demos/<démo>/` : `engine.ts` (logique pure, testée), `copy.ts` (textes FR/EN), composant React, CSS.

Conventions :

- Chaque texte d'interface passe par `src/i18n/ui.ts` (ou `copy.ts` pour une démo), aucun texte en dur dans les composants.
- Typographie française automatique (`src/lib/typo.ts`) : `getTranslations`, `typographize(copy.fr)` et le plugin Sätteri pour les MDX sous `/fr/`. Guillemets « » en français, “ ” en anglais.
- Astro 7 utilise Sätteri comme moteur Markdown : les plugins remark/rehype ne marchent pas, utiliser `defineMdastPlugin` de `satteri`.
- Les étapes LLM des démos sont pré-calculées et rejouées, pas d'appel LLM au runtime (sauf, plus tard, l'analyse de l'offre).
- Après un changement de `content.config.ts` ou une installation de dépendance : `astro dev stop`, supprimer `node_modules/.vite`, puis relancer le serveur.
- Avant de conclure : `npm test`, `npm run check` puis `npm run build`.

## Prototype « La Brigade » (`/lab/brigade/`)

La direction retenue après la première maquette, jugée trop proche d'un CV : les projets sont les postes d'une cuisine-diorama en 3D (Three.js), dans un style ligne claire BD. L'offre du recruteur y devient un bon de commande traité par la brigade. L'ancienne page (`/`) reste accessible comme « version texte ».

- `src/lab/brigade/` : `main.ts` (mise en scène, caméra, service), `kitchen.ts` (le décor, dessiné en code), `cook.ts` (cuisiniers animés), `stations.ts` (postes ↔ projets), `toon.ts` (ombrage 3 tons et contours encrés), `sound.ts` (sons synthétisés, coupés par défaut), `rush.ts` (le jeu du passe).
- `src/lab/brigade/games/<poste>/` : un mini-jeu par poste, chargé à la demande. Contrat dans `games/types.ts`, cahier des charges dans `games/BRIEF.md` (à suivre pour tout nouveau jeu).
- Performance : garder `THREE.BasicShadowMap`. Les ombres PCF de Three r186 font tomber la scène à 2 images par seconde sur une carte graphique intégrée, contre plus de 200 avec des ombres nettes.
- `frTypo` gère la ponctuation, les milliers et les unités courantes. Les jeux ajoutent leurs unités métier localement.
