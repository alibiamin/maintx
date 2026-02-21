import React, { useEffect, useState } from 'react';
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
import { Edit, Delete, Warning } from '@mui/icons-material';
import api from '../services/api';

const emptyForm = {
  contract_number: '',
  name: '',
  supplier_id: '',
  equipment_id: '',
  contract_type: 'preventive',
  start_date: '',
  end_date: '',
  annual_cost: '',
  frequency_days: '',
  description: '',
  terms: ''
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadContracts();
    api.get('/suppliers').then((r) => setSuppliers(r.data || [])).catch(() => {});
    api.get('/equipment').then((r) => setEquipment(r.data || [])).catch(() => {});
  }, []);

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

  const openEdit = (contract) => {
    setEditingId(contract.id);
    setForm({
      contract_number: contract.contract_number || '',
      name: contract.name || '',
      supplier_id: contract.supplier_id ?? '',
      equipment_id: contract.equipment_id ?? '',
      contract_type: contract.contract_type || 'preventive',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      annual_cost: contract.annual_cost ?? '',
      frequency_days: contract.frequency_days ?? '',
      description: contract.description || '',
      terms: contract.terms || ''
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
        equipment_id: form.equipment_id ? parseInt(form.equipment_id) : null,
        annual_cost: parseFloat(form.annual_cost) || 0,
        frequency_days: form.frequency_days ? parseInt(form.frequency_days) : null
      };
      if (editingId) {
        await api.put(`/contracts/${editingId}`, {
          name: payload.name,
          contract_type: payload.contract_type,
          start_date: payload.start_date,
          end_date: payload.end_date,
          annual_cost: payload.annual_cost,
          frequency_days: payload.frequency_days,
          description: payload.description,
          terms: payload.terms,
          is_active: true
        });
      } else {
        await api.post('/contracts', payload);
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
            Contrats de maintenance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des contrats avec les fournisseurs
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {contracts.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun contrat enregistré
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Fournisseur</TableCell>
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
                    <TableCell>{contract.supplier_name || '-'}</TableCell>
                    <TableCell>{contract.equipment_code || contract.equipment_name || '-'}</TableCell>
                    <TableCell>
                      <Chip label={contract.contract_type} size="small" />
                    </TableCell>
                    <TableCell>{contract.start_date}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {contract.end_date}
                        {new Date(contract.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                          <Warning color="warning" fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{contract.annual_cost != null ? Number(contract.annual_cost).toLocaleString('fr-FR') : '-'} €</TableCell>
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
    </Box>
  );
}
