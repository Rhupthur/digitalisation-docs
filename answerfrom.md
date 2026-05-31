# Réponses au formulaire d'inscription — Hackathon

> Réponses préparées à partir du fichier `projet-hackathon.md`, prêtes à recopier dans le formulaire d'inscription de l'équipe.

---

## 1. Quel est le nom du projet ?

**Plateforme d'indexation et de recherche documentaire intelligente pour une mairie**

> ⚠️ Le projet n'a pas encore de nom court / de marque (acronyme ou nom commercial). À définir si le formulaire le demande.

---

## 2. Brève description du problème sociétal (5 à 10 lignes)

Dans les mairies, le patrimoine documentaire (actes d'état civil, délibérations, arrêtés, permis d'urbanisme, dossiers sociaux…) est dispersé entre papier, scans et dossiers numériques mal organisés. Retrouver un document précis dépend souvent de la mémoire de quelques agents, et ce savoir se perd avec les départs. Faute de point d'entrée unique, les agents perdent un temps considérable à chercher, voire refont des documents qu'ils ne retrouvent pas. Cela ralentit le service rendu aux citoyens et fragilise la continuité du service public. À cela s'ajoute un enjeu de confidentialité : ces documents contiennent des données personnelles sensibles (RGPD) qui ne peuvent pas être confiées à des solutions cloud externes. Le problème sociétal est donc double : améliorer l'efficacité et la qualité du service public local, tout en garantissant la souveraineté et la protection des données des citoyens.

---

## 3. Quelle solution envisagez-vous avec l'IA ? (10 à 15 lignes – objectif, impact, technologies envisagées)

**Objectif.** Nous concevons une plateforme web qui centralise tous les documents d'une mairie et permet de les retrouver instantanément en posant une simple question en langage naturel. La solution fonctionne en trois temps : ingestion d'un document, indexation automatique, puis recherche intelligente.

**Le rôle de l'IA** s'articule à trois niveaux. D'abord, un OCR intelligent transforme scans et images (y compris manuscrits) en texte exploitable. Ensuite, une indexation sémantique par embeddings convertit chaque passage en vecteur capturant son sens, pour une recherche par intention et non par simple mot-clé. Enfin, un mécanisme de RAG (recherche augmentée par génération) retrouve les passages pertinents et les fournit à un modèle de langage local qui rédige une réponse synthétique en citant ses sources — sans hallucination, et de façon traçable.

**Impact.** Gain de temps majeur pour les agents, fin de la dépendance au « collègue qui sait », service plus rapide rendu aux citoyens, valorisation des archives, et conformité RGPD par conception puisque tout le traitement reste local.

**Technologies envisagées.** Interface PWA (HTML/JS), OCR via Tesseract.js, extraction PDF via pdf.js, embeddings locaux (type MiniLM / BGE via Transformers.js/ONNX), index vectoriel léger, et LLM local (wllama en CPU ou WebLLM en GPU). Principe directeur : souveraineté totale, aucune donnée ne quitte l'infrastructure de la mairie.

---

> 📝 Ce fichier sera complété au fur et à mesure des questions suivantes du formulaire.
