import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import { Search, AccountTree, Add } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActionPanel } from '../../context/ActionPanelContext';
import { useSnackbar } from '../../context/SnackbarContext';

const statusColors = { operational: 'success', maintenance: 'warning', out_of_service: 'error', retired: 'default' };

export default function EquipmentList() {
  const [equipment, setEquipment] = useState([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLigne, setFilterLigne] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('code');
  const [sortOrder, setSortOrder] = useState('asc');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view'); // 'history' | 'documents' | 'warranties' depuis le menu Gestion
  const { setContext } = useActionPanel();
  const snackbar = useSnackbar();
  const [selectedId, setSelectedId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'equipment' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (!selectedId) {
      setContext({ type: 'list', entityType: 'equipment' });
      return;
    }
    const eq = equipment.find((e) => e.id === selectedId);
    setContext(eq ? { type: 'list', entityType: 'equipment', selectedEntity: eq } : { type: 'list', entityType: 'equipment' });
  }, [selectedId, equipment, setContext]);

  useEffect(() => {
    if (selectedId && !equipment.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [equipment, selectedId]);

  useEffect(() => {
    Promise.all([
      api.get('/equipment/categories'),
      api.get('/lignes')
    ]).then(([c, l]) => {
      setCategories(c.data);
      setLignes(l.data);
    }).catch((err) => {
      snackbar.showError(err.response?.data?.error || 'Erreur chargement des filtres');
    });
  }, [snackbar]);

  useEffect(() => {
    setLoading(true);
    const params = { page: page + 1, limit: rowsPerPage, sortBy, order: sortOrder };
    if (search) params.search = search;
    if (filterStatus) params.status = filterStatus;
    if (filterCategory) params.categoryId = filterCategory;
    if (filterLigne) params.ligneId = filterLigne;
    setLoadError(null);
    api.get('/equipment', { params })
      .then(r => {
        const res = r.data;
        setEquipment(res?.data ?? res ?? []);
        setTotal(res?.total ?? (res?.length ?? 0));
      })
      .catch((err) => {
        setLoadError(err.response?.data?.error || 'Erreur chargement des équipements');
        snackbar.showError(err.response?.data?.error || 'Erreur chargement des équipements');
      })
      .finally(() => setLoading(false));
  }, [search, filterStatus, filterCategory, filterLigne, page, rowsPerPage, sortBy, sortOrder, snackbar]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  return (
    <Box>
      {loadError && (
        <Alert severity="error" onClose={() => setLoadError(null)} sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Équipements</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Gestion des actifs et fiches techniques</p>
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/app/equipment/creation/machine')}>
            Nouvel équipement
          </Button>
          <Button variant="outlined" startIcon={<AccountTree />} onClick={() => navigate('/app/equipment/map')}>
            Carte hiérarchie
          </Button>
        </Box>
      </Box>

      {view && ['history', 'documents', 'warranties'].includes(view) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {view === 'history' && 'Sélectionnez un équipement dans la liste pour afficher son historique.'}
          {view === 'documents' && 'Sélectionnez un équipement dans la liste pour afficher ses documents.'}
          {view === 'warranties' && 'Sélectionnez un équipement dans la liste pour afficher ses garanties.'}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Rechercher..."
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Statut</InputLabel>
            <Select value={filterStatus} label="Statut" onChange={(e) => setFilterStatus(e.target.value)}>
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="operational">Opérationnel</MenuItem>
              <MenuItem value="maintenance">En maintenance</MenuItem>
              <MenuItem value="out_of_service">Hors service</MenuItem>
              <MenuItem value="retired">Retiré</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Catégorie</InputLabel>
            <Select value={filterCategory} label="Catégorie" onChange={(e) => setFilterCategory(e.target.value)}>
              <MenuItem value="">Toutes</MenuItem>
              {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Ligne</InputLabel>
            <Select value={filterLigne} label="Ligne" onChange={(e) => setFilterLigne(e.target.value)}>
              <MenuItem value="">Toutes</MenuItem>
              {lignes.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Tri</InputLabel>
            <Select value={`${sortBy}-${sortOrder}`} label="Tri" onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSortBy(s);
              setSortOrder(o);
              setPage(0);
            }}>
              <MenuItem value="code-asc">Code (A-Z)</MenuItem>
              <MenuItem value="code-desc">Code (Z-A)</MenuItem>
              <MenuItem value="name-asc">Nom (A-Z)</MenuItem>
              <MenuItem value="name-desc">Nom (Z-A)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell>Ligne</TableCell>
                <TableCell>Criticité</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Localisation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {equipment.map((eq) => (
                <TableRow
                  key={eq.id}
                  hover
                  selected={selectedId === eq.id}
                  onClick={() => {
                    if (view === 'history') navigate(`/app/equipment/${eq.id}/history`);
                    else if (view === 'documents') navigate(`/app/equipment/${eq.id}/documents`);
                    else if (view === 'warranties') navigate(`/app/equipment/${eq.id}/warranties`);
                    else setSelectedId(selectedId === eq.id ? null : eq.id);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{eq.code}</TableCell>
                  <TableCell>{eq.name}</TableCell>
                  <TableCell>{eq.categoryName || '-'}</TableCell>
                  <TableCell>{eq.ligneName || '-'}</TableCell>
                  <TableCell><Chip label={eq.criticite || 'B'} size="small" color={eq.criticite === 'A' ? 'error' : eq.criticite === 'B' ? 'warning' : 'default'} /></TableCell>
                  <TableCell><Chip label={eq.status} size="small" color={statusColors[eq.status] || 'default'} /></TableCell>
                  <TableCell>{eq.location || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && equipment.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun équipement trouvé</Box>
        )}
        {!loading && total > 0 && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Lignes par page"
          />
        )}
      </Card>
    </Box>
  );
}
