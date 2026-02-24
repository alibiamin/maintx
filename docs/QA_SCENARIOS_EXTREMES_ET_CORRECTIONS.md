# QA — Scénarios extrêmes et incohérents

*Audit type « QA parano » : suppression d’équipement lié, stock zéro/négatif, OT jamais clôturé, données manquantes/corrompues, payload API incomplet. Objectif : l’application ne plante jamais, les erreurs sont propres et explicites, aucune donnée critique n’est perdue.*

---

## 1. Suppression d’un équipement lié

### Comportement attendu
- L’équipement ne doit pas être supprimé tant qu’il est référencé par des OT, plans de maintenance, contrats, garanties, demandes d’intervention, etc.
- L’utilisateur doit recevoir un **message d’erreur explicite** indiquant la raison du refus (et si possible quoi faire).

### Scénarios testés (analyse code)

| Liaison | Avant correction | Après correction |
|--------|-------------------|------------------|
| **Ordres de travail** | 400 + message clair | Inchangé : « référencé par un ou plusieurs ordres de travail. Supprimez ou réaffectez les OT avant suppression. » |
| **Plans de maintenance** | 400 + message clair | Inchangé : « référencé par des plans de maintenance. Supprimez ou réaffectez les plans avant suppression. » |
| **Contrats de maintenance** | FK → 400 message générique | **400** : « cet équipement est lié à un ou plusieurs contrats de maintenance. » |
| **Garanties** | FK → 400 message générique | **400** : « cet équipement possède des garanties enregistrées. » |
| **Demandes d’intervention** | FK → 400 message générique | **400** : « cet équipement est référencé par des demandes d’intervention. » |
| **Documents, BOM, seuils** | FK → 400 générique | Message explicite : « Supprimez d’abord les éléments associés (documents, nomenclature, seuils, etc.). » |
| **Équipement inexistant** | 404 après DELETE (changes=0) | **404** renvoyé dès le début si l’équipement n’existe pas. |

### Corrections appliquées
- **Fichier :** `backend/src/routes/equipment.js` (DELETE `/:id`).
- Vérification explicite de l’existence de l’équipement avant toute logique métier.
- Vérifications explicites (avec gestion des tables optionnelles) pour :
  - `maintenance_contracts`
  - `warranties`
  - `intervention_requests`
- Message d’erreur en cas de FK restante : « Supprimez d’abord les éléments associés (documents, nomenclature, seuils, etc.). »

---

## 2. Stock à zéro ou négatif

### Comportement attendu
- **Entrée / Sortie / Transfert :** quantité strictement positive (≥ 1).
- **Réglage (adjustment) :** nouveau total ≥ 0.
- Le **stock affiché** ne doit jamais devenir négatif (déjà garanti par `Math.max(0, ...)` dans `updateBalance`).

### Scénarios testés

| Cas | Avant | Après |
|-----|--------|--------|
| POST `/stock/movements` avec `movementType: 'in'`, `quantity: 0` | Accepté (entrée 0 en base) | **400** : « La quantité doit être au moins 1 pour une entrée, sortie ou transfert. » |
| POST avec `quantity: -5` pour entrée | Entrée négative possible (incohérent) | **400** (même message) |
| POST sortie avec quantité > stock accepté | **400** : « Stock accepté insuffisant... » (déjà en place) | Inchangé |
| Réglage avec `quantity: -1` | Nouveau total négatif évité par `Math.max(0, ...)` mais mouvement enregistré | **400** : « La quantité (nouveau total) doit être un nombre >= 0 pour un réglage. » |

### Corrections appliquées
- **Fichier :** `backend/src/routes/stock.js` (POST `/movements`).
- Validation `body('quantity').custom(...)` :
  - Pour `in`, `out`, `transfer` : quantité ≥ 1.
  - Pour `adjustment` : quantité ≥ 0 et nombre fini.
- En cas d’erreur de validation : réponse **400** avec `{ error: "..." }` (message lisible par le frontend).

---

## 3. Ordre de travail jamais clôturé

### Comportement attendu
- Aucun plantage si un OT reste en « En cours » ou « À planifier » indéfiniment.
- Les rapports / KPIs doivent gérer l’absence de `completed_at` (pas de perte de données).

### Analyse
- **Backend :** Aucune contrainte obligeant la clôture ; statuts `pending`, `in_progress`, `completed`, `cancelled`, `deferred` gérés.
- **Frontend :** Affichage conditionnel sur `order?.status`, `order?.actualEnd`, etc. ; pas d’accès direct à une propriété inexistante qui ferait planter.
- **Rapports :** À vérifier en conditions réelles (filtres par statut, calculs MTTR/coûts en excluant les OT non clôturés).

### Recommandation (non implémentée)
- Indicateur ou filtre « OT ouverts depuis plus de X jours » pour faciliter le suivi.
- Dans les exports / KPIs : exclure explicitement les OT non clôturés des indicateurs « coût par OT » ou « durée moyenne » quand c’est pertinent.

---

## 4. Données manquantes ou corrompues

### Comportement attendu
- Pas de crash si une réponse API renvoie `null`, `[]` ou un objet partiel.
- Messages explicites en cas de 404 ou donnée invalide.

### Points vérifiés

