# Indicateurs MTTR et MTBF — Définitions et calculs

*Référence pour la maintenance industrielle (normes type EN 15341).*

---

## MTTR (Mean Time To Repair) — Temps moyen de réparation

- **Définition :** Durée moyenne pour réparer un équipement après une panne (de la prise en charge à la fin de l’intervention).
- **Unité :** **heures (h)** partout dans l’application (dashboard, rapports, objectifs).
- **Formule :**  
  `MTTR = Σ (actual_end − actual_start) / nombre de réparations`
- **Périmètre :**
  - OT **correctifs** uniquement : `failure_date` renseignée **ou** type d’OT « Correctif » (libellé contenant "correctif" / "corrective").
  - OT **clôturés** (`status = 'completed'`).
  - Durée **réelle** : `actual_start` et `actual_end` non nuls, `actual_end > actual_start`.
- **Où c’est utilisé :**
  - **Dashboard** : KPIs (objectif type MTTR ≤ 24 h).
  - **Rapports** : onglet MTTR, page « Rapports > MTBF / MTTR », export PDF KPIs.
  - **Service backend :** `backend/src/services/mttrMtbf.js` (`getMttr`), routes `reports.js` et `dashboard.js`.

---

## MTBF (Mean Time Between Failures) — Temps moyen entre pannes

- **Définition :** Temps moyen entre deux pannes consécutives pour un équipement (à partir des dates de panne déclarées).
- **Unité :** **jours (j)** partout dans l’application (dashboard, rapports, objectifs type MTBF ≥ 30 j).
- **Formule :**
  - Par équipement : moyenne des intervalles `failure_date[i] − failure_date[i−1]` (en jours).
  - Global : moyenne de tous ces intervalles (tous équipements).
- **Périmètre :**
  - OT avec **failure_date** renseignée, **status = completed**, **equipment_id** non nul.
  - Intervalles calculés **par équipement** (PARTITION BY equipment_id) pour ne pas mélanger les actifs.
- **Où c’est utilisé :**
  - **Dashboard** : KPIs (objectif type MTBF ≥ 30 j).
  - **Rapports** : page « Rapports > MTBF / MTTR » (tableau par équipement + global en jours).
  - **Export PDF** : indicateurs KPIs (MTBF moyen en jours).
  - **Service backend :** `mttrMtbf.js` (`getMtbf`), routes `reports.js` et `dashboard.js`.

---

## Cohérence dans l’application

| Lieu              | MTTR      | MTBF      |
|-------------------|-----------|-----------|
| Dashboard / KPIs  | heures (h)| jours (j) |
| Page MTBF/MTTR    | heures (h)| jours (j) |
| Objectifs (indicator_targets) | MTTR ≤ X h | MTBF ≥ X j |
| Export PDF KPIs   | heures    | jours     |
| API `/reports/mttr` | mttr_hours | —       |
| API `/reports/mtbf` | —       | mtbf_days (et mtbf_hours pour conversion) |
| API `/dashboard/kpis` | mttr (heures) | mtbf (jours) |

Les calculs sont centralisés dans le service `mttrMtbf.js` pour le dashboard et la période glissante ; les rapports avec dates début/fin utilisent les routes `/reports/mttr` et `/reports/mtbf` avec les mêmes règles métier (OT correctifs pour MTTR, failure_date et intervalles par équipement pour MTBF).
