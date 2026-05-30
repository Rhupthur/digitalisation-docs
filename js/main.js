/*
  ════════════════════════════════════════════════
  main.js
  Rôle : orchestrateur final — branche tous les
         modules ensemble en un seul pipeline.

  Fonction publique unique :
    traiter(fichier, typeDoc, champs, formatExport, nomFichier)
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  SEUIL DE CONFIANCE OCR
  ────────────────────────────────────────────────
  En dessous de ce seuil, on bascule sur
  manuscrit.js pour une meilleure extraction.
*/
var SEUIL_CONFIANCE_OCR = 60;

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : validerParametres()
  ────────────────────────────────────────────────
  Valide tous les paramètres avant de lancer
  le pipeline.

  Lève une erreur descriptive si un paramètre
  est invalide.
*/
function validerParametres(fichier, typeDoc, champs, formatExport, nomFichier) {

    if (!fichier || !(fichier instanceof File)) {
        throw new Error('main.js — validerParametres() : fichier invalide');
    }

    if (!typeDoc || typeof typeDoc !== 'string') {
        throw new Error('main.js — validerParametres() : typeDoc invalide');
    }

    var typesValides = ['releve', 'acte', 'autres'];
    if (typesValides.indexOf(typeDoc) === -1) {
        throw new Error('main.js — validerParametres() : typeDoc inconnu → ' + typeDoc);
    }

    if (typeDoc === 'autres') {
        if (!Array.isArray(champs) || champs.length === 0) {
            throw new Error('main.js — validerParametres() : champs requis pour typeDoc "autres"');
        }
        for (var i = 0; i < champs.length; i++) {
            if (!champs[i].champ || !champs[i].question) {
                throw new Error('main.js — validerParametres() : champ invalide à l\'index ' + i);
            }
        }
    }

    var formatsValides = ['json', 'csv', 'excel'];
    if (!formatExport || formatsValides.indexOf(formatExport) === -1) {
        throw new Error('main.js — validerParametres() : formatExport invalide → ' + formatExport);
    }

    if (!nomFichier || typeof nomFichier !== 'string' || nomFichier.trim().length === 0) {
        throw new Error('main.js — validerParametres() : nomFichier invalide');
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : etape1Extraction(fichier)
  ────────────────────────────────────────────────
  Étape 1 — Extraction du texte brut.

  Si la confiance OCR < SEUIL_CONFIANCE_OCR,
  on bascule sur manuscrit.js.

  Retourne :
  {
    texte              : string,
    methode            : string,
    confiance          : number | null,
    pages              : number,
    verificationRequise: boolean,
  }
*/
async function etape1Extraction(fichier) {

    var extraction = await extraire(fichier);

    // Vérifier si c'est un PDF (même scanné)
    var estPdf = fichier.type === 'application/pdf' ||
                 fichier.name.toLowerCase().endsWith('.pdf');

    // PDF ou confiance suffisante → on garde le résultat
    if (extraction.confiance === null ||
        extraction.confiance >= SEUIL_CONFIANCE_OCR ||
        estPdf) {
        return {
            texte              : extraction.texte,
            methode            : extraction.methode,
            confiance          : extraction.confiance,
            pages              : extraction.pages,
            verificationRequise: extraction.confiance !== null &&
                                 extraction.confiance < SEUIL_CONFIANCE_OCR,
        };
    }

    // Image directe avec confiance faible → manuscrit.js
    console.log('main.js — confiance OCR faible (' +
                extraction.confiance + '%) — basculement sur manuscrit.js');

    var img = new Image();
    img.src = URL.createObjectURL(fichier);
    await new Promise(function(resolve) { img.onload = resolve; });

    var canvas        = document.createElement('canvas');
    canvas.width      = img.width;
    canvas.height     = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);

    var manuscrit = await extraireManuscrit(canvas);

    return {
        texte              : manuscrit.texte,
        methode            : 'manuscrit',
        confiance          : manuscrit.confiance,
        pages              : extraction.pages,
        verificationRequise: manuscrit.verificationRequise,
    };
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : etape2Pretraitement(texte)
  ────────────────────────────────────────────────
  Étape 2 — Nettoyage du texte brut.

  Lève une erreur si le prétraitement échoue.
*/
function etape2Pretraitement(texte) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('main.js — etape2Pretraitement() : texte vide après extraction');
    }

    return pretraiter(texte);
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : etape3Analyse(texte, typeDoc, champs)
  ────────────────────────────────────────────────
  Étape 3 — Analyse et extraction des champs.

  Si WebGPU disponible → tente analyse_llm.js
  Si échec WebLLM     → fallback automatique wllama
  Si pas de WebGPU    → analyse.js (wllama) directement

  Lève une erreur uniquement si wllama échoue aussi.
*/
async function etape3Analyse(texte, typeDoc, champs) {

    if (typeof CAPACITES === 'undefined') {
        throw new Error('main.js — etape3Analyse() : CAPACITES non défini — vérifier libs.js');
    }

    if (CAPACITES.webgpu) {
        try {
            console.log('main.js — tentative analyse via WebLLM (WebGPU)');
            return await analyserLLM(texte, typeDoc, champs);
        } catch (erreur) {
            console.warn('main.js — WebLLM échoué (' + erreur.message + ') — fallback wllama');
        }
    }

    console.log('main.js — analyse via wllama (CPU)');
    return await analyser(texte, typeDoc, champs);
}

/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : traiter(fichier, typeDoc, champs, formatExport, nomFichier)
  ════════════════════════════════════════════════
  Orchestratrice — l'interface utilisateur appelle
  uniquement celle-ci.

  Pipeline complet :
  1. Validation des paramètres
  2. Extraction du texte (extraction.js + manuscrit.js)
  3. Nettoyage du texte (pretraitement.js)
  4. Analyse et extraction des champs
     (analyse.js ou analyse_llm.js selon WebGPU)
  5. Export du résultat (export.js)

  Paramètres :
    fichier      : File — fichier PDF ou image
    typeDoc      : 'releve' | 'acte' | 'autres'
    champs       : [{champ, question}] — si typeDoc === 'autres'
    formatExport : 'json' | 'csv' | 'excel'
    nomFichier   : string — nom du fichier exporté sans extension

  Retourne :
  {
    donnees            : object  — champs extraits
    methode            : string  — 'pdfjs' | 'ocr' | 'manuscrit'
    confiance          : number | null
    verificationRequise: boolean
  }

  Lève une erreur si un paramètre est invalide
  ou si une étape du pipeline échoue.
*/
async function traiter(fichier, typeDoc, champs, formatExport, nomFichier) {

    // Étape 0 — Validation
    try {
        validerParametres(fichier, typeDoc, champs, formatExport, nomFichier);
    } catch (erreur) {
        throw new Error('main.js — traiter() : ' + erreur.message);
    }

    // Étape 1 — Extraction
    var extraction;
    try {
        extraction = await etape1Extraction(fichier);
    } catch (erreur) {
        throw new Error('main.js — traiter() — étape extraction : ' + erreur.message);
    }

    // Étape 2 — Prétraitement
    var texte;
    try {
        texte = etape2Pretraitement(extraction.texte);
    } catch (erreur) {
        throw new Error('main.js — traiter() — étape prétraitement : ' + erreur.message);
    }

    // Étape 3 — Analyse
    var donnees;
    try {
        donnees = await etape3Analyse(texte, typeDoc, champs);
    } catch (erreur) {
        throw new Error('main.js — traiter() — étape analyse : ' + erreur.message);
    }

    // Étape 4 — Export
    try {
        await exporter(donnees, formatExport, nomFichier);
    } catch (erreur) {
        throw new Error('main.js — traiter() — étape export : ' + erreur.message);
    }

    // Retourner le résultat pour l'interface utilisateur
    return {
        donnees            : donnees,
        methode            : extraction.methode,
        confiance          : extraction.confiance,
        verificationRequise: extraction.verificationRequise,
    };
}