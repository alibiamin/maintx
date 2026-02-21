/**
 * Codes couleur - Priorités, statuts (Design system)
 */
export const PRIORITY_COLORS = {
  critical: { main: '#ef4444', label: 'Critique' },
  high: { main: '#f59e0b', label: 'Haute' },
  medium: { main: '#3b82f6', label: 'Moyenne' },
  low: { main: '#6b7280', label: 'Basse' }
};

export const STATUS_COLORS = {
  pending: { main: '#f59e0b', label: 'En attente' },
  in_progress: { main: '#3b82f6', label: 'En cours' },
  completed: { main: '#22c55e', label: 'Terminé' },
  cancelled: { main: '#6b7280', label: 'Annulé' },
  deferred: { main: '#8b5cf6', label: 'Reporté' },
  operational: { main: '#22c55e', label: 'Opérationnel' },
  maintenance: { main: '#f59e0b', label: 'En maintenance' },
  out_of_service: { main: '#ef4444', label: 'Hors service' },
  retired: { main: '#6b7280', label: 'Retiré' }
};

export const CRITICITE_COLORS = {
  A: { main: '#ef4444', label: 'A - Production' },
  B: { main: '#f59e0b', label: 'B - Support' },
  C: { main: '#6b7280', label: 'C - Secondaire' }
};
