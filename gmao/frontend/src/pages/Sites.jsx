import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress
} from '@mui/material';
import api from '../services/api';

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/sites'), api.get('/lignes')])
      .then(([s, l]) => { setSites(s.data); setLignes(l.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <h2 style={{ margin: 0 }}>Sites et Lignes</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Organisation géographique du parc. Création dans le menu <strong>Création</strong>.</p>
        </Box>
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <h3 style={{ margin: '0 0 16px' }}>Sites</h3>
        {loading ? (
          <Box py={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Adresse</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sites.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.code}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.address || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && sites.length === 0 && <Box py={2} color="text.secondary">Aucun site</Box>}
      </Card>

      <Card sx={{ p: 2 }}>
        <h3 style={{ margin: '0 0 16px' }}>Lignes</h3>
        {loading ? null : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Nom</TableCell>
                <TableCell>Site</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.code}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.site_name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && lignes.length === 0 && <Box py={2} color="text.secondary">Aucune ligne</Box>}
      </Card>
    </Box>
  );
}
