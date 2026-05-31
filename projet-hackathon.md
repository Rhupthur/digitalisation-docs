# Plateforme d'indexation et de recherche documentaire intelligente pour une mairie

> Projet de hackathon — moteur de recherche documentaire augmenté par l'IA, au service de l'administration locale.

---

## 1. Contexte

Une mairie produit et conserve chaque jour des centaines de documents : actes d'état civil, courriers, délibérations du conseil municipal, permis d'urbanisme, dossiers sociaux, factures, arrêtés… Ces documents sont **dispersés** entre des classeurs papier, des scans, des PDF sur différents postes et des dossiers réseau mal organisés.

Aujourd'hui, retrouver un document précis relève souvent du parcours du combattant :

- on cherche **dans sa mémoire** où le document a été rangé,
- on ouvre **les dossiers un par un**,
- on demande **à un collègue** qui « sait où ça se trouve »,
- on **refait** parfois un document parce qu'on ne retrouve pas l'original.

Le savoir documentaire repose sur quelques agents, et se perd avec les départs. Il n'existe pas de **point d'entrée unique** pour interroger le patrimoine documentaire de la mairie.

Ce projet s'inscrit dans la continuité de **DigitaDocs** (extraction de données documentaires par IA locale, 100 % offline), en ajoutant la brique manquante : **l'indexation et la recherche intelligente**.

---

## 2. Problématique

> **Comment permettre à un agent de mairie de retrouver instantanément le bon document — ou la bonne information à l'intérieur d'un document — en posant simplement une question en langage naturel, tout en garantissant la confidentialité des données personnelles ?**

Sous-problématiques :

1. **Recherche par le sens, pas seulement par mot-clé** — un agent qui cherche « l'arrêté sur le stationnement de la rue principale » doit le trouver même si le document s'appelle `AR-2023-0412.pdf`.
2. **Documents non textuels** — beaucoup de documents sont des scans ou des images : il faut les rendre **cherchables** (OCR).
3. **Confidentialité** — les documents contiennent des données personnelles (RGPD) : on ne peut pas les envoyer vers un cloud externe.
4. **Volume et hétérogénéité** — formats variés (PDF, images, manuscrits), services différents, pas de nomenclature unifiée.
5. **Simplicité d'usage** — les agents ne sont pas des informaticiens : l'outil doit être aussi simple qu'une barre de recherche.

---

## 3. Objectifs

| Objectif | Description |
|----------|-------------|
| **Centraliser** | Un point d'entrée unique pour tous les documents de la mairie |
| **Indexer automatiquement** | Extraire le texte (OCR si besoin) et l'indexer dès l'ajout d'un document |
| **Rechercher par le sens** | Recherche sémantique en langage naturel, pas seulement par mot-clé |
| **Répondre, pas seulement lister** | L'IA donne une réponse synthétique + cite les documents sources |
| **Protéger les données** | Traitement local, aucune donnée personnelle ne quitte l'infrastructure de la mairie |
| **Rester simple** | Interface accessible à tout agent, sans formation technique |

---

## 4. Solution proposée

Une **plateforme web** qui fonctionne en trois temps :

```
1. INGESTION              2. INDEXATION                 3. RECHERCHE
   ───────────              ─────────────                  ──────────
   Dépôt d'un       →       Extraction texte       →       Question en
   document                 (OCR / pdf.js)                 langage naturel
   (PDF, image)             + découpage en passages              ↓
                            + vectorisation (embeddings)   Recherche sémantique
                            + stockage dans un index              ↓
                                                           Réponse IA + sources
```

### Le rôle de l'IA dans la plateforme

L'IA intervient à **trois niveaux** :

1. **Extraction / OCR intelligent** — transformer un scan ou une image en texte exploitable, y compris pour les documents manuscrits (réutilisation du pipeline DigitaDocs : Tesseract + nettoyage).
2. **Indexation sémantique (embeddings)** — chaque passage de document est transformé en vecteur numérique qui capture son **sens**. Deux phrases proches par le sens sont proches dans l'index, même sans mots communs.
3. **Recherche augmentée par génération (RAG)** — quand l'agent pose une question, la plateforme :
   - vectorise la question,
   - retrouve les passages les plus pertinents dans l'index,
   - les fournit à un **modèle de langage local** qui rédige une **réponse synthétique** en citant les documents sources.

> Le modèle ne « hallucine » pas une réponse seul : il **s'appuie sur les documents réels** de la mairie (principe du RAG). Chaque réponse est **traçable** vers sa source.

---

## 5. Fonctionnalités clés

- 🔎 **Recherche en langage naturel** — « Trouve-moi les délibérations de 2023 sur le budget des écoles »
- 🤖 **Réponse IA avec citations** — un résumé + la liste des documents sources cliquables
- 📑 **Indexation automatique à l'ajout** — OCR + extraction de métadonnées (type, date, personnes, numéro)
- 🏷️ **Filtres** — par type de document, date, service, personne concernée
- 👁️ **Aperçu et surlignage** — le passage répondant à la question est mis en évidence dans le document
- 🔒 **100 % local / souverain** — aucune donnée envoyée à un tiers
- 📊 **Tableau de bord** — volume indexé, recherches fréquentes, documents récents

---

## 6. Architecture technique (proposition)

