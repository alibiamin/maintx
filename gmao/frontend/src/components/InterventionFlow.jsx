import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  useTheme,
  alpha,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  GroupAdd as AssignIcon,
  Build as ProgressIcon,
  DoneAll as DoneIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as VisibilityIcon
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
  return 'demande';
};

const priorityColors = { low: 'default', medium: 'primary', high: 'warning', critical: 'error' };

export default function InterventionFlow({ workOrders = [] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const [selectedStep, setSelectedStep] = useState('demande');

  const FLOW_STEPS = useMemo(() => getFlowSteps(t), [t]);

  const byStep = useMemo(() => {
    return FLOW_STEPS.reduce((acc, s) => {
      acc[s.key] = workOrders.filter(wo => mapStatusToStep(wo) === s.key);
      return acc;
    }, {});
  }, [workOrders, FLOW_STEPS]);

  const filteredOrders = useMemo(() => {
    if (!selectedStep) return workOrders;
    return byStep[selectedStep] || [];
  }, [workOrders, selectedStep, byStep]);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Flux des interventions
      </Typography>

      {/* Pipeline horizontal : étapes reliées par un trait */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(primary, 0.15)}`,
          overflow: 'hidden',
          mb: 3,
          background: `linear-gradient(135deg, ${alpha(primary, 0.03)} 0%, ${alpha(theme.palette.primary.light, 0.06)} 100%)`
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            minHeight: 80
          }}
        >
          {FLOW_STEPS.map((step, index) => {
            const items = byStep[step.key] || [];
            const count = items.length;
            const Icon = step.icon;
            const isSelected = selectedStep === step.key;
            const isLast = index === FLOW_STEPS.length - 1;
            return (
              <React.Fragment key={step.key}>
                <Box
                  onClick={() => setSelectedStep(isSelected ? null : step.key)}
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    borderRight: isLast ? 'none' : `2px solid ${alpha(primary, 0.2)}`,
                    bgcolor: isSelected ? alpha(step.color, 0.12) : 'transparent',
                    transition: 'background 0.2s',
                    '&:hover': { bgcolor: alpha(step.color, 0.08) }
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: alpha(step.color, 0.18),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Icon sx={{ color: step.color, fontSize: 24 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                      {step.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {step.sublabel}
                    </Typography>
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        mt: 0.5,
                        height: 22,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        bgcolor: alpha(step.color, 0.2),
                        color: step.color
                      }}
                    />
                  </Box>
                  {!isLast && (
                    <ChevronRightIcon sx={{ color: alpha(primary, 0.4), fontSize: 20, flexShrink: 0 }} />
                  )}
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
      </Paper>

      {/* Tableau des OT (remplace les cartes) */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          maxHeight: 360
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead
            sx={{
              '& .MuiTableCell-head': {
                fontWeight: 700,
                bgcolor: theme.palette.background.paper,
                borderBottom: `2px solid ${theme.palette.divider}`,
                position: 'sticky',
                top: 0,
                zIndex: 2
              }
            }}
          >
            <TableRow>
              <TableCell sx={{ width: 120 }}>Phase</TableCell>
              <TableCell sx={{ width: 110 }}>N° OT</TableCell>
              <TableCell>Titre</TableCell>
              <TableCell sx={{ width: 160 }}>Équipement</TableCell>
              <TableCell sx={{ width: 100 }}>Priorité</TableCell>
              <TableCell sx={{ width: 120 }}>Affecté à</TableCell>
              <TableCell sx={{ width: 56 }} align="center" />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                  {selectedStep
                    ? t('common.noData', 'Aucun OT dans cette phase')
                    : t('common.noData', 'Aucun ordre de travail dans le flux')}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((wo) => {
                const stepKey = mapStatusToStep(wo);
                const step = FLOW_STEPS.find(s => s.key === stepKey);
                const stepColor = step?.color || '#6b7280';
                return (
                  <TableRow
                    key={wo.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: alpha(primary, 0.04) }
                    }}
                    onClick={() => navigate(`/app/work-orders/${wo.id}`)}
                  >
                    <TableCell>
                      <Chip
                        size="small"
                        label={step?.label || stepKey}
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          bgcolor: alpha(stepColor, 0.15),
                          color: stepColor,
                          border: `1px solid ${alpha(stepColor, 0.3)}`
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {wo.number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.primary" noWrap sx={{ maxWidth: 220 }}>
                        {wo.title || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>
                        {wo.equipmentName || 'Sans équipement'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(`priority.${wo.priority}`, wo.priority)}
                        color={priorityColors[wo.priority]}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                        {wo.assignedName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title={t('common.view', 'Voir')}>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/app/work-orders/${wo.id}`)}
                          sx={{ color: primary }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedStep && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('flow.filterHint', 'Cliquez sur une phase pour filtrer. Cliquez à nouveau pour tout afficher.')}
        </Typography>
      )}
    </Box>
  );
}
