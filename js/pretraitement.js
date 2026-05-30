/*
  ════════════════════════════════════════════════
  pretraitement.js
  Rôle : nettoyer le texte brut sorti de
         extraction.js avant de l'envoyer
         à analyse.js
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : normaliserSautsLigne(texte)
  ────────────────────────────────────────────────
  - Sauts de ligne Windows \r\n → \n
  - Sauts de ligne Mac \r      → \n
*/
function normaliserSautsLigne(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — normaliserSautsLigne() : texte invalide');
    }

    return texte
        .replace(/\r\n/g, '\n')
        .replace(/\r/g,   '\n');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : supprimerCaracteresInvisibles(texte)
  ────────────────────────────────────────────────
  - Caractères de contrôle invisibles (sauf \n)
  - Espaces insécables \u00A0 → espace normal
  - Autres espaces unicode → espace normal
*/
function supprimerCaracteresInvisibles(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — supprimerCaracteresInvisibles() : texte invalide');
    }

    return texte
        // Espaces insécables et autres espaces unicode → espace normal
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
        // Caractères de contrôle invisibles sauf \n
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Caractères unicode parasites
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : normaliserEspaces(texte)
  ────────────────────────────────────────────────
  - Tabulations → espace
  - Espaces multiples → un seul espace
  - Espaces en début/fin de chaque ligne
*/
function normaliserEspaces(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — normaliserEspaces() : texte invalide');
    }

    return texte
        // Tabulations → espace
        .replace(/\t/g, ' ')
        // Espaces multiples → un seul espace
        .replace(/ {2,}/g, ' ')
        // Espaces en début et fin de chaque ligne
        .split('\n')
        .map(function(ligne) { return ligne.trim(); })
        .join('\n');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : supprimerLignesVides(texte)
  ────────────────────────────────────────────────
  - Lignes vides multiples → une seule ligne vide
  - Lignes vides en début et fin du texte
*/
function supprimerLignesVides(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — supprimerLignesVides() : texte invalide');
    }

    return texte
        // Lignes vides multiples → une seule
        .replace(/\n{3,}/g, '\n\n')
        // Ligne vide en début
        .replace(/^\n+/, '')
        // Ligne vide en fin
        .replace(/\n+$/, '');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : supprimerLignesParasites(texte)
  ────────────────────────────────────────────────
  Supprime les lignes qui ne contiennent que
  du bruit OCR :
  - Lignes de pointillés (....... ou _______)
  - Lignes de tirets (-------)
  - Numéros de page (- 1 -, Page 1/3, 1/3)
  - Caractères parasites isolés (|, ~, #, @)
*/
function supprimerLignesParasites(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — supprimerLignesParasites() : texte invalide');
    }

    var lignes    = texte.split('\n');
    var nettoyees = [];

    for (var i = 0; i < lignes.length; i++) {
        var ligne = lignes[i];

        // Ligne vide — on garde
        if (ligne.trim().length === 0) {
            nettoyees.push(ligne);
            continue;
        }

        // Lignes de pointillés ou tirets ou underscores
        // ex: ".......", "_______", "-------"
        if (/^[\.\-_]{3,}$/.test(ligne.trim())) {
            continue;
        }

        // Numéros de page
        // ex: "- 1 -", "- 12 -", "Page 1/3", "page 2 / 5", "1/3"
        if (/^-?\s*\d+\s*-?$/.test(ligne.trim())) {
            continue;
        }
        if (/^[Pp]age\s+\d+\s*(\/\s*\d+)?$/.test(ligne.trim())) {
            continue;
        }
        if (/^\d+\s*\/\s*\d+$/.test(ligne.trim())) {
            continue;
        }

        // Caractères parasites isolés
        // ex: "|", "~", "#", "@", "§"
        if (/^[|~#@§]{1,3}$/.test(ligne.trim())) {
            continue;
        }

        nettoyees.push(ligne);
    }

    return nettoyees.join('\n');
}


/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : corrigerCesures(texte)
  ────────────────────────────────────────────────
  Corrige les césures de mots en fin de ligne.
  ex: "profes-\nsionnel" → "professionnel"

  On ne corrige que si le tiret est en fin de
  ligne et la suite commence par une minuscule —
  pour éviter de fusionner des mots composés
  légitimes (ex: "Burkina-\nFaso" → on ne touche pas)
*/
function corrigerCesures(texte) {

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — corrigerCesures() : texte invalide');
    }

    return texte.replace(/-\n([a-zàâäéèêëîïôùûüç])/g, '$1');
}

/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : pretraiter(texte)
  ════════════════════════════════════════════════
  Orchestratrice — main.js et analyse.js appellent
  uniquement celle-ci.

  Applique toutes les étapes de nettoyage
  dans le bon ordre.

  Paramètres :
    texte : string — texte brut sorti de extraction.js

  Retourne le texte nettoyé prêt pour analyse.js.
  Lève une erreur si le texte est invalide.
  Retourne une chaîne vide si le texte est vide
  après nettoyage.
*/
function pretraiter(texte) {

    if (texte === null || texte === undefined) {
        throw new Error('pretraitement.js — pretraiter() : texte null ou undefined');
    }

    if (typeof texte !== 'string') {
        throw new Error('pretraitement.js — pretraiter() : texte doit être une string, reçu : ' + typeof texte);
    }

    // Texte vide — on retourne directement
    if (texte.trim().length === 0) {
        return '';
    }

    try {
        var resultat = texte;

        resultat = normaliserSautsLigne(resultat);
        resultat = supprimerCaracteresInvisibles(resultat);
        resultat = corrigerCesures(resultat);
        resultat = normaliserEspaces(resultat);
        resultat = supprimerLignesParasites(resultat);
        resultat = supprimerLignesVides(resultat);
        return resultat;

    } catch (erreur) {
        throw new Error('pretraitement.js — pretraiter() : ' + erreur.message);
    }
}