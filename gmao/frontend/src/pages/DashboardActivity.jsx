import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
  Button
} from '@mui/material';
import { Assignment, Build, CheckCircle, Schedule, ArrowBack, List as ListIcon } from '@mui/icons-material';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';

export default function DashboardActivity() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const res = await api.get('/dashboard/activity');
      setActivities(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setActivities([]);
      snackbar.showError('Erreur chargement de l\'activité');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'work_order':
        return <Assignment />;
      case 'maintenance':
        return <Build />;
      case 'completed':
        return <CheckCircle />;
      default:
        return <Schedule />;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'work_order':
        return 'primary';
      case 'maintenance':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Activité récente
        </Typography>
        <Box display="flex" gap={1}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/app')} size="small">Tableau de bord</Button>
          <Button startIcon={<ListIcon />} onClick={() => navigate('/app/work-orders')} size="small" variant="outlined">Tous les OT</Button>
        </Box>
      </Box>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : activities.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune activité récente
            </Typography>
          ) : (
            <List>
              {activities.map((activity, index) => (
                <React.Fragment key={activity.id}>
                  <ListItem
                    sx={{ cursor: activity.type === 'work_order' && activity.id ? 'pointer' : 'default', '&:hover': activity.type === 'work_order' && activity.id ? { bgcolor: 'action.hover' } : {} }}
                    onClick={() => { if (activity.type === 'work_order' && activity.id) navigate(`/app/work-orders/${activity.id}`); }}
                  >
                    <ListItemAvatar>
                      <Chip icon={getIcon(activity.type)} color={getColor(activity.type)} size="small" />
                    </ListItemAvatar>
                    <ListItemText
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                      primary={
                        <Box component="span" display="flex" alignItems="center" gap={1} flexWrap="wrap">
                          <span>{activity.title}</span>
                          {activity.work_order_number && (
                            <Typography component="span" variant="caption" color="primary">#{activity.work_order_number}</Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'block' }}>
                          {(activity.equipment_name || activity.description) && (
                            <Typography component="span" variant="body2" color="text.secondary" display="block">
                              {activity.equipment_name || activity.description}
                            </Typography>
                          )}
                          <Typography component="span" variant="caption" color="text.secondary" display="block">
                            {new Date(activity.created_at).toLocaleString('fr-FR')}
                          </Typography>
                        </Box>
                      }
                    />
                    <Chip label={activity.status} size="small" />
                  </ListItem>
                  {index < activities.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
