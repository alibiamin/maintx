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

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [departements, setDepartements] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSite, setEditSite] = useState(null);
  const [editDep, setEditDep] = useState(null);
  const [editLigne, setEditLigne] = useState(null);
  const [siteForm, setSiteForm] = useState({ code: '', name: '', address: '', latitude: '', longitude: '' });
  const [depForm, setDepForm] = useState({ siteId: '', code: '', name: '', description: '' });
  const [ligneForm, setLigneForm] = useState({ siteId: '', code: '', name: '' });
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/sites'),
      api.get('/departements').catch(() => ({ data: [] })),
      api.get('/lignes')
    ])
      .then(([s, d, l]) => {
        const dedupeById = (arr) => {
          if (!Array.isArray(arr)) return [];
          const seen = new Set();
          return arr.filter((x) => x && x.id != null && !seen.has(x.id) && (seen.add(x.id), true));
        };
        const depRaw = d.data || [];
        const depByKey = new Map();
        depRaw.forEach((x) => {
          const key = `${x.site_id ?? ''}|${(x.code || '').trim()}`;
          if (!depByKey.has(key)) depByKey.set(key, x);
        });
        setSites(dedupeById(s.data || []));
        setDepartements([...depByKey.values()]);
        setLignes(dedupeById(l.data || []));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const openEditSite = (s) => {
    setEditSite(s);
    setSiteForm({
      code: s.code || '',
      name: s.name || '',
      address: s.address || '',
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : ''
    });
  };

  const saveSite = () => {
    if (!editSite) return;
    setSubmitting(true);
    api.put(`/sites/${editSite.id}`, {
      code: siteForm.code.trim(),
      name: siteForm.name.trim(),
      address: siteForm.address.trim() || undefined,
      latitude: siteForm.latitude === '' ? null : parseFloat(siteForm.latitude),
      longitude: siteForm.longitude === '' ? null : parseFloat(siteForm.longitude)
    })
      .then((r) => { setSites((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x))); setEditSite(null); snackbar.showSuccess('Site enregistré'); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const openEditDep = (d) => {
    setEditDep(d);
    setDepForm({
      siteId: d.site_id != null ? String(d.site_id) : '',
      code: d.code || '',
      name: d.name || '',
      description: d.description || ''
    });
  };

  const saveDep = () => {
    if (!editDep) return;
    setSubmitting(true);
    api.put(`/departements/${editDep.id}`, {
      siteId: depForm.siteId ? parseInt(depForm.siteId, 10) : undefined,
      code: depForm.code.trim(),
      name: depForm.name.trim(),
      description: depForm.description.trim() || undefined
    })
      .then((r) => { setDepartements((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x))); setEditDep(null); snackbar.showSuccess('Département enregistré'); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const openEditLigne = (l) => {
    setEditLigne(l);
    setLigneForm({
      siteId: l.site_id != null ? String(l.site_id) : '',
      code: l.code || '',
      name: l.name || ''
    });
  };

  const saveLigne = () => {
    if (!editLigne) return;
    setSubmitting(true);
    api.put(`/lignes/${editLigne.id}`, {
      siteId: ligneForm.siteId ? parseInt(ligneForm.siteId, 10) : undefined,
      code: ligneForm.code.trim(),
      name: ligneForm.name.trim()
    })
      .then((r) => { setLignes((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x))); setEditLigne(null); snackbar.showSuccess('Ligne enregistrée'); load(); })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Sites, Départements et Lignes</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Organisation géographique. Création dans le menu <strong>Création</strong>. Modifiez les lignes ci-dessous.</p>
        </Box>
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <h3 style={{ margin: '0 0 16px' }}>Sites</h3>
        {loading ? (
          <Box py={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Adresse</TableCell>
                {canEdit && <TableCell align="right">Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.address || '-'}</TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" startIcon={<Edit />} onClick={() => openEditSite(s)}>Modifier</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && sites.length === 0 && <Box py={2} color="text.secondary">Aucun site</Box>}
      </Card>

      {departements.length > 0 && (
        <Card sx={{ mb: 2, p: 2 }}>
          <h3 style={{ margin: '0 0 16px' }}>Départements</h3>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Description</TableCell>
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
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" startIcon={<Edit />} onClick={() => openEditDep(d)}>Modifier</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card sx={{ p: 2 }}>
        <h3 style={{ margin: '0 0 16px' }}>Lignes</h3>
        {loading ? null : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
                {canEdit && <TableCell align="right">Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.code}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.site_name || '-'}</TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" startIcon={<Edit />} onClick={() => openEditLigne(l)}>Modifier</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && lignes.length === 0 && <Box py={2} color="text.secondary">Aucune ligne</Box>}
      </Card>

      {/* Dialog Edit Site */}
      <Dialog open={!!editSite} onClose={() => setEditSite(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier le site</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Code" value={siteForm.code} onChange={(e) => setSiteForm((f) => ({ ...f, code: e.target.value }))} fullWidth required />
          <TextField label="Nom" value={siteForm.name} onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))} fullWidth required />
          <TextField label="Adresse" value={siteForm.address} onChange={(e) => setSiteForm((f) => ({ ...f, address: e.target.value }))} fullWidth multiline />
          <TextField label="Latitude" value={siteForm.latitude} onChange={(e) => setSiteForm((f) => ({ ...f, latitude: e.target.value }))} fullWidth placeholder="ex. 48.8566" />
          <TextField label="Longitude" value={siteForm.longitude} onChange={(e) => setSiteForm((f) => ({ ...f, longitude: e.target.value }))} fullWidth placeholder="ex. 2.3522" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditSite(null)}>Annuler</Button>
          <Button variant="contained" onClick={saveSite} disabled={submitting || !siteForm.code.trim() || !siteForm.name.trim()}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Edit Département */}
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDep(null)}>Annuler</Button>
          <Button variant="contained" onClick={saveDep} disabled={submitting || !depForm.code.trim() || !depForm.name.trim()}>Enregistrer</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Edit Ligne */}
      <Dialog open={!!editLigne} onClose={() => setEditLigne(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier la ligne</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField select SelectProps={{ native: true }} label="Site" value={ligneForm.siteId} onChange={(e) => setLigneForm((f) => ({ ...f, siteId: e.target.value }))} fullWidth required>
            <option value="">—</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </TextField>
          <TextField label="Code" value={ligneForm.code} onChange={(e) => setLigneForm((f) => ({ ...f, code: e.target.value }))} fullWidth required />
          <TextField label="Nom" value={ligneForm.name} onChange={(e) => setLigneForm((f) => ({ ...f, name: e.target.value }))} fullWidth required />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditLigne(null)}>Annuler</Button>
          <Button variant="contained" onClick={saveLigne} disabled={submitting || !ligneForm.siteId || !ligneForm.code.trim() || !ligneForm.name.trim()}>Enregistrer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
