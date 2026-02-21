import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import api from '../../services/api';
import { useActionPanel } from '../../context/ActionPanelContext';

export default function EquipmentWarranties() {
  const { id } = useParams();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { setContext } = useActionPanel();

  useEffect(() => {
    loadWarranties();
  }, [id]);

  useEffect(() => {
    setContext({ type: 'list', entityType: 'warranties' });
    return () => setContext(null);
  }, [setContext]);

  useEffect(() => {
    if (!selectedId) return;
    const w = warranties.find((x) => x.id === selectedId);
    setContext(w ? { type: 'list', entityType: 'warranties', selectedEntity: w } : { type: 'list', entityType: 'warranties' });
  }, [selectedId, warranties, setContext]);

  const loadWarranties = async () => {
    try {
      const res = await api.get('/warranties', { params: { equipment_id: id } });
      setWarranties(res.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Garanties de l'équipement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Garanties constructeur et extensions
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
          ) : warranties.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={4}>
              Aucune garantie enregistrée
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Numéro</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date début</TableCell>
                  <TableCell>Date fin</TableCell>
                  <TableCell>Fournisseur</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {warranties.map((w) => {
                  const isExpiring = new Date(w.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const isExpired = new Date(w.end_date) < new Date();
                  return (
                    <TableRow
                      key={w.id}
                      selected={selectedId === w.id}
                      onClick={() => setSelectedId(selectedId === w.id ? null : w.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{w.warranty_number}</TableCell>
                      <TableCell>
                        <Chip label={w.warranty_type} size="small" />
                      </TableCell>
                      <TableCell>{w.start_date}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {w.end_date}
                          {isExpiring && !isExpired && <Warning color="warning" fontSize="small" />}
                          {isExpired && <Warning color="error" fontSize="small" />}
                        </Box>
                      </TableCell>
                      <TableCell>{w.supplier_name || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={w.is_active ? 'Active' : 'Expirée'}
                          color={w.is_active && !isExpired ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
