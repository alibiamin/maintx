import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Typography
} from '@mui/material';

/**
 * Tableau de données réutilisable
 */
export function DataTable({ columns, rows, loading, emptyMessage = 'Aucune donnée', size = 'medium' }) {
  if (loading) {
    return (
      <Box py={4} display="flex" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }
  if (!rows?.length) {
    return (
      <Box py={4} textAlign="center">
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'
      }}
    >
      <Table size={size}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} align={col.align || 'left'} sx={col.headerSx}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.id || idx} hover>
              {columns.map((col) => (
                <TableCell key={col.key} align={col.align || 'left'} sx={col.cellSx}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
