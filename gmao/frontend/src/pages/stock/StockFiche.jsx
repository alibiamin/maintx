import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Edit from '@mui/icons-material/Edit';
import Save from '@mui/icons-material/Save';
import Cancel from '@mui/icons-material/Cancel';
import Image from '@mui/icons-material/Image';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import api from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';

const MAX_IMAGE_SIZE = 800;
const MAX_IMAGE_KB = 500;

function resizeImageIfNeeded(dataUrl) {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w <= MAX_IMAGE_SIZE && h <= MAX_IMAGE_SIZE) {
        resolve(dataUrl);
        return;
      }
      const ratio = Math.min(MAX_IMAGE_SIZE / w, MAX_IMAGE_SIZE / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', 0.85);
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function StockFiche() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = useCurrency();
  const { user } = useAuth();
  const canEdit = ['administrateur', 'responsable_maintenance'].includes(user?.role);

  const [part, setPart] = useState(null);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    unit: 'unit',
    unitPrice: 0,
    minStock: 0,
    supplierId: '',
    location: '',
    manufacturerReference: '',
    imageData: null
  });
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);
  const [changeStatusForm, setChangeStatusForm] = useState({ fromStatus: 'A', toStatus: 'Q', quantity: 1, notes: '' });
  const [changeStatusSubmitting, setChangeStatusSubmitting] = useState(false);
  const [changeStatusError, setChangeStatusError] = useState('');

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) {
      setLoading(false);
      navigate('/app/stock');
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/stock/parts/${id}`),
      api.get(`/stock/parts/${id}/movements`).catch(() => ({ data: [] })),
      api.get('/suppliers').catch(() => ({ data: [] }))
    ])
      .then(([partRes, movRes, supRes]) => {
        const p = partRes.data;
        setPart(p);
        setMovements(Array.isArray(movRes.data) ? movRes.data : []);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setForm({
          name: p.name || '',
          description: p.description || '',
          unit: p.unit || 'unit',
          unitPrice: p.unit_price ?? 0,
          minStock: p.min_stock ?? 0,
          supplierId: p.supplier_id ?? '',
          location: p.location || '',
          manufacturerReference: p.manufacturer_reference || '',
          imageData: p.image_data || null
        });
      })
      .catch((e) => {
        setError(e.response?.data?.error || e.message || 'Erreur chargement');
        setPart(null);
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_KB * 1024) {
      setError(`Image trop volumineuse (max ${MAX_IMAGE_KB} Ko). Réduisez-la ou choisissez une autre.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      let dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      resizeImageIfNeeded(dataUrl).then((resized) => {
        handleChange('imageData', resized);
        setError('');
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    handleChange('imageData', null);
  };

  const openChangeStatusDialog = () => {
    const acc = part.quantity_accepted ?? 0;
    const quar = part.quantity_quarantine ?? 0;
    const rej = part.quantity_rejected ?? 0;
    const from = acc > 0 ? 'A' : (quar > 0 ? 'Q' : 'R');
    const to = from === 'A' ? 'Q' : (from === 'Q' ? 'A' : 'A');
    const maxQty = from === 'A' ? acc : (from === 'Q' ? quar : rej);
    setChangeStatusForm({ fromStatus: from, toStatus: to, quantity: Math.min(1, maxQty) || 1, notes: '' });
    setChangeStatusError('');
    setChangeStatusOpen(true);
  };

  const handleChangeStatusSubmit = () => {
    const acc = part.quantity_accepted ?? 0;
    const quar = part.quantity_quarantine ?? 0;
    const rej = part.quantity_rejected ?? 0;
    const maxQty = changeStatusForm.fromStatus === 'A' ? acc : (changeStatusForm.fromStatus === 'Q' ? quar : rej);
    if (changeStatusForm.quantity < 1 || changeStatusForm.quantity > maxQty) {
      setChangeStatusError(`Quantité invalide (max ${maxQty} pour le statut ${changeStatusForm.fromStatus})`);
      return;
    }
    if (changeStatusForm.fromStatus === changeStatusForm.toStatus) {
      setChangeStatusError('Choisir un statut cible différent');
      return;
    }
    setChangeStatusSubmitting(true);
    setChangeStatusError('');
    api.post('/stock/quality/change-status', {
      sparePartId: part.id,
      fromStatus: changeStatusForm.fromStatus,
      toStatus: changeStatusForm.toStatus,
      quantity: changeStatusForm.quantity,
      notes: changeStatusForm.notes || undefined
    })
      .then((r) => {
        const bal = r.data.balance || {};
        setPart((prev) => prev ? { ...prev, stock_quantity: bal.quantity ?? prev.stock_quantity, quantity_accepted: bal.quantity_accepted, quantity_quarantine: bal.quantity_quarantine, quantity_rejected: bal.quantity_rejected } : null);
        setChangeStatusOpen(false);
      })
      .catch((e) => setChangeStatusError(e.response?.data?.error || e.message || 'Erreur'))
      .finally(() => setChangeStatusSubmitting(false));
  };

  const handleSave = () => {
    setSaving(true);
    setError('');
    api
      .put(`/stock/parts/${id}`, {
        name: (form.name || '').trim(),
        description: (form.description || '').trim() || null,
        unit: (form.unit || 'unit').trim(),
        unitPrice: parseFloat(form.unitPrice) || 0,
        minStock: parseInt(form.minStock, 10) || 0,
        supplierId: form.supplierId ? parseInt(form.supplierId, 10) : null,
        location: (form.location || '').trim() || null,
        manufacturerReference: (form.manufacturerReference || '').trim() || null,
        imageData: form.imageData || null
      })
      .then((r) => {
        setPart(r.data);
        setForm((f) => ({
          ...f,
          name: r.data.name || '',
          description: r.data.description || '',
          unit: r.data.unit || 'unit',
          unitPrice: r.data.unit_price ?? 0,
          minStock: r.data.min_stock ?? 0,
          supplierId: r.data.supplier_id ?? '',
          location: r.data.location || '',
          manufacturerReference: r.data.manufacturer_reference || '',
          imageData: r.data.image_data || null
        }));
        setEditing(false);
      })
      .catch((e) => setError(e.response?.data?.error || e.message || 'Erreur enregistrement'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }
  if (!part) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/stock')} sx={{ mb: 2 }}>
          Retour
        </Button>
        <Typography color="error">{error || 'Pièce non trouvée'}</Typography>
      </Box>
    );
  }

  const stockQty = part.stock_quantity ?? 0;
  const belowMin = part.min_stock != null && stockQty <= part.min_stock;

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        <IconButton onClick={() => navigate('/app/stock')} size="small" aria-label="Retour">
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          Fiche stock — {part.code}
        </Typography>
        {!editing && (part.quantity_accepted != null || part.quantity_quarantine != null) && (canEdit || user?.role === 'technicien') && (
          <Button variant="outlined" size="small" startIcon={<SwapHoriz />} onClick={openChangeStatusDialog}>
            Changer le statut
          </Button>
        )}
        {canEdit && !editing && (
          <Button variant="outlined" size="small" startIcon={<Edit />} onClick={() => setEditing(true)}>
            Modifier
          </Button>
        )}
        {editing && (
          <>
            <Button variant="contained" size="small" startIcon={<Save />} onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="outlined" size="small" startIcon={<Cancel />} onClick={() => setEditing(false)} disabled={saving}>
              Annuler
            </Button>
          </>
        )}
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Image de l&apos;article
              </Typography>
              {editing ? (
                <Box>
                  {(form.imageData || part.image_data) ? (
                    <Box position="relative" display="inline-block">
                      <img
                        src={form.imageData || part.image_data}
                        alt={part.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 280,
                          objectFit: 'contain',
                          borderRadius: 8,
                          border: '1px solid #e0e0e0'
                        }}
                      />
                      <Button size="small" color="error" onClick={handleRemoveImage} sx={{ mt: 1 }}>
                        Supprimer l&apos;image
                      </Button>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 3,
                        textAlign: 'center'
                      }}
                    >
                      <Image sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Ajouter une photo (max {MAX_IMAGE_KB} Ko)
                      </Typography>
                      <Button variant="outlined" component="label" size="small">
                        Choisir un fichier
                        <input type="file" accept="image/*" hidden onChange={handleImageFile} />
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                part.image_data ? (
                  <img
                    src={part.image_data}
                    alt={part.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 280,
                      objectFit: 'contain',
                      borderRadius: 8,
                      border: '1px solid #e0e0e0'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      bgcolor: 'action.hover',
                      borderRadius: 2,
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Image sx={{ fontSize: 64, color: 'text.disabled' }} />
                  </Box>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              {editing ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Code" value={part.code} disabled size="small" helperText="Non modifiable" />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Désignation"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={form.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      multiline
                      rows={2}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Unité"
                      value={form.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label={`Prix unitaire (${currency})`}
                      value={form.unitPrice}
                      onChange={(e) => handleChange('unitPrice', e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Seuil minimum"
                      value={form.minStock}
                      onChange={(e) => handleChange('minStock', e.target.value)}
                      inputProps={{ min: 0 }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Fournisseur</InputLabel>
                      <Select
                        value={form.supplierId ?? ''}
                        label="Fournisseur"
                        onChange={(e) => handleChange('supplierId', e.target.value)}
                      >
                        <MenuItem value="">— Aucun —</MenuItem>
                        {suppliers.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Emplacement"
                      value={form.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      placeholder="Rayon, armoire..."
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Référence constructeur"
                      value={form.manufacturerReference}
                      onChange={(e) => handleChange('manufacturerReference', e.target.value)}
                      size="small"
                    />
                  </Grid>
                </Grid>
              ) : (
                <>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Code</Typography>
                      <Typography variant="body1" fontWeight={600}>{part.code}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Désignation</Typography>
                      <Typography variant="body1" fontWeight={600}>{part.name}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Description</Typography>
                      <Typography variant="body1">{part.description || '—'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Unité</Typography>
                      <Typography variant="body1">{part.unit || 'unit'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Prix unitaire</Typography>
                      <Typography variant="body1">{part.unit_price != null ? `${Number(part.unit_price).toFixed(2)} ${currency}` : '—'}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Stock actuel</Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {stockQty}
                        {belowMin && <Chip label="Sous seuil" size="small" color="warning" sx={{ ml: 1 }} />}
                      </Typography>
                    </Grid>
                    {(part.quantity_accepted != null || part.quantity_quarantine != null) && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Répartition (A / Q / R)</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                          <Chip size="small" label={`A: ${part.quantity_accepted ?? 0}`} color="success" variant="outlined" title="Accepté (utilisable OT/projets)" />
                          <Chip size="small" label={`Q: ${part.quantity_quarantine ?? 0}`} color="warning" variant="outlined" title="Quarantaine" />
                          <Chip size="small" label={`R: ${part.quantity_rejected ?? 0}`} color="error" variant="outlined" title="Rejeté" />
                        </Box>
                      </Grid>
                    )}
                    <Grid item xs={6} sm={3}>
                      <Typography variant="caption" color="text.secondary">Seuil minimum</Typography>
                      <Typography variant="body1">{part.min_stock ?? 0}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Fournisseur</Typography>
                      <Typography variant="body1">{part.supplier_name || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Emplacement</Typography>
                      <Typography variant="body1">{part.location || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Référence constructeur</Typography>
                      <Typography variant="body1">{part.manufacturer_reference || '—'}</Typography>
                    </Grid>
                  </Grid>
                </>
              )}
            </CardContent>
          </Card>

          {movements.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Derniers mouvements
              </Typography>
              <Card variant="outlined">
                <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {movements.slice(0, 10).map((m) => (
                      <li key={m.id}>
                        <Typography variant="body2">
                          {m.created_at?.slice(0, 16)} — {m.movement_type} {m.quantity > 0 ? '+' : ''}{m.quantity} {m.user_name ? `(${m.user_name})` : ''}
                          {m.reference && ` — ${m.reference}`}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </>
          )}
        </Grid>
      </Grid>

      <Dialog open={changeStatusOpen} onClose={() => !changeStatusSubmitting && setChangeStatusOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Changer le statut du stock (total ou partiel)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {changeStatusError && <Typography color="error">{changeStatusError}</Typography>}
            <FormControl fullWidth>
              <InputLabel>Statut source</InputLabel>
              <Select
                value={changeStatusForm.fromStatus}
                label="Statut source"
                onChange={(e) => {
                  const from = e.target.value;
                  const acc = part?.quantity_accepted ?? 0;
                  const quar = part?.quantity_quarantine ?? 0;
                  const rej = part?.quantity_rejected ?? 0;
                  const maxQty = from === 'A' ? acc : (from === 'Q' ? quar : rej);
                  setChangeStatusForm((f) => ({ ...f, fromStatus: from, quantity: Math.min(f.quantity, maxQty) || 1 }));
                }}
              >
                <MenuItem value="A">A — Accepté (disponible : {part?.quantity_accepted ?? 0})</MenuItem>
                <MenuItem value="Q">Q — Quarantaine (disponible : {part?.quantity_quarantine ?? 0})</MenuItem>
                <MenuItem value="R">R — Rejeté (disponible : {part?.quantity_rejected ?? 0})</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Statut cible</InputLabel>
              <Select
                value={changeStatusForm.toStatus}
                label="Statut cible"
                onChange={(e) => setChangeStatusForm((f) => ({ ...f, toStatus: e.target.value }))}
              >
                <MenuItem value="A">A — Accepté</MenuItem>
                <MenuItem value="Q">Q — Quarantaine</MenuItem>
                <MenuItem value="R">R — Rejeté</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="number"
              label="Quantité"
              value={changeStatusForm.quantity}
              onChange={(e) => setChangeStatusForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 0 }))}
              inputProps={{
                min: 1,
                max: changeStatusForm.fromStatus === 'A' ? (part?.quantity_accepted ?? 0) : (changeStatusForm.fromStatus === 'Q' ? (part?.quantity_quarantine ?? 0) : (part?.quantity_rejected ?? 0))
              }}
              fullWidth
              helperText={`Max : ${changeStatusForm.fromStatus === 'A' ? (part?.quantity_accepted ?? 0) : (changeStatusForm.fromStatus === 'Q' ? (part?.quantity_quarantine ?? 0) : (part?.quantity_rejected ?? 0))} en statut ${changeStatusForm.fromStatus}`}
            />
            <TextField
              label="Notes"
              value={changeStatusForm.notes}
              onChange={(e) => setChangeStatusForm((f) => ({ ...f, notes: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeStatusOpen(false)} disabled={changeStatusSubmitting}>Annuler</Button>
          <Button variant="contained" onClick={handleChangeStatusSubmit} disabled={changeStatusSubmitting}>
            {changeStatusSubmitting ? 'En cours...' : 'Appliquer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
