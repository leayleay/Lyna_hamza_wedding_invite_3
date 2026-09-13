# Recevoir les chansons dans Google Sheets

Les invités restent sur `rappel.html`. Ils renseignent leur prénom, ajoutent une ou plusieurs chansons, puis cliquent sur **Envoyer mes chansons**. Chaque titre arrive sur une ligne distincte dans votre feuille privée, avec la date, le prénom et l’artiste. La colonne **Retenu** permet de cocher vos choix. Aucun Google Form n’est affiché.

## Une seule configuration dans votre compte Google

1. Créez une [feuille Google](https://sheets.google.com) et nommez-la **Chansons — Lyna & Hamza**. Gardez son partage restreint.
2. Dans **Extensions → Apps Script**, remplacez le contenu de `Code.gs` par le contenu de [song-collection.gs](song-collection.gs). Enregistrez, sélectionnez **setupSongSheet**, puis cliquez sur **Exécuter**. Autorisez le script à accéder à votre feuille.
3. Cliquez sur **Déployer → Nouveau déploiement → Application Web**. Choisissez **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**. Déployez et copiez l’URL qui se termine par `/exec`.
4. Envoyez cette URL à Codex pour terminer la connexion, ou collez-la dans `googleScriptUrl` dans [song-collection-config.js](song-collection-config.js).

L’accès public concerne uniquement le point d’envoi : votre feuille reste privée. Les invités n’ont pas besoin d’un compte Google. Si un compte professionnel interdit l’accès « Tout le monde », utilisez un compte Google personnel.

## Avant publication

Le déploiement Google est connecté dans `song-collection-config.js`. Un envoi réel de deux chansons marquées **TEST TECHNIQUE — à supprimer** a reçu la confirmation d’enregistrement de Google, sans ouvrir de formulaire visible.

Après toute modification du déploiement Google, testez un envoi depuis le site : vérifiez le message de remerciement et les lignes correspondantes dans la feuille. Testez aussi en navigation privée sur téléphone.

Les origines autorisées dans `song-collection.gs` sont `https://leayleay.github.io` et l’aperçu local sur le port 4174. Ajoutez l’origine exacte si le site utilise ensuite un domaine personnalisé. Après modification du script, mettez à jour le déploiement avec une nouvelle version.

## Fonctionnement

### Si les chansons apparaissent vers la ligne 1001

Les anciennes cases à cocher pouvaient faire compter les lignes vides comme des lignes utilisées. Les chansons étaient bien enregistrées, mais sous ces lignes.

Pour les remonter, supprimez uniquement les lignes entièrement vides au-dessus des premières suggestions (hors cases à cocher inutilisées), en conservant l’en-tête et toutes les lignes contenant une chanson. Si la première suggestion est à la ligne 1001 et que les lignes 2 à 1000 sont vides, sélectionnez **2:1000**, puis **clic droit → Supprimer les lignes 2 à 1000**.

Le fichier `song-collection.gs` corrigé ne prépare plus de cases à cocher sur les lignes vides et ignore cette colonne pour trouver la prochaine ligne. Pour appliquer ce correctif à Google : remplacez le code Apps Script, enregistrez, puis **Déployer → Gérer les déploiements → Modifier → Nouvelle version → Déployer**. Gardez le déploiement existant pour conserver la même URL.

La page transmet les champs dans un cadre invisible. Le script valide tous les titres avant de les écrire, conserve un identifiant d’envoi pour éviter les doublons lors d’une nouvelle tentative, puis confirme la réception à la page. La page ne montre un remerciement qu’après cette confirmation. Une erreur conserve la sélection à réessayer ; le chargement du cadre seul ne compte jamais comme un envoi réussi.

L’ancien serveur SQLite et les éventuelles réponses dans `.data` sont conservés, mais le formulaire utilise maintenant uniquement Google Sheets. Aucun serveur Python ni abonnement d’hébergement supplémentaire n’est nécessaire pour cette nouvelle connexion.

Références : [applications Web Apps Script](https://developers.google.com/apps-script/guides/web), [intégration dans une page](https://developers.google.com/apps-script/reference/html/x-frame-options-mode).
