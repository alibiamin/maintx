import React, { useEffect, useState } from 'react';
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
  CircularProgress,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import { Download } from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { CHART_COLORS } from '../shared/chartTheme';
import { useCurrency } from '../context/CurrencyContext';

const TAB_IDS = ['costs', 'availability', 'technician', 'parts', 'mttr', 'costPerHour'];
const TAB_ID_TO_INDEX = Object.fromEntries(TAB_IDS.map((id, i) => [id, i]));

export default function Reports() {
  const currency = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || '';
  const tab = TAB_ID_TO_INDEX[tabParam] !== undefined ? TAB_ID_TO_INDEX[tabParam] : 0;
  const setTab = (index) => {
    setSearchParams({ tab: TAB_IDS[index] || 'costs' });
  };

  const [costs, setCosts] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [timeByTech, setTimeByTech] = useState([]);
  const [partsMostUsed, setPartsMostUsed] = useState([]);
  const [mttrData, setMttrData] = useState({ global: {}, byEquipment: [] });
  const [costPerHourData, setCostPerHourData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [siteId, setSiteId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [sites, setSites] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === 'dark';

  useEffect(() => {
    api.get('/sites').then(r => setSites(r.data || [])).catch(() => setSites([]));
    api.get('/equipment').then(r => setEquipmentList(r.data || [])).catch(() => setEquipmentList([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { startDate, endDate };
    if (siteId) params.siteId = siteId;
    if (equipmentId) params.equipmentId = equipmentId;
    if (tab === 0) {
      api.get('/reports/maintenance-costs', { params })
        .then(r => setCosts(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (tab === 1) {
      api.get('/reports/availability', { params })
        .then(r => setAvailability(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (tab === 2) {
      api.get('/reports/time-by-technician', { params: { startDate, endDate } })
        .then(r => setTimeByTech(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (tab === 4) {
      const params = { startDate, endDate };
      if (siteId) params.siteId = siteId;
      if (equipmentId) params.equipmentId = equipmentId;
      api.get('/reports/mttr', { params })
        .then(r => setMttrData(r.data || { global: {}, byEquipment: [] }))
        .catch(() => setMttrData({ global: {}, byEquipment: [] }))
        .finally(() => setLoading(false));
    } else if (tab === 5) {
      const params = { startDate, endDate };
      if (siteId) params.siteId = siteId;
      if (equipmentId) params.equipmentId = equipmentId;
      api.get('/reports/cost-per-operating-hour', { params })
        .then(r => setCostPerHourData(r.data || []))
        .catch(() => setCostPerHourData([]))
        .finally(() => setLoading(false));
    } else {
      api.get('/reports/parts-most-used', { params: { startDate, endDate, limit: 20 } })
        .then(r => setPartsMostUsed(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tab, startDate, endDate, siteId, equipmentId]);

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/reports/export/excel', { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-ot.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportDetailed = async () => {
    try {
      const res = await api.get('/reports/export/detailed', {
        params: { startDate, endDate },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-detaille.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Rapports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Statistiques, coûts, disponibilité et exports
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
          <TextField type="date" size="small" label="Début" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="date" size="small" label="Fin" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField select size="small" label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)} sx={{ minWidth: 140 }} SelectProps={{ native: true }}>
            <option value="">Tous</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </TextField>
          <TextField select size="small" label="Équipement" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} sx={{ minWidth: 160 }} SelectProps={{ native: true }}>
            <option value="">Tous</option>
            {equipmentList.map((e) => <option key={e.id} value={e.id}>{e.code} – {e.name}</option>)}
          </TextField>
          <Button variant="contained" startIcon={<Download />} onClick={handleExportExcel}>
            Export OT
          </Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleExportDetailed}>
            Export détaillé
          </Button>
        </Box>
      </Box>

      <Box display="flex" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>Coût total ({currency})</Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {costs.reduce((s, c) => s + parseFloat(c.parts_cost || 0) + parseFloat(c.labor_cost || 0), 0).toFixed(2)}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>Temps arrêt total (h)</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#FFBF00' }}>
              {availability.reduce((s, a) => s + parseFloat(a.total_downtime_hours || 0), 0).toFixed(1)}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>Équipements suivis</Typography>
            <Typography variant="h5" fontWeight={700}>
              {tab === 0 ? costs.length : availability.length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab label="Coûts par équipement" />
        <Tab label="Disponibilité" />
        <Tab label="Temps par technicien" />
        <Tab label="Pièces les plus utilisées" />
        <Tab label="MTTR" />
        <Tab label="Coût / h fonctionnement" />
      </Tabs>

      {tab === 0 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Coûts de maintenance par équipement
            </Typography>
            {!loading && costs.length > 0 && (
              <Box sx={{ mb: 3, height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={costs.map(c => ({
                      code: c.code,
                      total: parseFloat(c.parts_cost || 0) + parseFloat(c.labor_cost || 0),
                      labor: parseFloat(c.labor_cost || 0),
                      parts: parseFloat(c.parts_cost || 0)
                    }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <XAxis dataKey="code" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: isDark ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(0,0,0,0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#fff'
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)} ${currency}`, '']}
                      labelFormatter={(_, payload) => payload[0]?.payload?.code && `Équipement: ${payload[0].payload.code}`}
                    />
                    <Bar dataKey="total" name={`Total (${currency})`} radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {costs.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Équipement</TableCell>
                    <TableCell align="right">Interventions</TableCell>
                    <TableCell align="right">Coût main-d'œuvre ({currency})</TableCell>
                    <TableCell align="right">Coût pièces ({currency})</TableCell>
                    <TableCell align="right">Total ({currency})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costs.map((row) => {
                    const labor = parseFloat(row.labor_cost || 0);
                    const parts = parseFloat(row.parts_cost || 0);
                    return (
                      <TableRow key={row.equipment_id || row.code}>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell align="right">{row.interventions}</TableCell>
                        <TableCell align="right">{labor.toFixed(2)}</TableCell>
                        <TableCell align="right">{parts.toFixed(2)}</TableCell>
                        <TableCell align="right">{(labor + parts).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!loading && costs.length === 0 && (
              <Typography color="text.secondary">Aucune donnée de coût sur la période</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Disponibilité et temps d'arrêt par équipement
            </Typography>
            {!loading && availability.length > 0 && (
              <Box sx={{ mb: 3, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={availability.map(a => ({ code: a.code, value: parseFloat(a.total_downtime_hours || 0) }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <XAxis type="number" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis type="category" dataKey="code" width={80} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: isDark ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(0,0,0,0.1)',
                        backgroundColor: isDark ? '#1e293b' : '#fff'
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)} h`, 'Temps arrêt']}
                    />
                    <Bar dataKey="value" name="Temps arrêt (h)" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {availability.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[1]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Équipement</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="right">Interventions</TableCell>
                    <TableCell align="right">Temps arrêt (h)</TableCell>
                    <TableCell align="right">Disponibilité %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availability.map((row) => {
                    const periodHours = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60);
                    const down = parseFloat(row.total_downtime_hours || 0);
                    const availPct = periodHours > 0 ? Math.max(0, ((periodHours - down) / periodHours) * 100) : null;
                    return (
                      <TableRow key={row.id ?? row.code}>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell align="right">{row.intervention_count ?? 0}</TableCell>
                        <TableCell align="right">{row.total_downtime_hours ? down.toFixed(2) : '0.00'}</TableCell>
                        <TableCell align="right">{availPct != null ? `${availPct.toFixed(1)} %` : '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!loading && availability.length === 0 && (
              <Typography color="text.secondary">Aucune donnée</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Temps passé par technicien
            </Typography>
            {!loading && timeByTech.length > 0 && (
              <Box sx={{ mb: 3, height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={timeByTech.map(t => ({ name: t.technician_name, value: parseFloat(t.hours_spent || 0) }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} h`, 'Heures']} />
                    <Bar dataKey="value" name="Heures" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {timeByTech.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Technicien</TableCell>
                    <TableCell align="right">Heures</TableCell>
                    <TableCell align="right">OT concernés</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {timeByTech.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.technician_name}</TableCell>
                      <TableCell align="right">{row.hours_spent ? parseFloat(row.hours_spent).toFixed(2) : '0.00'}</TableCell>
                      <TableCell align="right">{row.work_orders_count ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && timeByTech.length === 0 && (
              <Typography color="text.secondary">Aucune intervention sur la période</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Pièces les plus utilisées
            </Typography>
            {!loading && partsMostUsed.length > 0 && (
              <Box sx={{ mb: 3, height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={partsMostUsed.map(p => ({ name: p.part_code, value: parseInt(p.quantity_used || 0, 10) }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <XAxis type="number" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                    <Tooltip formatter={(value) => [value, 'Quantité']} />
                    <Bar dataKey="value" name="Quantité" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {partsMostUsed.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
            {loading ? (
              <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Désignation</TableCell>
                    <TableCell>Famille</TableCell>
                    <TableCell>Emplacement</TableCell>
                    <TableCell align="right">Quantité utilisée</TableCell>
                    <TableCell align="right">Coût total ({currency})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {partsMostUsed.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.part_code}</TableCell>
                      <TableCell>{row.part_name}</TableCell>
                      <TableCell>{row.part_family_name || row.part_family_code || '—'}</TableCell>
                      <TableCell>{row.location_name || row.location_code || '—'}</TableCell>
                      <TableCell align="right">{row.quantity_used ?? 0}</TableCell>
                      <TableCell align="right">{row.total_cost ? parseFloat(row.total_cost).toFixed(2) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && partsMostUsed.length === 0 && (
              <Typography color="text.secondary">Aucune pièce utilisée sur la période</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 4 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              MTTR — Temps moyen de réparation (h)
            </Typography>
            {!loading && (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Global (période)</Typography>
                  <Typography variant="h6">
                    {mttrData.global?.mttr_hours != null ? Number(mttrData.global.mttr_hours).toFixed(2) : '—'} h
                    {mttrData.global?.repair_count != null && ` (${mttrData.global.repair_count} réparation(s))`}
                  </Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Équipement</TableCell>
                      <TableCell align="right">Réparations</TableCell>
                      <TableCell align="right">MTTR (h)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(mttrData.byEquipment || []).map((row) => (
                      <TableRow key={row.equipment_id}>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell align="right">{row.repair_count ?? 0}</TableCell>
                        <TableCell align="right">{row.mttr_hours != null ? Number(row.mttr_hours).toFixed(2) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!mttrData.byEquipment || mttrData.byEquipment.length === 0) && (
                  <Typography color="text.secondary">Aucune donnée sur la période</Typography>
                )}
              </>
            )}
            {loading && <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>}
          </CardContent>
        </Card>
      )}

      {tab === 5 && (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              Coût par heure de fonctionnement
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Basé sur les compteurs (heures) des équipements et les coûts de maintenance de la période.
            </Typography>
            {!loading && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Équipement</TableCell>
                    <TableCell align="right">Coût total ({currency})</TableCell>
                    <TableCell align="right">Heures fonctionnement</TableCell>
                    <TableCell align="right">Coût / h ({currency})</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costPerHourData.map((row) => (
                    <TableRow key={row.equipment_id}>
                      <TableCell>{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{row.total_cost != null ? Number(row.total_cost).toFixed(2) : '—'}</TableCell>
                      <TableCell align="right">{row.operating_hours != null ? Number(row.operating_hours).toFixed(0) : '—'}</TableCell>
                      <TableCell align="right">{row.cost_per_operating_hour != null ? Number(row.cost_per_operating_hour).toFixed(2) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && (!costPerHourData || costPerHourData.length === 0) && (
              <Typography color="text.secondary">Aucune donnée (compteurs heures ou coûts)</Typography>
            )}
            {loading && <Box display="flex" justifyContent="center" p={2}><CircularProgress /></Box>}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
