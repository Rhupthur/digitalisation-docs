/*
  ════════════════════════════════════════════════
  analyse.js
  Rôle : extraire les champs structurés d'un texte
         en posant des questions au modèle wllama
  ════════════════════════════════════════════════
*/

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
  SINGLETON wllama
  ────────────────────────────────────────────────
*/
var instanceWllama = null;

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : chargerModele()
  ────────────────────────────────────────────────
  Charge wllama une seule fois.
  Les appels suivants retournent l'instance
  déjà chargée sans recharger le modèle.

  Lève une erreur si le chargement échoue.
*/
async function chargerModele() {

    if (instanceWllama !== null) {
        return instanceWllama;
    }

    try {
        var { Wllama } = await import('/libs/wllama/wllama.js');

        var wllama = new Wllama({
            'default': '/libs/wllama/wllama.wasm'
        });

        await wllama.loadModelFromUrl(
            window.location.origin + '/models/qwen-wllama/qwen2.5-0.5b-q4.gguf',
            { n_ctx: 2048 }
        );

        instanceWllama = wllama;
        return instanceWllama;

    } catch (erreur) {
        instanceWllama = null;
        throw new Error('analyse.js — chargerModele() : ' + erreur.message);
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : poserQuestion(contexte, question)
  ────────────────────────────────────────────────
  Envoie une question au modèle avec le texte
  du document comme contexte.

  Retourne une string ou null si NON_TROUVE.
  Retourne null si le modèle plante — on ne
  bloque pas tout le document pour un seul champ.
*/
async function poserQuestion(contexte, question) {

    try {
        var wllama = await chargerModele();

        var resultat = await wllama.createCompletion({
            messages: [
                {
                    role: 'system',
                    content: 'Tu es un extracteur de données. ' +
                             'Réponds uniquement avec la valeur demandée, ' +
                             'sans phrase, sans explication. ' +
                             'Si tu ne trouves pas, réponds: NON_TROUVE'
                },
                {
                    role: 'user',
                    content: 'Document:\n' + contexte + '\n\nQuestion: ' + question
                }
            ],
            nPredict    : 30,
            temperature : 0.1,
        });

        var reponse = resultat.choices[0].message.content.trim();
        return (reponse === 'NON_TROUVE') ? null : reponse;

    } catch (erreur) {
        console.error('analyse.js — poserQuestion() — question: "' +
                      question + '" — ' + erreur.message);
        return null;
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : extraireListeMatieres(texte)
  ────────────────────────────────────────────────
  Demande au modèle de lister toutes les matières
  séparées par des virgules.

  Retourne un tableau de strings.
  Retourne [] si le modèle ne trouve pas ou plante.
*/
async function extraireListeMatieres(texte) {

    try {
        var wllama = await chargerModele();

        var resultat = await wllama.createCompletion({
            messages: [
                {
                    role: 'system',
                    content: 'Tu es un extracteur de données. ' +
                             'Réponds uniquement avec les valeurs demandées ' +
                             'séparées par des virgules, sans phrase, ' +
                             'sans explication. ' +
                             'Si tu ne trouves pas, réponds: NON_TROUVE'
                },
                {
                    role: 'user',
                    content: 'Document:\n' + texte +
                             '\n\nListe toutes les matières présentes ' +
                             'dans ce relevé de notes, séparées par des virgules.'
                }
            ],
            nPredict    : 200,
            temperature : 0.1,
        });

        var reponse = resultat.choices[0].message.content.trim();

        if (reponse === 'NON_TROUVE') return [];

        return reponse
            .split(',')
            .map(function(m) { return m.trim(); })
            .filter(function(m) { return m.length > 0; });

    } catch (erreur) {
        console.error('analyse.js — extraireListeMatieres() : ' + erreur.message);
        return [];
    }
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : extraireNoteMatiere(texte, matiere)
  ────────────────────────────────────────────────
  Pour une matière donnée, extrait la note
  correspondante dans le texte.

  Retourne une string (ex: "14/20") ou null.
*/
async function extraireNoteMatiere(texte, matiere) {

    return await poserQuestion(
        texte,
        'Quelle est la note obtenue en ' + matiere + ' ?'
    );
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserReleve(texte)
  ────────────────────────────────────────────────
  Extrait les champs simples du relevé de notes
  puis les matières et leurs notes respectives.

  Retourne un objet structuré.
  Lève une erreur si le texte est vide.
*/
async function analyserReleve(texte) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse.js — analyserReleve() : texte vide');
    }

    var resultat = {};

    // Champs simples
    for (var i = 0; i < QUESTIONS_RELEVE.length; i++) {
        var q       = QUESTIONS_RELEVE[i];
        var reponse = await poserQuestion(texte, q.question);
        resultat[q.champ] = reponse;
    }

    // Matières et notes
    var matieres = await extraireListeMatieres(texte);
    var notes    = [];

    for (var j = 0; j < matieres.length; j++) {
        var note = await extraireNoteMatiere(texte, matieres[j]);
        notes.push({
            matiere : matieres[j],
            note    : note
        });
    }

    resultat.matieres = notes;

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserActe(texte)
  ────────────────────────────────────────────────
  Extrait les champs d'un acte de naissance.

  Retourne un objet structuré.
  Lève une erreur si le texte est vide.
*/
async function analyserActe(texte) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse.js — analyserActe() : texte vide');
    }

    var resultat = {};

    for (var i = 0; i < QUESTIONS_ACTE.length; i++) {
        var q       = QUESTIONS_ACTE[i];
        var reponse = await poserQuestion(texte, q.question);
        resultat[q.champ] = reponse;
    }

    return resultat;
}

/*
  ────────────────────────────────────────────────
  FONCTION PRIVÉE : analyserAutres(texte, champs)
  ────────────────────────────────────────────────
  Reçoit un tableau de champs définis par
  l'utilisateur :
  [
    { champ: 'nom',  question: 'Quel est le nom ?' },
    { champ: 'date', question: 'Quelle est la date ?' },
  ]

  Retourne un objet structuré.
  Lève une erreur si le texte est vide ou si
  champs n'est pas un tableau valide.
*/
async function analyserAutres(texte, champs) {

    if (!texte || texte.trim().length === 0) {
        throw new Error('analyse.js — analyserAutres() : texte vide');
    }

    if (!Array.isArray(champs) || champs.length === 0) {
        throw new Error('analyse.js — analyserAutres() : champs invalides ou vides');
    }

    var resultat = {};

    for (var i = 0; i < champs.length; i++) {
        var q = champs[i];

        if (!q.champ || !q.question) {
            console.error('analyse.js — analyserAutres() : champ invalide à l\'index ' + i);
            continue;
        }

        var reponse = await poserQuestion(texte, q.question);
        resultat[q.champ] = reponse;
    }

    return resultat;
}

/*
  ════════════════════════════════════════════════
  FONCTION PUBLIQUE : analyser(texte, type, champs)
  ════════════════════════════════════════════════
  Orchestratrice — main.js appelle uniquement
  celle-ci.

  Paramètres :
    texte  : string — le texte extrait du document
    type   : 'releve' | 'acte' | 'autres'
    champs : requis uniquement si type === 'autres'
             [{ champ: '...', question: '...' }]

  Retourne un objet structuré avec les champs
  extraits du document.

  Lève une erreur si le type est inconnu.
*/
async function analyser(texte, type, champs) {

    if (type === 'releve') {
        return await analyserReleve(texte);
    }

    if (type === 'acte') {
        return await analyserActe(texte);
    }

    if (type === 'autres') {
        return await analyserAutres(texte, champs);
    }

    throw new Error('analyse.js — analyser() : type inconnu → ' + type);
}