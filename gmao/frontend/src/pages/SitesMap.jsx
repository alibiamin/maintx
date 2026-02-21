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
  Link
} from '@mui/material';
import { OpenInNew, Place } from '@mui/icons-material';
import api from '../services/api';

export default function SitesMap() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sites')
      .then((r) => setSites(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  const sitesWithCoords = sites.filter((s) => s.latitude != null && s.longitude != null && !Number.isNaN(parseFloat(s.latitude)) && !Number.isNaN(parseFloat(s.longitude)));

  const openInOsm = (lat, lon) => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=14`, '_blank', 'noopener');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Place color="primary" />
        Carte des sites (SIG)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Géolocalisation des sites. Renseignez latitude/longitude dans la fiche site pour les afficher ici.
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Sites avec localisation</Typography>
              {sitesWithCoords.length === 0 ? (
                <Typography color="text.secondary">Aucun site avec latitude/longitude. Éditez un site pour ajouter ses coordonnées.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Site</TableCell>
                      <TableCell>Adresse</TableCell>
                      <TableCell>Coordonnées</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sitesWithCoords.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell><strong>{s.code}</strong> {s.name}</TableCell>
                        <TableCell>{s.address || '—'}</TableCell>
                        <TableCell>{s.latitude}, {s.longitude}</TableCell>
                        <TableCell align="right">
                          <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(s.latitude, s.longitude)}>
                            Voir sur OpenStreetMap
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {sitesWithCoords.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Aperçu carte</Typography>
                <Box
                  component="iframe"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(...sitesWithCoords.map((s) => parseFloat(s.longitude))) - 0.05}%2C${Math.min(...sitesWithCoords.map((s) => parseFloat(s.latitude))) - 0.05}%2C${Math.max(...sitesWithCoords.map((s) => parseFloat(s.longitude))) + 0.05}%2C${Math.max(...sitesWithCoords.map((s) => parseFloat(s.latitude))) + 0.05}&layer=mapnik&marker=${sitesWithCoords[0].latitude}%2C${sitesWithCoords[0].longitude}`}
                  title="Carte OpenStreetMap"
                  sx={{ width: '100%', height: 400, border: 0, borderRadius: 2 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</Link>
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
