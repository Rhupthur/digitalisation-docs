/*
  ════════════════════════════════════════════════
  export.js
  Rôle : exporter les données extraites dans
         différents formats (JSON, CSV, Excel)
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : telecharger(contenu, nomFichier, typeMime)
  ────────────────────────────────────────────────
  Crée un lien de téléchargement temporaire
  et le déclenche automatiquement.

  Lève une erreur si la création du blob échoue.
*/
function telecharger(contenu, nomFichier, typeMime) {

    if (contenu === null || contenu === undefined) {
        throw new Error('export.js — telecharger() : contenu invalide');
    }

    if (!nomFichier || nomFichier.trim().length === 0) {
        throw new Error('export.js — telecharger() : nom de fichier manquant');
    }

    if (!typeMime || typeMime.trim().length === 0) {
        throw new Error('export.js — telecharger() : type MIME manquant');
    }

    var blob;
    try {
        blob = new Blob([contenu], { type: typeMime });
    } catch (erreur) {
        throw new Error('export.js — telecharger() : création du blob échouée — ' + erreur.message);
    }

    var url = URL.createObjectURL(blob);

    try {
        var lien      = document.createElement('a');
        lien.href     = url;
        lien.download = nomFichier;

        document.body.appendChild(lien);
        lien.click();
        document.body.removeChild(lien);

    } finally {
        // Toujours libérer l'URL même si le clic échoue
        URL.revokeObjectURL(url);
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : exporterJSON(donnees, nomFichier)
  ────────────────────────────────────────────────
  Convertit les données en JSON formaté
  et déclenche le téléchargement.

  Lève une erreur si la sérialisation échoue
  (ex: références circulaires).
*/
function exporterJSON(donnees, nomFichier) {

    var contenu;
    try {
        contenu = JSON.stringify(donnees, null, 2);
    } catch (erreur) {
        throw new Error('export.js — exporterJSON() : sérialisation échouée — ' + erreur.message);
    }

    telecharger(contenu, nomFichier + '.json', 'application/json');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : aplatiDonnees(donnees)
  ────────────────────────────────────────────────
  Aplatit l'objet données pour CSV et Excel.
  Le tableau matieres est converti en colonnes
  séparées : matiere_1, note_1, matiere_2, note_2...

  Exemple :
  {
    nom_complet : "DIALLO Mamadou",
    matieres    : [
      { matiere: "Maths", note: "14/20" }
    ]
  }
  →
  {
    nom_complet : "DIALLO Mamadou",
    matiere_1   : "Maths",
    note_1      : "14/20"
  }

  Lève une erreur si donnees n'est pas un objet.
*/
function aplatiDonnees(donnees) {

    if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) {
        throw new Error('export.js — aplatiDonnees() : données invalides');
    }

    var resultat = {};
    var cles     = Object.keys(donnees);

    if (cles.length === 0) {
        throw new Error('export.js — aplatiDonnees() : données vides');
    }

    for (var i = 0; i < cles.length; i++) {
        var cle    = cles[i];
        var valeur = donnees[cle];

        if (cle === 'matieres' && Array.isArray(valeur)) {

            if (valeur.length === 0) {
                // Tableau vide — on ignore silencieusement
                continue;
            }

            for (var j = 0; j < valeur.length; j++) {
                var item = valeur[j];

                if (!item || typeof item !== 'object') {
                    console.error('export.js — aplatiDonnees() : matière invalide à l\'index ' + j);
                    continue;
                }

                var num = j + 1;
                resultat['matiere_' + num] = (item.matiere !== undefined && item.matiere !== null)
                    ? String(item.matiere)
                    : '';
                resultat['note_' + num] = (item.note !== undefined && item.note !== null)
                    ? String(item.note)
                    : '';
            }

        } else {
            resultat[cle] = (valeur === null || valeur === undefined)
                ? ''
                : String(valeur);
        }
    }

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : exporterCSV(donnees, nomFichier)
  ────────────────────────────────────────────────
  Convertit les données en CSV et déclenche
  le téléchargement.

  Format :
  colonne1,colonne2,...
  valeur1,valeur2,...

  Lève une erreur si l'aplatissement échoue.
*/
function exporterCSV(donnees, nomFichier) {

    var aplati = aplatiDonnees(donnees);
    var cles   = Object.keys(aplati);

    if (cles.length === 0) {
        throw new Error('export.js — exporterCSV() : aucune donnée à exporter');
    }

    // Entête
    var entete = cles.map(function(c) {
        return '"' + String(c).replace(/"/g, '""') + '"';
    }).join(',');

    // Valeurs
    var valeurs = cles.map(function(c) {
        var v = (aplati[c] === null || aplati[c] === undefined)
            ? ''
            : String(aplati[c]);
        return '"' + v.replace(/"/g, '""') + '"';
    }).join(',');

    var contenu = entete + '\n' + valeurs;

    // BOM UTF-8 pour compatibilité Excel
    telecharger('\uFEFF' + contenu, nomFichier + '.csv', 'text/csv;charset=utf-8');
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : chargerSheetJS()
  ────────────────────────────────────────────────
  Charge SheetJS dynamiquement si pas déjà chargé.
  Lève une erreur si le chargement échoue.
*/
async function chargerSheetJS() {

    if (typeof XLSX !== 'undefined') {
        return;
    }

    await new Promise(function(resolve, reject) {
        var script     = document.createElement('script');
        script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload  = resolve;
        script.onerror = function() {
            reject(new Error('export.js — chargerSheetJS() : impossible de charger SheetJS'));
        };
        document.head.appendChild(script);
    });

    if (typeof XLSX === 'undefined') {
        throw new Error('export.js — chargerSheetJS() : SheetJS chargé mais XLSX introuvable');
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : exporterExcel(donnees, nomFichier)
  ────────────────────────────────────────────────
  Convertit les données en fichier Excel (.xlsx)
  via SheetJS chargé dynamiquement.

  Lève une erreur si SheetJS est indisponible
  ou si la création du fichier échoue.
*/
async function exporterExcel(donnees, nomFichier) {

    await chargerSheetJS();

    var aplati;
    try {
        aplati = aplatiDonnees(donnees);
    } catch (erreur) {
        throw new Error('export.js — exporterExcel() : ' + erreur.message);
    }

    try {
        var feuille  = XLSX.utils.json_to_sheet([aplati]);
        var classeur = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(classeur, feuille, 'Données');
        XLSX.writeFile(classeur, nomFichier + '.xlsx');

    } catch (erreur) {
        throw new Error('export.js — exporterExcel() : création du fichier échouée — ' + erreur.message);
    }
}

/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : exporter(donnees, type, nomFichier)
  ════════════════════════════════════════════════
  Orchestratrice — main.js appelle uniquement
  celle-ci.

  Paramètres :
    donnees     : objet retourné par analyse.js
    type        : 'json' | 'csv' | 'excel'
    nomFichier  : nom du fichier sans extension

  Lève une erreur si les paramètres sont invalides
  ou si le type est inconnu.
*/
async function exporter(donnees, type, nomFichier) {

    if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) {
        throw new Error('export.js — exporter() : données invalides');
    }

    if (!type || typeof type !== 'string' || type.trim().length === 0) {
        throw new Error('export.js — exporter() : type manquant');
    }

    if (!nomFichier || typeof nomFichier !== 'string' || nomFichier.trim().length === 0) {
        throw new Error('export.js — exporter() : nom de fichier manquant');
    }

    if (type === 'json') {
        exporterJSON(donnees, nomFichier);
        return;
    }

    if (type === 'csv') {
        exporterCSV(donnees, nomFichier);
        return;
    }

    if (type === 'excel') {
        await exporterExcel(donnees, nomFichier);
        return;
    }

    throw new Error('export.js — exporter() : type inconnu → ' + type);
}