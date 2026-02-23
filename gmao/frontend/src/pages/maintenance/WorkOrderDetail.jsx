import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction,
  LinearProgress,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';
import { ArrowBack, PlayArrow, Stop, PersonSearch, Star, Schedule, Checklist, Inventory, Description, Download, Delete, Upload, Print, Add, MenuBook, Build } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTranslation } from 'react-i18next';

const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', cancelled: 'default', deferred: 'default' };

export default function WorkOrderDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useCurrency();
  const [order, setOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestedList, setSuggestedList] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [planChecklists, setPlanChecklists] = useState([]);
  const [assignedChecklists, setAssignedChecklists] = useState([]);
  const [woChecklistExecutions, setWoChecklistExecutions] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [woDocuments, setWoDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [reservationForm, setReservationForm] = useState({ sparePartId: '', quantity: 1 });
  const [reservationSubmitting, setReservationSubmitting] = useState(false);
  const [toolAssignments, setToolAssignments] = useState([]);
  const [tools, setTools] = useState([]);
  const [selectedToolId, setSelectedToolId] = useState('');
  const [toolAssigning, setToolAssigning] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [operatorAdding, setOperatorAdding] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance', 'technicien'].includes(user?.role);
  const canClose = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const loadOrder = () => {
    if (id === 'new') return;
    api.get(`/work-orders/${id}`).then(r => setOrder(r.data)).catch(() => navigate('/app/work-orders'));
  };

  const loadReservations = () => {
    if (!id || id === 'new') return;
    api.get(`/work-orders/${id}/reservations`).then(r => setReservations(Array.isArray(r.data) ? r.data : [])).catch(() => setReservations([]));
  };

  const loadToolAssignments = () => {
    if (!id || id === 'new') return;
    api.get(`/work-orders/${id}/tool-assignments`).then(r => setToolAssignments(Array.isArray(r.data) ? r.data : [])).catch(() => setToolAssignments([]));
  };

  useEffect(() => {
    if (id === 'new') return;
    Promise.all([
      api.get(`/work-orders/${id}`),
      api.get('/users/assignable').then(r => r.data).catch(() => []),
      api.get(`/work-orders/${id}/reservations`).catch(() => ({ data: [] })),
      api.get('/stock/parts').catch(() => ({ data: [] })),
      api.get('/tools').catch(() => ({ data: [] }))
    ]).then(([wo, u, resRes, partsRes, toolsRes]) => {
      setOrder(wo.data);
      setUsers(u);
      setReservations(Array.isArray(resRes?.data) ? resRes.data : []);
      const parts = partsRes?.data?.data ?? partsRes?.data ?? [];
      setSpareParts(Array.isArray(parts) ? parts : []);
      setTools(Array.isArray(toolsRes?.data) ? toolsRes.data : []);
    }).catch(() => navigate('/app/work-orders')).finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!order?.id) return;
    loadToolAssignments();
  }, [order?.id]);

  useEffect(() => {
    if (!order?.maintenancePlanId) return;
    api.get('/checklists', { params: { maintenance_plan_id: order.maintenancePlanId } })
      .then(r => setPlanChecklists(r.data || []))
      .catch(() => setPlanChecklists([]));
  }, [order?.maintenancePlanId]);

  useEffect(() => {
    const ids = order?.assignedChecklistIds;
    if (!ids?.length) { setAssignedChecklists([]); return; }
    api.get('/checklists')
      .then(r => {
        const list = r.data || [];
        setAssignedChecklists(list.filter(c => ids.includes(c.id)));
      })
      .catch(() => setAssignedChecklists([]));
  }, [order?.id, order?.assignedChecklistIds?.length]);

  useEffect(() => {
    if (!order?.id) return;
    api.get(`/work-orders/${order.id}/checklist-executions`)
      .then(r => setWoChecklistExecutions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setWoChecklistExecutions([]));
  }, [order?.id]);

  // Dédupliquer par id pour éviter affichages en double (API ou intercepteur peuvent renvoyer des doublons)
  const dedupeById = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return arr;
    const seen = new Set();
    return arr.filter((item) => {
      const id = item?.id;
      if (id == null || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  useEffect(() => {
    if (!order?.id) return;
    api.get('/stock/movements', { params: { work_order_id: order.id } })
      .then(r => setStockMovements(dedupeById(r.data || [])))
      .catch(() => setStockMovements([]));
  }, [order?.id]);

  useEffect(() => {
    if (!order?.id) return;
    api.get('/documents', { params: { entity_type: 'work_order', entity_id: order.id } })
      .then(r => setWoDocuments(dedupeById(r.data || [])))
      .catch(() => setWoDocuments([]));
  }, [order?.id]);

  const handleDownloadDoc = (docId) => {
    api.get(`/documents/${docId}/download`, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = woDocuments.find(d => d.id === docId)?.original_filename || 'document';
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        const msg = err.response?.status === 404 ? 'Fichier introuvable sur le serveur' : 'Téléchargement impossible';
        snackbar.showError(msg);
      });
  };

  const handleUploadDoc = (e) => {
    const file = e.target?.files?.[0];
    if (!file || !order?.id) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', 'work_order');
    formData.append('entity_id', String(order.id));
    api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(() => api.get('/documents', { params: { entity_type: 'work_order', entity_id: order.id } }))
      .then(r => { setWoDocuments(dedupeById(r.data || [])); snackbar.showSuccess('Document ajouté'); e.target.value = ''; })
      .catch(err => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setUploadingDoc(false));
  };

  const handleDeleteDoc = (docId) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    api.delete(`/documents/${docId}`)
      .then(() => setWoDocuments(prev => prev.filter(d => d.id !== docId)))
      .catch(() => snackbar.showError('Erreur'));
  };

  const handleStatusChange = (newStatus) => {
    if (!canEdit || !order?.id) return;
    if (newStatus === 'completed' && canClose) {
      setSignatureName([user?.firstName, user?.lastName].filter(Boolean).join(' ') || '');
      setCloseDialogOpen(true);
      return;
    }
    setActionLoading(true);
    api.put(`/work-orders/${order.id}`, { ...order, status: newStatus })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Statut mis à jour'); })
      .catch(err => { snackbar.showError(err.response?.data?.error || 'Erreur'); })
      .finally(() => setActionLoading(false));
  };

  const handleConfirmClose = () => {
    if (!order?.id) return;
    setActionLoading(true);
    api.put(`/work-orders/${order.id}`, {
      status: 'completed',
      signatureName: signatureName.trim() || undefined,
      completedBy: user?.id
    })
      .then(r => { setOrder(r.data); setCloseDialogOpen(false); snackbar.showSuccess('OT clôturé avec signature.'); })
      .catch(err => { snackbar.showError(err.response?.data?.error || 'Erreur'); })
      .finally(() => setActionLoading(false));
  };

  const handleAssign = (userId) => {
    if (!canEdit || !order?.id) return;
    api.put(`/work-orders/${order.id}`, { assignedTo: userId || null })
      .then(r => { setOrder(r.data); setSuggestOpen(false); snackbar.showSuccess('Responsable principal mis à jour'); })
      .catch(() => snackbar.showError('Erreur'));
  };

  const handleAddOperator = () => {
    if (!canEdit || !order?.id || !selectedOperatorId) return;
    setOperatorAdding(true);
    api.post(`/work-orders/${order.id}/operators`, { userId: parseInt(selectedOperatorId, 10) })
      .then(() => { loadOrder(); setSelectedOperatorId(''); snackbar.showSuccess('Opérateur ajouté'); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setOperatorAdding(false));
  };

  const handleRemoveOperator = (userId) => {
    if (!canEdit || !order?.id) return;
    if (!window.confirm('Retirer cet opérateur de l\'OT ?')) return;
    api.delete(`/work-orders/${order.id}/operators/${userId}`)
      .then(() => { loadOrder(); snackbar.showSuccess('Opérateur retiré'); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };

  const handleAssignTool = () => {
    if (!canEdit || !order?.id || !selectedToolId) return;
    setToolAssigning(true);
    const assigneeId = order.assignedTo || (order.assignedOperators && order.assignedOperators[0]?.id) || user?.id;
    api.post(`/tools/${selectedToolId}/assign`, { work_order_id: order.id, assigned_to: assigneeId })
      .then(() => { loadToolAssignments(); setSelectedToolId(''); api.get('/tools').then(r => setTools(r.data || [])); snackbar.showSuccess('Outil affecté'); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setToolAssigning(false));
  };

  const handleReturnTool = (toolId, assignmentId) => {
    if (!canEdit || !toolId || !assignmentId) return;
    if (!window.confirm('Enregistrer le retour de cet outil ?')) return;
    api.post(`/tools/${toolId}/return`, { assignment_id: assignmentId })
      .then(() => { loadToolAssignments(); api.get('/tools').then(r => setTools(r.data || [])); snackbar.showSuccess('Outil retourné'); })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };

  const loadSuggestions = () => {
    if (!order?.id) return;
    setSuggestLoading(true);
    setSuggestOpen(true);
    api.get('/technicians/suggest-assignment', { params: { workOrderId: order.id } })
      .then(r => setSuggestedList(r.data || []))
      .catch(() => setSuggestedList([]))
      .finally(() => setSuggestLoading(false));
  };

  const handleStartWork = () => {
    if (!canEdit || !order?.id || order.status !== 'pending') return;
    setActionLoading(true);
    const now = new Date().toISOString();
    api.put(`/work-orders/${order.id}`, { ...order, status: 'in_progress', actualStart: now })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Travail démarré'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setActionLoading(false));
  };

  const handleMarkEnd = () => {
    if (!canEdit || !order?.id || order.status !== 'in_progress') return;
    setActionLoading(true);
    const now = new Date().toISOString();
    api.put(`/work-orders/${order.id}`, { ...order, actualEnd: now })
      .then(r => { setOrder(r.data); snackbar.showSuccess('Fin du travail enregistrée. Un responsable ou administrateur clôturera l\'OT.'); })
      .catch(() => snackbar.showError('Erreur'))
      .finally(() => setActionLoading(false));
  };

  const handlePrintPdf = () => {
    if (!order?.id) return;
    setActionLoading(true);
    api.get(`/reports/export/pdf/work-order/${order.id}`, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        const w = window.open(url, '_blank');
        if (w) w.onload = () => URL.revokeObjectURL(url);
        else { URL.revokeObjectURL(url); snackbar.showSuccess('PDF téléchargé (ouvrez les téléchargements si la fenêtre a été bloquée).'); }
      })
      .catch(() => snackbar.showError('Erreur lors de la génération du PDF'))
      .finally(() => setActionLoading(false));
  };

  if (id === 'new') return <Navigate to="/app/creation" replace />;
  if (loading || !order) return <Box p={4}><CircularProgress /></Box>;

  const statusOptions = [
    { value: 'pending', label: t('status.pending') },
    { value: 'in_progress', label: t('status.in_progress') },
    ...(canClose ? [{ value: 'completed', label: t('status.completed_closed') }] : []),
    { value: 'cancelled', label: t('status.cancelled') },
    { value: 'deferred', label: t('status.deferred') }
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/work-orders')}>Retour</Button>
        <Button startIcon={<Print />} onClick={handlePrintPdf} disabled={actionLoading} variant="outlined" size="small">
          Imprimer / PDF
        </Button>
      </Box>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5">{order.number}</Typography>
              <Typography variant="h6">{order.title}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={t(`status.${order.status}`, order.status)} color={statusColors[order.status]} size="small" />
                <Chip label={t(`priority.${order.priority}`, order.priority)} size="small" variant="outlined" />
                {order.typeName && <Chip label={order.typeName} size="small" variant="outlined" />}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
              {canEdit && (
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>Statut</InputLabel>
                  <Select
                    value={order.status}
                    label="Statut"
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={actionLoading}
                  >
                    {statusOptions.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {canEdit && order.status === 'pending' && (
                <Button variant="contained" startIcon={<PlayArrow />} onClick={handleStartWork} disabled={actionLoading} size="small">
                  Démarrer le travail
                </Button>
              )}
              {canEdit && order.status === 'in_progress' && (
                <Button variant="outlined" color="primary" startIcon={<Stop />} onClick={handleMarkEnd} disabled={actionLoading} size="small">
                  Marquer la fin du travail
                </Button>
              )}
              {canEdit && !canClose && order.status === 'in_progress' && order.actualEnd && (
                <Alert severity="info" sx={{ mt: 1 }}>En attente de clôture par un responsable ou administrateur.</Alert>
              )}
              {order.status === 'completed' && (order.completedAt || order.signatureName) && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                  {t('status.completed')}{order.completedAt ? ` ${new Date(order.completedAt).toLocaleString()}` : ''}
                  {order.signatureName ? ` — Signé par ${order.signatureName}` : ''}
                </Typography>
              )}
            </Box>
          </Box>
          {order.description && (
            <Typography sx={{ mt: 2 }}>{order.description}</Typography>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Équipement</Typography>
              <Typography>{order.equipmentName || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Projet</Typography>
              {(() => {
                const pid = order.projectId;
                const validId = pid != null && pid !== '' && pid !== 'undefined' && !Number.isNaN(Number(pid)) ? Number(pid) : null;
                return validId != null ? (
                  <Button size="small" onClick={() => navigate(`/app/maintenance-projects/${validId}`)} sx={{ p: 0, textTransform: 'none', justifyContent: 'flex-start' }}>
                    {order.projectName || `Projet #${validId}`}
                  </Button>
                ) : (
                  <Typography>—</Typography>
                );
              })()}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Responsable principal</Typography>
              {canEdit && users.length ? (
                <Select size="small" value={order.assignedTo || ''} onChange={(e) => handleAssign(e.target.value || null)} sx={{ minWidth: 180 }}>
                  <MenuItem value="">Non assigné</MenuItem>
                  {users.filter(u => u.role_name === 'technicien' || u.role_name === 'responsable_maintenance').map(u => (
                    <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>
                  ))}
                </Select>
              ) : (
                <Typography>{order.assignedName || '-'}</Typography>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">Date de création</Typography>
              <Typography>{new Date(order.createdAt).toLocaleString('fr-FR')}</Typography>
            </Grid>
            {order.maintenancePlanId && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Plan de maintenance</Typography>
                <Typography component="span">
                  <Button size="small" startIcon={<Schedule />} onClick={() => navigate('/app/maintenance-plans')}>
                    {order.maintenancePlanName || `Plan #${order.maintenancePlanId}`}
                  </Button>
                </Typography>
              </Grid>
            )}
            {(order.actualStart || order.actualEnd) && (
              <>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Début d'intervention</Typography>
                  <Typography>{order.actualStart ? new Date(order.actualStart).toLocaleString('fr-FR') : '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Fin d'intervention</Typography>
                  <Typography>{order.actualEnd ? new Date(order.actualEnd).toLocaleString('fr-FR') : '-'}</Typography>
                </Grid>
              </>
            )}
            {(order.laborCost != null || order.partsCost != null || order.totalCost != null) && (
              <>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Coût main-d'œuvre</Typography>
                  <Typography>{order.laborCost != null ? `${Number(order.laborCost).toFixed(2)} ${currency}` : '—'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Coût pièces</Typography>
                  <Typography>{order.partsCost != null ? `${Number(order.partsCost).toFixed(2)} ${currency}` : '—'}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Coût total</Typography>
                  <Typography fontWeight={600}>{order.totalCost != null ? `${Number(order.totalCost).toFixed(2)} ${currency}` : '—'}</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Équipe / Opérateurs — plusieurs opérateurs possibles */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonSearch /> Équipe / Opérateurs
          </Typography>
          {((order.assignedOperators && order.assignedOperators.length > 0) || order.assignedTo || order.assignedName) ? (
            <>
              <List dense disablePadding sx={{ mb: canEdit ? 2 : 0 }}>
                {order.assignedTo && !(order.assignedOperators || []).some(o => o.id === order.assignedTo) && (
                  <ListItem>
                    <ListItemText primary={order.assignedName || `#${order.assignedTo}`} secondary="Responsable principal" />
                  </ListItem>
                )}
                {(order.assignedOperators || []).map((op) => (
                  <ListItem key={op.id} secondaryAction={canEdit && (
                    <IconButton size="small" color="error" onClick={() => handleRemoveOperator(op.id)} title="Retirer"><Delete /></IconButton>
                  )}>
                    <ListItemText primary={op.name || `${op.firstName} ${op.lastName}`.trim()} />
                  </ListItem>
                ))}
              </List>
              {canEdit && users.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Ajouter un opérateur</InputLabel>
                    <Select
                      value={selectedOperatorId}
                      label="Ajouter un opérateur"
                      onChange={(e) => setSelectedOperatorId(e.target.value)}
                    >
                      <MenuItem value="">—</MenuItem>
                      {users.filter(u => !(order.assignedOperators || []).some(o => o.id === u.id) && u.id !== order.assignedTo).map(u => (
                        <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button size="small" variant="outlined" startIcon={<Add />} disabled={!selectedOperatorId || operatorAdding} onClick={handleAddOperator}>
                    {operatorAdding ? 'Ajout...' : 'Ajouter'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PersonSearch />} onClick={loadSuggestions}>Suggérer techniciens</Button>
                </Box>
              )}
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: canEdit ? 2 : 0 }}>Aucun opérateur affecté. Ajoutez-en depuis la liste ci-dessous.</Typography>
              {canEdit && users.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Ajouter un opérateur</InputLabel>
                    <Select value={selectedOperatorId} label="Ajouter un opérateur" onChange={(e) => setSelectedOperatorId(e.target.value)}>
                      <MenuItem value="">—</MenuItem>
                      {users.map(u => <MenuItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button size="small" variant="outlined" startIcon={<Add />} disabled={!selectedOperatorId || operatorAdding} onClick={handleAddOperator}>
                    {operatorAdding ? 'Ajout...' : 'Ajouter'}
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PersonSearch />} onClick={loadSuggestions}>Suggérer techniciens</Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Outils affectés à l'OT — ajout / retour */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Build /> Outils affectés
          </Typography>
          {canEdit && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>Affecter un outil</InputLabel>
                <Select value={selectedToolId} label="Affecter un outil" onChange={(e) => setSelectedToolId(e.target.value)}>
                  <MenuItem value="">Sélectionner</MenuItem>
                  {tools.filter(t => t.status === 'available').map(t => (
                    <MenuItem key={t.id} value={t.id}>{t.code} – {t.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" size="small" startIcon={<Add />} disabled={!selectedToolId || toolAssigning} onClick={handleAssignTool}>
                {toolAssigning ? 'Affectation...' : 'Affecter'}
              </Button>
            </Box>
          )}
          {toolAssignments.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Aucun outil affecté. Affectez des outils pour l'intervention.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Outil</TableCell>
                  <TableCell>Affecté à</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {toolAssignments.map((ta) => (
                  <TableRow key={ta.assignmentId}>
                    <TableCell>{ta.toolCode}</TableCell>
                    <TableCell>{ta.toolName}</TableCell>
                    <TableCell>{ta.assignedToName || '—'}</TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <Button size="small" color="primary" onClick={() => handleReturnTool(ta.toolId, ta.assignmentId)}>Retour</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Inventory /> Réservation de pièces (préparation chantier)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Pièce</InputLabel>
                <Select
                  value={reservationForm.sparePartId}
                  label="Pièce"
                  onChange={(e) => setReservationForm((f) => ({ ...f, sparePartId: e.target.value }))}
                >
                  <MenuItem value="">Sélectionner</MenuItem>
                  {spareParts.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.code} – {p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField type="number" size="small" label="Quantité" value={reservationForm.quantity} onChange={(e) => setReservationForm((f) => ({ ...f, quantity: e.target.value }))} inputProps={{ min: 1 }} sx={{ width: 100 }} />
              <Button variant="outlined" size="small" startIcon={<Add />} disabled={reservationSubmitting || !reservationForm.sparePartId} onClick={() => {
                if (!reservationForm.sparePartId) return;
                setReservationSubmitting(true);
                api.post(`/work-orders/${order.id}/reservations`, { sparePartId: Number(reservationForm.sparePartId), quantity: Number(reservationForm.quantity) || 1 })
                  .then(() => { snackbar.showSuccess('Réservation ajoutée'); setReservationForm({ sparePartId: '', quantity: 1 }); loadReservations(); })
                  .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
                  .finally(() => setReservationSubmitting(false));
              }}>
                Réserver
              </Button>
            </Box>
            {reservations.length === 0 ? (
              <Typography color="text.secondary" variant="body2">Aucune réservation. Réservez des pièces pour préparer l'intervention.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Désignation</TableCell>
                    <TableCell align="right">Quantité</TableCell>
                    <TableCell align="right">Stock dispo</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.partCode}</TableCell>
                      <TableCell>{r.partName}</TableCell>
                      <TableCell align="right">{r.quantity}</TableCell>
                      <TableCell align="right">{r.stockQuantity ?? '—'}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => {
                          api.delete(`/work-orders/${order.id}/reservations/${r.id}`)
                            .then(() => { snackbar.showSuccess('Réservation supprimée'); loadReservations(); })
                            .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
                        }}><Delete /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Procédures / modes opératoires — une ou plusieurs à suivre pour réaliser l'OT */}
      {((order.procedures && order.procedures.length > 0) || order.procedureId || order.procedureName) && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <MenuBook /> Procédures / modes opératoires
            </Typography>
            {(order.procedures && order.procedures.length > 0 ? order.procedures : [{ id: order.procedureId, name: order.procedureName, description: order.procedureDescription, steps: order.procedureSteps, safety_notes: order.procedureSafetyNotes }]).map((proc, idx) => (
              <Box key={proc.id || idx} sx={{ mb: idx < (order.procedures?.length || 1) - 1 ? 3 : 0, pb: idx < (order.procedures?.length || 1) - 1 ? 2 : 0, borderBottom: idx < (order.procedures?.length || 1) - 1 ? 1 : 0, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {proc.name || `Procédure #${proc.id}`}
                </Typography>
                {proc.description && (
                  <Typography variant="body2" sx={{ mb: 1.5 }}>{proc.description}</Typography>
                )}
                {proc.safety_notes && (
                  <Alert severity="warning" sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" gutterBottom>Consignes de sécurité</Typography>
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{proc.safety_notes}</Typography>
                  </Alert>
                )}
                {proc.steps && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Étapes à suivre</Typography>
                    <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
                      {(() => {
                        try {
                          const steps = typeof proc.steps === 'string' ? JSON.parse(proc.steps) : proc.steps;
                          if (Array.isArray(steps)) {
                            return steps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((s, i) => (
                              <li key={i}><Typography variant="body2">{s.text || s.label || s.name || String(s)}</Typography></li>
                            ));
                          }
                        } catch (_) {}
                        return <li><Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{proc.steps}</Typography></li>;
                      })()}
                    </Box>
                  </>
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Exécutions de checklists enregistrées pour cet OT */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Checklist /> Exécutions de checklists
          </Typography>
          {woChecklistExecutions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune exécution de checklist enregistrée pour cet OT. Exécutez une checklist (ci‑dessous si le plan en a, ou depuis le menu Checklists) en la liant à cet OT.
            </Typography>
          ) : (
            <List dense disablePadding>
              {woChecklistExecutions.map((exec) => (
                <ListItem key={exec.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={exec.checklistName || `Checklist #${exec.checklistId}`}
                    secondary={
                      <>
                        {exec.executedAt && new Date(exec.executedAt).toLocaleString('fr-FR')}
                        {exec.executedByName && ` — ${exec.executedByName}`}
                        {exec.notes && ` · ${exec.notes}`}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {((order.maintenancePlanId && planChecklists.length > 0) || (order.assignedChecklistIds && order.assignedChecklistIds.length > 0)) && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Checklist /> Checklists à exécuter (plan + affectées)
            </Typography>
            {(() => {
              const byId = new Map();
              planChecklists.forEach(c => byId.set(c.id, { ...c, source: 'plan' }));
              assignedChecklists.forEach(c => byId.set(c.id, { ...c, source: 'affectée' }));
              const allChecklists = [...byId.values()];
              if (allChecklists.length === 0) {
                return (
                  <Typography variant="body2" color="text.secondary">
                    Aucune checklist (plan ou affectation). Associez un plan ou affectez des checklists à la création ou en modification de l&apos;OT.
                  </Typography>
                );
              }
              return (
                <List dense disablePadding>
                  {allChecklists.map((c) => (
                    <ListItem key={c.id} disablePadding secondaryAction={
                      <Button size="small" variant="outlined" onClick={() => navigate('/app/checklists', { state: { executeChecklistId: c.id, workOrderId: order.id } })}>
                        Exécuter
                      </Button>
                    }>
                      <ListItemText primary={c.name} secondary={c.description || (c.source === 'affectée' ? 'Affectée à l\'OT' : null)} />
                    </ListItem>
                  ))}
                </List>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description /> Pièces jointes
            </Typography>
            {canEdit && (
              <Button size="small" variant="outlined" component="label" startIcon={<Upload />} disabled={uploadingDoc}>
                {uploadingDoc ? 'Envoi...' : 'Ajouter un fichier'}
                <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt,image/*" capture="environment" onChange={handleUploadDoc} />
              </Button>
            )}
          </Box>
          {woDocuments.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Aucune pièce jointe</Typography>
          ) : (
            <List dense disablePadding>
              {woDocuments.map((doc) => (
                <ListItem key={doc.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 0.5 }}
                  secondaryAction={
                    <Box>
                      <IconButton size="small" onClick={() => handleDownloadDoc(doc.id)}><Download /></IconButton>
                      {canEdit && <IconButton size="small" onClick={() => handleDeleteDoc(doc.id)}><Delete /></IconButton>}
                    </Box>
                  }
                >
                  <ListItemText
                    primary={doc.original_filename}
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={doc.document_type || 'other'} size="small" variant="outlined" />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {(doc.file_size / 1024).toFixed(1)} KB · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {stockMovements.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Inventory /> Sorties stock liées à cet OT
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { borderBottom: 1, borderColor: 'divider', py: 1, textAlign: 'left' } }}>
              <thead>
                <tr>
                  <th>Pièce</th>
                  <th>Quantité</th>
                  <th>Date</th>
                  <th>Référence</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.partName || m.part_code || '-'}</td>
                    <td>{Math.abs(m.quantity)}</td>
                    <td>{m.created_at ? new Date(m.created_at).toLocaleString('fr-FR') : '-'}</td>
                    <td>{m.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={suggestOpen} onClose={() => setSuggestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Suggestion d'affectation</DialogTitle>
        <DialogContent>
          {suggestLoading ? (
            <Box p={2}><CircularProgress /></Box>
          ) : suggestedList.length === 0 ? (
            <Typography color="text.secondary">Aucun technicien ou aucune règle d'affectation (type ↔ compétence). Configurez les compétences et les règles dans Techniciens.</Typography>
          ) : (
            <List dense>
              {suggestedList.map((t) => (
                <ListItem
                  key={t.id}
                  secondaryAction={
                    <Button size="small" variant="contained" onClick={() => handleAssign(t.id)}>
                      Affecter
                    </Button>
                  }
                  disablePadding
                  sx={{ py: 0.5 }}
                >
                  <ListItemButton onClick={() => handleAssign(t.id)}>
                    <ListItemText
                      primary={`${t.first_name} ${t.last_name}`}
                      secondaryTypographyProps={{ component: 'div' }}
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip size="small" label={`Score ${t.suggestion_score}%`} color="primary" variant="outlined" />
                          {t.match_score != null && <Typography component="span" variant="caption">Adéquation {t.match_score}%</Typography>}
                          {t.avg_evaluation != null && <Typography component="span" variant="caption"><Star sx={{ fontSize: 14, verticalAlign: 'middle' }} /> {t.avg_evaluation}/5</Typography>}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Clôturer l&apos;OT — Signature</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enregistrez le nom du signataire pour valider la clôture de l&apos;ordre de travail.
          </Typography>
          <TextField
            fullWidth
            label="Nom du signataire"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Prénom Nom"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleConfirmClose} disabled={actionLoading}>
            {actionLoading ? 'Enregistrement...' : 'Confirmer la clôture'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
