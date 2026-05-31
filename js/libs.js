
/*
  ════════════════════════════════════════════════
  libs.js
  Rôle : savoir ce que la machine de l'utilisateur
         est capable de faire AVANT de charger quoi
         que ce soit.
  ════════════════════════════════════════════════
*/

// Capacités de la machine de l'utilisateur a voir avant de charger quoi que ce soit
var CAPACITES = {
    "webgpu": false,
    "ram": null,
    "modele_ia": null,
    "pdfjs": false,
    "tesseract": false,
    "webllm": false,
};


/*
  ────────────────────────────────────────────────
  FONCTION 1 : détecter WebGPU et la RAM
  ────────────────────────────────────────────────

  navigator.gpu
    → propriété standard W3C
    → existe seulement si le navigateur supporte WebGPU
    → undefined sur les vieux navigateurs

  navigator.gpu.requestAdapter()
    → vérifie si le GPU physique est accessible
    → peut retourner null même si navigator.gpu existe
      (ex: driver trop vieux, GPU blacklisté par Chrome)

  navigator.deviceMemory
    → retourne la RAM en GB (arrondi : 0.25, 0.5, 1, 2, 4, 8)
    → undefined sur Firefox et Safari
    → on met 4 par défaut si non disponible
*/


// detecter les capacités de la machine de l'utilisateur
async function detecterCapacites(){

    // Detecter la capacite de la RAM. On met 4 directement si non disponible.
    CAPACITES.ram = navigator.deviceMemory || 4;

    // Detecter la capacite de WebGPU
    if (!navigator.gpu) {
        CAPACITES.webgpu = false;
    } else {
        var adapter = await navigator.gpu.requestAdapter();
        CAPACITES.webgpu = (adapter !== null);
    }

    // Choisir le model d'IA en fonction des capacites ci-dessus
    if (!CAPACITES.webgpu) {
        CAPACITES.modele_ia = 'qwen-wllama';
        CAPACITES.webllm = false;
    } else if (CAPACITES.ram >= 4) {
        CAPACITES.modele_ia = 'qwen-webllm';
        CAPACITES.webllm = true;
    
    } else {
        CAPACITES.modele_ia = 'qwen-wllama';
        CAPACITES.webllm = false;
    }

    return CAPACITES;
}

/*
  ────────────────────────────────────────────────
  FONCTION 2 : charger pdf.js
  ────────────────────────────────────────────────

  On ne charge pas pdf.js avec une balise <script>
  dans le HTML. On le charge dynamiquement depuis JS.

  Pourquoi ?
  Parce qu'on veut contrôler QUAND il se charge
  et être notifié QUAND il est prêt.

  document.createElement('script') crée une balise
  <script> en mémoire sans l'ajouter à la page.

  document.head.appendChild() l'ajoute au <head>
  ce qui déclenche le téléchargement.
*/

// Charger pdf.js dynamiquement
function chargerPdfJs(){
    return new Promise(function(resolve, reject){
        var script = document.createElement('script');
        script.src = './libs/pdf.min.mjs';
        script.type = 'module';

        script.onload = function(){
            import('../libs/pdf.min.mjs').then(function(module) {
                window.pdfjsLib = module;
                pdfjsLib.GlobalWorkerOptions.workerSrc = '../libs/pdf.worker.min.mjs';
                CAPACITES.pdfjs = true;
                resolve('pdf.js prêt');
            }).catch(reject);
        };

        script.onerror = function(){
            CAPACITES.pdfjs = false;
            reject(new Error('Échec du chargement de pdf.js'));
        };

        document.head.appendChild(script);
    });

}

/*
  ────────────────────────────────────────────────
  FONCTION 3 : charger Tesseract.js
  ────────────────────────────────────────────────

  Tesseract.js est un script classique — pas un module.
  Il expose window.Tesseract automatiquement au chargement.
  
  Tesseract → fichier .js → window.Tesseract disponible
                               directement après onload
*/
function chargerTesseractJs() {
    return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = './libs/tesseract.min.js';

        script.onload = function() {
            if (window.Tesseract) {
                CAPACITES.tesseract = true;
                resolve('Tesseract.js prêt');
            } else {
                reject(new Error('Tesseract.js chargé mais window.Tesseract introuvable'));
            }
        };

        script.onerror = function() {
            CAPACITES.tesseract = false;
            reject(new Error('Échec du chargement de Tesseract'));
        };

        document.head.appendChild(script);
    });
}

/*
  ────────────────────────────────────────────────
  FONCTION 4 : initialiser
  ────────────────────────────────────────────────
  Elle retourne CAPACITES quand tout est prêt.
  En cas d'erreur sur une lib, elle s'arrête
  immédiatement et remonte l'erreur.
*/
async function initialiser() {
    await detecterCapacites();
    await chargerPdfJs();
    await chargerTesseractJs();
    return CAPACITES;
}
