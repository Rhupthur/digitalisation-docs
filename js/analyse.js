/*
  analyse.js
  Role : extraire les champs structures d'un texte
         en posant des questions au modele Q&A
*/

// Les questions — une par champ a extraire
var QUESTIONS_RELEVE = [
    {
        champ    : 'nom_complet',
        question : 'Quel est le nom complet de l etudiant ?'
    },
    {
        champ    : 'matricule',
        question : 'Quel est le matricule ?'
    },
    {
        champ    : 'specialite',
        question : 'Quelle est la specialite ?'
    },
    {
        champ    : 'annee_universitaire',
        question : 'Quelle est l annee universitaire ?'
    },
    {
        champ    : 'niveau',
        question : 'Quel est le niveau ?'
    },
    {
        champ    : 'date_edition',
        question : 'Quelle est la date d edition ?'
    }
];

// Singleton — null = pas encore charge
var modeleQA = null;

async function chargerModele() {

    // Deja charge — on retourne directement
    if (modeleQA !== null) {
        return modeleQA;
    }

    // Import dynamique de Transformers.js
    var transformers = await import(
        'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
    );

    // Charger le pipeline question-answering
    modeleQA = await transformers.pipeline(
        'question-answering',
        'Xenova/distilbert-base-multilingual-cased-finetuned-squad'
    );

    return modeleQA;
}