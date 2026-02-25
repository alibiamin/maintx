import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Search, Factory, Edit } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';

export default function SitesLines() {
  const [lines, setLines] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editLigne, setEditLigne] = useState(null);
  const [ligneForm, setLigneForm] = useState({ siteId: '', code: '', name: '' });
  const [submitting, setSubmitting] = useState(false);
  const { user, can } = useAuth();
  const snackbar = useSnackbar();
  const canEdit = can('sites', 'update');

  useEffect(() => {
    loadLines();
    api.get('/sites').then((r) => setSites(r.data || [])).catch(() => setSites([]));
  }, []);

  const loadLines = async () => {
    try {
      const res = await api.get('/lignes');
      const data = (res.data || []).map((l) => ({
        ...l,
        siteName: l.site_name != null ? l.site_name : l.siteName
      }));
      setLines(data);
    } catch (error) {
      console.error(error);
      setLines([]);
    } finally {
      setLoading(false);
    }
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
      .then((r) => {
        setLines((prev) => prev.map((x) => (x.id === r.data.id ? { ...r.data, siteName: r.data.site_name } : x)));
        setEditLigne(null);
        snackbar.showSuccess('Ligne enregistrée');
      })
      .catch((e) => snackbar.showError(e.response?.data?.error || 'Erreur'))
      .finally(() => setSubmitting(false));
  };

  const filteredLines = lines.filter((l) =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    (l.siteName || l.site_name)?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Lignes de production
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des lignes de production par site
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
        </Box>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : filteredLines.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune ligne de production enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Site</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Équipements</TableCell>
                  <TableCell>Statut</TableCell>
                  {canEdit && <TableCell align="right">Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Factory />
                        {line.name}
                      </Box>
                    </TableCell>
                    <TableCell>{line.siteName || line.site_name}</TableCell>
                    <TableCell>{line.code || '-'}</TableCell>
                    <TableCell>
                      <Chip label={line.equipmentCount ?? 0} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={line.status || 'Actif'} size="small" color={line.status === 'Actif' ? 'success' : 'default'} />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Button size="small" startIcon={<Edit />} onClick={() => openEditLigne(line)}>Modifier</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
