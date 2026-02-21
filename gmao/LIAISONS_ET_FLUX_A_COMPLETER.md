# Ce qu’il manque pour que tout soit lié, organisé, synchronisé et fonctionne de bout en bout

Ce document complète **CE_QUI_MANQUE_POUR_ETRE_COMPLETE.md** et **SECTIONS_NON_IMPLEMENTEES.md** en se concentrant sur les **liaisons entre modules**, la **synchronisation** et le **flux métier** du début à la fin.

---

## 1. Flux préventif : Plan → OT → Intervention → Exécution plan / Checklist

### État actuel

| Étape | Ce qui existe | Ce qui manque |
|-------|----------------|----------------|
| **Plan de maintenance** | CRUD, échéances, liste « à venir » | — |
| **Génération / création OT** | Création manuelle d’OT avec `maintenance_plan_id` (page Création uniquement) | Pas de **génération automatique** ni de **bouton « Créer un OT »** depuis la liste des plans / échéances |
| **Exécution du plan** | Bouton « Exécuter » qui met à jour `last_execution_date` et `next_due_date` | Aucun **lien avec un OT** : on peut « exécuter » sans créer d’OT → pas de traçabilité (quel OT a réalisé cette exécution ?) |
| **Checklist** | Checklist liée à un plan (`maintenance_plan_id`), exécution avec ou sans OT | Sur la **fiche OT**, pas d’affichage du plan lié ni des **checklists du plan** avec accès rapide « Exécuter la checklist » |

### À faire pour un flux cohérent

1. **Depuis « Échéances » / « Plans »**  
   - Ajouter un bouton **« Créer un OT »** par plan (ou par ligne « à faire »).  
   - Action : ouvrir la création d’OT en pré-remplissant **équipement**, **plan** (`maintenance_plan_id`), **titre** (ex. nom du plan), **type** (préventif si disponible).

2. **Lors de l’exécution du plan**  
   - **Option A (recommandée)** : exiger ou proposer de **lier un OT** à l’exécution (saisie ou sélection de l’OT réalisé). Enregistrer ce lien (ex. table `maintenance_plan_executions` avec `plan_id`, `work_order_id`, `executed_at`, `executed_by`) pour traçabilité.  
   - **Option B** : au minimum, documenter que « Exécuter » = constat d’exécution sans OT ; garder la possibilité de créer l’OT avant ou après, manuellement.

3. **Fiche OT**  
   - Afficher le **plan de maintenance lié** (si `maintenancePlanId` présent) avec lien vers la fiche plan.  
   - Afficher les **checklists du plan** (GET `/checklists?maintenance_plan_id=…`) avec bouton **« Exécuter la checklist »** (en passant l’OT courant comme `work_order_id`) pour que l’intervention et la checklist soient naturellement reliées.

4. **Formulaire OT dédié** (`WorkOrderForm.jsx`)  
   - Ajouter le champ **Plan de maintenance** (optionnel) comme sur la page Création, pour lier l’OT au plan dès la création.

---

## 2. Alertes : tableau `alerts` vs alertes calculées (dashboard)

### État actuel

- **Table `alerts`** : alimentée uniquement à la **création d’un OT** (notification « Nouvelle panne » aux rôles maintenance).  
- **Dashboard** (`/api/dashboard/alerts`) : calcule à la volée **stock bas**, **SLA dépassé**, **plans en retard** (pas d’insertion dans `alerts`).  
- **Layout (cloche)** : lit `/api/alerts` → n’affiche que les alertes de la table (donc surtout « nouvelle panne »), pas les plans en retard ni le stock bas dans la cloche.

### À faire pour une synchronisation claire

1. **Centraliser les alertes visibles**  
   - Soit : **écrire** dans `alerts` lorsqu’un événement métier se produit (plan en retard détecté par un job, stock sous seuil, SLA dépassé), et garder la cloche comme seule source.  
   - Soit : faire en sorte que la **cloche** appelle aussi (ou à la place) un endpoint « toutes mes alertes » qui agrège **table `alerts`** + **dashboard/alerts** (stock, SLA, plans), pour un seul endroit où l’utilisateur voit tout.

