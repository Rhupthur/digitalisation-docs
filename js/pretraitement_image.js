/*
  ════════════════════════════════════════════════
  pretraitement_image.js
  Rôle : améliorer une image de document via
         OpenCV WASM avant l'OCR (extraction.js)

  Pipeline :
  1. Débruitage — filtre gaussien
  2. Amélioration contraste — CLAHE
  3. Détection bords — Canny + Transformée de Hough
  4. Redressement perspective
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  SINGLETON OpenCV
  ────────────────────────────────────────────────
*/
var instanceOpenCV = null;

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : chargerOpenCV()
  ────────────────────────────────────────────────
  Charge opencv.js une seule fois en lazy loading.
  Lève une erreur si le chargement échoue
  ou si le timeout de 30 secondes est dépassé.
*/
async function chargerOpenCV() {

    if (instanceOpenCV !== null) {
        return instanceOpenCV;
    }

    await new Promise(function(resolve, reject) {

        var limite = setTimeout(function() {
            reject(new Error('pretraitement_image.js — chargerOpenCV() : timeout dépassé'));
        }, 30000);

        var script   = document.createElement('script');
        script.src   = '/libs/opencv.js';
        script.async = true;

        script.onload = async function() {
            try {
                // opencv.js récent retourne une Promise
                if (typeof cv === 'function' || (typeof cv === 'object' && typeof cv.then === 'function')) {
                    var module = await cv;
                    window.cv  = module;
                }

                var attente = setInterval(function() {
                    if (typeof cv !== 'undefined' && cv.Mat) {
                        clearInterval(attente);
                        clearTimeout(limite);
                        resolve();
                    }
                }, 100);

            } catch (erreur) {
                clearTimeout(limite);
                reject(new Error('pretraitement_image.js — chargerOpenCV() : ' + erreur.message));
            }
        };

        script.onerror = function() {
            clearTimeout(limite);
            reject(new Error('pretraitement_image.js — chargerOpenCV() : impossible de charger opencv.js'));
        };

        document.head.appendChild(script);
    });

    if (typeof cv === 'undefined' || !cv.Mat) {
        throw new Error('pretraitement_image.js — chargerOpenCV() : cv introuvable après chargement');
    }

    instanceOpenCV = cv;
    return instanceOpenCV;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : canvasVersMatOpenCV(canvas)
  ────────────────────────────────────────────────
  Convertit un canvas HTML en Mat OpenCV.
  Le Mat doit être libéré après utilisation
  avec mat.delete() pour éviter les fuites mémoire.
*/
function canvasVersMatOpenCV(canvas) {

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('pretraitement_image.js — canvasVersMatOpenCV() : canvas invalide');
    }

    var ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('pretraitement_image.js — canvasVersMatOpenCV() : impossible d\'obtenir le contexte 2D');
    }

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return cv.matFromImageData(imageData);
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : matOpenCVVersCanvas(mat, canvas)
  ────────────────────────────────────────────────
  Convertit un Mat OpenCV vers un canvas HTML.
*/
function matOpenCVVersCanvas(mat, canvas) {

    if (!mat || mat.isDeleted()) {
        throw new Error('pretraitement_image.js — matOpenCVVersCanvas() : mat invalide ou supprimé');
    }

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('pretraitement_image.js — matOpenCVVersCanvas() : canvas invalide');
    }

    cv.imshow(canvas, mat);
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : debruitage(mat)
  ────────────────────────────────────────────────
  Filtre gaussien — réduit le bruit de scan.
  ksize (5,5), sigmaX 0 (calculé automatiquement)
