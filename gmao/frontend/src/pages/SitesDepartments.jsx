import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';

export default function SitesDepartments() {
  const [sites, setSites] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDep, setEditDep] = useState(null);
  const [depForm, setDepForm] = useState({ siteId: '', code: '', name: '', description: '', latitude: '', longitude: '', location_address: '' });
  const [submitting, setSubmitting] = useState(false);
  const { can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('sites', 'update');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/sites'),
      api.get('/departements').catch(() => ({ data: [] }))
    ])
      .then(([s, d]) => {
        const depRaw = d.data || [];
        const depByKey = new Map();
        depRaw.forEach((x) => {
          const key = `${x.site_id ?? ''}|${(x.code || '').trim()}`;
          if (!depByKey.has(key)) depByKey.set(key, x);
        });
        setSites(s.data || []);
        setDepartements([...depByKey.values()]);
      })
      .catch(() => snackbar.showError('Erreur lors du chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const openEditDep = (d) => {
    setEditDep(d);
    setDepForm({
      siteId: d.site_id != null ? String(d.site_id) : '',
      code: d.code || '',
      name: d.name || '',
      description: d.description || '',
      latitude: d.latitude != null ? String(d.latitude) : '',
      longitude: d.longitude != null ? String(d.longitude) : '',
      location_address: d.location_address || ''
    });
  };

  const saveDep = () => {
    if (!editDep) return;
    setSubmitting(true);
    api.put(`/departements/${editDep.id}`, {
      siteId: depForm.siteId ? parseInt(depForm.siteId, 10) : undefined,
      code: depForm.code.trim(),
      name: depForm.name.trim(),
      description: depForm.description.trim() || undefined,
      latitude: depForm.latitude ? parseFloat(depForm.latitude) : undefined,
      longitude: depForm.longitude ? parseFloat(depForm.longitude) : undefined,
      location_address: depForm.location_address.trim() || undefined
    })
      .then((r) => {
        setDepartements((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x)));
        setEditDep(null);
        snackbar.showSuccess('Département enregistré');
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Départements</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Liste des départements par site. Création dans le menu <strong>Création</strong>.</p>
        </Box>
      </Box>

      <Card sx={{ p: 2 }}>
        <h3 style={{ margin: '0 0 16px' }}>Départements</h3>
        {loading ? (
          <Box py={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Litérairie / Coordonnées</TableCell>
                {canEdit && <TableCell align="right">Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {departements.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.site_name || '-'}</TableCell>
                  <TableCell>{d.description || '-'}</TableCell>
                  <TableCell>{d.location_address || (d.latitude != null && d.longitude != null ? `${Number(d.latitude).toFixed(4)}, ${Number(d.longitude).toFixed(4)}` : '—')}</TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" startIcon={<Edit />} onClick={() => openEditDep(d)}>Modifier</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && departements.length === 0 && <Box py={2} color="text.secondary">Aucun département.</Box>}
      </Card>

      <Dialog open={!!editDep} onClose={() => setEditDep(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier le département</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField select SelectProps={{ native: true }} label="Site" value={depForm.siteId} onChange={(e) => setDepForm((f) => ({ ...f, siteId: e.target.value }))} fullWidth>
            <option value="">—</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </TextField>
          <TextField label="Code" value={depForm.code} onChange={(e) => setDepForm((f) => ({ ...f, code: e.target.value }))} fullWidth required />
          <TextField label="Nom" value={depForm.name} onChange={(e) => setDepForm((f) => ({ ...f, name: e.target.value }))} fullWidth required />
          <TextField label="Description" value={depForm.description} onChange={(e) => setDepForm((f) => ({ ...f, description: e.target.value }))} fullWidth multiline />
          <TextField label="Latitude" type="number" value={depForm.latitude} onChange={(e) => setDepForm((f) => ({ ...f, latitude: e.target.value }))} fullWidth inputProps={{ step: 'any' }} placeholder="ex. 48.8566" />
          <TextField label="Longitude" type="number" value={depForm.longitude} onChange={(e) => setDepForm((f) => ({ ...f, longitude: e.target.value }))} fullWidth inputProps={{ step: 'any' }} placeholder="ex. 2.3522" />
          <TextField label="Litérairie (adresse ou description précise du lieu)" value={depForm.location_address} onChange={(e) => setDepForm((f) => ({ ...f, location_address: e.target.value }))} fullWidth multiline placeholder="Bâtiment A, étage 2, zone nord" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDep(null)}>Annuler</Button>
          <Button variant="contained" onClick={saveDep} disabled={submitting || !depForm.code.trim() || !depForm.name.trim()}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
