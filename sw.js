/*
  ════════════════════════════════════════════════
  sw.js — Service Worker
  Rôle : mettre en cache les fichiers statiques
         pour que l'app fonctionne offline.

  Stratégie :
  - Fichiers statiques → Cache First
  - Modèles IA        → cache navigateur (géré automatiquement)
  - Requêtes inconnues → Network First avec fallback cache
  ════════════════════════════════════════════════
*/

var CACHE_NOM     = 'digitalisation-docs-v1';
var CACHE_FICHIERS = [
    '/',
    '/index.html',
    '/js/libs.js',
    '/js/extraction.js',
    '/js/pretraitement.js',
    '/js/pretraitement_image.js',
    '/js/manuscrit.js',
    '/js/analyse.js',
    '/js/analyse_llm.js',
    '/js/export.js',
    '/js/main.js',
    '/libs/pdf.min.mjs',
    '/libs/pdf.worker.min.mjs',
    '/libs/tesseract.min.js',
    '/libs/wllama/wllama.js',
    '/libs/wllama/wllama.wasm',
    '/libs/opencv.js',
    '/manifest.json',
];

/*
  ────────────────────────────────────────────────
  ÉVÉNEMENT : install
  ────────────────────────────────────────────────
  Déclenché une seule fois quand le Service Worker
  est installé.

  On met en cache tous les fichiers statiques.
  Si un seul fichier échoue → on log l'erreur
  mais on ne bloque pas l'installation.
*/
self.addEventListener('install', function(event) {

    console.log('sw.js — installation...');

    event.waitUntil(
        caches.open(CACHE_NOM).then(async function(cache) {

            console.log('sw.js — mise en cache des fichiers statiques...');

            // On met en cache fichier par fichier
            // pour ne pas bloquer si un seul échoue
            for (var i = 0; i < CACHE_FICHIERS.length; i++) {
                try {
                    await cache.add(CACHE_FICHIERS[i]);
                    console.log('sw.js — mis en cache : ' + CACHE_FICHIERS[i]);
                } catch (erreur) {
                    console.error('sw.js — échec cache : ' + CACHE_FICHIERS[i] +
                                  ' — ' + erreur.message);
                }
            }

            console.log('sw.js — installation terminée');
        })
    );

    // Activer immédiatement sans attendre
    self.skipWaiting();
});

/*
  ────────────────────────────────────────────────
  ÉVÉNEMENT : activate
  ────────────────────────────────────────────────
  Déclenché quand le Service Worker prend le
  contrôle de la page.

  On supprime les anciens caches pour libérer
  de l'espace et éviter les conflits de version.
*/
self.addEventListener('activate', function(event) {

    console.log('sw.js — activation...');

    event.waitUntil(
        caches.keys().then(function(cacheNoms) {
            return Promise.all(
                cacheNoms
                    .filter(function(nom) {
                        // Supprimer tous les caches sauf le courant
                        return nom !== CACHE_NOM;
                    })
                    .map(function(nom) {
                        console.log('sw.js — suppression ancien cache : ' + nom);
                        return caches.delete(nom);
                    })
            );
        })
    );

    // Prendre le contrôle immédiatement
    self.clients.claim();
});

/*
  ────────────────────────────────────────────────
  ÉVÉNEMENT : fetch
  ────────────────────────────────────────────────
  Intercepte toutes les requêtes réseau.

  Stratégie Cache First :
  1. Cherche dans le cache
  2. Si trouvé → retourne depuis le cache
  3. Si non trouvé → fetch depuis le réseau
  4. Si réseau échoue → retourne une erreur propre

  On ignore les requêtes non-GET et les requêtes
  vers des domaines externes (CDN WebLLM).
*/
self.addEventListener('fetch', function(event) {

    // Ignorer les requêtes non-GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Ignorer les requêtes vers des domaines externes
    var url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(reponseCache) {

            // Trouvé dans le cache → retourner directement
            if (reponseCache) {
                return reponseCache;
            }

            // Pas dans le cache → fetch réseau
            return fetch(event.request).then(function(reponseReseau) {

                // Réponse invalide → retourner telle quelle
                if (!reponseReseau ||
                    reponseReseau.status !== 200 ||
                    reponseReseau.type === 'opaque') {
                    return reponseReseau;
                }

                // Mettre en cache la nouvelle ressource
                var reponseClone = reponseReseau.clone();
                caches.open(CACHE_NOM).then(function(cache) {
                    cache.put(event.request, reponseClone);
                });

                return reponseReseau;

            }).catch(function(erreur) {
                console.error('sw.js — fetch échoué : ' +
                              event.request.url + ' — ' + erreur.message);
            });
        })
    );
});