| Contexte | Risque | Mitigation actuelle / correction |
|----------|--------|-----------------------------------|
| **Fiche OT** (`WorkOrderDetail`) | `order` null ou partiel | `if (loading \|\| !order) return <CircularProgress />` ; garde avec `order?.id` avant appels API. |
| **Listes (OT, équipements)** | `res.data` undefined | Usage de `res?.data ?? res ?? []` ou `Array.isArray(res.data) ? res.data : []`. |
| **Format WO / équipement** | Champs manquants | `formatWO` / `formatEquipment` utilisent des accès sûrs ; champs optionnels. |
| **Réservations / Pièces consommées** | `order.consumedParts` undefined | Affichage conditionnel `order.consumedParts && order.consumedParts.length > 0` avant `.map`. |
| **API 404** | Page blanche ou crash | Redirection ou message (ex. équipement → liste) ; composants avec `if (!order)` avant rendu. |

### Recommandation
- S’assurer que **toutes** les réponses d’erreur API (400, 404, 500) exposent un champ **`error`** (string) lisible par le frontend, et que les composants utilisent systématiquement `err.response?.data?.error || err.message || 'Erreur'` pour le snackbar.

---

## 5. Appels API avec payload incomplet

### Comportement attendu
- **400** avec message clair si champs obligatoires manquants ou invalides.
- Aucune donnée partielle ou incohérente enregistrée (pas de « demi-création »).

### Points vérifiés

| Endpoint | Validation | Message renvoyé |
|----------|------------|------------------|
| **POST /work-orders** | `body('title').notEmpty().trim()` | 400 + `errors.array()` (express-validator). |
| **POST /stock/movements** | `sparePartId`, `quantity`, `movementType` + custom quantity | 400 + `{ error: "..." }` (voir §2). |
| **POST /equipment** | À vérifier côté backend (code, nom, etc.) | — |
| **PUT /work-orders/:id** | Champs optionnels ; statut/workflow validés | 400 si valeurs hors liste, 404 si OT absent. |

### Correction appliquée (validation stock)
- Pour POST `/stock/movements`, en cas d’échec de validation, la réponse est **400** avec un seul champ **`error`** contenant le message (concaténation des messages de validation), pour que le frontend puisse toujours afficher `err.response?.data?.error`.

### Recommandation
- Partout où le backend renvoie `res.status(400).json({ errors: errors.array() })`, prévoir soit :
  - une normalisation côté backend en `{ error: errors.array().map(e => e.msg).join(' ') }`,  
  - soit côté frontend une fonction du type `getApiErrorMessage(err)` qui lit `err.response?.data?.error` ou, si absent, `err.response?.data?.errors?.[0]?.msg`.

---

## 6. Synthèse : l’application ne plante jamais

### Déjà en place
- **Backend :** Contrôles d’existence (404), validations express-validator, `try/catch` avec réponses 400/404/500 et message d’erreur.
- **Frontend :** Optionnel chaining (`order?.id`), gardes `if (!order)`, listes par défaut `[]`, `.catch(() => snackbar.showError(...))` sur les appels API critiques.
- **Stock :** `updateBalance` avec `Math.max(0, ...)` ; `deductStockOut` lance une erreur métier si stock insuffisant → 400 avec message clair.

### Corrections effectuées dans ce QA
1. **Suppression équipement :** Vérifications explicites (contrats, garanties, demandes d’intervention) + messages d’erreur explicites ; 404 si équipement inexistant avant toute action.
2. **Mouvements de stock :** Quantité ≥ 1 pour in/out/transfer, ≥ 0 pour adjustment ; réponse 400 avec `{ error: "..." }` en cas de validation invalide.

### À faire en continu
- Utiliser systématiquement `err.response?.data?.error || err.message || 'Erreur'` (ou une helper centralisée) pour l’affichage des erreurs.
- Ne jamais faire `.map` ou accès profond sur une liste/objet sans s’assurer qu’ils existent (`Array.isArray(x) && x.length > 0` avant `.map`, ou `x?.y`).
- Pour les créations (OT, équipement, pièce, etc.) : s’assurer que le backend valide tous les champs obligatoires et renvoie 400 avec un message unique lisible plutôt qu’un tableau brut si le frontend n’affiche que `error`.

---

## 7. Liste des scénarios problématiques et statut des corrections

| # | Scénario | Gravité | Correction |
|---|----------|---------|------------|
| 1 | Suppression équipement avec OT liés | Bloquant | Déjà géré ; message explicite conservé/amélioré. |
| 2 | Suppression équipement avec contrats / garanties / demandes d’intervention | Bloquant | **Corrigé** : vérifications explicites + message clair. |
| 3 | Suppression équipement inexistant | UX | **Corrigé** : 404 immédiat. |
| 4 | Mouvement de stock avec quantité 0 ou négative (in/out/transfer) | Données | **Corrigé** : validation + 400 avec message. |
| 5 | Réglage de stock avec nouveau total négatif | Données | **Corrigé** : validation adjustment ≥ 0. |
| 6 | Sortie stock > stock disponible | Données | Déjà géré : `deductStockOut` lance une erreur → 400. |
| 7 | OT jamais clôturé | Aucun (comportement métier) | Aucune correction nécessaire ; rapports à vérifier. |
| 8 | Réponse API 404 ou données null/partielles | Stabilité | Déjà bien mitégé (optionnel chaining, gardes). Recommandation : helper d’erreur unifiée. |
| 9 | Payload API incomplet (ex. title vide OT) | Données | Déjà géré (notEmpty). Stock : **corrigé** (quantity). |
| 10 | Message d’erreur validation illisible (tableau) | UX | **Corrigé** pour POST movements (un seul `error`). Recommandation : généraliser. |

---

*Document généré après analyse du code et corrections ciblées. Pour valider en conditions réelles : tests manuels ou E2E sur suppression équipement lié, mouvements de stock (0, négatif, réglage), et réponses API 400/404.*
