
/*
  ────────────────────────────────────────────────
  FONCTION 1 : lireEnMemoire(file)
  ────────────────────────────────────────────────

  Un objet File n'est pas lisible directement.
  Il faut demander au navigateur de le lire
  et le convertir en ArrayBuffer.

  ArrayBuffer = représentation brute du fichier
                en mémoire (suite d'octets)

  C'est ce format qu'attend pdf.js.
*/
async function lireEnMemoire(file) {
    
    /* transformons file en une suite d'octets (ArrayBuffer)
    en utilisant la methode arrayBuffer(), native au navigateur */
    var arrayBuffer = await file.arrayBuffer();

    // on retourne les metadonnées du fichier + son contenu en mémoire
    return {
        nom: file.name,
        taille: file.size,
        type: file.type,
        buffer: arrayBuffer,
    };
}

/*
  ────────────────────────────────────────────────
  FONCTION 2 : detecterType(info)
  ────────────────────────────────────────────────

  Reçoit l'objet retourné par lireEnMemoire().
  Retourne une string indiquant le type de document.

  On utilise info.type (MIME) et info.nom (extension)
  car parfois le MIME est vide ou incorrect.

  Types possibles :
    'pdf'   → fichier PDF (natif ou scanné, on ne sait pas encore)
    'image' → JPG, PNG, WEBP — ira directement en OCR
    'autre' → non supporté
*/
function detecterType(info){

    // Vérifier le MIME
    if (info.type === 'application/pdf') {
        return 'pdf';
    }

    if (info.type.startsWith('image/')) {
        return 'image';
    }

    // quelquefois le navigateur retourne un type vide
    // on verifie alors l'extention du nom de fichier
    var nom = info.nom.toLowerCase();
    if (nom.endsWith('.pdf')) {
        return 'pdf';
    }

    if (nom.endsWith('.jpg') || nom.endsWith('.jpeg') || nom.endsWith('.png') || nom.endsWith('.webp')) {
        return 'image';
    }

    // si on ne reconnait pas le type, on retourne 'autre'
    return 'autre';
}

/*
  ────────────────────────────────────────────────
  FONCTION 3 : extraireTexteAvecPdfJs(buffer)
  ────────────────────────────────────────────────

  Reçoit un ArrayBuffer (les octets bruts du PDF).
  Retourne un objet avec le texte de chaque page
  et le nombre total de caractères.

  pdf.js travaille de façon asynchrone —
  chaque opération retourne une Promise.
*/
async function extraireTexteAvecPdfJs(buffer) {

    /*
      pdfjsLib.getDocument() charge le PDF en mémoire.
      On lui passe { data: buffer } — les octets bruts.
      .promise est nécessaire car getDocument() retourne
      un objet "LoadingTask", pas directement une Promise.
    */
   var copie = buffer.slice(0); // faire une copie du buffer pour pdf.js
   var pdfDoc = await pdfjsLib.getDocument({ data: copie }).promise;

   var nbPages = pdfDoc.numPages;
   var pages = [];
   var totalChars = 0;

    /*
      On boucle sur chaque page — les pages commencent à 1
      pas à 0 en pdf.js (attention c'est inhabituel).
    */
   for (var p = 1; p <= nbPages; p++) {
        var page = await pdfDoc.getPage(p);
        var content = await page.getTextContent();
        var texte = content.items
            .sort(function(a, b) {
                var dy = b.transform[5] - a.transform[5];
                if (Math.abs(dy) > 5) return dy;
                return a.transform[4] - b.transform[4];
            })
            .map(function(item) { return item.str; })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        totalChars += texte.length;
        pages.push({
            numero: p,
            texte: texte,
            chars : texte.length,
        });
   }
   
   return {
    nbPages: nbPages,
    totalChars: totalChars,
    pages: pages,
   };
}

/*
  ────────────────────────────────────────────────
  FONCTION 4 : estPageScannee(texte)
  ────────────────────────────────────────────────

  Reçoit le texte extrait par pdf.js pour une page.
  Retourne true si la page semble être une image scannée.

  On utilise le seuil de 50 caractères significatifs.
  En dessous → on considère que c'est un scan.

  "Significatifs" = on ignore les espaces et
  la pagination (1/2, 2/2...) qui ne sont pas
  du vrai contenu.
*/
function estPageScannee(texte){

    /*
      On supprime les espaces et on vérifie
      si ce qui reste est suffisant.
      Ex: "1/2" → après nettoyage → "1/2" → 3 chars → scanné
          "Nom : DIALLO" → 13 chars → pas scanné
    */
   var textePropre = texte
    .replace(/\s/g, '') // supprimer tous les espaces
    .replace(/^\d+\/\d+$/, ''); // supprimer les numéros de page

   return textePropre.length < 50;
}

