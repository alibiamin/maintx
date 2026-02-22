import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress,
  List, ListItem, ListItemText, ListItemButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PlayArrow, CheckCircle, Schedule } from '@mui/icons-material';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};
const todayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

export default function MyWorkOrdersToday() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const snackbar = useSnackbar();

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get('/work-orders', { params: { assignedTo: user.id, limit: 100 } })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        const arr = Array.isArray(data) ? data : [];
        const start = todayStart();
        const end = todayEnd();
        const todayOrInProgress = arr.filter((wo) => {
          if (wo.status === 'in_progress') return true;
          if (wo.status !== 'pending') return false;
          const planned = wo.plannedStart || wo.plannedEnd || wo.createdAt;
          if (!planned) return true;
          return planned >= start && planned <= end;
        });
        setList(todayOrInProgress);
      })
      .catch(() => snackbar.showError('Erreur chargement'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleStart = (woId) => {
    setActionId(woId);
    api.put(`/work-orders/${woId}`, { status: 'in_progress', actualStart: new Date().toISOString() })
      .then(() => {
        setList((prev) => prev.map((wo) => (wo.id === woId ? { ...wo, status: 'in_progress' } : wo)));
        snackbar.showSuccess('OT démarré');
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setActionId(null));
  };

  return (
    <Box>
      <Box mb={2}>
        <h2 style={{ margin: 0 }}>Mes OT du jour</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b' }}>Ordres de travail qui vous sont affectés (aujourd'hui ou en cours)</p>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
      ) : list.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">Aucun OT prévu pour vous aujourd'hui.</Typography>
            <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/app/work-orders')}>Voir tous les OT</Button>
          </CardContent>
        </Card>
      ) : (
        <List disablePadding>
          {list.map((wo) => (
            <Card key={wo.id} sx={{ mb: 1.5 }}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate(`/work-orders/${wo.id}`)}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography fontWeight={600}>{wo.number}</Typography>
                        <Chip size="small" label={wo.status === 'in_progress' ? 'En cours' : 'Planifié'} color={wo.status === 'in_progress' ? 'info' : 'default'} />
                        {wo.priority === 'critical' && <Chip size="small" label="Critique" color="error" />}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="body2">{wo.title}</Typography>
                        {(wo.equipmentName || wo.equipmentCode) && (
                          <Typography variant="caption" color="text.secondary">
                            {[wo.equipmentCode, wo.equipmentName].filter(Boolean).join(' — ')}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItemButton>
              </ListItem>
              <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<Schedule />} onClick={() => navigate(`/work-orders/${wo.id}`)}>Voir détail</Button>
                {wo.status === 'pending' && (
                  <Button size="small" variant="contained" startIcon={<PlayArrow />} onClick={(e) => { e.stopPropagation(); handleStart(wo.id); }} disabled={actionId === wo.id}>
                    Démarrer
                  </Button>
                )}
                {wo.status === 'in_progress' && (
                  <Button size="small" variant="contained" startIcon={<CheckCircle />} onClick={() => navigate(`/work-orders/${wo.id}`)}>Clôturer (avec signature)</Button>
                )}
              </Box>
            </Card>
          ))}
        </List>
      )}
    </Box>
  );
}
