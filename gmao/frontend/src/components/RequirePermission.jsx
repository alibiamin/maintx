import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

/**
 * Affiche les enfants uniquement si l'utilisateur a la permission (resource, action).
 * Sinon : redirection vers /forbidden ou rendu d'un message.
 */
export default function RequirePermission({ resource, action = 'view', children, fallback }) {
  const { can, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (can(resource, action)) {
    return children;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  return <Navigate to="/forbidden" replace state={{ from: location, required: `${resource}.${action}` }} />;
}

/**
 * Réserve l'accès aux admins plateforme MAINTX (sans tenant). Sinon redirection vers /forbidden.
 */
export function RequireMaintxAdmin({ children }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!user?.isAdmin) {
    return <Navigate to="/forbidden" replace state={{ from: location, required: 'maintx_admin' }} />;
  }
  return children;
}

/**
 * Affiche les enfants uniquement si l'utilisateur a la permission (resource, action).
 * Sinon ne rend rien (pour masquer boutons, sections, etc. selon les habilitations).
 */
export function Can({ resource, action = 'view', children, fallback = null }) {
  const { can, isAuthenticated } = useAuth();
  if (!isAuthenticated) return fallback;
  return can(resource, action) ? children : fallback;
}

/**
 * Page affichée lorsque l'utilisateur n'a pas la permission requise.
 */
export function ForbiddenPage() {
  const location = useLocation();
  const required = location.state?.required;

  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        Accès refusé
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Vous n'avez pas la permission d'accéder à cette ressource.
        {required && (
          <Typography component="span" display="block" variant="body2" sx={{ mt: 1 }}>
            Permission requise : {required}
          </Typography>
        )}
      </Typography>
      <Button variant="contained" component={Link} to="/app">
        Retour au tableau de bord
      </Button>
    </Box>
  );
}
