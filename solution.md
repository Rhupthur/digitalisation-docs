# DigitaDocs pour une administration publique (mairie)

> Quelles problématiques concrètes cette solution permet-elle de résoudre, et comment ?

---

## 1. Le contexte d'une mairie

Une mairie manipule chaque jour un volume important de documents papier ou scannés :

- **État civil** — actes de naissance, de mariage, de décès, livrets de famille
- **Services à la population** — demandes de certificats, attestations de domicile, légalisations
- **Urbanisme** — permis de construire, déclarations de travaux
- **Affaires sociales** — dossiers d'aide, justificatifs
- **Élections** — listes électorales, cartes d'électeur

Ces documents sont souvent **ressaisis manuellement** dans un logiciel métier ou un tableur. C'est lent, source d'erreurs, et coûteux en temps agent.

---

## 2. Les problématiques résolues

### 2.1 La ressaisie manuelle chronophage
**Problème** : un agent recopie à la main le nom, la date de naissance, le numéro d'acte… pour chaque dossier.
**Apport DigitaDocs** : l'extraction automatique (`extraction.js` + IA) lit le document et en sort les champs structurés. L'agent **vérifie** au lieu de **ressaisir**. Gain de temps estimé : plusieurs minutes par document, multiplié par des centaines de dossiers.

### 2.2 Les erreurs de transcription
**Problème** : une faute de frappe sur un nom ou une date dans un registre d'état civil a des conséquences juridiques.
**Apport DigitaDocs** : l'extraction est déterministe à partir du texte source, et le pipeline signale les cas douteux (`verificationRequise` quand la confiance OCR est faible) pour que l'agent contrôle en priorité ces documents.

### 2.3 La confidentialité des données personnelles (RGPD / loi sur la protection des données)
**Problème** : un acte de naissance contient des données personnelles sensibles. Les envoyer vers un cloud externe pose un problème juridique et de souveraineté.
**Apport DigitaDocs** : **tout le traitement est local, dans le navigateur** (wllama/WebLLM en WASM/WebGPU). **Aucune donnée ne quitte le poste de l'agent.** C'est l'argument décisif pour une administration : pas de transfert vers un tiers, pas de cloud, conformité par conception (*privacy by design*).

### 2.4 Le manque de connexion ou les réseaux instables
**Problème** : certaines mairies (notamment en zones rurales ou dans les pays à infrastructure limitée) ont une connexion intermittente.
**Apport DigitaDocs** : application **100 % offline** une fois installée (PWA + Service Worker). Elle fonctionne sans Internet, comme un logiciel installé.

### 2.5 Le coût et la dépendance à un éditeur
**Problème** : les solutions de GED/OCR cloud sont facturées au document ou à l'abonnement, et créent une dépendance.
**Apport DigitaDocs** : **pas de serveur, pas d'abonnement, pas de licence par poste** (MIT). L'IA tourne sur le matériel existant. Coût marginal par document ≈ 0.

### 2.6 La numérisation des archives et registres anciens
**Problème** : des registres manuscrits anciens doivent être numérisés et indexés.
**Apport DigitaDocs** : l'OCR manuscrit (`manuscrit.js`, Tesseract `fra_best`) prend le relais quand la confiance est faible, pour traiter les documents scannés et manuscrits.

### 2.7 L'hétérogénéité des documents
**Problème** : chaque service a ses propres formulaires.
**Apport DigitaDocs** : les **champs personnalisés** (type « autres ») permettent à chaque service de définir ses propres questions d'extraction, sans redévelopper l'outil.

---

## 3. Tableau de synthèse

| Problématique mairie | Résolue par | Bénéfice |
|----------------------|-------------|----------|
| Ressaisie manuelle | Extraction automatique IA | Temps agent divisé |
| Erreurs de transcription | Extraction + signalement des cas douteux | Fiabilité juridique |
| Données personnelles / RGPD | Traitement 100 % local | Souveraineté, conformité |
| Réseau instable / pas d'Internet | PWA offline (Service Worker) | Disponibilité permanente |
| Coût et dépendance éditeur | Open source, sans serveur | Budget maîtrisé |
| Archives manuscrites | OCR manuscrit | Valorisation du patrimoine |
| Formulaires variés | Champs personnalisés | Adaptabilité par service |

---

## 4. Propositions pour une adoption réelle en mairie

Au-delà des fonctionnalités actuelles, voici ce que je recommande pour passer d'un prototype à un outil déployable en administration.

### 4.1 Prioritaire — fiabiliser l'existant
- **Brancher le moteur GPU (WebLLM)** : le chemin était bloqué par un bug (désormais corrigé), à valider sur poste réel pour accélérer le traitement.
- **Brancher le prétraitement image OpenCV** (`pretraitement_image.js`, aujourd'hui non câblé) : redressement + amélioration de contraste avant OCR → meilleure précision sur les documents scannés de travers ou peu contrastés.
- **Fournir les bibliothèques `libs/`** (aujourd'hui absentes du dépôt) pour que l'outil démarre après installation.

### 4.2 Mode batch (traitement en masse)
Permettre de déposer **un lot de documents** (ex. tous les actes d'une journée) et d'exporter un seul fichier CSV/Excel consolidé. C'est le besoin n°1 d'un service d'état civil.

### 4.3 Interface de vérification / validation
Un écran où l'agent **voit le document à gauche et les champs extraits à droite**, peut corriger avant export. Les champs à faible confiance sont surlignés. La validation humaine reste indispensable pour un usage administratif.

### 4.4 Modèles de documents pré-configurés
Livrer des **gabarits prêts à l'emploi** pour les documents français/africains courants (acte de naissance, certificat de résidence, etc.) afin que l'agent n'ait rien à paramétrer.

### 4.5 Connexion au logiciel métier
Prévoir un **export au format attendu par le logiciel d'état civil** de la mairie (mapping de champs configurable), pour éviter une double ressaisie inverse.

### 4.6 Traçabilité et journal
Pour un usage administratif : un **journal local** (qui a traité quel document, quand) — sans jamais sortir les données — pour répondre aux exigences de contrôle interne.

### 4.7 Accessibilité et langues
- Support de l'**arabe et des langues locales** (déjà en roadmap) pour les contextes multilingues.
- Conformité **accessibilité** (RGAA) de l'interface pour un service public.

### 4.8 Sécurité du poste
Documenter le déploiement sécurisé : poste dédié, navigateur à jour, pas d'extension tierce, afin de garantir que le « tout local » reste réellement étanche.

---

## 5. Argumentaire en une phrase

> **DigitaDocs permet à une mairie de transformer ses documents administratifs en données exploitables, automatiquement, sans ressaisie, sans cloud et sans Internet — en gardant 100 % des données personnelles sur ses propres postes.**
