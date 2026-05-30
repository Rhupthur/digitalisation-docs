/*
  ════════════════════════════════════════════════
  analyse_llm.js
  Rôle : extraire les champs structurés d'un texte
         via WebLLM (WebGPU) — machines puissantes.

  Activé par main.js si CAPACITES.webgpu === true.

  Modèle choisi selon la RAM disponible :
  - RAM >= 4GB → Qwen2-1.5B-Instruct-q4f16_1-MLC
  - RAM <  4GB → Qwen2-0.5B-Instruct-q4f16_1-MLC
  ════════════════════════════════════════════════
*/

/*
  ────────────────────────────────────────────────
  MODÈLES SELON RAM
  ────────────────────────────────────────────────
*/
var MODELE_RAM_ELEVEE = 'Qwen2-1.5B-Instruct-q4f16_1-MLC';
var MODELE_RAM_FAIBLE = 'Qwen2-0.5B-Instruct-q4f16_1-MLC';


/*
  ────────────────────────────────────────────────
  QUESTIONS PAR TYPE DE DOCUMENT
  ────────────────────────────────────────────────
*/
var QUESTIONS_RELEVE = [
    { champ: 'nom_complet',         question: 'Quel est le nom complet de l\'étudiant ?' },
    { champ: 'matricule',           question: 'Quel est le matricule ?' },
    { champ: 'specialite',          question: 'Quelle est la spécialité ?' },
    { champ: 'annee_universitaire', question: 'Quelle est l\'année universitaire ?' },
    { champ: 'niveau',              question: 'Quel est le niveau ?' },
    { champ: 'date_edition',        question: 'Quelle est la date d\'édition ?' },
];

var QUESTIONS_ACTE = [
    { champ: 'nom_complet',        question: 'Quel est le nom complet de la personne ?' },
    { champ: 'date_naissance',     question: 'Quelle est la date de naissance ?' },
    { champ: 'lieu_naissance',     question: 'Quel est le lieu de naissance ?' },
    { champ: 'nom_pere',           question: 'Quel est le nom du père ?' },
    { champ: 'nom_mere',           question: 'Quel est le nom de la mère ?' },
    { champ: 'numero_acte',        question: 'Quel est le numéro de l\'acte ?' },
    { champ: 'date_etablissement', question: 'Quelle est la date d\'établissement de l\'acte ?' },
];

/*
  ────────────────────────────────────────────────
  SINGLETON WebLLM
  ────────────────────────────────────────────────
*/
var instanceWebLLM = null;

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : chargerModelleLLM()
  ────────────────────────────────────────────────
  Charge WebLLM une seule fois (singleton).
  Choisit le modèle selon la RAM disponible
  depuis CAPACITES (défini dans libs.js).

  Le modèle est téléchargé automatiquement
  depuis le CDN WebLLM au premier appel
  puis mis en cache dans le navigateur.

  Lève une erreur si WebLLM n'est pas chargé,
  si WebGPU est indisponible, ou si le
  chargement du modèle échoue.
