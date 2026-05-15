# Biblos

Application statique de bibliothèque personnelle, prête pour Netlify.

## Fonctions
- Étagères visuelles avec couvertures Open Library
- Vue coverflow immersive
- Ajout / édition / suppression de livres
- Recherche, tri, filtres par statut
- Lookup automatique par ISBN (Open Library API)
- Export local JSON
- Synchronisation optionnelle vers un repo GitHub via l'API Contents

## Déploiement sur Netlify
1. Connecter ce repo à Netlify
2. Aucun build step — publier la racine `.`
3. Déployer

## Synchronisation GitHub
Dans l'app → « Synchroniser GitHub » :
- Owner : votre username GitHub
- Repo : nom du repo contenant votre `books.json`
- Token : Personal Access Token avec scope `repo`
- Cliquer « Pousser books.json »

## Stack
- Vanilla JS (aucune dépendance)
- CSS custom avec design system crème/ivoire
- Fonts : Boska (display) + Satoshi (body) via Fontshare
- Open Library API pour les couvertures et métadonnées
- GitHub Contents API pour la persistence
