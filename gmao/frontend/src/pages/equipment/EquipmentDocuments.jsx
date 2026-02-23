import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Chip,
  Alert
} from '@mui/material';
import { Download, Delete, Description } from '@mui/icons-material';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function EquipmentDocuments() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, [id]);

  const loadDocuments = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(`/equipment/${id}/documents`);
      const data = res.data?.data ?? res.data ?? [];
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Erreur lors du chargement des documents.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId) => {
    try {
      const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = documents.find((d) => d.id === docId)?.original_filename || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(t('equipmentManagement.deleteDocumentConfirm'))) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      await loadDocuments();
    } catch (err) {
      console.error(err);
    }
  };

  const formatSize = (fileSize) => {
    if (fileSize == null || fileSize === '') return '—';
    const kb = Number(fileSize) / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('equipmentManagement.documentsTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('equipmentManagement.documentsSubtitle')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('equipmentManagement.creationHint')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : documents.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              {t('equipmentManagement.noDocuments')}
            </Typography>
          ) : (
            <List disablePadding>
              {documents.map((doc) => (
                <ListItem
                  key={doc.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    mb: 1
                  }}
                >
                  <Description sx={{ mr: 2, color: 'primary.main' }} />
                  <ListItemText
                    primary={doc.original_filename || doc.filename || 'Sans nom'}
                    secondary={
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                        <Chip label={doc.document_type || 'other'} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          {t('equipmentManagement.documentSize')}: {formatSize(doc.file_size)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('equipmentManagement.documentDate')} {doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '—'}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => handleDownload(doc.id)} title={t('equipmentManagement.download')} size="small">
                      <Download />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(doc)} title={t('equipmentManagement.delete')} size="small" color="error">
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
