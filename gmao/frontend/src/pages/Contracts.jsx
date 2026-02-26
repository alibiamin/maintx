import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { Add, Edit, Delete, Warning } from '@mui/icons-material';
import api from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

const LINK_TYPE = { none: '', ot: 'ot', plan: 'plan', project: 'project' };

function LinkedEntity({ contract }) {
  if (contract.work_order_id) {
    return (
      <Link to={`/app/work-orders/${contract.work_order_id}`} style={{ color: 'inherit' }}>
        {contract.wo_number ? `${contract.wo_number} — ${contract.wo_title || ''}` : `OT #${contract.work_order_id}`}
      </Link>
    );
  }
  if (contract.maintenance_plan_id && contract.plan_name) {
    return (
      <Link to="/app/maintenance-plans" style={{ color: 'inherit' }}>
        Plan : {contract.plan_name}
      </Link>
    );
  }
  if (contract.maintenance_project_id && contract.project_name) {
    return (
      <Link to={`/app/maintenance-projects/${contract.maintenance_project_id}`} style={{ color: 'inherit' }}>
        Projet : {contract.project_name}
      </Link>
    );
  }
  return '—';
}

const emptyForm = {
  contract_number: '',
  name: '',
  external_contractor_id: '',
  equipment_id: '',
  contract_type: 'preventive',
  start_date: '',
  end_date: '',
  annual_cost: '',
  frequency_days: '',
  description: '',
  terms: '',
  linkType: LINK_TYPE.none,
  work_order_id: '',
  maintenance_plan_id: '',
  maintenance_project_id: ''
};

