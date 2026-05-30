# DigitaDocs — Numérisation intelligente de documents

> IA locale, offline, dans le navigateur. Aucune donnée ne quitte votre appareil.

![PWA](https://img.shields.io/badge/PWA-installable-blue)
![Offline](https://img.shields.io/badge/offline-100%25-green)
![WebAssembly](https://img.shields.io/badge/WebAssembly-wllama-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Vue d'ensemble

DigitaDocs est une application web progressive (PWA) qui extrait automatiquement les données structurées de documents administratifs africains — relevés de notes, actes de naissance, ordonnances, et tout autre document — en utilisant une IA embarquée qui fonctionne entièrement hors connexion.

**Aucun cloud. Aucun serveur. Aucune donnée transmise.** Tout se passe dans le navigateur.

---

## Fonctionnalités

- **Extraction automatique** — PDF natifs et images (JPG, PNG, WEBP)
- **OCR intelligent** — détection automatique des pages scannées et des documents manuscrits
- **IA locale embarquée** — Qwen 0.5B via wllama (CPU/WASM) ou WebLLM (GPU/WebGPU)
- **Fallback automatique** — WebLLM essaie en premier, wllama prend le relais si le GPU est insuffisant
- **3 types de documents** — relevé de notes, acte de naissance, champs personnalisés
- **3 formats d'export** — JSON, CSV, Excel (.xlsx)
- **PWA installable** — fonctionne comme une app native sur mobile et desktop
- **100% offline** — Service Worker met en cache tous les assets après le premier chargement

---

## Architecture

```
digitaldocs/
├── index.html              ← Interface utilisateur (PWA)
├── sw.js                   ← Service Worker (cache offline)
├── manifest.json           ← Config PWA
├── serveur.py              ← Serveur de dev Python (headers COOP/COEP)
│
├── js/
│   ├── libs.js             ← Détection capacités (WebGPU, RAM) + chargement libs
│   ├── extraction.js       ← Extraction texte (pdf.js + Tesseract OCR)
│   ├── manuscrit.js        ← OCR manuscrit (Tesseract fra_best)
│   ├── pretraitement.js    ← Nettoyage texte brut
│   ├── pretraitement_image.js ← Amélioration image (OpenCV WASM)
│   ├── analyse.js          ← Extraction champs via wllama (CPU)
│   ├── analyse_llm.js      ← Extraction champs via WebLLM (GPU)
│   ├── export.js           ← Export JSON / CSV / Excel
│   └── main.js             ← Orchestrateur pipeline complet
│
├── libs/
│   ├── pdf.min.mjs         ← pdf.js
│   ├── pdf.worker.min.mjs
│   ├── tesseract.min.js    ← Tesseract.js
│   ├── tessdata/           ← Modèles OCR (fra, fra_best)
│   ├── opencv.js           ← OpenCV WASM
│   ├── webllm.js           ← WebLLM (WebGPU)
│   └── wllama/             ← wllama WASM (llama.cpp)
│
└── models/
    └── qwen-wllama/        ← Qwen2.5 0.5B Q4 (469MB, CPU)
        └── qwen2.5-0.5b-q4.gguf
```

---

## Pipeline de traitement

```
Fichier (PDF / Image)
        ↓
[extraction.js]     — pdf.js (natif) ou Tesseract OCR (scanné)
        ↓
[manuscrit.js]      — si confiance OCR < 60% et image directe
        ↓
[pretraitement.js]  — nettoyage texte (espaces, caractères parasites, césures)
        ↓
[analyse_llm.js]    — WebLLM / WebGPU (si GPU disponible)
   ou
[analyse.js]        — wllama / WASM CPU (fallback automatique)
        ↓
[export.js]         — JSON / CSV / Excel
```

---

## Modèles IA

| Moteur | Modèle | Taille | Matériel |
|--------|--------|--------|----------|
| wllama (CPU) | Qwen2.5-0.5B-Instruct Q4 | 469 MB | CPU (WASM SIMD) |
| WebLLM (GPU) | Qwen2-1.5B-Instruct Q4F16 | ~830 MB | WebGPU (GPU dédié) |
| WebLLM (GPU faible) | Qwen2-0.5B-Instruct Q4F16 | ~400 MB | WebGPU (GPU intégré) |

---

## Installation et démarrage

### Prérequis
- Python 3.x (pour le serveur de développement)
- Navigateur moderne (Chrome 113+, Edge 113+, Firefox 116+)

### 1. Cloner le repo
```bash
git clone https://github.com/Rhupthur/digitalisation-docs.git
cd digitalisation-docs
```

### 2. Télécharger le modèle wllama
```bash
mkdir -p models/qwen-wllama
wget https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-q4_k_m.gguf \
     -O models/qwen-wllama/qwen2.5-0.5b-q4.gguf
```

### 3. Lancer le serveur
```bash
python3 serveur.py
```

### 4. Ouvrir dans le navigateur
```
http://localhost:8080
```

> **Important** : Le serveur Python est nécessaire pour les headers `Cross-Origin-Opener-Policy` et `Cross-Origin-Embedder-Policy` requis par SharedArrayBuffer (wllama).

---

## Utilisation

1. **Choisir un document** — déposer un PDF ou une image
2. **Configurer** — sélectionner le type (relevé de notes, acte de naissance, autres) et le format d'export
3. **Lancer l'extraction** — le pipeline s'exécute entièrement dans le navigateur
4. **Récupérer les données** — le fichier est téléchargé automatiquement

---

## Cas d'usage

- **Universités** — numérisation des relevés de notes en masse
- **État civil** — extraction des données d'actes de naissance
- **Postes de santé** — traitement des ordonnances et fiches patients
- **Administrations** — digitalisation de tout document administratif

---

## Compatibilité

| Navigateur | wllama (CPU) | WebLLM (GPU) |
|------------|-------------|--------------|
| Chrome 113+ | ✅ | ✅ (GPU dédié requis) |
| Edge 113+ | ✅ | ✅ (GPU dédié requis) |
| Firefox 116+ | ✅ | ⚠️ Support partiel |
| Safari 17+ | ✅ | ⚠️ Support partiel |

---

## Roadmap

- [ ] Module OpenCV (redressement, CLAHE, Canny + Hough) via Web Worker
- [ ] Modèle vision Florence-2 / Donut fine-tuné sur documents africains
- [ ] Interface d'annotation pour entraînement du modèle custom
- [ ] Support arabe et langues locales africaines
- [ ] Mode batch (traitement de plusieurs documents)
- [ ] Serveur Node.js Express pour déploiement production

---

## Auteur

**Rhupthur Jevainaitre BOUKOYI**
Étudiant Master 1 Intelligence Artificielle — Dakar, Sénégal
Nationalité congolaise (République du Congo-Brazzaville)

---

## Licence

MIT — libre d'utilisation, modification et distribution.