*/
function debruitage(mat) {

    if (!mat || mat.isDeleted()) {
        throw new Error('pretraitement_image.js — debruitage() : mat invalide ou supprimé');
    }

    var resultat = new cv.Mat();

    try {
        cv.GaussianBlur(mat, resultat, new cv.Size(5, 5), 0);
    } catch (erreur) {
        resultat.delete();
        throw new Error('pretraitement_image.js — debruitage() : ' + erreur.message);
    }

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : ameliorerContraste(mat)
  ────────────────────────────────────────────────
  CLAHE — améliore le contraste localement.
  clipLimit 2.0, tileGridSize 8x8.
  Convertit en gris, applique CLAHE, reconvertit RGBA.
*/
function ameliorerContraste(mat) {

    if (!mat || mat.isDeleted()) {
        throw new Error('pretraitement_image.js — ameliorerContraste() : mat invalide ou supprimé');
    }

    var gris     = new cv.Mat();
    var claheRes = new cv.Mat();
    var resultat = new cv.Mat();
    var clahe    = null;

    try {
        cv.cvtColor(mat, gris, cv.COLOR_RGBA2GRAY);
        clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(gris, claheRes);
        cv.cvtColor(claheRes, resultat, cv.COLOR_GRAY2RGBA);

    } catch (erreur) {
        resultat.delete();
        throw new Error('pretraitement_image.js — ameliorerContraste() : ' + erreur.message);

    } finally {
        gris.delete();
        claheRes.delete();
        if (clahe) clahe.delete();
    }

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : detectionBords(mat)
  ────────────────────────────────────────────────
  Canny + Transformée de Hough.

  1. Conversion niveaux de gris
  2. Canny (seuil bas 50, seuil haut 150)
  3. HoughLinesP (longueur min = 30% largeur, écart max 20px)

  Retourne 4 coins du document ou null si
  aucune ligne détectée.
*/
function detectionBords(mat) {

    if (!mat || mat.isDeleted()) {
        throw new Error('pretraitement_image.js — detectionBords() : mat invalide ou supprimé');
    }

    var gris   = new cv.Mat();
    var bords  = new cv.Mat();
    var lignes = new cv.Mat();

    try {
        cv.cvtColor(mat, gris, cv.COLOR_RGBA2GRAY);
        cv.Canny(gris, bords, 50, 150);

        cv.HoughLinesP(
            bords,
            lignes,
            1,
            Math.PI / 180,
            100,
            mat.cols * 0.3,
            20
        );

        if (lignes.rows === 0) {
            return null;
        }

        var xMin = mat.cols, xMax = 0;
        var yMin = mat.rows, yMax = 0;

        for (var i = 0; i < lignes.rows; i++) {
            var x1 = lignes.data32S[i * 4];
            var y1 = lignes.data32S[i * 4 + 1];
            var x2 = lignes.data32S[i * 4 + 2];
            var y2 = lignes.data32S[i * 4 + 3];

            xMin = Math.min(xMin, x1, x2);
            xMax = Math.max(xMax, x1, x2);
            yMin = Math.min(yMin, y1, y2);
            yMax = Math.max(yMax, y1, y2);
        }

        return [
            { x: xMin, y: yMin },
            { x: xMax, y: yMin },
            { x: xMax, y: yMax },
            { x: xMin, y: yMax },
        ];

    } catch (erreur) {
        throw new Error('pretraitement_image.js — detectionBords() : ' + erreur.message);

    } finally {
        gris.delete();
        bords.delete();
        lignes.delete();
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : redressement(mat, coins)
  ────────────────────────────────────────────────
  Transformation de perspective pour redresser
  le document.

  Si coins est null ou invalide — retourne
  le mat original cloné sans modification.
*/
function redressement(mat, coins) {

    if (!mat || mat.isDeleted()) {
        throw new Error('pretraitement_image.js — redressement() : mat invalide ou supprimé');
    }

    if (!coins || !Array.isArray(coins) || coins.length !== 4) {
        return mat.clone();
    }

    var largeur = Math.max(
        Math.abs(coins[1].x - coins[0].x),
        Math.abs(coins[2].x - coins[3].x)
    );

    var hauteur = Math.max(
        Math.abs(coins[3].y - coins[0].y),
        Math.abs(coins[2].y - coins[1].y)
    );

    if (largeur <= 0 || hauteur <= 0) {
        return mat.clone();
    }

    var srcPoints = null;
    var dstPoints = null;
    var transform = null;
    var resultat  = new cv.Mat();

    try {
        srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            coins[0].x, coins[0].y,
            coins[1].x, coins[1].y,
            coins[2].x, coins[2].y,
            coins[3].x, coins[3].y,
        ]);

        dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0,       0,
            largeur, 0,
            largeur, hauteur,
            0,       hauteur,
        ]);

        transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
        cv.warpPerspective(mat, resultat, transform, new cv.Size(largeur, hauteur));

    } catch (erreur) {
        resultat.delete();
        throw new Error('pretraitement_image.js — redressement() : ' + erreur.message);

    } finally {
        if (srcPoints) srcPoints.delete();
        if (dstPoints) dstPoints.delete();
        if (transform) transform.delete();
    }

    return resultat;
}

/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : pretraiterImage(canvas)
  ════════════════════════════════════════════════
  Orchestratrice — main.js appelle uniquement
  celle-ci.

  Paramètres :
    canvas : HTMLCanvasElement — image du document

  Retourne un HTMLCanvasElement amélioré
  prêt pour extraction.js.

  Lève une erreur si le canvas est invalide,
  vide, ou si OpenCV échoue.
*/
async function pretraiterImage(canvas) {

    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('pretraitement_image.js — pretraiterImage() : canvas invalide');
    }

    if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('pretraitement_image.js — pretraiterImage() : canvas vide (width ou height = 0)');
    }

    await chargerOpenCV();

    var mat        = null;
    var matDebrui  = null;
    var matContr   = null;
    var matRedress = null;

    try {
        mat       = canvasVersMatOpenCV(canvas);
        matDebrui = debruitage(mat);
        mat.delete();
        mat = null;

        matContr  = ameliorerContraste(matDebrui);
        matDebrui.delete();
        matDebrui = null;

        var coins  = detectionBords(matContr);
        matRedress = redressement(matContr, coins);
        matContr.delete();
        matContr = null;

        var canvasResultat    = document.createElement('canvas');
        canvasResultat.width  = matRedress.cols;
        canvasResultat.height = matRedress.rows;
        matOpenCVVersCanvas(matRedress, canvasResultat);

        return canvasResultat;

    } catch (erreur) {
        throw new Error('pretraitement_image.js — pretraiterImage() : ' + erreur.message);

    } finally {
        if (mat        && !mat.isDeleted())        mat.delete();
        if (matDebrui  && !matDebrui.isDeleted())  matDebrui.delete();
        if (matContr   && !matContr.isDeleted())   matContr.delete();
        if (matRedress && !matRedress.isDeleted())  matRedress.delete();
    }
}