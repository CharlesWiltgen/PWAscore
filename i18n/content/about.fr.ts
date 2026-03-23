export default `
PWAscore fournit des comparaisons objectives et basées sur les données des capacités des Progressive Web Apps (PWA) sur les navigateurs mobiles populaires (et bientôt de bureau).

## Pourquoi

J'ai créé cet outil pour combler un vide informationnel. Plutôt que de se fier à des anecdotes ou des informations obsolètes, les scores PWAscore sont basés sur des données provenant de bases de données de compatibilité faisant autorité, complétées par des recherches couvrant également les fonctionnalités expérimentales et propriétaires.

## Quoi

PWAscore évalue les navigateurs sur plus de 200 fonctionnalités PWA, notamment :

- **Installation et cycle de vie** — Invites d'installation, mode autonome, service workers
- **Intégration matérielle** — Caméra, géolocalisation, capteurs, accès au système de fichiers
- **Capacités hors ligne** — Synchronisation en arrière-plan, stratégies de mise en cache, détection hors ligne
- **Fonctionnalités UI/UX** — Modes d'affichage, écrans de démarrage, raccourcis d'application
- **API de performance** — Web Workers, IndexedDB, Cache API

Chaque fonctionnalité est pondérée selon son importance, les capacités PWA essentielles comptant davantage que les fonctionnalités expérimentales. Les navigateurs reçoivent des scores séparés pour les fonctionnalités stables (prêtes pour la production) et l'ensemble des fonctionnalités (y compris expérimentales).

## Sources

Toutes les données de compatibilité proviennent de deux sources fiables :

- [Can I Use](https://caniuse.com) (CC BY 4.0) — Tables de compatibilité des fonctionnalités navigateur
- [MDN Browser Compat Data](https://github.com/mdn/browser-compat-data) (CC0) — Statut des fonctionnalités et informations de standardisation

Les versions des navigateurs sont automatiquement dérivées de ces données, garantissant que PWAscore reflète toujours les dernières versions.

## Comment

PWAscore est construit avec ces technologies web modernes :

- **TypeScript** — Développement typé
- **Vue 3** — Framework UI réactif
- **Nuxt 4** — Framework Vue full-stack
- **Nuxt UI** — Bibliothèque de composants basée sur Tailwind
- **Cloudflare Workers** — Déploiement mondial optimisé en périphérie

Le site est open source et disponible sur [GitHub](https://github.com/CharlesWiltgen/PWAscore).

## À propos de l'auteur

PWAscore a été créé par [Charles Wiltgen](https://github.com/CharlesWiltgen).

## Contribuer

Vous avez trouvé un problème ou avez une suggestion ? Veuillez [ouvrir un ticket sur GitHub](https://github.com/CharlesWiltgen/PWAscore/issues).
`
