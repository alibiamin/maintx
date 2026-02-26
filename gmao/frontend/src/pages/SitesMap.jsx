import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Link,
  Tabs,
  Tab,
} from '@mui/material';
import { OpenInNew, Place } from '@mui/icons-material';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

const iconByLayer = {
  site: new L.Icon.Default(),
  departement: L.divIcon({ className: 'custom-marker', html: '<span style="background:#1976d2;width:12px;height:12px;border-radius:50%;display:block;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>', iconSize: [12, 12], iconAnchor: [6, 6] }),
  ligne: L.divIcon({ className: 'custom-marker', html: '<span style="background:#2e7d32;width:12px;height:12px;border-radius:50%;display:block;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>', iconSize: [12, 12], iconAnchor: [6, 6] }),
  equipment: L.divIcon({ className: 'custom-marker', html: '<span style="background:#ed6c02;width:12px;height:12px;border-radius:2px;display:block;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>', iconSize: [12, 12], iconAnchor: [6, 6] })
};

function FitBounds({ points }) {
  const map = useMap();
  const latLngs = useMemo(() => points.map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)]).filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b)), [points]);
  useEffect(() => {
    if (latLngs.length === 0) return;
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 16);
    } else {
      map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, latLngs]);
  return null;
}

export default function SitesMap() {
  const [mapData, setMapData] = useState({ sites: [], departements: [], lignes: [], equipment: [] });
  const [loading, setLoading] = useState(true);
  const [layerVisible, setLayerVisible] = useState({ sites: true, departements: true, lignes: true, equipment: true });
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.get('/map-data')
      .then((r) => setMapData(r.data || { sites: [], departements: [], lignes: [], equipment: [] }))
      .catch(() => setMapData({ sites: [], departements: [], lignes: [], equipment: [] }))
      .finally(() => setLoading(false));
  }, []);

  const allPoints = useMemo(() => {
    const out = [];
    if (layerVisible.sites) mapData.sites.forEach((s) => out.push({ ...s, _layer: 'site' }));
    if (layerVisible.departements) mapData.departements.forEach((d) => out.push({ ...d, _layer: 'departement' }));
    if (layerVisible.lignes) mapData.lignes.forEach((l) => out.push({ ...l, _layer: 'ligne' }));
    if (layerVisible.equipment) mapData.equipment.forEach((e) => out.push({ ...e, _layer: 'equipment' }));
    return out;
  }, [mapData, layerVisible]);

  const openInOsm = (lat, lon) => {
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`, '_blank', 'noopener');
  };

  const label = (row) => {
    if (row._layer === 'site') return `${row.code || ''} ${row.name || ''}`.trim();
    if (row._layer === 'departement') return `${row.code || ''} ${row.name || ''}`.trim();
    if (row._layer === 'ligne') return `${row.code || ''} ${row.name || ''}`.trim();
    if (row._layer === 'equipment') return `${row.code || ''} ${row.name || ''} (${row.equipment_type || 'machine'})`.trim();
    return row.name || row.code || '—';
  };

  const sublabel = (row) => {
    if (row.site_name) return row.site_name;
    if (row.ligne_name && row.site_name) return `${row.ligne_name} — ${row.site_name}`;
    if (row.ligne_name) return row.ligne_name;
    return null;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Place color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Carte SIG – Localisation précise
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        Géolocalisation des sites, départements, lignes et machines/sections avec litérairie (adresse ou description précise du lieu).
      </Typography>

      <Card>
        <CardContent>
          <FormGroup row sx={{ mb: 2, gap: 2 }}>
            <FormControlLabel
              control={<Checkbox checked={layerVisible.sites} onChange={(e) => setLayerVisible((v) => ({ ...v, sites: e.target.checked }))} />}
              label="Sites"
            />
            <FormControlLabel
              control={<Checkbox checked={layerVisible.departements} onChange={(e) => setLayerVisible((v) => ({ ...v, departements: e.target.checked }))} />}
              label="Départements"
            />
            <FormControlLabel
              control={<Checkbox checked={layerVisible.lignes} onChange={(e) => setLayerVisible((v) => ({ ...v, lignes: e.target.checked }))} />}
              label="Lignes"
            />
            <FormControlLabel
              control={<Checkbox checked={layerVisible.equipment} onChange={(e) => setLayerVisible((v) => ({ ...v, equipment: e.target.checked }))} />}
              label="Machines / Sections"
            />
          </FormGroup>

          {allPoints.length === 0 ? (
            <Typography color="text.secondary">
              Aucune entité avec coordonnées. Renseignez latitude/longitude (et optionnellement la litérairie) dans les fiches Sites, Départements, Lignes ou Équipements.
            </Typography>
          ) : (
            <Box sx={{ height: 420, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <MapContainer center={[46.5, 2.5]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {allPoints.map((point, idx) => {
                  const lat = parseFloat(point.latitude);
                  const lon = parseFloat(point.longitude);
                  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
                  return (
                    <Marker key={`${point._layer}-${point.id}-${idx}`} position={[lat, lon]} icon={iconByLayer[point._layer]}>
                      <Popup>
                        <Typography variant="subtitle2">{label(point)}</Typography>
                        {sublabel(point) && <Typography variant="caption" color="text.secondary">{sublabel(point)}</Typography>}
                        {(point.location_address || point.address) && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>{(point.location_address || point.address)}</Typography>
                        )}
                        <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(lat, lon)} sx={{ mt: 1 }}>Ouvrir dans OpenStreetMap</Button>
                      </Popup>
                    </Marker>
                  );
                })}
                <FitBounds points={allPoints} />
              </MapContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab label={`Sites (${mapData.sites?.length || 0})`} />
            <Tab label={`Départements (${mapData.departements?.length || 0})`} />
            <Tab label={`Lignes (${mapData.lignes?.length || 0})`} />
            <Tab label={`Machines / Sections (${mapData.equipment?.length || 0})`} />
          </Tabs>
          {tab === 0 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Site</TableCell><TableCell>Adresse / Litérairie</TableCell><TableCell>Coordonnées</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {(mapData.sites || []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><strong>{s.code}</strong> {s.name}</TableCell>
                    <TableCell>{s.address || '—'}</TableCell>
                    <TableCell>{s.latitude != null && s.longitude != null ? `${Number(s.latitude).toFixed(5)}, ${Number(s.longitude).toFixed(5)}` : '—'}</TableCell>
                    <TableCell align="right">
                      {s.latitude != null && s.longitude != null && (
                        <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(s.latitude, s.longitude)}>OSM</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === 1 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Département</TableCell><TableCell>Site</TableCell><TableCell>Litérairie</TableCell><TableCell>Coordonnées</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {(mapData.departements || []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell><strong>{d.code}</strong> {d.name}</TableCell>
                    <TableCell>{d.site_name || '—'}</TableCell>
                    <TableCell>{d.location_address || '—'}</TableCell>
                    <TableCell>{d.latitude != null && d.longitude != null ? `${Number(d.latitude).toFixed(5)}, ${Number(d.longitude).toFixed(5)}` : '—'}</TableCell>
                    <TableCell align="right">
                      {d.latitude != null && d.longitude != null && (
                        <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(d.latitude, d.longitude)}>OSM</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === 2 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Ligne</TableCell><TableCell>Site</TableCell><TableCell>Litérairie</TableCell><TableCell>Coordonnées</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {(mapData.lignes || []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell><strong>{l.code}</strong> {l.name}</TableCell>
                    <TableCell>{l.site_name || '—'}</TableCell>
                    <TableCell>{l.location_address || '—'}</TableCell>
                    <TableCell>{l.latitude != null && l.longitude != null ? `${Number(l.latitude).toFixed(5)}, ${Number(l.longitude).toFixed(5)}` : '—'}</TableCell>
                    <TableCell align="right">
                      {l.latitude != null && l.longitude != null && (
                        <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(l.latitude, l.longitude)}>OSM</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === 3 && (
            <Table size="small">
              <TableHead><TableRow><TableCell>Équipement</TableCell><TableCell>Type</TableCell><TableCell>Ligne / Site</TableCell><TableCell>Litérairie</TableCell><TableCell>Coordonnées</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {(mapData.equipment || []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><strong>{e.code}</strong> {e.name}</TableCell>
                    <TableCell>{e.equipment_type || 'machine'}</TableCell>
                    <TableCell>{e.ligne_name || '—'} {e.site_name ? `(${e.site_name})` : ''}</TableCell>
                    <TableCell>{e.location_address || e.location || '—'}</TableCell>
                    <TableCell>{e.latitude != null && e.longitude != null ? `${Number(e.latitude).toFixed(5)}, ${Number(e.longitude).toFixed(5)}` : '—'}</TableCell>
                    <TableCell align="right">
                      {e.latitude != null && e.longitude != null && (
                        <Button size="small" startIcon={<OpenInNew />} onClick={() => openInOsm(e.latitude, e.longitude)}>OSM</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Typography variant="caption" color="text.secondary">
        <Link href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</Link>
      </Typography>
    </Box>
  );
}