export default function Contracts() {
  const currency = useCurrency();
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadContracts();
    api.get('/external-contractors').then((r) => setContractors(r.data || [])).catch(() => {});
    api.get('/equipment').then((r) => setEquipment(r.data || [])).catch(() => {});
    api.get('/work-orders', { params: { limit: 500 } }).then((r) => {
      const data = r.data?.data ?? r.data;
      setWorkOrders(Array.isArray(data) ? data : []);
    }).catch(() => setWorkOrders([]));
    api.get('/maintenance-plans').then((r) => setPlans(r.data || [])).catch(() => setPlans([]));
    api.get('/maintenance-projects').then((r) => setProjects(r.data || [])).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setEditingId(null);
      setForm(emptyForm);
      setError('');
      setDialogOpen(true);
    }
  }, [searchParams]);

  const loadContracts = async () => {
    try {
      const res = await api.get('/contracts');
      setContracts(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (contract) => {
    setEditingId(contract.id);
    const linkType = contract.work_order_id ? LINK_TYPE.ot : contract.maintenance_plan_id ? LINK_TYPE.plan : contract.maintenance_project_id ? LINK_TYPE.project : LINK_TYPE.none;
    setForm({
      contract_number: contract.contract_number || '',
      name: contract.name || '',
      external_contractor_id: contract.external_contractor_id ?? '',
      equipment_id: contract.equipment_id ?? '',
      contract_type: contract.contract_type || 'preventive',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      annual_cost: contract.annual_cost ?? '',
      frequency_days: contract.frequency_days ?? '',
      description: contract.description || '',
      terms: contract.terms || '',
      linkType,
      work_order_id: contract.work_order_id ?? '',
      maintenance_plan_id: contract.maintenance_plan_id ?? '',
      maintenance_project_id: contract.maintenance_project_id ?? ''
    });
    setError('');
    setDialogOpen(true);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const payloadLink = () => {
    if (form.linkType === LINK_TYPE.ot && form.work_order_id) return { work_order_id: parseInt(form.work_order_id, 10), maintenance_plan_id: null, maintenance_project_id: null };
    if (form.linkType === LINK_TYPE.plan && form.maintenance_plan_id) return { work_order_id: null, maintenance_plan_id: parseInt(form.maintenance_plan_id, 10), maintenance_project_id: null };
    if (form.linkType === LINK_TYPE.project && form.maintenance_project_id) return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: parseInt(form.maintenance_project_id, 10) };
    return { work_order_id: null, maintenance_plan_id: null, maintenance_project_id: null };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        external_contractor_id: form.external_contractor_id ? parseInt(form.external_contractor_id, 10) : null,
        equipment_id: form.equipment_id ? parseInt(form.equipment_id) : null,
        annual_cost: parseFloat(form.annual_cost) || 0,
        frequency_days: form.frequency_days ? parseInt(form.frequency_days, 10) : null
      };
      const link = payloadLink();
      if (editingId) {
        await api.put(`/contracts/${editingId}`, {
          name: payload.name,
          external_contractor_id: payload.external_contractor_id,
          equipment_id: payload.equipment_id,
          contract_type: payload.contract_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          annual_cost: payload.annual_cost,
          frequency_days: payload.frequency_days,
          description: payload.description,
          terms: payload.terms,
          is_active: true,
          ...link
        });
      } else {
        await api.post('/contracts', {
          contract_number: payload.contract_number,
          name: payload.name,
          external_contractor_id: payload.external_contractor_id,
          equipment_id: payload.equipment_id,
          contract_type: payload.contract_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          annual_cost: payload.annual_cost,
          frequency_days: payload.frequency_days,
          description: payload.description,
          terms: payload.terms,
          ...link
        });
      }
      setDialogOpen(false);
      loadContracts();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/contracts/${id}`);
      setDeleteConfirm(null);
      loadContracts();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const displayPartner = (contract) =>
    contract.contractor_name
      ? (contract.contractor_code ? `${contract.contractor_code} — ` : '') + contract.contractor_name
      : contract.supplier_name || '-';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Contrats de sous-traitance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contrats de maintenance avec les prestataires externes (OT et actions de maintenance)
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Nouveau contrat
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {contracts.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun contrat de sous-traitance enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Prestataire</TableCell>
                  <TableCell>Lié à (OT / Plan / Projet)</TableCell>
                  <TableCell>Équipement</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date début</TableCell>
                  <TableCell>Date fin</TableCell>
                  <TableCell>Coût annuel</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>{contract.contract_number}</TableCell>
                    <TableCell>{contract.name}</TableCell>
                    <TableCell>{displayPartner(contract)}</TableCell>
                    <TableCell><LinkedEntity contract={contract} /></TableCell>
                    <TableCell>{contract.equipment_code || contract.equipment_name || '-'}</TableCell>
                    <TableCell>
                      <Chip label={contract.contract_type} size="small" />
                    </TableCell>
                    <TableCell>{contract.start_date}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {contract.end_date}
                        {contract.end_date && new Date(contract.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                          <Warning color="warning" fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{contract.annual_cost != null ? Number(contract.annual_cost).toLocaleString('fr-FR') : '-'} {currency}</TableCell>
                    <TableCell>
                      <Chip
                        label={contract.is_active ? 'Actif' : 'Inactif'}
                        color={contract.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(contract)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteConfirm(contract.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier le contrat' : 'Nouveau contrat de sous-traitance'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              {!editingId && (
                <TextField
                  fullWidth
                  required
                  label="N° contrat"
                  value={form.contract_number}
                  onChange={(e) => handleChange('contract_number', e.target.value)}
                />
              )}
              <TextField
                fullWidth
                required
                label="Nom du contrat"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
              <FormControl fullWidth required>
                <InputLabel>Prestataire</InputLabel>
                <Select
                  value={form.external_contractor_id ?? ''}
                  label="Prestataire"
                  onChange={(e) => handleChange('external_contractor_id', e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {contractors.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ''}{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Équipement</InputLabel>
                <Select
                  value={form.equipment_id ?? ''}
                  label="Équipement"
                  onChange={(e) => handleChange('equipment_id', e.target.value)}
                >
                  <MenuItem value="">—</MenuItem>
                  {equipment.map((eq) => (
                    <MenuItem key={eq.id} value={eq.id}>{eq.code} — {eq.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Lier à (optionnel)</InputLabel>
                <Select
                  value={form.linkType ?? LINK_TYPE.none}
                  label="Lier à (optionnel)"
                  onChange={(e) => setForm((prev) => ({ ...prev, linkType: e.target.value, work_order_id: '', maintenance_plan_id: '', maintenance_project_id: '' }))}
                >
                  <MenuItem value={LINK_TYPE.none}>— Aucun —</MenuItem>
                  <MenuItem value={LINK_TYPE.ot}>OT (ordre de travail)</MenuItem>
                  <MenuItem value={LINK_TYPE.plan}>Plan de maintenance</MenuItem>
                  <MenuItem value={LINK_TYPE.project}>Projet de maintenance</MenuItem>
                </Select>
              </FormControl>
              {form.linkType === LINK_TYPE.ot && (
                <FormControl fullWidth>
                  <InputLabel>OT</InputLabel>
                  <Select
                    value={form.work_order_id ?? ''}
                    label="OT"
                    onChange={(e) => handleChange('work_order_id', e.target.value)}
                  >
                    <MenuItem value="">— Choisir —</MenuItem>
                    {workOrders.map((wo) => (
                      <MenuItem key={wo.id} value={wo.id}>{wo.number} — {wo.title || 'Sans titre'}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {form.linkType === LINK_TYPE.plan && (
                <FormControl fullWidth>
                  <InputLabel>Plan de maintenance</InputLabel>
                  <Select
                    value={form.maintenance_plan_id ?? ''}
                    label="Plan de maintenance"
                    onChange={(e) => handleChange('maintenance_plan_id', e.target.value)}
                  >
                    <MenuItem value="">— Choisir —</MenuItem>
                    {plans.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name}{p.equipment_code ? ` (${p.equipment_code})` : ''}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {form.linkType === LINK_TYPE.project && (
                <FormControl fullWidth>
                  <InputLabel>Projet de maintenance</InputLabel>
                  <Select
                    value={form.maintenance_project_id ?? ''}
                    label="Projet de maintenance"
                    onChange={(e) => handleChange('maintenance_project_id', e.target.value)}
                  >
                    <MenuItem value="">— Choisir —</MenuItem>
                    {projects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={form.contract_type ?? 'preventive'}
                  label="Type"
                  onChange={(e) => handleChange('contract_type', e.target.value)}
                >
                  <MenuItem value="preventive">Préventif</MenuItem>
                  <MenuItem value="corrective">Correctif</MenuItem>
                  <MenuItem value="full">Complet</MenuItem>
                  <MenuItem value="spare_parts">Pièces</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                type="number"
                label={`Coût annuel (${currency})`}
                value={form.annual_cost ?? ''}
                onChange={(e) => handleChange('annual_cost', e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                fullWidth
                required
                type="date"
                label="Début"
                value={form.start_date ?? ''}
                onChange={(e) => handleChange('start_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                required
                type="date"
                label="Fin"
                value={form.end_date ?? ''}
                onChange={(e) => handleChange('end_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                type="number"
                label="Fréquence (jours)"
                value={form.frequency_days ?? ''}
                onChange={(e) => handleChange('frequency_days', e.target.value)}
                inputProps={{ min: 1 }}
              />
              <TextField
                fullWidth
                multiline
                label="Description"
                value={form.description ?? ''}
                onChange={(e) => handleChange('description', e.target.value)}
              />
              <TextField
                fullWidth
                multiline
                label="Conditions"
                value={form.terms ?? ''}
                onChange={(e) => handleChange('terms', e.target.value)}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button type="submit" variant="contained" disabled={submitting || !form.name?.trim() || !form.external_contractor_id || !form.start_date || !form.end_date}>
              {submitting ? <CircularProgress size={24} /> : (editingId ? 'Enregistrer' : 'Créer')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>Voulez-vous vraiment supprimer ce contrat ?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
