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
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip
} from '@mui/material';
import Add from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Chip from '@mui/material/Chip';
import api from '../services/api';

function formatDate(s) {
  if (!s) return '—';
  return s.slice(0, 10);
}

export default function SettingsTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [form, setForm] = useState({
    name: '', emailDomain: '', dbFilename: '', initSchema: true, licenseStart: '', licenseEnd: '',
    adminEmail: '', adminPassword: '', adminFirstName: '', adminLastName: ''
  });
  const [editForm, setEditForm] = useState({ name: '', licenseStart: '', licenseEnd: '', enabledModules: null });
  const [moduleList, setModuleList] = useState({ codes: [], labels: {}, packs: [] });
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offerPriceEdit, setOfferPriceEdit] = useState({}); // code -> value (string)
  const [savingOfferCode, setSavingOfferCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setOffersLoading(true);
    try {
      const res = await api.get('/tenants/offers');
      setOffers(Array.isArray(res.data) ? res.data : []);
      setOfferPriceEdit({});
    } catch (e) {
      console.error(e);
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  const handleSaveOffer = async (code) => {
    const raw = offerPriceEdit[code];
    const price = raw === '' || raw == null ? null : parseFloat(String(raw).replace(',', '.'));
    if (price !== null && Number.isNaN(price)) return;
    setSavingOfferCode(code);
    try {
      await api.put(`/tenants/offers/${code}`, { price });
      setOfferPriceEdit((prev) => ({ ...prev, [code]: undefined }));
      loadOffers();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Erreur lors de l\'enregistrement du prix.');
    } finally {
      setSavingOfferCode(null);
    }
  };

  useEffect(() => {
    api.get('/tenants/modules')
      .then((res) => setModuleList({
        codes: res.data?.codes ?? [],
        labels: res.data?.labels ?? {},
        packs: res.data?.packs ?? []
      }))
      .catch(() => setModuleList({ codes: [], labels: {}, packs: [] }));
  }, []);

  const loadTenants = async () => {
    try {
      const res = await api.get('/tenants');
      setTenants(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setError('');
    setForm({
      name: '', emailDomain: '', dbFilename: '', initSchema: true, licenseStart: '', licenseEnd: '',
      adminEmail: '', adminPassword: '', adminFirstName: '', adminLastName: ''
    });
    setDialogOpen(true);
  };

  const handleEdit = (t) => {
    setEditingTenant(t);
    setEditForm({
      name: t.name || '',
      licenseStart: t.licenseStart ? t.licenseStart.slice(0, 10) : '',
      licenseEnd: t.licenseEnd ? t.licenseEnd.slice(0, 10) : '',
      enabledModules: t.enabledModules !== undefined ? (Array.isArray(t.enabledModules) ? t.enabledModules : null) : null
    });
    setError('');
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingTenant) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: (editForm.name || '').trim() || undefined,
        licenseStart: (editForm.licenseStart || '').trim() || undefined,
        licenseEnd: (editForm.licenseEnd || '').trim() || undefined
      };
      if (editForm.enabledModules !== undefined) payload.enabledModules = editForm.enabledModules;
      await api.put(`/tenants/${editingTenant.id}`, payload);
      setEditDialogOpen(false);
      setEditingTenant(null);
      loadTenants();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Erreur lors de la mise à jour.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const name = (form.name || '').trim();
    const emailDomain = (form.emailDomain || '').trim().replace(/^@/, '');
    const adminEmail = (form.adminEmail || '').trim();
    const adminPassword = (form.adminPassword || '').trim();
    const adminFirstName = (form.adminFirstName || '').trim();
    const adminLastName = (form.adminLastName || '').trim();
    if (!name || !emailDomain) {
      setError('Nom et domaine email du client sont requis.');
      return;
    }
    if (!adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      setError('Tous les champs du compte administrateur sont requis.');
      return;
    }
    if (adminPassword.length < 8) {
      setError('Le mot de passe de l\'admin doit contenir au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/tenants', {
        name,
        emailDomain: emailDomain || undefined,
        dbFilename: (form.dbFilename || '').trim() || undefined,
        initSchema: !!form.initSchema,
        licenseStart: (form.licenseStart || '').trim() || undefined,
        licenseEnd: (form.licenseEnd || '').trim() || undefined,
        adminEmail,
        adminPassword,
        adminFirstName,
        adminLastName
      });
      setDialogOpen(false);
      loadTenants();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce client ? Les utilisateurs associés restent dans gmao.db ; la base de données du client n\'est pas supprimée.')) return;
    try {
      await api.delete(`/tenants/${id}`);
      loadTenants();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || 'Erreur lors de la suppression.');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Clients (tenants)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des clients et de leur licence (période d&apos;utilisation). Après la date de fin, les utilisateurs du client ne peuvent plus se connecter jusqu&apos;à une nouvelle activation.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>
          Nouveau client
        </Button>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : tenants.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun client. Cliquez sur « Nouveau client » pour en ajouter un.
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nom</TableCell>
                  <TableCell>Domaine email</TableCell>
                  <TableCell>Début licence</TableCell>
                  <TableCell>Fin licence</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{t.name}</Typography>
                    </TableCell>
                    <TableCell>{t.emailDomain || '-'}</TableCell>
                    <TableCell>{formatDate(t.licenseStart)}</TableCell>
                    <TableCell>{formatDate(t.licenseEnd)}</TableCell>
                    <TableCell>
                      <Chip
                        label={t.isActive ? 'Actif' : 'Expiré'}
                        size="small"
                        color={t.isActive ? 'success' : 'default'}
                        variant={t.isActive ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEdit(t)} title="Modifier licence">
                        <EditOutlined />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(t.id)} title="Supprimer">
                        <DeleteOutline />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2, mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Tarifs des offres
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Prix affichés sur la page d&apos;accueil (landing). Les offres sont utilisées pour la démo et les demandes de devis.
          </Typography>
          {offersLoading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={28} />
            </Box>
          ) : offers.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              Aucune offre configurée. Exécutez les migrations sur la base admin (gmao.db).
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Offre</TableCell>
                  <TableCell>Prix (€/mois)</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {offers.map((o) => {
                  const editVal = offerPriceEdit[o.code];
                  const displayPrice = editVal !== undefined ? editVal : (o.price != null ? String(o.price) : '');
                  const isSaving = savingOfferCode === o.code;
                  return (
                    <TableRow key={o.code}>
                      <TableCell>
                        <Typography fontWeight={600}>{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{o.code}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="text"
                          placeholder="Sur devis si vide"
                          value={displayPrice}
                          onChange={(e) => setOfferPriceEdit((prev) => ({ ...prev, [o.code]: e.target.value }))}
                          sx={{ maxWidth: 140 }}
                          inputProps={{ inputMode: 'decimal' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          disabled={isSaving}
                          onClick={() => handleSaveOffer(o.code)}
                        >
                          {isSaving ? <CircularProgress size={18} /> : 'Enregistrer'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nouveau client</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
            <TextField
              label="Nom du client"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Domaine email (ex: entreprise.com)"
              value={form.emailDomain}
              onChange={(e) => setForm((f) => ({ ...f, emailDomain: e.target.value }))}
              fullWidth
              required
              placeholder="entreprise.com"
              helperText="Les utilisateurs @ce-domaine se connecteront à la base de ce client."
            />
            <TextField
              label="Fichier base (optionnel)"
              value={form.dbFilename}
              onChange={(e) => setForm((f) => ({ ...f, dbFilename: e.target.value }))}
              fullWidth
              placeholder="client_entreprise.db"
              helperText="Par défaut : client_<domaine>.db"
            />
            <TextField
              label="Début licence (optionnel)"
              type="date"
              value={form.licenseStart || ''}
              onChange={(e) => setForm((f) => ({ ...f, licenseStart: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Date à partir de laquelle les utilisateurs peuvent se connecter"
            />
            <TextField
              label="Fin licence (optionnel)"
              type="date"
              value={form.licenseEnd || ''}
              onChange={(e) => setForm((f) => ({ ...f, licenseEnd: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Après cette date, les utilisateurs du client ne pourront plus se connecter"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!form.initSchema}
                  onChange={(e) => setForm((f) => ({ ...f, initSchema: e.target.checked }))}
                />
              }
              label="Créer la base vide dès maintenant (schéma GMAO)"
            />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              Compte administrateur du client
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Cet utilisateur pourra se connecter et gérer la GMAO de ce client. L&apos;email doit être du domaine du client (ex: admin@domaine.com).
            </Typography>
            <TextField
              label="Email de l'admin"
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
              fullWidth
              required
              placeholder={`admin@${(form.emailDomain || '').replace(/^@/, '') || 'domaine.com'}`}
            />
            <TextField
              label="Mot de passe (min. 8 caractères)"
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
              fullWidth
              required
              inputProps={{ minLength: 8 }}
            />
            <Box display="flex" gap={2}>
              <TextField
                label="Prénom"
                value={form.adminFirstName}
                onChange={(e) => setForm((f) => ({ ...f, adminFirstName: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label="Nom"
                value={form.adminLastName}
                onChange={(e) => setForm((f) => ({ ...f, adminLastName: e.target.value }))}
                fullWidth
                required
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Création...' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => !submitting && setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier le client — Période de licence et modules</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
            <TextField
              label="Nom du client"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Début licence"
              type="date"
              value={editForm.licenseStart || ''}
              onChange={(e) => setEditForm((f) => ({ ...f, licenseStart: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fin licence"
              type="date"
              value={editForm.licenseEnd || ''}
              onChange={(e) => setEditForm((f) => ({ ...f, licenseEnd: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Après cette date, les utilisateurs ne pourront plus se connecter jusqu'à une nouvelle activation"
            />
            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>
              Modules activés
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Choisir un pack prédéfini ou personnaliser ci‑dessous. L’absence d’un module n’affecte pas les autres.
            </Typography>
            {moduleList.packs.length > 0 && (
              <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                {moduleList.packs.map((pack) => {
                  const isComplet = pack.moduleCodes === null;
                  const isSelected = isComplet
                    ? editForm.enabledModules === null
                    : (Array.isArray(editForm.enabledModules) &&
                        editForm.enabledModules.length === (pack.moduleCodes?.length ?? 0) &&
                        (pack.moduleCodes ?? []).every((c) => editForm.enabledModules.includes(c)));
                  return (
                    <Tooltip key={pack.id} title={pack.description || ''}>
                      <Button
                        size="small"
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => setEditForm((f) => ({ ...f, enabledModules: pack.moduleCodes === null ? null : [...(pack.moduleCodes || [])] }))}
                      >
                        {pack.label}
                      </Button>
                    </Tooltip>
                  );
                })}
                <Button
                  size="small"
                  variant={editForm.enabledModules !== null && !moduleList.packs.some((pack) => {
                    const isComplet = pack.moduleCodes === null;
                    if (isComplet) return false;
                    return Array.isArray(editForm.enabledModules) &&
                      editForm.enabledModules.length === (pack.moduleCodes?.length ?? 0) &&
                      (pack.moduleCodes ?? []).every((c) => editForm.enabledModules.includes(c));
                  }) ? 'contained' : 'outlined'}
                  disabled
                >
                  Personnalisé
                </Button>
              </Box>
            )}
            <Box display="flex" flexWrap="wrap" gap={1} maxHeight={200} overflow="auto" p={1} border={1} borderColor="divider" borderRadius={1}>
              {moduleList.codes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Chargement…</Typography>
              ) : (
                moduleList.codes.map((code) => {
                  const isAll = editForm.enabledModules === null;
                  const checked = isAll || (Array.isArray(editForm.enabledModules) && editForm.enabledModules.includes(code));
                  const label = moduleList.labels[code] || code;
                  return (
                    <FormControlLabel
                      key={code}
                      control={
                        <Checkbox
                          size="small"
                          checked={checked}
                          onChange={(e) => {
                            setEditForm((f) => {
                              if (f.enabledModules === null) {
                                return e.target.checked
                                  ? f
                                  : { ...f, enabledModules: moduleList.codes.filter((c) => c !== code) };
                              }
                              const arr = Array.isArray(f.enabledModules) ? f.enabledModules : [];
                              return {
                                ...f,
                                enabledModules: e.target.checked ? [...arr, code] : arr.filter((c) => c !== code)
                              };
                            });
                          }}
                        />
                      }
                      label={label}
                    />
                  );
                })
              )}
            </Box>
            {editForm.enabledModules !== null && (
              <Button
                size="small"
                onClick={() => setEditForm((f) => ({ ...f, enabledModules: null }))}
              >
                Activer tous les modules
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleEditSubmit} disabled={submitting}>
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
