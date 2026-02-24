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
  MenuItem
} from '@mui/material';
import { PersonSearch as PresenceIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useSnackbar } from '../../context/SnackbarContext';

const STATUS_LABELS = {
  present: 'Présent',
  absent: 'Absent',
  leave: 'Congé',
  training: 'Formation',
  sick: 'Arrêt maladie',
  other: 'Autre'
};

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatMinutes(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function PresencePage() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState({ date: '', items: [] });
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState([]);
  const [overrideDialog, setOverrideDialog] = useState({ open: false, technicianId: '', status: 'leave', comment: '' });
  const [saving, setSaving] = useState(false);

  const loadSummary = () => {
    setLoading(true);
    api.get('/presence/summary', { params: { date } })
      .then((r) => setSummary(r.data))
      .catch(() => setSummary({ date, items: [] }))
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
    loadSummary();
  }, [date]);

  useEffect(() => {
    if (overrideDialog.open) loadTechnicians();
  }, [overrideDialog.open]);

  const handleOpenOverride = () => {
    setOverrideDialog({ open: true, technicianId: '', status: 'leave', comment: '' });
  };

  const handleCloseOverride = () => setOverrideDialog({ open: false, technicianId: '', status: 'leave', comment: '' });

  const handleSaveOverride = () => {
    if (!overrideDialog.technicianId) {
      snackbar.showError(t('effectif.selectTechnician', 'Sélectionnez un technicien'));
      return;
    }
    setSaving(true);
    api.post('/attendance-overrides', {
      technicianId: parseInt(overrideDialog.technicianId, 10),
      date,
      status: overrideDialog.status,
      comment: overrideDialog.comment || undefined
    })
      .then(() => {
        snackbar.showSuccess(t('common.saved', 'Enregistré'));
        handleCloseOverride();
        loadSummary();
      })
      .catch((err) => snackbar.showError(err.response?.data?.error || 'Erreur'))
      .finally(() => setSaving(false));
  };

  const items = summary.items || [];

  return (
    <Box sx={{ p: 2 }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PresenceIcon color="primary" />
            <Typography variant="h6">{t('item.effectif_presence')}</Typography>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('effectif.presenceDescription', 'Gestion de la présence de l\'effectif. Saisissez les congés, formations ou arrêts pour une date donnée.')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            <TextField
              type="date"
              label={t('effectif.date', 'Date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenOverride}>
              {t('effectif.addOverride', 'Saisir congé / formation / absence')}
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
                <TableCell align="center">{t('effectif.status', 'Statut')}</TableCell>
                <TableCell align="center">{t('effectif.firstIn', 'Entrée')}</TableCell>
                <TableCell align="center">{t('effectif.lastOut', 'Sortie')}</TableCell>
                <TableCell align="center">{t('effectif.minutesWorked', 'Heures')}</TableCell>
                <TableCell>{t('effectif.comment', 'Commentaire')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" color="text.secondary" sx={{ py: 3 }}>
                    {t('effectif.noTechnicians', 'Aucun technicien dans l\'effectif.')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.technician_id}>
                    <TableCell>
                      {row.technician_last_name} {row.technician_first_name}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={STATUS_LABELS[row.status] || row.status}
                        color={row.status === 'present' ? 'success' : row.status === 'absent' ? 'default' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">{formatTime(row.first_in)}</TableCell>
                    <TableCell align="center">{formatTime(row.last_out)}</TableCell>
                    <TableCell align="center">{formatMinutes(row.minutes_worked)}</TableCell>
                    <TableCell>{row.override_comment || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={overrideDialog.open} onClose={handleCloseOverride} maxWidth="sm" fullWidth>
        <DialogTitle>{t('effectif.addOverride', 'Saisir congé / formation / absence')}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
            <InputLabel>{t('effectif.technician', 'Technicien')}</InputLabel>
            <Select
              value={overrideDialog.technicianId}
              label={t('effectif.technician', 'Technicien')}
              onChange={(e) => setOverrideDialog((o) => ({ ...o, technicianId: e.target.value }))}
            >
              <MenuItem value="">—</MenuItem>
              {technicians.map((tech) => (
                <MenuItem key={tech.id} value={tech.id}>
                  {tech.last_name} {tech.first_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>{t('effectif.status', 'Statut')}</InputLabel>
            <Select
              value={overrideDialog.status}
              label={t('effectif.status', 'Statut')}
              onChange={(e) => setOverrideDialog((o) => ({ ...o, status: e.target.value }))}
            >
              <MenuItem value="leave">{STATUS_LABELS.leave}</MenuItem>
              <MenuItem value="training">{STATUS_LABELS.training}</MenuItem>
              <MenuItem value="sick">{STATUS_LABELS.sick}</MenuItem>
              <MenuItem value="other">{STATUS_LABELS.other}</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            size="small"
            label={t('effectif.comment', 'Commentaire')}
            value={overrideDialog.comment}
            onChange={(e) => setOverrideDialog((o) => ({ ...o, comment: e.target.value }))}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseOverride}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant="contained" onClick={handleSaveOverride} disabled={saving}>
            {saving ? t('common.saving', 'Enregistrement…') : t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PresencePage;
