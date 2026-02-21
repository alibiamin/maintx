# Sections ou fonctions non implémentées ou incomplètes

## 1. **Planning — API manquantes (corrigé)**

- **PlanningAssignments** : `GET /api/planning/assignments` a été ajouté (liste des OT assignés par technicien).
- **PlanningResources** : `GET /api/planning/resources` a été ajouté (techniciens, équipements, OT actifs).

---

## 2. **Menu Équipements — Liens incorrects (corrigé)**

Les entrées **Historique**, **Documents**, **Garanties** pointaient vers `/equipment/history` etc., interprétés comme un id d’équipement.  
**Correction :** les trois entrées pointent maintenant vers `/equipment` avec le libellé « (par équipement) ». L’utilisateur ouvre la liste puis une fiche équipement pour accéder à l’historique, aux documents et aux garanties.

---

## 3. **Rapports — Exports** (`/reports/exports`) — partiellement corrigé

- **ReportsExports.jsx** : les exports **Ordres de travail (Excel)** et **Rapport détaillé (Excel)** sont branchés sur les API existantes et déclenchent un téléchargement.
- Les autres types (Liste équipements PDF, Plans maintenance PDF, État stocks, KPIs PDF) restent marqués « Non disponible (à venir) ».

---

## 4. **Stock — Inventaires** (`/stock/inventories`)

- **Backend :** `GET /api/stock/inventories` renvoie toujours `[]` (pas de table ni logique métier).
- **Frontend :** bouton « Nouvel inventaire » sans action (pas de modal, pas de création).
- Aucune table `inventories` ou `stock_inventories` en base.

→ **Fonctionnalité non implémentée** (écran + API à créer si besoin).

---

## 5. **Stock — Réapprovisionnements** (`/stock/reorders`)

- **Backend :** `GET /api/stock/reorders` renvoie toujours `[]` (pas de table ni logique).
- **Frontend :** affiche une liste vide avec message « Aucune demande de réapprovisionnement ».

→ **Fonctionnalité non implémentée** (demandes de réappro, workflow, etc. à définir et coder).

---

## 6. **Stock — Entrées / Sorties / Transferts** (vues listes)

- **Backend :**  
  - `GET /stock/entries` → mouvements de type `in` (implémenté).  
  - `GET /stock/exits` → mouvements de type `out` (implémenté).  
  - `GET /stock/transfers` → mouvements de type `transfer` (implémenté).
- **Frontend :** les pages listent les données mais indiquent « Création dans le menu Création » (pas de formulaire direct sur la page Entrées/Sorties/Transferts).

→ **Implémentation partielle** : consultation OK, création uniquement via la page Création (cohérent mais à documenter).

---

## 7. **Résumé**

| Section / Fonction              | État                    | Action recommandée                                      |
|--------------------------------|-------------------------|--------------------------------------------------------|
| Planning Assignments           | Corrigé                 | API ajoutée                                            |
| Planning Resources             | Corrigé                 | API ajoutée                                            |
| Menu Historique/Docs/Garanties | Corrigé                 | Liens vers `/equipment` avec libellé « (par équipement) » |
| Reports Exports (boutons)      | Partiellement corrigé   | Excel OT et rapport détaillé branchés ; PDF à venir     |
| Stock Inventaires              | Non implémenté          | Implémenter (table + API + UI) ou retirer du menu      |
| Stock Réapprovisionnements     | Non implémenté          | Implémenter (demandes + workflow) ou retirer du menu   |
