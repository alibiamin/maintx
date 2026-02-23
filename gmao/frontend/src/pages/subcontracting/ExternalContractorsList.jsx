import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

export default function ExternalContractorsList() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    api.get('/external-contractors').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ code: row.code || '', name: row.name || '', contactPerson: row.contact_person || '', email: row.email || '', phone: row.phone || '', address: row.address || '', notes: row.notes || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name.trim()) { snackbar.showError('Nom requis'); return; }
    setSaving(true);
    const payload = { code: form.code, name: form.name, contactPerson: form.contactPerson, email: form.email, phone: form.phone, address: form.address, notes: form.notes };
    (editingId ? api.put(`/external-contractors/${editingId}`, payload) : api.post('/external-contractors', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce sous-traitant ?')) return;
    api.delete(`/external-contractors/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.external_contractors')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Nom</TableCell><TableCell>Contact</TableCell><TableCell>Email</TableCell><TableCell>Téléphone</TableCell>{canEdit && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 6 : 5} align="center"><Typography color="text.secondary">Aucun sous-traitant</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{row.contact_person || '—'}</TableCell><TableCell>{row.email || '—'}</TableCell><TableCell>{row.phone || '—'}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button component={Link} to={`/app/subcontracting/orders?contractorId=${row.id}`} size="small">Ordres</Button>
                        <Button size="small" onClick={() => openEdit(row)}>Modifier</Button>
                        <Button size="small" color="error" onClick={() => handleDelete(row.id)}>Supprimer</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Modifier le sous-traitant' : 'Nouveau sous-traitant'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="dense" />
          <TextField fullWidth label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" />
          <TextField fullWidth label="Contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} margin="dense" />
          <TextField fullWidth label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} margin="dense" />
          <TextField fullWidth label="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} margin="dense" />
          <TextField fullWidth label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} margin="dense" />
          <TextField fullWidth label="Notes" multiline value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
