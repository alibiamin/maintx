import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  CircularProgress,
  Chip,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Person,
  Group,
  ArrowBack
} from '@mui/icons-material';
import api from '../../services/api';

const roleLabels = { technicien: 'Technicien', responsable_maintenance: 'Responsable' };

function TreeNode({ node, level, onSelect, expanded, onToggle }) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = Boolean(expanded[node.id]);
  const theme = useTheme();

  return (
    <Box sx={{ pl: level * 2 }}>
      <ListItemButton
        onClick={() => hasChildren ? onToggle(node.id) : onSelect(node.id)}
        sx={{
          borderRadius: 1,
          mb: 0.5,
          bgcolor: hasChildren ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {hasChildren ? (
            <Group fontSize="small" color="primary" />
          ) : (
            <Person fontSize="small" sx={{ color: 'text.secondary' }} />
          )}
        </ListItemIcon>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ListItemText
            primary={node.label}
            primaryTypographyProps={{ fontWeight: hasChildren ? 600 : 500 }}
          />
          <Chip
            label={roleLabels[node.role_name] || node.role_name}
            size="small"
            sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
            color={node.role_name === 'responsable_maintenance' ? 'primary' : 'default'}
            variant="outlined"
          />
        </Box>
        {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
      </ListItemButton>
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                onSelect={onSelect}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </List>
        </Collapse>
      )}
    </Box>
  );
}

export default function TeamPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = () => {
    api.get('/technicians/team-hierarchy')
      .then((r) => setTree(r.data || []))
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggle = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (id) => {
    navigate(`/app/technicians/${id}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/app/technicians')} sx={{ mb: 2 }}>
        Retour
      </Button>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        Équipe — Organisation hiérarchique
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Structure des techniciens et responsables (responsable défini dans la fiche de chaque technicien).
      </Typography>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          {tree.length === 0 ? (
            <Typography color="text.secondary">
              Aucun effectif ou hiérarchie non renseignée. Renseignez le responsable dans la fiche de chaque technicien.
            </Typography>
          ) : (
            <List disablePadding>
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  level={0}
                  onSelect={handleSelect}
                  expanded={expanded}
                  onToggle={handleToggle}
                />
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
