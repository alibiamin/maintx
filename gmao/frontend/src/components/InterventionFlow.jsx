import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  GroupAdd as AssignIcon,
  Build as ProgressIcon,
  DoneAll as DoneIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

function getFlowSteps(t) {
  return [
    { key: 'demande', label: t('flow.demande', 'Demande'), sublabel: t('flow.demande_sublabel', 'Déclaration panne'), icon: AssignmentIcon, color: '#f59e0b' },
    { key: 'assigned', label: t('flow.assigned', 'Affectation'), sublabel: t('flow.assigned_sublabel', 'Équipe assignée'), icon: AssignIcon, color: '#8b5cf6' },
    { key: 'in_progress', label: t('status.in_progress'), sublabel: t('flow.in_progress_sublabel', 'Intervention terrain'), icon: ProgressIcon, color: '#06b6d4' },
    { key: 'completed', label: t('status.completed'), sublabel: t('status.completed'), icon: DoneIcon, color: '#10b981' }
  ];
}

const mapStatusToStep = (wo) => {
  if (wo.status === 'completed') return 'completed';
  if (wo.status === 'in_progress') return 'in_progress';
  if (wo.status === 'cancelled' || wo.status === 'deferred') return null;
  if (wo.assignedTo && wo.status === 'pending') return 'assigned';
  return 'demande'; // pending sans affectation
};

const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };

export default function InterventionFlow({ workOrders = [] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const FLOW_STEPS = getFlowSteps(t);

  const byStep = FLOW_STEPS.reduce((acc, s) => {
    acc[s.key] = workOrders.filter(wo => mapStatusToStep(wo) === s.key);
    return acc;
  }, {});

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Flux des interventions
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          minHeight: 280
        }}
      >
        {FLOW_STEPS.map((step) => {
          const items = byStep[step.key] || [];
          const Icon = step.icon;
          return (
            <Card
              key={step.key}
              sx={{
                minWidth: 260,
                maxWidth: 280,
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha(step.color, 0.3),
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  bgcolor: alpha(step.color, 0.12),
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    bgcolor: alpha(step.color, 0.25),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon sx={{ color: step.color, fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {items.length} OT — {step.sublabel}
                  </Typography>
                </Box>
              </Box>
              <CardContent sx={{ py: 1.5, maxHeight: 220, overflowY: 'auto' }}>
                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Aucun
                  </Typography>
                ) : (
                  items.map((wo) => (
                    <Card
                      key={wo.id}
                      variant="outlined"
                      sx={{
                        mb: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        borderColor: 'divider',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                      onClick={() => navigate(`/app/work-orders/${wo.id}`)}
                    >
                      <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {wo.number}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {wo.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {wo.equipmentName || 'Sans équipement'}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={t(`priority.${wo.priority}`, wo.priority)}
                            color={priorityColors[wo.priority]}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {wo.assignedName && (
                            <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem', bgcolor: 'primary.main' }}>
                              {(wo.assignedName || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </Avatar>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