2. **Création automatique d’alertes** (si on garde la table comme référence)  
   - **Plan en retard** : tâche planifiée ou vérification au chargement du dashboard qui insère une alerte par plan en retard (avec `entity_type` = `maintenance_plan`, `entity_id` = id du plan).  
   - **Stock sous seuil** : à la sortie stock ou à un contrôle périodique, insérer une alerte `stock_alert` (déjà prévu côté type, à brancher).  
   - **SLA OT dépassé** : idem, insertion d’une alerte lors d’un job ou au passage en retard.

---

## 3. Stock ↔ OT et traçabilité

### État actuel

- **Mouvements de stock** : `work_order_id` et `user_id` possibles en base.  
- **Création de mouvements** : surtout depuis la page **Création** ; pas de formulaire direct sur les pages Entrées / Sorties / Transferts (voir SECTIONS_NON_IMPLEMENTEES.md).  
- **Fiche OT** : pas d’affichage des **mouvements de stock** (sorties) liés à cet OT.

### À faire

1. **Fiche OT** : afficher les **mouvements** (sorties) dont `work_order_id` = cet OT (appel API type GET `/stock/movements?work_order_id=…` ou champ déjà renvoyé par une API OT enrichie).  
2. **Traçabilité** : s’assurer que **toute** création de mouvement renseigne `user_id` (utilisateur connecté).  
3. **Optionnel** : formulaires de création directe sur les pages Entrées / Sorties / Transferts pour ne pas dépendre uniquement de la page Création.

---

## 4. Résumé des liens à renforcer

| Liaison | Où c’est utilisé | Manque |
|--------|-------------------|--------|
| **Plan → OT** | Création (page Création), base (champ `maintenance_plan_id`) | Bouton « Créer un OT » depuis plans/échéances ; formulaire OT dédié sans champ plan ; exécution plan sans lien OT |
| **OT → Plan** | API GET work-order renvoie le champ | Fiche OT n’affiche pas le plan ni les checklists du plan |
| **OT ↔ Checklist** | Exécution checklist avec `work_order_id` optionnel | Sur fiche OT : pas de liste des checklists du plan ni bouton « Exécuter » pré-rempli avec cet OT |
| **Alertes ↔ Événements** | Table `alerts` + dashboard calculé | Cloche = seulement table ; pas d’écriture auto pour plans en retard / stock / SLA |
| **Stock ↔ OT** | Mouvements avec `work_order_id` | Fiche OT ne liste pas les sorties liées ; `user_id` à garantir partout |

---

## 5. Ordre de priorité recommandé (flux et liaisons)

| Priorité | Action | Impact |
|----------|--------|--------|
| **Haute** | Bouton « Créer un OT » depuis les échéances / plans (pré-remplissage équipement + plan) | Boucle préventive complète : plan → OT → intervention |
| **Haute** | Fiche OT : afficher plan lié + checklists du plan + « Exécuter la checklist » (avec cet OT) | Checklist et OT vraiment reliés dans l’usage |
| **Moyenne** | Champ « Plan de maintenance » dans le formulaire OT dédié (`WorkOrderForm.jsx`) | Cohérence avec la page Création |
| **Moyenne** | Alertes : unifier cloche et dashboard (agrégat ou écriture dans `alerts` pour plans en retard, stock, SLA) | Utilisateur voit tout au même endroit |
| **Moyenne** | Fiche OT : bloc « Sorties stock » liées à cet OT | Traçabilité pièces / OT |
| **Basse** | Lier explicitement l’exécution du plan à un OT (table exécutions ou champ) | Traçabilité « cette exécution = OT #X » |

En complétant au moins les points **haute priorité**, le flux **Plan préventif → OT → Checklist (et optionnellement stock)** sera clair, lié et exploitable de bout en bout. Les autres points renforcent la cohérence et la traçabilité.
