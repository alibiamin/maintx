# GMAO - Gestion de Maintenance Assistée par Ordinateur

Application web professionnelle de GMAO destinée aux entreprises industrielles.

## Stack technique

- **Backend** : Node.js, Express, SQLite (better-sqlite3)
- **Frontend** : React 18, Vite, Material UI (MUI)
- **Authentification** : JWT + rôles (Administrateur, Responsable maintenance, Technicien, Utilisateur)
- **API** : RESTful

## Modules fonctionnels

- **Tableau de bord** : KPIs (disponibilité, MTBF, MTTR), graphiques, activité récente
- **Équipements** : CRUD, arborescence, fiches techniques, historique des interventions
- **Ordres de travail** : Déclaration de panne, affectation techniciens, suivi statuts
- **Maintenance préventive** : Plans de maintenance, échéances, exécution
- **Stocks** : Pièces de rechange, alertes seuil, mouvements
- **Fournisseurs** : Gestion, commandes
- **Rapports** : Coûts par équipement, export Excel
- **Utilisateurs** : Gestion des comptes (Admin)

## Démarrage rapide

```bash
# Installer les dépendances (backend + frontend)
cd gmao/backend && npm install && cd ../frontend && npm install

# Initialiser la base de données
cd gmao/backend
npm run init-db
npm run migrate    # Pour base existante (sites, lignes)
npm run seed

# Lancer le backend (port 5000)
npm run dev

# Dans un autre terminal : lancer le frontend (port 3000)
cd gmao/frontend && npm run dev
```

Ou manuellement :

```bash
cd gmao/backend
npm install
npm run init-db
npm run seed
npm run dev

# Autre terminal
cd gmao/frontend
npm install
npm run dev
```

### Comptes de démo

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@gmao.com | Password123! | Administrateur |
| responsable@gmao.com | Password123! | Responsable maintenance |
| technicien@gmao.com | Password123! | Technicien |
| user@gmao.com | Password123! | Utilisateur |

## Structure

```
AppWeb/
├── gmao/
│   ├── backend/       # API Express + SQLite
│   │   ├── src/
│   │   │   ├── database/  # init, migrate, seed
│   │   │   ├── routes/    # auth, dashboard, equipment, work-orders, sites...
│   │   │   └── middleware/
│   │   └── data/          # gmao.db
│   ├── frontend/      # React + Vite + MUI + Zustand
│   │   └── src/
│   │       ├── pages/
│   │       ├── store/     # authStore, uiStore
│   │       ├── shared/    # DataTable, colors
│   │       └── services/
│   └── docs/          # Spécification GMAO
├── package.json
└── README.md
```

## Nouveautés (implémentation spec)

- **Sites & Lignes** : Organisation géographique du parc
- **Criticité équipements** : A, B, C pour priorisation
- **Dashboard** : Alertes stock en temps réel
- **Filtres** : Ligne dans liste équipements
