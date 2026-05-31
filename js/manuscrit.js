/*
  ════════════════════════════════════════════════
  manuscrit.js
  Rôle : extraire le texte de documents manuscrits
         via Tesseract avec le modèle fra_best local.

  Activé par main.js quand la confiance OCR
  standard retournée par extraction.js est < 60%.

  Retourne un flag verificationRequise pour
  signaler à main.js que l'utilisateur doit
  vérifier manuellement le résultat.
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  SEUIL DE CONFIANCE
  ────────────────────────────────────────────────
  En dessous de ce seuil, on considère que
  le texte extrait est peu fiable et on lève
  le flag verificationRequise.
*/
var SEUIL_CONFIANCE_MANUSCRIT = 50;

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : ocrManuscrit(canvas)
  ────────────────────────────────────────────────
  Lance l'OCR avec le modèle fra local.
  Utilise Tesseract.recognize() directement
  comme extraction.js — pas de createWorker.

  Le modèle est chargé depuis /libs/tessdata/
  en local — pas d'internet requis.

  Retourne :
  {
    texte    : string,
    confiance: number (0-100)
  }

  Lève une erreur si le canvas est invalide,
  si Tesseract n'est pas chargé, ou si l'OCR
  échoue.
*/
async function ocrManuscrit(canvas) {

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('manuscrit.js — ocrManuscrit() : canvas invalide');
    }

    if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('manuscrit.js — ocrManuscrit() : canvas vide (width ou height = 0)');
    }

    if (typeof Tesseract === 'undefined') {
        throw new Error('manuscrit.js — ocrManuscrit() : Tesseract.js non chargé — vérifier libs.js');
    }

    try {
        var resultat = await Tesseract.recognize(canvas, 'fra_best', {
            langPath: '/libs/tessdata',
            logger: function(m) {
                if (m.status === 'recognizing text') {
                    var pct = Math.round((m.progress || 0) * 100);
                    console.log('OCR en cours : ' + pct + '%');
                }
            }
        });

        if (!resultat || !resultat.data) {
            throw new Error('manuscrit.js — ocrManuscrit() : résultat OCR invalide');
        }

        return {
            texte     : resultat.data.text     || '',
            confiance : resultat.data.confidence || 0,
        };

    } catch (erreur) {
        throw new Error('manuscrit.js — ocrManuscrit() : ' + erreur.message);
    }
}
/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : extraireManuscrit(canvas)
  ════════════════════════════════════════════════
  Orchestratrice — main.js appelle uniquement
  celle-ci.

  Paramètres :
    canvas : HTMLCanvasElement — image du document
             manuscrit

  Retourne :
  {
    texte              : string — texte extrait
    confiance          : number (0-100)
    verificationRequise: boolean — true si confiance
                         < SEUIL_CONFIANCE_MANUSCRIT
  }

  Lève une erreur si le canvas est invalide
  ou si l'OCR échoue complètement.
*/
async function extraireManuscrit(canvas) {

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('manuscrit.js — extraireManuscrit() : canvas invalide');
    }

    if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('manuscrit.js — extraireManuscrit() : canvas vide (width ou height = 0)');
    }

    try {
        var ocr = await ocrManuscrit(canvas);

        return {
            texte              : ocr.texte,
            confiance          : ocr.confiance,
            verificationRequise: ocr.confiance < SEUIL_CONFIANCE_MANUSCRIT,
        };

    } catch (erreur) {
        throw new Error('manuscrit.js — extraireManuscrit() : ' + erreur.message);
    }
}