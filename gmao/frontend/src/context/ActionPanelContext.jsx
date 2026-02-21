import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Drawer, Typography, IconButton, Divider, List, ListItemButton, ListItemIcon, ListItemText, Chip } from '@mui/material';
import { Close } from '@mui/icons-material';

const ActionPanelContext = createContext();

export const useActionPanel = () => {
  const context = useContext(ActionPanelContext);
  if (!context) {
    throw new Error('useActionPanel must be used within ActionPanelProvider');
  }
  return context;
};

export const ActionPanelProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [actions, setActions] = useState([]);
  const [entity, setEntity] = useState(null);

  const openPanel = (config) => {
    setTitle(config.title || 'Actions');
    setActions(config.actions || []);
    setEntity(config.entity || null);
    setOpen(true);
  };

  const closePanel = () => {
    setOpen(false);
    setTimeout(() => {
      setTitle('');
      setActions([]);
      setEntity(null);
    }, 300);
  };

  const value = {
    openPanel,
    closePanel,
    isOpen: open
  };

  // Rendu du Drawer dans un portail pour éviter les problèmes de z-index
  const drawerContent = open ? (
    <Drawer
      anchor="right"
      open={true}
      onClose={closePanel}
      variant="temporary"
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 360 },
          maxWidth: 360,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.25)',
          borderLeft: '1px solid rgba(0,0,0,0.08)'
        }
      }}
      sx={{ zIndex: 1500 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #2EB23E 0%, #259633 100%)',
            color: 'white',
            boxShadow: '0 2px 8px rgba(46, 178, 62, 0.3)'
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <IconButton onClick={closePanel} size="small" sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Box>

        {/* Entity info */}
        {entity && (
          <Box
            sx={{
              p: 2,
              bgcolor: 'rgba(46, 178, 62, 0.06)',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            {entity.name && (
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                {entity.name}
              </Typography>
            )}
            {entity.code && (
              <Typography variant="body2" color="text.secondary">
                Code: {entity.code}
              </Typography>
            )}
            {entity.status && (
              <Chip
                label={entity.status}
                size="small"
                sx={{ mt: 1 }}
                color={entity.status === 'operational' ? 'success' : 'default'}
              />
            )}
          </Box>
        )}

        {/* Actions list */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List disablePadding>
            {actions.map((action, index) => {
              if (action.divider) {
                return <Divider key={`divider-${index}`} sx={{ my: 1 }} />;
              }

              const handleClick = () => {
                if (action.onClick) action.onClick(entity);
                if (action.closeAfterClick !== false) closePanel();
              };

              return (
                <ListItemButton
                  key={action.id || index}
                  onClick={handleClick}
                  disabled={action.disabled}
                  sx={{
                    py: 1.5,
                    px: 2,
                    '&:hover': {
                      bgcolor:
                        action.color === 'error'
                          ? 'rgba(211, 47, 47, 0.08)'
                          : 'rgba(46, 178, 62, 0.08)'
                    }
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        action.color === 'error'
                          ? 'error.main'
                          : action.color === 'primary'
                          ? 'primary.main'
                          : 'text.secondary',
                      minWidth: 40
                    }}
                  >
                    {action.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={action.label}
                    primaryTypographyProps={{
                      fontWeight: action.variant === 'contained' ? 600 : 400,
                      color:
                        action.color === 'error'
                          ? 'error.main'
                          : action.color === 'primary'
                          ? 'primary.main'
                          : 'text.primary'
                    }}
                    secondary={action.description}
                  />
                  {action.badge && (
                    <Chip label={action.badge} size="small" color="primary" />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* Footer actions rapides */}
        {entity && actions.some(a => a.quick && !a.divider) && (
          <Box
            sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover'
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Actions rapides
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {actions
                .filter(a => a.quick && !a.divider)
                .slice(0, 4)
                .map(action => (
                  <IconButton
                    key={action.id}
                    size="small"
                    onClick={() => {
                      if (action.onClick) action.onClick(entity);
                      if (action.closeAfterClick !== false) closePanel();
                    }}
                    sx={{
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'rgba(46, 178, 62, 0.1)' }
                    }}
                  >
                    {action.icon}
                  </IconButton>
                ))}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  ) : null;

  return (
    <ActionPanelContext.Provider value={value}>
      {children}
      {drawerContent ? createPortal(drawerContent, document.body) : null}
    </ActionPanelContext.Provider>
  );
};
