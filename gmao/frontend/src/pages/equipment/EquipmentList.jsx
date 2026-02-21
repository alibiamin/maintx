import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import { Search, Visibility, AccountTree, MoreVert } from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useActionPanelHelpers } from '../../hooks/useActionPanel';

const statusColors = { operational: 'success', maintenance: 'warning', out_of_service: 'error', retired: 'default' };

export default function EquipmentList() {
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLigne, setFilterLigne] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openEntityPanel, openListPanel } = useActionPanelHelpers();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  useEffect(() => {
    Promise.all([
      api.get('/equipment/categories'),
      api.get('/lignes')
    ]).then(([c, l]) => {
      setCategories(c.data);
      setLignes(l.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (filterStatus) params.status = filterStatus;
    if (filterCategory) params.categoryId = filterCategory;
    if (filterLigne) params.ligneId = filterLigne;
    api.get('/equipment', { params }).then(r => setEquipment(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [search, filterStatus, filterCategory, filterLigne]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Équipements</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Gestion des actifs et fiches techniques</p>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" startIcon={<AccountTree />} onClick={() => navigate('/equipment/map')}>
            Carte hiérarchie
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<MoreVert />} 
            onClick={() => openListPanel('equipment')}
          >
            Actions
          </Button>
        </Box>
      </Box>

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
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {equipment.map((eq) => (
                <TableRow key={eq.id} hover>
                  <TableCell>{eq.code}</TableCell>
                  <TableCell>{eq.name}</TableCell>
                  <TableCell>{eq.categoryName || '-'}</TableCell>
                  <TableCell>{eq.ligneName || '-'}</TableCell>
                  <TableCell><Chip label={eq.criticite || 'B'} size="small" color={eq.criticite === 'A' ? 'error' : eq.criticite === 'B' ? 'warning' : 'default'} /></TableCell>
                  <TableCell><Chip label={eq.status} size="small" color={statusColors[eq.status] || 'default'} /></TableCell>
                  <TableCell>{eq.location || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small" 
                      onClick={() => navigate(`/equipment/${eq.id}`)}
                      title="Voir les détails"
                    >
                      <Visibility />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => openEntityPanel('equipment', eq)}
                      title="Actions"
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && equipment.length === 0 && (
          <Box p={4} textAlign="center" color="text.secondary">Aucun équipement trouvé</Box>
        )}
      </Card>
    </Box>
  );
}
