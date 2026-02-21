import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Chip
} from '@mui/material';
import { Download, Delete, Description } from '@mui/icons-material';
import api from '../../services/api';

export default function EquipmentDocuments() {
  const { id } = useParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [id]);

  const loadDocuments = async () => {
    try {
      const res = await api.get('/documents', { params: { entity_type: 'equipment', entity_id: id } });
      setDocuments(res.data);
    } catch (error) {
      console.error(error);
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
      a.download = documents.find(d => d.id === docId)?.original_filename || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Documents de l'équipement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manuels, certificats, photos et autres documents
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">Création dans le menu Création</Typography>
      </Box>

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : documents.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucun document disponible
            </Typography>
          ) : (
            <List>
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
                    primary={doc.original_filename}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={doc.document_type || 'other'} size="small" />
                        <Typography variant="caption" color="text.secondary">
                          {(doc.file_size / 1024).toFixed(2)} KB
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => handleDownload(doc.id)}>
                      <Download />
                    </IconButton>
                    <IconButton>
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