*/
async function chargerModelleLLM(onProgression) {

    if (instanceWebLLM !== null) {
        return instanceWebLLM;
    }

    if (typeof CreateMLCEngine === 'undefined') {
        throw new Error('analyse_llm.js — chargerModelleLLM() : WebLLM non chargé — vérifier libs.js');
    }

    if (typeof CAPACITES === 'undefined' || !CAPACITES.webgpu) {
        throw new Error('analyse_llm.js — chargerModelleLLM() : WebGPU non disponible sur cette machine');
    }

    var modele = (CAPACITES.ram >= 4)
        ? MODELE_RAM_ELEVEE
        : MODELE_RAM_FAIBLE;

    try {
        var webllm = await import('/libs/webllm.js');

        var engine = await webllm.CreateMLCEngine(modele, {
            initProgressCallback: function(info) {
                console.log('analyse_llm.js — chargement modèle : ' + info.text);
                if (typeof onProgression === 'function') {
                    onProgression(info.text, info.progress);
                }
            }
        });

        instanceWebLLM = engine;
        return instanceWebLLM;

    } catch (erreur) {
        instanceWebLLM = null;
        throw new Error('analyse_llm.js — chargerModelleLLM() : ' + erreur.message);
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : poserQuestionLLM(contexte, question)
  ────────────────────────────────────────────────
  Envoie une question au modèle WebLLM avec
  le texte du document comme contexte.

  Même pattern qu'analyse.js mais via WebGPU.

  Retourne une string ou null si NON_TROUVE.
  Retourne null si le modèle plante — on ne
  bloque pas tout le document pour un seul champ.
*/
async function poserQuestionLLM(contexte, question, onProgression) {

    var engine = await chargerModelleLLM(onProgression);

    var resultat = await engine.chat.completions.create({
        messages: [
            {
                role   : 'system',
                content: 'Tu es un extracteur de données. ' +
                         'Réponds uniquement avec la valeur demandée, ' +
                         'sans phrase, sans explication. ' +
                         'Si tu ne trouves pas, réponds: NON_TROUVE'
            },
            {
                role   : 'user',
                content: 'Document:\n' + contexte + '\n\nQuestion: ' + question
            }
        ],
        max_tokens : 30,
        temperature: 0.1,
    });

    if (!resultat ||
        !resultat.choices ||
        !resultat.choices[0] ||
        !resultat.choices[0].message) {
        return null;
    }

    var reponse = resultat.choices[0].message.content.trim();
    return (reponse === 'NON_TROUVE') ? null : reponse;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : extraireListeMatieresLLM(texte)
  ────────────────────────────────────────────────
  Demande au modèle de lister toutes les matières
  séparées par des virgules.

  Retourne un tableau de strings.
  Retourne [] si le modèle ne trouve pas ou plante.
*/
async function extraireListeMatieresLLM(texte) {

    try {
        var engine = await chargerModelleLLM(onProgression);
        var resultat = await engine.chat.completions.create({
            messages: [
                {
                    role   : 'system',
                    content: 'Tu es un extracteur de données. ' +
                             'Réponds uniquement avec les valeurs demandées ' +
                             'séparées par des virgules, sans phrase, ' +
                             'sans explication. ' +
                             'Si tu ne trouves pas, réponds: NON_TROUVE'
                },
                {
                    role   : 'user',
                    content: 'Document:\n' + texte +
                             '\n\nListe toutes les matières présentes ' +
                             'dans ce relevé de notes, séparées par des virgules.'
                }
            ],
            max_tokens : 200,
            temperature: 0.1,
        });

        if (!resultat ||
            !resultat.choices ||
            !resultat.choices[0] ||
            !resultat.choices[0].message) {
            return [];
        }

        var reponse = resultat.choices[0].message.content.trim();

        if (reponse === 'NON_TROUVE') return [];

        return reponse
            .split(',')
            .map(function(m) { return m.trim(); })
            .filter(function(m) { return m.length > 0; });

    } catch (erreur) {
        console.error('analyse_llm.js — extraireListeMatieresLLM() : ' + erreur.message);
        return [];
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserReleveLLM(texte)
  ────────────────────────────────────────────────
  Extrait les champs simples du relevé de notes
  puis les matières et leurs notes respectives.

  Lève une erreur si le texte est vide.
*/
async function analyserReleveLLM(texte, onProgression) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse_llm.js — analyserReleveLLM() : texte vide');
    }

    var resultat = {};
    var total    = QUESTIONS_RELEVE.length;

    for (var i = 0; i < total; i++) {
        var q       = QUESTIONS_RELEVE[i];

        // Notifier la progression des questions
        if (typeof onProgression === 'function') {
            onProgression(
                'Question ' + (i + 1) + '/' + total + ' : ' + q.champ,
                (i + 1) / total
            );
        }

        var reponse = await poserQuestionLLM(texte, q.question, onProgression);
        resultat[q.champ] = reponse;
    }

    var matieres = await extraireListeMatieresLLM(texte, onProgression);
    var notes    = [];

    for (var j = 0; j < matieres.length; j++) {
        var note = await poserQuestionLLM(
            texte,
            'Quelle est la note obtenue en ' + matieres[j] + ' ?',
            onProgression
        );
        notes.push({ matiere: matieres[j], note: note });
    }

    resultat.matieres = notes;
    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserActeLLM(texte)
  ────────────────────────────────────────────────
  Extrait les champs d'un acte de naissance.
  Lève une erreur si le texte est vide.
*/
async function analyserActeLLM(texte, onProgression) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse_llm.js — analyserActeLLM() : texte vide');
    }

    var resultat = {};
    var total    = QUESTIONS_ACTE.length;

    for (var i = 0; i < total; i++) {
        var q = QUESTIONS_ACTE[i];

        if (typeof onProgression === 'function') {
            onProgression(
                'Question ' + (i + 1) + '/' + total + ' : ' + q.champ,
                (i + 1) / total
            );
        }

        var reponse = await poserQuestionLLM(texte, q.question, onProgression);
        resultat[q.champ] = reponse;
    }

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserAutresLLM(texte, champs)
  ────────────────────────────────────────────────
  Reçoit un tableau de champs définis par
  l'utilisateur.

  Lève une erreur si le texte est vide ou si
  champs n'est pas un tableau valide.
*/
async function analyserAutresLLM(texte, champs, onProgression) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse_llm.js — analyserAutresLLM() : texte vide');
    }

    if (!Array.isArray(champs) || champs.length === 0) {
        throw new Error('analyse_llm.js — analyserAutresLLM() : champs invalides ou vides');
    }

    var resultat = {};
    var total    = champs.length;

    for (var i = 0; i < total; i++) {
        var q = champs[i];

        if (!q.champ || !q.question) {
            console.error('analyse_llm.js — analyserAutresLLM() : champ invalide à l\'index ' + i);
            continue;
        }

        if (typeof onProgression === 'function') {
            onProgression(
                'Question ' + (i + 1) + '/' + total + ' : ' + q.champ,
                (i + 1) / total
            );
        }

        var reponse = await poserQuestionLLM(texte, q.question, onProgression);
        resultat[q.champ] = reponse;
    }

    return resultat;
}
/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : analyserLLM(texte, type, champs)
  ════════════════════════════════════════════════
  Orchestratrice — main.js appelle uniquement
  celle-ci.

  Paramètres :
    texte  : string — texte extrait du document
    type   : 'releve' | 'acte' | 'autres'
    champs : requis uniquement si type === 'autres'
             [{ champ: '...', question: '...' }]

  Retourne un objet structuré avec les champs
  extraits du document.

  Lève une erreur si le type est inconnu ou si
  les paramètres sont invalides.
*/
async function analyserLLM(texte, type, champs, onProgression) {

    if (!texte || typeof texte !== 'string' || texte.trim().length === 0) {
        throw new Error('analyse_llm.js — analyserLLM() : texte invalide ou vide');
    }

    if (!type || typeof type !== 'string' || type.trim().length === 0) {
        throw new Error('analyse_llm.js — analyserLLM() : type manquant');
    }

    if (type === 'releve') {
        return await analyserReleveLLM(texte, onProgression);
    }

    if (type === 'acte') {
        return await analyserActeLLM(texte, onProgression);
    }

    if (type === 'autres') {
        return await analyserAutresLLM(texte, champs, onProgression);
    }

    throw new Error('analyse_llm.js — analyserLLM() : type inconnu → ' + type);
}