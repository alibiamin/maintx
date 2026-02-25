import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, CircularProgress, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';
import { useAuth } from '../context/AuthContext';

export default function SettingsEmailTemplates() {
  const { t } = useTranslation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', subjectTemplate: '', bodyTemplate: '', description: '' });
  const [saving, setSaving] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('settings', 'update');

  const load = () => {
    setLoading(true);
    api.get('/settings/email-templates').then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => snackbar.showError('Erreur chargement')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ code: '', name: '', subjectTemplate: '', bodyTemplate: '', description: '' }); setDialogOpen(true); };
  const openEdit = (row) => { setEditingId(row.id); setForm({ code: row.code || '', name: row.name || '', subjectTemplate: row.subject_template || '', bodyTemplate: row.body_template || '', description: row.description || '' }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.code.trim() || !form.name.trim()) { snackbar.showError('Code et nom requis'); return; }
    setSaving(true);
    const payload = { code: form.code, name: form.name, subjectTemplate: form.subjectTemplate, bodyTemplate: form.bodyTemplate, description: form.description };
    (editingId ? api.put(`/settings/email-templates/${editingId}`, payload) : api.post('/settings/email-templates', payload))
      .then(() => { snackbar.showSuccess(editingId ? 'Mis à jour' : 'Créé'); setDialogOpen(false); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce template ?')) return;
    api.delete(`/settings/email-templates/${id}`).then(() => { snackbar.showSuccess('Supprimé'); load(); }).catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('item.email_templates')}</Typography>
        {canEdit && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Nouveau</Button>}
      </Box>
      <Card>
        {loading ? <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box> : (
          <Table>
            <TableHead><TableRow><TableCell>Code</TableCell><TableCell>Nom</TableCell><TableCell>Description</TableCell>{canEdit && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow><TableCell colSpan={canEdit ? 4 : 3} align="center"><Typography color="text.secondary">Aucun template email</Typography></TableCell></TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell>{(row.description || '').slice(0, 50)}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Modifier le template' : 'Nouveau template email'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="dense" required />
          <TextField fullWidth label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" required />
          <TextField fullWidth label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="dense" />
          <TextField fullWidth label="Sujet (template)" value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} margin="dense" placeholder="{{wo_number}}, {{title}}..." />
          <TextField fullWidth label="Corps (template)" multiline rows={4} value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
