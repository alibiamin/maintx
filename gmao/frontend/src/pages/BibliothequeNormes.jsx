import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  BookmarkBorder as ToConsultIcon,
  Bookmark as ToConsultFilledIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useSnackbar } from '../context/SnackbarContext';

const STORAGE_KEY = 'gmao-standards-marks';
const ORGANIZATIONS = ['ISO', 'IEC', 'API', 'ASME', 'EN'];
const STANDARD_TYPES = [
  { value: 'qualité', labelKey: 'standards.type_quality' },
  { value: 'sécurité', labelKey: 'standards.type_safety' },
  { value: 'fiabilité', labelKey: 'standards.type_reliability' },
  { value: 'secteur_spécifique', labelKey: 'standards.type_sector' },
  { value: 'management_actifs', labelKey: 'standards.type_asset_mgmt' },
  { value: 'maintenance', labelKey: 'standards.type_maintenance' }
];

function loadMarks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { favorites: [], toConsult: [] };
    const data = JSON.parse(raw);
    return {
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      toConsult: Array.isArray(data.toConsult) ? data.toConsult : []
    };
  } catch {
    return { favorites: [], toConsult: [] };
  }
}

function saveMarks(marks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
}

export default function BibliothequeNormes() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const snackbar = useSnackbar();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [marks, setMarks] = useState(loadMarks);

  const fetchList = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterType) params.type = filterType;
    if (filterOrg) params.organization = filterOrg;
    if (search.trim()) params.search = search.trim();
    api.get('/standards', { params })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => snackbar.showError(t('standards.errorLoad')))
      .finally(() => setLoading(false));
  }, [filterType, filterOrg, search, snackbar, t]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openDetail = (row) => {
    setDetail(row);
    setDetailOpen(true);
    if (row.id && (!row.objectives || !row.sectorsEquipment)) {
      setDetailLoading(true);
      api.get(`/standards/${row.id}`)
        .then((r) => setDetail(r.data))
        .catch(() => snackbar.showError(t('standards.errorLoad')))
        .finally(() => setDetailLoading(false));
    }
  };

  const toggleFavorite = (id) => {
    const next = { ...marks };
    const idx = next.favorites.indexOf(id);
    if (idx >= 0) next.favorites = next.favorites.filter((x) => x !== id);
    else next.favorites = [...next.favorites, id];
    setMarks(next);
    saveMarks(next);
  };

  const toggleToConsult = (id) => {
    const next = { ...marks };
    const idx = next.toConsult.indexOf(id);
    if (idx >= 0) next.toConsult = next.toConsult.filter((x) => x !== id);
    else next.toConsult = [...next.toConsult, id];
    setMarks(next);
    saveMarks(next);
  };

  const isFavorite = (id) => marks.favorites.includes(id);
  const isToConsult = (id) => marks.toConsult.includes(id);

  const typeLabel = (type) => {
    const found = STANDARD_TYPES.find((s) => s.value === type);
    return found ? t(found.labelKey) : type || '—';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('menu.standards_library')}</Typography>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} flexWrap="wrap">
            <TextField
              size="small"
              placeholder={t('standards.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon /></InputAdornment>
                )
              }}
              sx={{ minWidth: 200, flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>{t('standards.filterType')}</InputLabel>
              <Select
                value={filterType}
                label={t('standards.filterType')}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {STANDARD_TYPES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>{t(s.labelKey)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('standards.filterOrg')}</InputLabel>
              <Select
                value={filterOrg}
                label={t('standards.filterOrg')}
                onChange={(e) => setFilterOrg(e.target.value)}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {ORGANIZATIONS.map((o) => (
                  <MenuItem key={o} value={o}>{o}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <Card>
        {loading ? (
          <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>
        ) : list.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary">{t('standards.noData')}</Typography>
          </Box>
        ) : isMobile ? (
          <Box display="flex" flexDirection="column" gap={1} p={2}>
            {list.map((row) => (
              <Card key={row.id} variant="outlined" sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>{row.code}</Typography>
                      <Typography variant="body2" color="text.secondary">{row.title}</Typography>
                      <Box mt={0.5}>
                        <Chip size="small" label={row.organization} sx={{ mr: 0.5 }} />
                        <Chip size="small" label={typeLabel(row.standardType)} variant="outlined" />
                      </Box>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFavorite(row.id); }} color={isFavorite(row.id) ? 'primary' : 'default'}>
                        {isFavorite(row.id) ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleToConsult(row.id); }} color={isToConsult(row.id) ? 'primary' : 'default'}>
                        {isToConsult(row.id) ? <ToConsultFilledIcon /> : <ToConsultIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('standards.code')}</TableCell>
                <TableCell>{t('standards.title')}</TableCell>
                <TableCell>{t('standards.domain')}</TableCell>
                <TableCell>{t('standards.type')}</TableCell>
                <TableCell>{t('standards.organization')}</TableCell>
                <TableCell align="center" width={100}>{t('standards.marks')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                  <TableCell><Typography fontWeight={600}>{row.code}</Typography></TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.domain || '—'}</TableCell>
                  <TableCell>{typeLabel(row.standardType)}</TableCell>
                  <TableCell>{row.organization}</TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => toggleFavorite(row.id)} color={isFavorite(row.id) ? 'primary' : 'default'} title={t('standards.favorite')}>
                      {isFavorite(row.id) ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                    <IconButton size="small" onClick={() => toggleToConsult(row.id)} color={isToConsult(row.id) ? 'primary' : 'default'} title={t('standards.toConsult')}>
                      {isToConsult(row.id) ? <ToConsultFilledIcon /> : <ToConsultIcon />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {detail ? `${detail.code} – ${detail.title}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : detail ? (
            <Box display="flex" flexDirection="column" gap={2}>
              {detail.description && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('standards.description')}</Typography>
                  <Typography variant="body2">{detail.description}</Typography>
                </Box>
              )}
              {detail.domain && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('standards.domain')}</Typography>
                  <Typography variant="body2">{detail.domain}</Typography>
                </Box>
              )}
              {detail.objectives && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('standards.objectives')}</Typography>
                  <Typography variant="body2">{detail.objectives}</Typography>
                </Box>
              )}
              {detail.sectorsEquipment && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('standards.sectorsEquipment')}</Typography>
                  <Typography variant="body2">{detail.sectorsEquipment}</Typography>
                </Box>
              )}
              {detail.versionHistory && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('standards.versionHistory')}</Typography>
                  <Typography variant="body2">{detail.versionHistory}</Typography>
                </Box>
              )}
              {detail.documentUrl && (
                <Button
                  component="a"
                  href={detail.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<OpenInNewIcon />}
                  variant="outlined"
                  size="small"
                >
                  {t('standards.documentLink')}
                </Button>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          {detail && (
            <>
              <IconButton onClick={() => toggleFavorite(detail.id)} color={isFavorite(detail.id) ? 'primary' : 'default'} title={t('standards.favorite')}>
                {isFavorite(detail.id) ? <StarIcon /> : <StarBorderIcon />}
              </IconButton>
              <IconButton onClick={() => toggleToConsult(detail.id)} color={isToConsult(detail.id) ? 'primary' : 'default'} title={t('standards.toConsult')}>
                {isToConsult(detail.id) ? <ToConsultFilledIcon /> : <ToConsultIcon />}
              </IconButton>
            </>
          )}
          <Button onClick={() => setDetailOpen(false)}>{t('common.cancel')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