/*
  ────────────────────────────────────────────────
  FONCTION 5 : rendrePageEnImage(pdfDoc, numPage)
  ────────────────────────────────────────────────

  Reçoit l'objet pdfDoc (PDF chargé par pdf.js)
  et le numéro de page.

  pdf.js peut dessiner n'importe quelle page
  dans un <canvas> HTML — exactement comme
  un navigateur affiche une page web dans un onglet.

  On utilise scale: 2.0 — cela double la résolution.
  Plus la résolution est haute → meilleur OCR.
  2.0 = bon compromis vitesse / qualité.

  Le canvas n'est pas ajouté à la page HTML —
  il reste en mémoire, invisible.
  Tesseract lit directement le canvas.
*/
async function rendrePageEnImage(pdfDoc, numPage){

    var page = await pdfDoc.getPage(numPage);

    /*
      getViewport({ scale }) retourne les dimensions
      de la page à l'échelle demandée.
      scale: 1.0 = taille originale
      scale: 2.0 = double résolution
    */
    var viewport = page.getViewport({ scale: 2.0 });

    // créer un canvas en mémoire avec les dimensions de la page
    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // dessiner la page dans le canvas
    await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport,
    }).promise;

    // retourner le canvas pour que Tesseract puisse le lire
    return canvas;
}

/*
  ────────────────────────────────────────────────
  FONCTION 6 : ocrAvecTesseract(canvas)
  ────────────────────────────────────────────────

  Reçoit un canvas (image de la page).
  Retourne le texte reconnu + le score de confiance.

  Tesseract.recognize() accepte directement un canvas
  sans conversion — il lit les pixels directement.

  'fra' = modèle français
  Tesseract télécharge fra.traineddata au premier appel
  (~10MB) puis le met en cache dans le navigateur.
  Les appels suivants sont instantanés.

  confidence : score 0-100
    > 80  → texte imprimé propre
    60-80 → acceptable
    < 60  → probablement manuscrit ou mauvaise qualité
*/
async function ocrAvecTesseract(canvas){

    var resultat = await Tesseract.recognize(canvas, 'fra_best', {
        langPath: '/libs/tessdata',
        logger: function(m) {
            if (m.status === 'recognizing text') {
                var pct = Math.round((m.progress || 0) * 100);
                console.log('OCR en cours : ' + pct + '%');
            }
        }
    });

    return {
        texte: resultat.data.text.trim(),
        confiance: resultat.data.confidence,
    };
}

/*
  ────────────────────────────────────────────────
  FONCTION 7 : extraire(file)
  ────────────────────────────────────────────────

  C'est la fonction publique de extraction.js.
  main.js n'appellera que celle-ci.

  Elle orchestre tout le FSM :
    1. lire le fichier
    2. détecter le type
    3. extraire le texte (pdf.js ou OCR selon le cas)
    4. retourner le texte propre

  Retourne toujours le même objet :
  {
    texte     : string    ← le texte extrait
    methode   : string    ← 'pdfjs' ou 'ocr'
    confiance : number    ← score OCR (null si pdfjs)
    pages     : number    ← nombre de pages
  }
*/
async function extraire(file) {

    // Étape 1 : lire le fichier
    var info = await lireEnMemoire(file);

    // Étape 2 : détecter le type
    var type = detecterType(info);

    if (type === 'autre') {
        throw new Error('Format non supporté : ' + info.nom);
    }

    // Étape 3a : image directe → OCR immédiat
    if (type === 'image') {
        var img    = new Image();
        img.src    = URL.createObjectURL(file);
        await new Promise(function(r) { img.onload = r; });

        var cv     = document.createElement('canvas');
        cv.width   = img.width;
        cv.height  = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);

        var ocr = await ocrAvecTesseract(cv);
        return {
            texte     : ocr.texte,
            methode   : 'ocr',
            confiance : ocr.confiance,
            pages     : 1
        };
    }

    // Étape 3b : PDF → on charge une seule fois
    var pdfDoc = await pdfjsLib.getDocument({
        data: info.buffer.slice(0)
    }).promise;

    var extraction = await extraireTexteAvecPdfJs(info.buffer);
    var texteTotal = '';
    var methode    = 'pdfjs';
    var confiance  = null;

    // Étape 4 : page par page
    for (var i = 0; i < extraction.pages.length; i++) {
        var page = extraction.pages[i];

        if (estPageScannee(page.texte)) {
            // Page scannée → OCR
            var canvas = await rendrePageEnImage(pdfDoc, page.numero);
            var ocrPage = await ocrAvecTesseract(canvas);
            texteTotal += ocrPage.texte + '\n\n';
            methode    = 'ocr';
            confiance  = ocrPage.confiance;
        } else {
            // Page native → texte direct
            texteTotal += page.texte + '\n\n';
        }
    }

    return {
        texte     : texteTotal.trim(),
        methode   : methode,
        confiance : confiance,
        pages     : extraction.nbPages
    };
}