```
┌─────────────────────────────────────────────────────────┐
│                   INTERFACE WEB (PWA)                     │
│         Barre de recherche · Résultats · Aperçu          │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌────────────────┐                     ┌──────────────────┐
│   INGESTION    │                     │    RECHERCHE     │
│ OCR (Tesseract)│                     │  Question → vec  │
│ Extraction txt │                     │  Recherche kNN   │
│ Découpage      │                     │  RAG (LLM local) │
└───────┬────────┘                     └────────┬─────────┘
        ▼                                       ▼
┌─────────────────────────────────────────────────────────┐
│         INDEX VECTORIEL + MÉTADONNÉES (local)            │
│   embeddings des passages · type · date · personnes      │
└─────────────────────────────────────────────────────────┘
```

### Stack technique envisagée

| Brique | Technologie candidate | Justification |
|--------|----------------------|---------------|
| Interface | PWA (HTML/JS) ou React | S'installe comme une app, fonctionne offline |
| OCR | Tesseract.js (déjà dans DigitaDocs) | Local, multilingue (français) |
| Extraction PDF | pdf.js | Texte natif sans OCR |
| Embeddings | Modèle local (ex. `all-MiniLM`, `bge-small`) via Transformers.js / ONNX | Vectorisation locale, sans cloud |
| Index vectoriel | SQLite + extension vectorielle, ou index en mémoire / IndexedDB | Léger, déployable sur un poste mairie |
| LLM (RAG) | Modèle local — wllama (CPU) / WebLLM (GPU), comme DigitaDocs | Souveraineté, offline |
| Backend (option) | Node.js / Python (FastAPI) si index serveur | Mutualiser l'index entre postes |

> **Principe directeur : souveraineté et confidentialité.** Tout ce qui touche aux documents reste dans l'infrastructure de la mairie (poste ou serveur interne).

---

## 7. Périmètre du MVP (pour le hackathon)

Un hackathon = un temps court. On vise une **démonstration fonctionnelle de bout en bout**, pas l'exhaustivité.

### Inclus dans le MVP
- ✅ Déposer un lot de documents (PDF + images)
- ✅ Extraction texte + OCR automatique
- ✅ Indexation sémantique (embeddings)
- ✅ Barre de recherche en langage naturel
- ✅ Réponse IA + documents sources cités
- ✅ Aperçu du document avec passage surligné

### Hors MVP (roadmap)
- ⏳ Gestion fine des droits par service
- ⏳ Connexion au logiciel métier d'état civil
- ⏳ Index partagé multi-postes / serveur
- ⏳ Support arabe et langues locales
- ⏳ Détection automatique du type de document

---

## 8. Démonstration prévue

**Scénario de démo (3 minutes) :**
1. On dépose une dizaine de documents variés (un scan d'arrêté, un PDF de délibération, une image d'acte).
2. La plateforme les indexe sous nos yeux (barre de progression).
3. On tape une question en langage naturel : *« Quels documents parlent du stationnement ? »*
4. La plateforme renvoie une **réponse synthétique** + la **liste des documents sources**, avec le passage pertinent **surligné**.
5. On montre qu'**aucune requête réseau** ne part vers l'extérieur (souveraineté).

---

## 9. Valeur ajoutée et impact

| Bénéfice | Pour qui |
|----------|----------|
| Gain de temps sur la recherche documentaire | Agents municipaux |
| Fin de la dépendance au « collègue qui sait » | Service / continuité |
| Meilleur service rendu à l'usager (réponses plus rapides) | Citoyens |
| Conformité RGPD par conception (local) | Mairie / juridique |
| Valorisation et préservation des archives | Patrimoine |
| Coût maîtrisé (open source, sans abonnement cloud) | Budget communal |

---

## 10. Facteurs différenciants

- **Souveraineté totale** — l'IA tourne **localement**, contrairement aux solutions cloud du marché. Argument fort pour une administration publique.
- **Recherche par le sens** — au-delà du simple `Ctrl+F`, on cherche par **intention**.
- **Réponse tracée** — l'IA cite ses sources, indispensable dans un contexte administratif.
- **Réutilisation de DigitaDocs** — on capitalise sur un pipeline OCR + IA locale déjà éprouvé.

---

## 11. Indicateurs de succès (KPIs)

- ⏱️ Temps moyen pour retrouver un document : **avant vs après**
- 🎯 Pertinence des résultats (top-3 contient le bon document)
- 📈 Nombre de documents indexés
- 😊 Satisfaction des agents testeurs

---

## 12. Risques et points d'attention

| Risque | Mitigation |
|--------|------------|
| Qualité OCR sur documents anciens/manuscrits | Prétraitement image (OpenCV) + vérification humaine |
| Modèles locaux lourds à charger | Mise en cache (PWA), choix de modèles légers quantifiés |
| Hallucination du LLM | RAG strict : réponse fondée uniquement sur les sources, citations obligatoires |
| Performance sur gros volumes | Index optimisé, pagination, traitement par lots |

---

## 13. Équipe

> *(À compléter)*

| Rôle | Membre |
|------|--------|
| Lead / IA | |
| Frontend | |
| Backend / Indexation | |
| Design / UX | |

---

## 14. En une phrase

> **Une plateforme souveraine qui transforme le fouillis documentaire d'une mairie en un assistant intelligent : on pose une question, l'IA trouve le bon document et y répond — sans qu'aucune donnée ne quitte l'administration.**
