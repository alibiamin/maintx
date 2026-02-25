import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  TablePagination
} from '@mui/material';
import { Schedule as PointageIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';
import { useAuth } from '../../context/AuthContext';

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function PointagePage() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const { user, can } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState([]);
  const [filters, setFilters] = useState({
    technicianId: '',
    dateFrom: new Date().toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10)
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dialog, setDialog] = useState({ open: false, technicianId: '', occurredAt: '', type: 'in' });
  const [saving, setSaving] = useState(false);

  const loadEntries = () => {
    setLoading(true);
    const params = {
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit: rowsPerPage,
      offset: page * rowsPerPage
    };
    if (filters.technicianId) params.technicianId = filters.technicianId;
    api.get('/time-entries', { params })
      .then((r) => {
        setItems(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  const loadTechnicians = () => {
    api.get('/technicians', { params: { limit: 500 } })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        setTechnicians(Array.isArray(data) ? data : []);
      })
      .catch(() => setTechnicians([]));
  };

  useEffect(() => {
    loadEntries();
  }, [filters.dateFrom, filters.dateTo, filters.technicianId, page, rowsPerPage]);

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    if (dialog.open && technicians.length === 0) loadTechnicians();
  }, [dialog.open]);

  const handleOpenDialog = (type) => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setDialog({
      open: true,
      technicianId: user?.id ? String(user.id) : '',
      occurredAt: local,
      type: type || 'in'
    });
  };

  const handleCloseDialog = () => setDialog({ open: false, technicianId: '', occurredAt: '', type: 'in' });

  const handleSaveEntry = () => {
    if (!dialog.technicianId) {
      snackbar.showError(t('effectif.selectTechnician', 'Sélectionnez un technicien'));
      return;
    }
    const occurredAt = dialog.occurredAt ? new Date(dialog.occurredAt).toISOString() : new Date().toISOString();
    setSaving(true);
    api.post('/time-entries', {
      technicianId: parseInt(dialog.technicianId, 10),
      occurredAt,
      type: dialog.type,
      source: 'manual'
    })
      .then(() => {
        snackbar.showSuccess(t('common.saved', 'Enregistré'));
        handleCloseDialog();
        loadEntries();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm(t('effectif.confirmDeleteEntry', 'Supprimer ce pointage ?'))) return;
    api.delete(`/time-entries/${id}`)
      .then(() => {
        snackbar.showSuccess(t('common.saved', 'Enregistré'));
        loadEntries();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'));
  };

  const canDelete = can('time_entries', 'delete');

  return (
    <Box sx={{ p: 2 }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PointageIcon color="primary" />
            <Typography variant="h6">{t('item.effectif_pointage')}</Typography>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('effectif.pointageDescription', 'Saisie des entrées et sorties (manuel). Le lien avec une machine pointeuse sera disponible ultérieurement.')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            <TextField
              type="date"
              size="small"
              label={t('effectif.dateFrom', 'Du')}
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              size="small"
              label={t('effectif.dateTo', 'Au')}
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('effectif.technician', 'Technicien')}</InputLabel>
              <Select
                value={filters.technicianId}
                label={t('effectif.technician', 'Technicien')}
                onChange={(e) => setFilters((f) => ({ ...f, technicianId: e.target.value }))}
              >
                <MenuItem value="">{t('common.all', 'Tous')}</MenuItem>
                {technicians.map((tech) => (
                  <MenuItem key={tech.id} value={tech.id}>
                    {tech.last_name} {tech.first_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {technicians.length === 0 && !loading && (
              <Button size="small" onClick={loadTechnicians}>
                {t('effectif.loadTechnicians', 'Charger les techniciens')}
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog('in')}>
              {t('effectif.entryIn', 'Entrée')}
            </Button>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenDialog('out')}>
              {t('effectif.entryOut', 'Sortie')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('effectif.technician', 'Technicien')}</TableCell>
                <TableCell>{t('effectif.dateTime', 'Date / heure')}</TableCell>
                <TableCell align="center">{t('effectif.type', 'Type')}</TableCell>
                <TableCell align="center">{t('effectif.source', 'Source')}</TableCell>
                {canDelete && <TableCell align="right" width={60} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canDelete ? 5 : 4} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canDelete ? 5 : 4} align="center" color="text.secondary" sx={{ py: 3 }}>
                    {t('effectif.noEntries', 'Aucun pointage sur la période.')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.technician_last_name} {row.technician_first_name}
                    </TableCell>
                    <TableCell>{formatDateTime(row.occurred_at)}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.type === 'in' ? t('effectif.entryIn', 'Entrée') : t('effectif.entryOut', 'Sortie')}
                        color={row.type === 'in' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">{row.source === 'pointeuse' ? t('effectif.pointeuse', 'Pointeuse') : t('effectif.manual', 'Manuel')}</TableCell>
                    {canDelete && (
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row.id)} title={t('common.delete', 'Supprimer')}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage={t('effectif.rowsPerPage', 'Lignes par page')}
        />
      </Card>

      <Dialog open={dialog.open} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialog.type === 'in' ? t('effectif.entryIn', 'Entrée') : t('effectif.entryOut', 'Sortie')}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
            <InputLabel>{t('effectif.technician', 'Technicien')}</InputLabel>
            <Select
              value={dialog.technicianId}
              label={t('effectif.technician', 'Technicien')}
              onChange={(e) => setDialog((d) => ({ ...d, technicianId: e.target.value }))}
            >
              <MenuItem value="">—</MenuItem>
              {technicians.map((tech) => (
                <MenuItem key={tech.id} value={tech.id}>
                  {tech.last_name} {tech.first_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            type="datetime-local"
            label={t('effectif.dateTime', 'Date / heure')}
            value={dialog.occurredAt}
            onChange={(e) => setDialog((d) => ({ ...d, occurredAt: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant="contained" onClick={handleSaveEntry} disabled={saving}>
            {saving ? t('common.saving', 'Enregistrement…') : t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PointagePage;
