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
  TableHead,
  TableRow,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Save, Backup, Email, Sms } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../context/SnackbarContext';

const CODIFICATION_ENTITIES = [
  { key: 'site', label: 'Site' },
  { key: 'departement', label: 'Département' },
  { key: 'ligne', label: 'Ligne' },
  { key: 'machine', label: 'Machine / Équipement' },
  { key: 'piece', label: 'Pièce détachée' },
  { key: 'outil', label: 'Outil' },
  { key: 'fournisseur', label: 'Fournisseur' },
  { key: 'code_defaut', label: 'Code défaut' }
];

export default function Settings() {
  const [failureCodes, setFailureCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState('45');
  const [tab, setTab] = useState(0);
  const [codification, setCodification] = useState({});
  const [codificationSave, setCodificationSave] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState({ email: '', phone: '', events: [], preferences: {} });
  const [notifPhone, setNotifPhone] = useState('');
  const [notifPreferences, setNotifPreferences] = useState({});
  const [notifSaving, setNotifSaving] = useState(false);
  const { user } = useAuth();
  const canEditCodification = ['administrateur', 'responsable_maintenance'].includes(user?.role);
  const isAdmin = user?.role === 'administrateur';
  const snackbar = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const alertesTabIndex = isAdmin ? 4 : 3;

  useEffect(() => {
    if (searchParams.get('tab') === 'alertes') setTab(alertesTabIndex);
  }, [searchParams.get('tab'), alertesTabIndex]);

  useEffect(() => {
    api.get('/failure-codes').then(r => setFailureCodes(r.data)).catch(() => setFailureCodes([])).finally(() => setLoading(false));
    api.get('/settings/hourly-rate').then(r => setHourlyRate(r.data?.value || '45')).catch(() => {});
    api.get('/settings/codification').then(r => setCodification(r.data || {})).catch(() => setCodification({}));
  }, []);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then((r) => {
        setNotifPrefs(r.data);
        setNotifPhone(r.data.phone || '');
        setNotifPreferences(r.data.preferences || {});
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  const handleSaveRate = () => {
    api.post('/settings/hourly-rate', { value: hourlyRate })
      .then(() => snackbar.showSuccess('Taux horaire enregistré'))
      .catch(() => snackbar.showError('Erreur enregistrement'));
  };

  const handleCodificationChange = (entity, field, value) => {
    setCodification(prev => ({
      ...prev,
      [entity]: { ...(prev[entity] || {}), [field]: value }
    }));
  };

  const handleSaveCodification = () => {
    setCodificationSave('');
    api.put('/settings/codification', codification)
      .then(() => { setCodificationSave('Codification enregistrée.'); snackbar.showSuccess('Codification enregistrée'); })
      .catch(() => { setCodificationSave('Erreur lors de l\'enregistrement.'); snackbar.showError('Erreur enregistrement'); });
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/settings/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xmaint-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleNotifPrefChange = (eventType, channel, checked) => {
    setNotifPreferences((prev) => ({
      ...prev,
      [eventType]: { ...(prev[eventType] || {}), [channel]: checked }
    }));
  };

  const handleSaveNotifPrefs = () => {
    setNotifSaving(true);
    api.put('/notifications/preferences', { phone: notifPhone || undefined, preferences: notifPreferences })
      .then((r) => {
        setNotifPrefs(r.data);
        setNotifPhone(r.data.phone || '');
        setNotifPreferences(r.data.preferences || {});
        snackbar.showSuccess('Préférences d\'alertes enregistrées');
      })
      .catch(() => snackbar.showError('Erreur lors de l\'enregistrement des alertes'))
      .finally(() => setNotifSaving(false));
  };

  if (loading && failureCodes.length === 0) return <Box p={4}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Paramétrage
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          if (v === alertesTabIndex) setSearchParams({ tab: 'alertes' });
          else setSearchParams({});
        }}
        sx={{ mb: 2 }}
      >
        <Tab label="Codes défaut" />
        <Tab label="Coûts" />
        <Tab label="Codification" />
        {isAdmin && <Tab label="Sauvegarde" />}
        <Tab label="Alertes email / SMS" />
      </Tabs>

      {tab === 0 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Codes défaut / Causes de panne
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Référentiel pour l'analyse des pannes (inspiré Coswin, arbre de défaillance)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Nom</TableCell>
                  <TableCell>Catégorie</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {failureCodes.map((fc) => (
                  <TableRow key={fc.id}>
                    <TableCell>{fc.code}</TableCell>
                    <TableCell>{fc.name}</TableCell>
                    <TableCell>{fc.category || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {failureCodes.length === 0 && (
              <Typography color="text.secondary">Exécutez la migration 002 pour charger les codes par défaut.</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Taux horaire (coûts main d'œuvre)
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <TextField
                type="number"
                label="Taux horaire (€/h)"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                size="small"
                sx={{ width: 120 }}
              />
              <Button variant="contained" startIcon={<Save />} onClick={handleSaveRate}>
                Enregistrer
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Utilisé pour le calcul des coûts de maintenance (interventions × heures)
            </Typography>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              Codification des éléments
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Définissez un préfixe et le nombre de chiffres pour les codes. À la création (site, département, ligne…), le code sera généré automatiquement et l&apos;utilisateur saisit uniquement la désignation.
            </Typography>
            {codificationSave && <Alert severity={codificationSave.startsWith('Erreur') ? 'error' : 'success'} sx={{ mb: 2 }} onClose={() => setCodificationSave('')}>{codificationSave}</Alert>}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Élément</TableCell>
                  <TableCell>Préfixe</TableCell>
                  <TableCell>Longueur (chiffres)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CODIFICATION_ENTITIES.map(({ key, label }) => (
                  <TableRow key={key}>
                    <TableCell>{label}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={codification[key]?.prefix ?? ''}
                        onChange={(e) => handleCodificationChange(key, 'prefix', e.target.value)}
                        placeholder="ex: S"
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 1, max: 10 }}
                        value={codification[key]?.length ?? ''}
                        onChange={(e) => handleCodificationChange(key, 'length', e.target.value)}
                        placeholder="4"
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<Save />} onClick={handleSaveCodification} disabled={!canEditCodification}>
                Enregistrer la codification
              </Button>
              {!canEditCodification && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Réservé aux administrateurs et responsables.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {isAdmin && tab === 3 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Sauvegarde de la base de données
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Téléchargez une copie du fichier SQLite (toutes les données). Réservé aux administrateurs.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Backup />}
              onClick={handleBackup}
              disabled={backupLoading}
            >
              {backupLoading ? 'Téléchargement…' : 'Télécharger une sauvegarde'}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === alertesTabIndex && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Alertes par email et SMS
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choisissez les événements pour lesquels vous souhaitez recevoir une alerte par email et/ou SMS (nouvelle panne, affectation, clôture OT, plans en retard, alerte stock).
            </Typography>
            {notifLoading ? (
              <CircularProgress size={24} />
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Email (lecture seule)</Typography>
                  <TextField size="small" value={notifPrefs.email || ''} disabled fullWidth sx={{ maxWidth: 400 }} />
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Téléphone (pour les SMS)</Typography>
                  <TextField
                    size="small"
                    placeholder="+33 6 12 34 56 78"
                    value={notifPhone}
                    onChange={(e) => setNotifPhone(e.target.value)}
                    fullWidth
                    sx={{ maxWidth: 400 }}
                  />
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Événement</TableCell>
                      <TableCell align="center"><Email fontSize="small" /> Email</TableCell>
                      <TableCell align="center"><Sms fontSize="small" /> SMS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(notifPrefs.events || []).map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.label}</TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(notifPreferences[ev.id]?.email)}
                                onChange={(e) => handleNotifPrefChange(ev.id, 'email', e.target.checked)}
                              />
                            }
                            label=""
                          />
                        </TableCell>
                        <TableCell align="center">
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={!!(notifPreferences[ev.id]?.sms)}
                                onChange={(e) => handleNotifPrefChange(ev.id, 'sms', e.target.checked)}
                              />
                            }
                            label=""
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" startIcon={<Save />} onClick={handleSaveNotifPrefs} disabled={notifSaving}>
                    {notifSaving ? 'Enregistrement…' : 'Enregistrer les préférences'}
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
